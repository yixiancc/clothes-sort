import os
import time
import uuid
from collections import defaultdict
from threading import Lock

from flask import Blueprint, request
from flask_jwt_extended import create_access_token, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from captcha import new_captcha, verify_captcha
from models import User, db
from utils import ok, fail, current_user

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# ---------- 登录防刷：同一 用户名+IP 连续失败 5 次，锁定 10 分钟 ----------
_MAX_FAILS = 5
_LOCK_SECONDS = 600
_fail_records = defaultdict(list)  # key -> [失败时间戳...]
_fail_lock = Lock()


def _client_key(username):
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
    return f"{username}|{ip}"


def _is_locked(key):
    now = time.time()
    with _fail_lock:
        recs = [t for t in _fail_records.get(key, []) if now - t < _LOCK_SECONDS]
        _fail_records[key] = recs
        return len(recs) >= _MAX_FAILS


def _record_fail(key):
    now = time.time()
    with _fail_lock:
        recs = [t for t in _fail_records.get(key, []) if now - t < _LOCK_SECONDS]
        recs.append(now)
        _fail_records[key] = recs


def _clear_fails(key):
    with _fail_lock:
        _fail_records.pop(key, None)


@bp.get("/captcha")
def captcha():
    captcha_id, image = new_captcha()
    return ok({"captcha_id": captcha_id, "image": image})


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    nickname = (data.get("nickname") or "").strip() or username

    if not verify_captcha(data.get("captcha_id"), data.get("captcha_code")):
        return fail("验证码错误或已过期")

    if not username or not password:
        return fail("用户名和密码不能为空")
    if len(username) > 50 or len(password) < 6:
        return fail("用户名最长50字符，密码至少6位")
    if User.query.filter_by(username=username).first():
        return fail("用户名已存在")

    user = User(username=username, nickname=nickname,
                password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    return ok(message="注册成功，请等待管理员审核通过后再登录")


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    key = _client_key(username)
    if _is_locked(key):
        return fail("失败次数过多，账号已锁定，请10分钟后再试", 429)

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password_hash, password):
        _record_fail(key)
        return fail("用户名或密码错误", 401)
    if not user.is_approved:
        return fail("账号审核中，请等待管理员通过后再登录", 403)

    _clear_fails(key)  # 登录成功清除失败记录
    token = create_access_token(identity=str(user.id))
    return ok({"token": token, "user": user.to_dict()}, "登录成功")


@bp.get("/profile")
@jwt_required()
def get_profile():
    return ok(current_user().to_dict())


@bp.put("/profile")
@jwt_required()
def update_profile():
    user = current_user()
    data = request.get_json(silent=True) or {}

    new_username = (data.get("username") or "").strip()
    if new_username and new_username != user.username:
        if User.query.filter(User.username == new_username, User.id != user.id).first():
            return fail("用户名已存在")
        user.username = new_username

    nickname = (data.get("nickname") or "").strip()
    if nickname:
        user.nickname = nickname

    old_password = data.get("old_password") or ""
    new_password = data.get("new_password") or ""
    if new_password:
        if not check_password_hash(user.password_hash, old_password):
            return fail("原密码错误")
        if len(new_password) < 6:
            return fail("新密码至少6位")
        user.password_hash = generate_password_hash(new_password)

    db.session.commit()
    return ok(user.to_dict(), "修改成功")
