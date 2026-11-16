import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from models import db


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    JWTManager(app)
    # CORS 收敛：只允许网页端域名（小程序不受 CORS 约束，走的是公众平台合法域名）
    CORS(app, origins=[
        "https://clothessort.yixianluoshui.top",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ])

    from routes_auth import bp as auth_bp
    from routes_categories import bp as categories_bp
    from routes_locations import bp as locations_bp
    from routes_clothes import bp as clothes_bp
    from routes_admin import bp as admin_bp
    from routes_outfits import bp as outfits_bp
    from routes_wear import bp as wear_bp
    from routes_stats import bp as stats_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(locations_bp)
    app.register_blueprint(clothes_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(outfits_bp)
    app.register_blueprint(wear_bp)
    app.register_blueprint(stats_bp)

    @app.errorhandler(413)
    def too_large(_):
        return jsonify({"code": 1, "message": "文件过大，最大支持 20MB"}), 413

    @app.get("/api/health")
    def health():
        return {"code": 0, "message": "ok"}

    with app.app_context():
        try:
            db.create_all()  # 表不存在时自动创建（正式环境以 database.sql 为准）
        except Exception as e:  # 建表失败（如账号无 CREATE 权限）不应让整个服务起不来
            app.logger.error("db.create_all() 失败：%s —— 新功能（搭配/穿着记录）的表可能没建好，"
                             "请在数据库执行 database.sql 里对应的 CREATE TABLE 语句", e)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=18888, debug=False)
