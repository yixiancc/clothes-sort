from calendar import monthrange
from datetime import date

from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from cos_storage import get_image_url
from models import Clothes, WearLog, db
from timeutil import today_cn
from utils import ok, fail, current_user, parse_day, clothes_dict

bp = Blueprint("wear", __name__, url_prefix="/api")

HISTORY_LIMIT = 90  # 单件衣服的穿着历史最多返回最近 90 条


def _own_clothes(cid, user):
    return Clothes.query.filter_by(id=cid, user_id=user.id).first()


def _day_text(day):
    return "今天" if day == today_cn() else day.strftime("%Y-%m-%d")


@bp.post("/clothes/<int:cid>/wear")
@jwt_required()
def wear_clothes(cid):
    """记录「这件衣服某天穿过」。body: {date?: "YYYY-MM-DD"}，省略 = 今天（北京时间）。
    同一件衣服同一天重复记录是幂等的（只算一次）。"""
    user = current_user()
    clothes = _own_clothes(cid, user)
    if not clothes:
        return fail("衣服不存在", 404)
    day, err = parse_day((request.get_json(silent=True) or {}).get("date"))
    if err:
        return fail(err)

    if not WearLog.query.filter_by(clothes_id=cid, worn_on=day).first():
        db.session.add(WearLog(user_id=user.id, clothes_id=cid, worn_on=day))
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()  # 并发重复点击：唯一约束兜底，结果等同于已记录
    return ok(clothes_dict(clothes), f"已记录{_day_text(day)}穿过")


@bp.delete("/clothes/<int:cid>/wear")
@jwt_required()
def unwear_clothes(cid):
    """撤销某天的穿着记录。?date=YYYY-MM-DD，省略 = 今天。"""
    user = current_user()
    clothes = _own_clothes(cid, user)
    if not clothes:
        return fail("衣服不存在", 404)
    day, err = parse_day(request.args.get("date"))
    if err:
        return fail(err)
    WearLog.query.filter_by(clothes_id=cid, user_id=user.id, worn_on=day).delete()
    db.session.commit()
    return ok(clothes_dict(clothes), "已撤销")


@bp.get("/clothes/<int:cid>/wear")
@jwt_required()
def wear_history(cid):
    """这件衣服的穿着历史：{total, dates: [最近的在前]}"""
    user = current_user()
    clothes = _own_clothes(cid, user)
    if not clothes:
        return fail("衣服不存在", 404)
    q = WearLog.query.filter_by(clothes_id=cid, user_id=user.id)
    total = q.count()
    logs = q.order_by(WearLog.worn_on.desc()).limit(HISTORY_LIMIT).all()
    return ok({"total": total, "dates": [x.worn_on.strftime("%Y-%m-%d") for x in logs]})


@bp.get("/wear/calendar")
@jwt_required()
def wear_calendar():
    """某个月的穿着日历。?month=YYYY-MM，省略 = 本月（北京时间）。
    返回 days 为「日期 -> 当天穿过的衣服列表」的字典，没有记录的日期不出现。"""
    user = current_user()
    today = today_cn()
    raw = (request.args.get("month") or "").strip()
    if raw:
        try:
            year, month = (int(x) for x in raw.split("-"))
            first = date(year, month, 1)
        except (ValueError, TypeError):
            return fail("月份格式应为 YYYY-MM")
    else:
        first = date(today.year, today.month, 1)
    last = date(first.year, first.month, monthrange(first.year, first.month)[1])

    logs = (WearLog.query
            .options(selectinload(WearLog.clothes), selectinload(WearLog.outfit))
            .filter(WearLog.user_id == user.id, WearLog.worn_on >= first, WearLog.worn_on <= last)
            .order_by(WearLog.worn_on, WearLog.id).all())

    days = {}
    for log in logs:
        c = log.clothes
        if not c:
            continue
        days.setdefault(log.worn_on.strftime("%Y-%m-%d"), []).append({
            "clothes_id": c.id,
            "name": c.name,
            "image_url": get_image_url(current_app, c.image),
            "outfit_id": log.outfit_id,
            "outfit_name": log.outfit.name if log.outfit else None,
        })
    return ok({
        "month": first.strftime("%Y-%m"),
        "today": today.strftime("%Y-%m-%d"),
        "days": days,
        "worn_days": len(days),
        "total_logs": len(logs),
    })
