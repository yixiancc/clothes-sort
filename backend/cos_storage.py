import os
import time
import uuid
from threading import Lock

from qcloud_cos import CosConfig, CosS3Client

ALLOWED_EXT = {"jpg", "jpeg", "png", "gif", "webp", "bmp"}

_client = None

# 签名 URL 缓存：key -> (url, 过期时间戳)。签名默认 2 小时有效，缓存 1.5 小时。
_url_cache = {}
_url_lock = Lock()
_CACHE_TTL = 5400  # 1.5 小时，预留 0.5 小时缓冲


def _get_client(app):
    global _client
    if _client is None:
        config = CosConfig(
            Region=app.config["COS_REGION"],
            SecretId=app.config["COS_SECRET_ID"],
            SecretKey=app.config["COS_SECRET_KEY"],
        )
        _client = CosS3Client(config)
    return _client


def save_image(app, file_storage):
    """上传图片到 COS，返回对象 key；格式不支持时返回 None"""
    filename = file_storage.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXT:
        return None
    key = f"clothes/{uuid.uuid4().hex}.{ext}"
    _get_client(app).put_object(
        Bucket=app.config["COS_BUCKET"],
        Body=file_storage.stream,
        Key=key,
        ContentType=file_storage.mimetype or f"image/{ext}",
    )
    return key


def delete_image(app, key):
    if not key:
        return
    try:
        _get_client(app).delete_object(Bucket=app.config["COS_BUCKET"], Key=key)
    except Exception:
        pass  # 对象可能已不存在


def get_image_url(app, key, expires=7200):
    """生成私有读签名 URL，默认 2 小时有效；结果按 key 缓存 1.5 小时，避免每次列表重复计算"""
    if not key:
        return ""
    now = time.time()
    with _url_lock:
        cached = _url_cache.get(key)
        if cached and cached[1] > now:
            return cached[0]
    url = _get_client(app).get_presigned_url(
        Method="GET",
        Bucket=app.config["COS_BUCKET"],
        Key=key,
        Expired=expires,
    )
    with _url_lock:
        _url_cache[key] = (url, now + _CACHE_TTL)
        # 简单防内存膨胀：缓存过多时清理过期项
        if len(_url_cache) > 2000:
            for k in [k for k, v in _url_cache.items() if v[1] <= now]:
                _url_cache.pop(k, None)
    return url
