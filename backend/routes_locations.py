from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from models import Clothes, Location, db
from utils import ok, fail, current_user

bp = Blueprint("locations", __name__, url_prefix="/api/locations")


@bp.get("")
@jwt_required()
def list_locations():
    user = current_user()
    locs = Location.query.filter_by(user_id=user.id).order_by(Location.id).all()
    return ok([l.to_dict() for l in locs])


@bp.post("")
@jwt_required()
def create_location():
    user = current_user()
    name = ((request.get_json(silent=True) or {}).get("name") or "").strip()
    if not name:
        return fail("位置名不能为空")
    if Location.query.filter_by(user_id=user.id, name=name).first():
        return fail("位置已存在")
    loc = Location(user_id=user.id, name=name)
    db.session.add(loc)
    db.session.commit()
    return ok(loc.to_dict(), "创建成功")


@bp.put("/<int:lid>")
@jwt_required()
def update_location(lid):
    user = current_user()
    loc = Location.query.filter_by(id=lid, user_id=user.id).first()
    if not loc:
        return fail("位置不存在", 404)
    name = ((request.get_json(silent=True) or {}).get("name") or "").strip()
    if not name:
        return fail("位置名不能为空")
    if Location.query.filter(Location.user_id == user.id, Location.name == name,
                             Location.id != lid).first():
        return fail("位置已存在")
    loc.name = name
    db.session.commit()
    return ok(loc.to_dict(), "修改成功")


@bp.delete("/<int:lid>")
@jwt_required()
def delete_location(lid):
    user = current_user()
    loc = Location.query.filter_by(id=lid, user_id=user.id).first()
    if not loc:
        return fail("位置不存在", 404)
    # 该位置下的衣服归为"未设置位置"
    Clothes.query.filter_by(user_id=user.id, location_id=lid).update({"location_id": None})
    db.session.delete(loc)
    db.session.commit()
    return ok(message="删除成功")
