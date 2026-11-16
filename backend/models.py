from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

from timeutil import today_cn

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False, comment="登录用户名")
    nickname = db.Column(db.String(50), nullable=False, default="", comment="显示名字")
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, nullable=False, default=False)
    is_approved = db.Column(db.Boolean, nullable=False, default=False, comment="管理员审核通过后才能登录")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    categories = db.relationship("Category", backref="user", cascade="all, delete-orphan")
    locations = db.relationship("Location", backref="user", cascade="all, delete-orphan")
    clothes = db.relationship("Clothes", backref="user", cascade="all, delete-orphan")
    outfits = db.relationship("Outfit", backref="user", cascade="all, delete-orphan")
    wear_logs = db.relationship("WearLog", backref="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "nickname": self.nickname,
            "is_admin": self.is_admin,
            "is_approved": self.is_approved,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "clothes_count": len(self.clothes),
        }


class Category(db.Model):
    __tablename__ = "categories"
    __table_args__ = (db.UniqueConstraint("user_id", "name", name="uq_user_category"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "name": self.name}


class Location(db.Model):
    __tablename__ = "locations"
    __table_args__ = (db.UniqueConstraint("user_id", "name", name="uq_user_location"),)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "name": self.name}


class Clothes(db.Model):
    __tablename__ = "clothes"

    SEASONS = ("spring", "summer", "autumn", "winter")

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    location_id = db.Column(db.Integer, db.ForeignKey("locations.id"), nullable=True)
    # 多选季节，逗号分隔存储，如 "spring,summer"
    seasons = db.Column(db.String(100), nullable=False, default="")
    image = db.Column(db.String(255), nullable=False, default="", comment="COS 对象 key")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = db.relationship("Category")
    location = db.relationship("Location")
    # 删除衣服时，一并清理它的穿着记录和搭配关联（ORM 级联，MySQL/SQLite 通用）
    wear_logs = db.relationship("WearLog", back_populates="clothes", cascade="all")
    outfit_items = db.relationship("OutfitItem", back_populates="clothes", cascade="all")

    def season_list(self):
        return [s for s in (self.seasons or "").split(",") if s]

    def to_dict(self, wear=None):
        """wear: (穿着天数, 最近穿着日期) 元组；传入时附带 wear_count / last_worn / worn_today"""
        from flask import current_app
        from cos_storage import get_image_url
        d = {
            "id": self.id,
            "name": self.name,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "location_id": self.location_id,
            "location_name": self.location.name if self.location else None,
            "seasons": self.season_list(),
            "image_url": get_image_url(current_app, self.image),
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
        }
        if wear is not None:
            d["wear_count"] = int(wear[0] or 0)
            d["last_worn"] = wear[1].strftime("%Y-%m-%d") if wear[1] else None
            d["worn_today"] = bool(wear[1] and wear[1] == today_cn())
        return d


# ------------------------------------------------------------------
# 搭配 / 穿着记录（第三批新增；表由 db.create_all() 自动创建，
# 也可执行 database.sql 里对应的 CREATE TABLE IF NOT EXISTS）
# ------------------------------------------------------------------
_TABLE_OPTS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}


class Outfit(db.Model):
    """一套搭配：由 2~8 件衣服组成，可命名、可记录「今天穿了这套」"""
    __tablename__ = "outfits"
    __table_args__ = (_TABLE_OPTS,)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    note = db.Column(db.String(200), nullable=False, default="")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = db.relationship("OutfitItem", back_populates="outfit", cascade="all, delete-orphan",
                            order_by="OutfitItem.seq, OutfitItem.id")

    def to_dict(self, wear=None):
        """wear: (该搭配被穿的天数, 最近穿着日期)；传入时附带 wear_count / last_worn"""
        from flask import current_app
        from cos_storage import get_image_url
        items = []
        for it in self.items:
            c = it.clothes
            if not c:
                continue
            items.append({
                "clothes_id": c.id,
                "name": c.name,
                "category_name": c.category.name if c.category else None,
                "image_url": get_image_url(current_app, c.image),
            })
        d = {
            "id": self.id,
            "name": self.name,
            "note": self.note or "",
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S") if self.created_at else None,
            "clothes_count": len(items),
            "items": items,
        }
        if wear is not None:
            d["wear_count"] = int(wear[0] or 0)
            d["last_worn"] = wear[1].strftime("%Y-%m-%d") if wear[1] else None
            d["worn_today"] = bool(wear[1] and wear[1] == today_cn())
        return d


class OutfitItem(db.Model):
    """搭配与衣服的多对多关联；seq 决定展示顺序"""
    __tablename__ = "outfit_items"
    __table_args__ = (
        db.UniqueConstraint("outfit_id", "clothes_id", name="uq_outfit_clothes"),
        _TABLE_OPTS,
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    outfit_id = db.Column(db.Integer, db.ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False, index=True)
    clothes_id = db.Column(db.Integer, db.ForeignKey("clothes.id", ondelete="CASCADE"), nullable=False, index=True)
    seq = db.Column(db.Integer, nullable=False, default=0)

    outfit = db.relationship("Outfit", back_populates="items")
    clothes = db.relationship("Clothes", back_populates="outfit_items")


class WearLog(db.Model):
    """穿着记录：某件衣服在某天被穿过。(clothes_id, worn_on) 唯一，
    所以「穿过 N 次」= 穿过的天数；outfit_id 表示这条记录来自哪套搭配（可为空）。"""
    __tablename__ = "wear_logs"
    __table_args__ = (
        db.UniqueConstraint("clothes_id", "worn_on", name="uq_wear_clothes_day"),
        db.Index("idx_wear_user_day", "user_id", "worn_on"),
        _TABLE_OPTS,
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    clothes_id = db.Column(db.Integer, db.ForeignKey("clothes.id", ondelete="CASCADE"), nullable=False)
    outfit_id = db.Column(db.Integer, db.ForeignKey("outfits.id", ondelete="SET NULL"), nullable=True, index=True)
    worn_on = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    clothes = db.relationship("Clothes", back_populates="wear_logs")
    outfit = db.relationship("Outfit")
