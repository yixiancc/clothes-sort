import functools
from datetime import datetime

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import func

from models import User, WearLog, db
from timeutil import today_cn


def wear_map(ids=None, user_id=None):
    """批量统计穿着情况，返回 {clothes_id: (穿着天数, 最近穿着日期)}。
    传 ids 则只统计这些衣服；传 user_id 则统计该用户全部衣服（避免超长 IN 列表）。"""
    q = db.session.query(WearLog.clothes_id, func.count(WearLog.id), func.max(WearLog.worn_on))
    if ids is not None:
        if not ids:
            return {}
        q = q.filter(WearLog.clothes_id.in_(ids))
    if user_id is not None:
        q = q.filter(WearLog.user_id == user_id)
    return {cid: (cnt, last) for cid, cnt, last in q.group_by(WearLog.clothes_id).all()}


def clothes_dict(c):
    """单件衣服的完整信息（含穿着统计）"""
    return c.to_dict(wear=wear_map([c.id]).get(c.id, (0, None)))


def outfit_wear_map(ids):
    """批量统计搭配被穿情况，返回 {outfit_id: (穿着天数, 最近穿着日期)}"""
    if not ids:
        return {}
    rows = (db.session.query(WearLog.outfit_id, func.count(func.distinct(WearLog.worn_on)),
                             func.max(WearLog.worn_on))
            .filter(WearLog.outfit_id.in_(ids))
            .group_by(WearLog.outfit_id).all())
    return {oid: (cnt, last) for oid, cnt, last in rows}


def cleanup_empty_outfits(user_id):
    """衣服被删除后，没有任何衣服的搭配没有意义，一并清掉（其穿着记录保留，只解除搭配关联）"""
    from models import Outfit
    empties = Outfit.query.filter(Outfit.user_id == user_id, ~Outfit.items.any()).all()
    for o in empties:
        WearLog.query.filter_by(outfit_id=o.id).update({"outfit_id": None})
        db.session.delete(o)
    if empties:
        db.session.commit()


def parse_day(raw):
    """解析 YYYY-MM-DD；为空则取今天（北京时间）。返回 (date, 错误信息)。不允许记录未来的日期。"""
    if raw in (None, ""):
        return today_cn(), None
    try:
        day = datetime.strptime(str(raw).strip(), "%Y-%m-%d").date()
    except ValueError:
        return None, "日期格式应为 YYYY-MM-DD"
    if day > today_cn():
        return None, "不能记录未来的日期"
    return day, None


def parse_id_list(raw, limit=100):
    """把 JSON 数组（如 [1, "2", 2]）解析为去重且保持顺序的 int 列表；非数组返回空列表"""
    if not isinstance(raw, list):
        return []
    ids = []
    for x in raw[:limit]:
        if isinstance(x, bool):
            continue
        try:
            n = int(x)
        except (TypeError, ValueError):
            continue
        if n > 0 and n not in ids:
            ids.append(n)
    return ids


def ok(data=None, message="success"):
    return jsonify({"code": 0, "message": message, "data": data})


def fail(message, http_code=400):
    return jsonify({"code": 1, "message": message}), http_code


def current_user():
    uid = int(get_jwt_identity())
    return User.query.get(uid)


def admin_required(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = current_user()
        if not user or not user.is_admin:
            return fail("需要管理员权限", 403)
        return fn(*args, **kwargs)

    return wrapper
