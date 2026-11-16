-- =============================================================
-- 衣服管理系统数据库初始化脚本
-- 适用版本: MySQL 5.7.44
-- 说明: 如果当前账号没有建库权限，可跳过前两行，
--       直接在目标数据库中执行本脚本其余部分。
-- =============================================================

CREATE DATABASE IF NOT EXISTS clothes_sort_mysql
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE clothes_sort_mysql;

-- -------------------------------------------------------------
-- 用户表
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL COMMENT '登录用户名',
  nickname      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '显示名字',
  password_hash VARCHAR(255) NOT NULL,
  is_admin      TINYINT(1)   NOT NULL DEFAULT 0,
  is_approved   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '管理员审核通过后才能登录',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- -------------------------------------------------------------
-- 分类表（每个用户维护自己的分类）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT         NOT NULL,
  name       VARCHAR(50) NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_category (user_id, name),
  KEY idx_user (user_id),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='衣服分类表';

-- -------------------------------------------------------------
-- 位置表（每个用户维护自己的位置，如衣柜/行李箱）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT         NOT NULL,
  name       VARCHAR(50) NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_location (user_id, name),
  KEY idx_user (user_id),
  CONSTRAINT fk_locations_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='存放位置表';

-- -------------------------------------------------------------
-- 衣服表
-- seasons: 多选季节，逗号分隔，取值 spring/summer/autumn/winter
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clothes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  name        VARCHAR(100) NOT NULL COMMENT '衣服名称',
  category_id INT          NULL,
  location_id INT          NULL,
  seasons     VARCHAR(100) NOT NULL DEFAULT '' COMMENT '季节，逗号分隔',
  image       VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'COS 对象 key',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_category (category_id),
  KEY idx_location (location_id),
  CONSTRAINT fk_clothes_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_clothes_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_clothes_location FOREIGN KEY (location_id)
    REFERENCES locations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='衣服表';

-- -------------------------------------------------------------
-- 搭配表：一套搭配由 2~8 件衣服组成（第三批新增）
-- 注意：后端启动时 db.create_all() 会自动建这三张表；
--       若数据库账号没有 CREATE 权限，请手动执行下面三段。
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outfits (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  note       VARCHAR(200) NOT NULL DEFAULT '',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  CONSTRAINT fk_outfits_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='搭配表';

-- 搭配与衣服的多对多关联；seq 为展示顺序
CREATE TABLE IF NOT EXISTS outfit_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  outfit_id  INT NOT NULL,
  clothes_id INT NOT NULL,
  seq        INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_outfit_clothes (outfit_id, clothes_id),
  KEY idx_outfit (outfit_id),
  KEY idx_clothes (clothes_id),
  CONSTRAINT fk_outfit_items_outfit FOREIGN KEY (outfit_id)
    REFERENCES outfits (id) ON DELETE CASCADE,
  CONSTRAINT fk_outfit_items_clothes FOREIGN KEY (clothes_id)
    REFERENCES clothes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='搭配-衣服关联表';

-- -------------------------------------------------------------
-- 穿着记录：某件衣服在某天被穿过（同一件同一天只记一次）
-- 「穿过 N 次」即穿着天数；outfit_id 表示这条记录来自哪套搭配（可为空）
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wear_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT      NOT NULL,
  clothes_id INT      NOT NULL,
  outfit_id  INT      NULL,
  worn_on    DATE     NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wear_clothes_day (clothes_id, worn_on),
  KEY idx_wear_user_day (user_id, worn_on),
  KEY idx_outfit (outfit_id),
  CONSTRAINT fk_wear_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_wear_clothes FOREIGN KEY (clothes_id)
    REFERENCES clothes (id) ON DELETE CASCADE,
  CONSTRAINT fk_wear_outfit FOREIGN KEY (outfit_id)
    REFERENCES outfits (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='穿着记录表';

-- -------------------------------------------------------------
-- 预置管理员账号: admin / admin123（登录后请尽快修改密码）
-- -------------------------------------------------------------
INSERT INTO users (username, nickname, password_hash, is_admin, is_approved)
SELECT 'admin', '管理员',
       'scrypt:32768:8:1$7sK26GbKR8izOReq$ede3f6ff81ef049514998dcd5eca0b9ab73c5ea9fd5b09b511fb521e0fdbfdd7b8c16fc04c46b160ef47a4c21aaed487d93cd095568373550f8ab58c639a997c',
       1, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
