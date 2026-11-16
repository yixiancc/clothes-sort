import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "clothes_sort_mysql")

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)  # token 有效期 1 个月

    # 腾讯云 COS
    COS_SECRET_ID = os.getenv("COS_SECRET_ID", "")
    COS_SECRET_KEY = os.getenv("COS_SECRET_KEY", "")
    COS_BUCKET = os.getenv("COS_BUCKET", "")
    COS_REGION = os.getenv("COS_REGION", "")
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 单文件最大 20MB
