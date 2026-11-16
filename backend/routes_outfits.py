from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from models import Clothes, Outfit, OutfitItem, WearLog, db
from utils import ok, fail, current_user, parse_day, parse_id_list, outfit_wear_map

bp = Blueprint("outfits", __name__, url_prefix="/api/outfits")

MIN_ITEMS = 2
MAX_ITEMS = 8
LIST_LIMIT = 200


def _own_outfit(oid, user):
    return Outfit.query.filter_by(id=oid, user_id=user.id).first()


def _outfit_dict(o):
    return o.to_dict(wear=outfit_wear_map([o.id]).get(o.id, (0, None)))


def _validate_ids(raw, user):
    """校验 clothes_ids：数量在 2~8 之间，且全部属于当前用户。返回 (ids, 错误信息)"""
    ids = parse_id_list(raw, limit=MAX_ITEMS + 1)
    if len(ids) < MIN_ITEMS:
        return None, f"一套搭配至少需要 {MIN_ITEMS} 件衣服"
    if len(ids) > MAX_ITEMS:
        return None, f"一套搭配最多 {MAX_ITEMS} 件衣服"
    owned = Clothes.query.filter(Clothes.user_id == user.id, Clothes.id.in_(ids)).count()
    if owned != len(ids):
        return None, "包含不存在的衣服"
    return ids, None


@bp.get("")
@jwt_required()
def list_outfits():
    user = current_user()
    outfits = (Outfit.query
               .options(selectinload(Outfit.items).selectinload(OutfitItem.clothes).selectinload(Clothes.category))
               .filter_by(user_id=user.id)
               .order_by(Outfit.id.desc()).limit(LIST_LIMIT).all())
    wmap = outfit_wear_map([o.id for o in outfits])
    return ok([o.to_dict(wear=wmap.get(o.id, (0, None))) for o in outfits])


@bp.post("")
@jwt_required()
def create_outfit():
    user = current_user()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    note = (data.get("note") or "").strip()
    if not name:
        return fail("搭配名称不能为空")
    if len(name) > 50:
        return fail("搭配名称最长 50 个字")
    if len(note) > 200:
        return fail("备注最长 200 个字")
    ids, err = _validate_ids(data.get("clothes_ids"), user)
    if err:
        return fail(err)

    outfit = Outfit(user_id=user.id, name=name, note=note)
    outfit.items = [OutfitItem(clothes_id=cid, seq=i) for i, cid in enumerate(ids)]
    db.session.add(outfit)
    db.session.commit()
    return ok(_outfit_dict(outfit), "搭配已保存")


@bp.get("/<int:oid>")
@jwt_required()
def get_outfit(oid):
    outfit = _own_outfit(oid, current_user())
    if not outfit:
        return fail("搭配不存在", 404)
    return ok(_outfit_dict(outfit))


@bp.put("/<int:oid>")
@jwt_required()
def update_outfit(oid):
    user = current_user()
    outfit = _own_outfit(oid, user)
    if not outfit:
        return fail("搭配不存在", 404)
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return fail("搭配名称不能为空")
        if len(name) > 50:
            return fail("搭配名称最长 50 个字")
        outfit.name = name
    if "note" in data:
        note = (data.get("note") or "").strip()
        if len(note) > 200:
            return fail("备注最长 200 个字")
        outfit.note = note
    if "clothes_ids" in data:
        ids, err = _validate_ids(data.get("clothes_ids"), user)
        if err:
            return fail(err)
        # 按差异更新：保留仍在搭配里的行，只改顺序；删除被移除的；新增新加的
        existing = {it.clothes_id: it for it in outfit.items}
        for idx, cid in enumerate(ids):
            if cid in existing:
                existing[cid].seq = idx
            else:
                db.session.add(OutfitItem(outfit_id=outfit.id, clothes_id=cid, seq=idx))
        for cid, it in existing.items():
            if cid not in ids:
                db.session.delete(it)

    db.session.commit()
    db.session.refresh(outfit)
    return ok(_outfit_dict(outfit), "修改成功")


@bp.delete("/<int:oid>")
@jwt_required()
def delete_outfit(oid):
    user = current_user()
    outfit = _own_outfit(oid, user)
    if not outfit:
        return fail("搭配不存在", 404)
    # 穿着记录是历史，保留；只解除与这套搭配的关联
    WearLog.query.filter_by(outfit_id=outfit.id).update({"outfit_id": None})
    db.session.delete(outfit)
    db.session.commit()
    return ok(message="删除成功")


@bp.post("/<int:oid>/wear")
@jwt_required()
def wear_outfit(oid):
    """记录「某天穿了这套搭配」：为搭配里的每件衣服各记一条穿着记录。
    body: {date?: "YYYY-MM-DD"}，省略 = 今天。同一天重复记录是幂等的。
    若某件衣服当天已有记录（单独记过或属于另一套搭配），把它归到这套搭配名下（后记录的为准）。"""
    user = current_user()
    outfit = _own_outfit(oid, user)
    if not outfit:
        return fail("搭配不存在", 404)
    day, err = parse_day((request.get_json(silent=True) or {}).get("date"))
    if err:
        return fail(err)

    cids = [it.clothes_id for it in outfit.items]
    if not cids:
        return fail("这套搭配里没有衣服")
    existing = {x.clothes_id: x for x in
                WearLog.query.filter(WearLog.user_id == user.id, WearLog.worn_on == day,
                                     WearLog.clothes_id.in_(cids)).all()}
    for cid in cids:
        log = existing.get(cid)
        if log:
            log.outfit_id = outfit.id
        else:
            db.session.add(WearLog(user_id=user.id, clothes_id=cid, outfit_id=outfit.id, worn_on=day))
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()  # 并发重复点击：唯一约束兜底
        return fail("操作太快了，请重试", 409)
    return ok(_outfit_dict(outfit), "已记录穿着")


@bp.delete("/<int:oid>/wear")
@jwt_required()
def unwear_outfit(oid):
    """撤销某天这套搭配的穿着记录。?date=YYYY-MM-DD，省略 = 今天。"""
    user = current_user()
    outfit = _own_outfit(oid, user)
    if not outfit:
        return fail("搭配不存在", 404)
    day, err = parse_day(request.args.get("date"))
    if err:
        return fail(err)
    WearLog.query.filter_by(user_id=user.id, outfit_id=outfit.id, worn_on=day).delete()
    db.session.commit()
    return ok(_outfit_dict(outfit), "已撤销")
