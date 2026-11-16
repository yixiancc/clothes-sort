from datetime import timedelta

from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload

from cos_storage import delete_image as cos_delete, save_image as cos_save
from models import Category, Clothes, Location, WearLog, db
from timeutil import STALE_DAYS, today_cn
from utils import ok, fail, current_user, clothes_dict, cleanup_empty_outfits

bp = Blueprint("clothes", __name__, url_prefix="/api")

# 列表排序：newest 最新添加(默认) / oldest 最早添加 / name 按名称 /
#          wear_desc 穿得最多 / wear_asc 穿得最少 / recent 最近穿过 / stale 最久没穿
SORTS = ("newest", "oldest", "name", "wear_desc", "wear_asc", "recent", "stale")


def _save_image(file):
    return cos_save(current_app, file)


def _delete_image(key):
    cos_delete(current_app, key)


def _parse_seasons(raw):
    if isinstance(raw, list):
        items = raw
    else:
        items = (raw or "").split(",")
    return ",".join([s for s in items if s in Clothes.SEASONS])


def _parse_ids(raw):
    """把 '1,2,3' 解析为 int 列表，忽略非法值"""
    ids = []
    for part in (raw or "").split(","):
        part = part.strip()
        if part.isdigit():
            ids.append(int(part))
    return ids


@bp.get("/clothes")
@jwt_required()
def list_clothes():
    user = current_user()
    keyword = (request.args.get("keyword") or "").strip()
    category_ids = _parse_ids(request.args.get("category_id"))
    location_ids = _parse_ids(request.args.get("location_id"))
    seasons = [s for s in (request.args.get("season") or "").split(",") if s in Clothes.SEASONS]
    page = max(request.args.get("page", 1, type=int), 1)
    page_size = min(max(request.args.get("page_size", 20, type=int), 1), 100)
    sort = request.args.get("sort") or "newest"
    if sort not in SORTS:
        sort = "newest"
    stale_only = (request.args.get("stale") or "") in ("1", "true")

    # 每件衣服的穿着统计（穿着天数 / 最近穿着日），左连接：没穿过的为 NULL
    wear_sq = (db.session.query(WearLog.clothes_id.label("w_clothes_id"),
                                func.count(WearLog.id).label("w_days"),
                                func.max(WearLog.worn_on).label("w_last_day"))
               .filter(WearLog.user_id == user.id)
               .group_by(WearLog.clothes_id).subquery())
    w_days = wear_sq.c.w_days
    w_last = wear_sq.c.w_last_day
    cnt = func.coalesce(w_days, 0)
    # 「好久没穿」的参考日：最近穿着日；从没穿过的用入库日
    ref = func.coalesce(w_last, func.date(Clothes.created_at))

    query = (db.session.query(Clothes, w_days, w_last)
             .outerjoin(wear_sq, wear_sq.c.w_clothes_id == Clothes.id)
             .options(selectinload(Clothes.category), selectinload(Clothes.location))
             .filter(Clothes.user_id == user.id))
    if keyword:
        query = query.filter(Clothes.name.like(f"%{keyword}%"))
    if category_ids:
        query = query.filter(Clothes.category_id.in_(category_ids))
    if location_ids:
        query = query.filter(Clothes.location_id.in_(location_ids))
    # 季节：多选时取「包含任一所选季节」的衣服
    if seasons:
        query = query.filter(or_(*[Clothes.seasons.like(f"%{s}%") for s in seasons]))
    if stale_only:
        query = query.filter(ref < today_cn() - timedelta(days=STALE_DAYS))

    order = {
        "newest": [Clothes.id.desc()],
        "oldest": [Clothes.id.asc()],
        "name": [Clothes.name.asc(), Clothes.id.desc()],
        # 次数相同时，最近穿过的在前（与统计页「最常穿」口径一致）；从没穿过的 w_last 都是 NULL，再按 id 倒序
        "wear_desc": [cnt.desc(), w_last.desc(), Clothes.id.desc()],
        "wear_asc": [cnt.asc(), Clothes.id.desc()],
        "recent": [w_last.is_(None), w_last.desc(), Clothes.id.desc()],
        "stale": [ref.asc(), Clothes.id.asc()],
    }[sort]

    total = query.order_by(None).count()
    rows = query.order_by(*order).offset((page - 1) * page_size).limit(page_size).all()
    return ok({
        "items": [c.to_dict(wear=(n, last)) for c, n, last in rows],
        "total": total,
        "page": page,
        "has_more": page * page_size < total,
    })


@bp.post("/clothes")
@jwt_required()
def create_clothes():
    user = current_user()
    name = (request.form.get("name") or "").strip()
    if not name:
        return fail("衣服名称不能为空")

    category_id = request.form.get("category_id", type=int) or None
    if category_id and not Category.query.filter_by(id=category_id, user_id=user.id).first():
        return fail("分类不存在")

    location_id = request.form.get("location_id", type=int) or None
    if location_id and not Location.query.filter_by(id=location_id, user_id=user.id).first():
        return fail("位置不存在")

    file = request.files.get("image")
    if not file or not file.filename:
        return fail("请上传图片")
    filename = _save_image(file)
    if not filename:
        return fail("不支持的图片格式")

    clothes = Clothes(
        user_id=user.id,
        name=name,
        category_id=category_id,
        location_id=location_id,
        seasons=_parse_seasons(request.form.get("seasons")),
        image=filename,
    )
    db.session.add(clothes)
    db.session.commit()
    return ok(clothes_dict(clothes), "添加成功")


@bp.get("/clothes/<int:cid>")
@jwt_required()
def get_clothes(cid):
    user = current_user()
    clothes = Clothes.query.filter_by(id=cid, user_id=user.id).first()
    if not clothes:
        return fail("衣服不存在", 404)
    return ok(clothes_dict(clothes))


@bp.put("/clothes/<int:cid>")
@jwt_required()
def update_clothes(cid):
    user = current_user()
    clothes = Clothes.query.filter_by(id=cid, user_id=user.id).first()
    if not clothes:
        return fail("衣服不存在", 404)

    name = (request.form.get("name") or "").strip()
    if name:
        clothes.name = name

    if "category_id" in request.form:
        category_id = request.form.get("category_id", type=int) or None
        if category_id and not Category.query.filter_by(id=category_id, user_id=user.id).first():
            return fail("分类不存在")
        clothes.category_id = category_id

    if "location_id" in request.form:
        location_id = request.form.get("location_id", type=int) or None
        if location_id and not Location.query.filter_by(id=location_id, user_id=user.id).first():
            return fail("位置不存在")
        clothes.location_id = location_id

    if "seasons" in request.form:
        clothes.seasons = _parse_seasons(request.form.get("seasons"))

    file = request.files.get("image")
    if file and file.filename:
        filename = _save_image(file)
        if not filename:
            return fail("不支持的图片格式")
        _delete_image(clothes.image)
        clothes.image = filename

    db.session.commit()
    return ok(clothes_dict(clothes), "修改成功")


@bp.delete("/clothes/<int:cid>")
@jwt_required()
def delete_clothes(cid):
    user = current_user()
    clothes = Clothes.query.filter_by(id=cid, user_id=user.id).first()
    if not clothes:
        return fail("衣服不存在", 404)
    _delete_image(clothes.image)
    db.session.delete(clothes)  # ORM 级联清理它的穿着记录和搭配关联
    db.session.commit()
    cleanup_empty_outfits(user.id)  # 搭配里的衣服全没了，搭配也就没有意义了
    return ok(message="删除成功")
