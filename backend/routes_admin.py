from flask import Blueprint, current_app, request
from werkzeug.security import generate_password_hash

from cos_storage import delete_image as cos_delete, save_image as cos_save
from models import Category, Clothes, Location, User, db
from utils import ok, fail, admin_required, cleanup_empty_outfits

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@bp.get("/users")
@admin_required
def list_users():
    keyword = (request.args.get("keyword") or "").strip()
    query = User.query
    if keyword:
        query = query.filter(User.username.like(f"%{keyword}%") |
                             User.nickname.like(f"%{keyword}%"))
    users = query.order_by(User.id).all()
    return ok([u.to_dict() for u in users])


@bp.get("/users/<int:uid>/clothes")
@admin_required
def user_clothes(uid):
    user = User.query.get(uid)
    if not user:
        return fail("用户不存在", 404)
    items = Clothes.query.filter_by(user_id=uid).order_by(Clothes.id.desc()).all()
    return ok([c.to_dict() for c in items])


@bp.post("/users")
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    nickname = (data.get("nickname") or "").strip() or username
    is_admin = bool(data.get("is_admin"))

    if not username or not password:
        return fail("用户名和密码不能为空")
    if User.query.filter_by(username=username).first():
        return fail("用户名已存在")

    user = User(username=username, nickname=nickname, is_admin=is_admin,
                is_approved=True,  # 管理员直接创建的用户免审核
                password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    return ok(user.to_dict(), "创建成功")


@bp.put("/users/<int:uid>/approve")
@admin_required
def approve_user(uid):
    user = User.query.get(uid)
    if not user:
        return fail("用户不存在", 404)
    if user.is_approved:
        return fail("该用户已通过审核")
    user.is_approved = True
    db.session.commit()
    return ok(user.to_dict(), "已通过审核")


@bp.put("/users/<int:uid>")
@admin_required
def update_user(uid):
    user = User.query.get(uid)
    if not user:
        return fail("用户不存在", 404)
    data = request.get_json(silent=True) or {}

    new_username = (data.get("username") or "").strip()
    if new_username and new_username != user.username:
        if User.query.filter(User.username == new_username, User.id != uid).first():
            return fail("用户名已存在")
        user.username = new_username

    nickname = (data.get("nickname") or "").strip()
    if nickname:
        user.nickname = nickname

    if "is_admin" in data:
        user.is_admin = bool(data.get("is_admin"))

    new_password = data.get("new_password") or ""
    if new_password:
        if len(new_password) < 6:
            return fail("新密码至少6位")
        user.password_hash = generate_password_hash(new_password)

    db.session.commit()
    return ok(user.to_dict(), "修改成功")


@bp.delete("/users/<int:uid>")
@admin_required
def delete_user(uid):
    from flask_jwt_extended import get_jwt_identity
    if int(get_jwt_identity()) == uid:
        return fail("不能删除自己的账号")
    user = User.query.get(uid)
    if not user:
        return fail("用户不存在", 404)
    db.session.delete(user)  # 级联删除其分类和衣服
    db.session.commit()
    return ok(message="删除成功")


# ---------- 管理员管理用户的分类/位置/衣服 ----------

@bp.get("/users/<int:uid>/categories")
@admin_required
def user_categories(uid):
    if not User.query.get(uid):
        return fail("用户不存在", 404)
    items = Category.query.filter_by(user_id=uid).order_by(Category.id).all()
    return ok([c.to_dict() for c in items])


@bp.post("/users/<int:uid>/categories")
@admin_required
def create_user_category(uid):
    if not User.query.get(uid):
        return fail("用户不存在", 404)
    name = (request.get_json(silent=True) or {}).get("name", "").strip()
    if not name:
        return fail("名称不能为空")
    if Category.query.filter_by(user_id=uid, name=name).first():
        return fail("该分类已存在")
    item = Category(user_id=uid, name=name)
    db.session.add(item)
    db.session.commit()
    return ok(item.to_dict(), "创建成功")


@bp.get("/users/<int:uid>/locations")
@admin_required
def user_locations(uid):
    if not User.query.get(uid):
        return fail("用户不存在", 404)
    items = Location.query.filter_by(user_id=uid).order_by(Location.id).all()
    return ok([l.to_dict() for l in items])


@bp.post("/users/<int:uid>/locations")
@admin_required
def create_user_location(uid):
    if not User.query.get(uid):
        return fail("用户不存在", 404)
    name = (request.get_json(silent=True) or {}).get("name", "").strip()
    if not name:
        return fail("名称不能为空")
    if Location.query.filter_by(user_id=uid, name=name).first():
        return fail("该位置已存在")
    item = Location(user_id=uid, name=name)
    db.session.add(item)
    db.session.commit()
    return ok(item.to_dict(), "创建成功")


def _parse_seasons(raw):
    items = (raw or "").split(",")
    return ",".join([s for s in items if s in Clothes.SEASONS])


@bp.put("/clothes/<int:cid>")
@admin_required
def admin_update_clothes(cid):
    clothes = Clothes.query.get(cid)
    if not clothes:
        return fail("衣服不存在", 404)
    owner_id = clothes.user_id

    name = (request.form.get("name") or "").strip()
    if name:
        clothes.name = name

    if "category_id" in request.form:
        category_id = request.form.get("category_id", type=int) or None
        if category_id and not Category.query.filter_by(id=category_id, user_id=owner_id).first():
            return fail("分类不存在")
        clothes.category_id = category_id

    if "location_id" in request.form:
        location_id = request.form.get("location_id", type=int) or None
        if location_id and not Location.query.filter_by(id=location_id, user_id=owner_id).first():
            return fail("位置不存在")
        clothes.location_id = location_id

    if "seasons" in request.form:
        clothes.seasons = _parse_seasons(request.form.get("seasons"))

    file = request.files.get("image")
    if file and file.filename:
        filename = cos_save(current_app, file)
        if not filename:
            return fail("不支持的图片格式")
        cos_delete(current_app, clothes.image)
        clothes.image = filename

    db.session.commit()
    return ok(clothes.to_dict(), "修改成功")


@bp.delete("/clothes/<int:cid>")
@admin_required
def admin_delete_clothes(cid):
    clothes = Clothes.query.get(cid)
    if not clothes:
        return fail("衣服不存在", 404)
    owner_id = clothes.user_id
    cos_delete(current_app, clothes.image)
    db.session.delete(clothes)  # ORM 级联清理穿着记录和搭配关联
    db.session.commit()
    cleanup_empty_outfits(owner_id)
    return ok(message="删除成功")
