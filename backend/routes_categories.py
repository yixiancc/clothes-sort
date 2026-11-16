from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from models import Category, Clothes, db
from utils import ok, fail, current_user

bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@bp.get("")
@jwt_required()
def list_categories():
    user = current_user()
    cats = Category.query.filter_by(user_id=user.id).order_by(Category.id).all()
    return ok([c.to_dict() for c in cats])


@bp.post("")
@jwt_required()
def create_category():
    user = current_user()
    name = ((request.get_json(silent=True) or {}).get("name") or "").strip()
    if not name:
        return fail("分类名不能为空")
    if Category.query.filter_by(user_id=user.id, name=name).first():
        return fail("分类已存在")
    cat = Category(user_id=user.id, name=name)
    db.session.add(cat)
    db.session.commit()
    return ok(cat.to_dict(), "创建成功")


@bp.put("/<int:cid>")
@jwt_required()
def update_category(cid):
    user = current_user()
    cat = Category.query.filter_by(id=cid, user_id=user.id).first()
    if not cat:
        return fail("分类不存在", 404)
    name = ((request.get_json(silent=True) or {}).get("name") or "").strip()
    if not name:
        return fail("分类名不能为空")
    if Category.query.filter(Category.user_id == user.id, Category.name == name,
                             Category.id != cid).first():
        return fail("分类已存在")
    cat.name = name
    db.session.commit()
    return ok(cat.to_dict(), "修改成功")


@bp.delete("/<int:cid>")
@jwt_required()
def delete_category(cid):
    user = current_user()
    cat = Category.query.filter_by(id=cid, user_id=user.id).first()
    if not cat:
        return fail("分类不存在", 404)
    # 该分类下的衣服归为"未分类"
    Clothes.query.filter_by(user_id=user.id, category_id=cid).update({"category_id": None})
    db.session.delete(cat)
    db.session.commit()
    return ok(message="删除成功")
