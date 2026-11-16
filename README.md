# 衣服管理大师

把衣柜搬进手机：给每件衣服拍张照、记下分类、季节和放在哪里；每天记一笔「今天穿了什么」，再回头看看哪些衣服穿得最多、哪些已经压箱底很久。

项目由三部分组成，共用同一个后端和数据库：

- **网页端**：Vue 3 单页应用，手机和电脑都能用
- **微信小程序**：原生小程序，适合随手拍照入库和查看衣柜
- **后端**：Flask 接口服务，数据存 MySQL，图片存腾讯云 COS

## 功能

**衣柜**
- 拍照或从相册选图上传（图片存腾讯云 COS，私有读，通过签名链接展示）
- 每件衣服有名称、自定义分类、自定义存放位置、季节（春夏秋冬可多选）
- 按名称搜索；按季节、分类、位置多选筛选
- 七种排序：最新添加、最早添加、按名称、穿得最多、穿得最少、最近穿过、最久没穿
- 「好久没穿」筛选：上次穿的日期距今超过 30 天的衣服（从没穿过的，按入库日期计算）

**穿着记录**
- 一键记录「今天穿了」，可以撤销
- 每件衣服显示穿过几次、上次穿的日期
- 穿着日历：按月查看每天穿了哪些衣服，可以撤销某一天的记录

**搭配**
- 从衣柜里选 2~8 件，组成一套并命名、加备注
- 一键记录「今天穿了这套」，会同时记下其中每件衣服

**统计**
- 衣服总数、穿过 / 没穿过的数量、利用率
- 按季节、分类、位置的分布
- 最近 6 个月的穿着次数趋势
- 最常穿 TOP5、压箱底 TOP5

**账户**
- 注册需要图形验证码，新用户要由管理员审核通过后才能登录
- 登录有失败次数保护：同一用户名、同一 IP 在 10 分钟内累计输错 5 次密码后，会被暂时锁定（约 10 分钟）
- 登录令牌（JWT）有效期 30 天
- 可以修改用户名、昵称和密码
- 「记住账号密码」：网页端和小程序端都支持，只在本机保存

**管理员**
- 查看所有用户及其衣柜内容
- 新建、编辑、删除用户；通过新用户的注册申请；重置用户密码
- 管理员在小程序里可以在「我的 → 用户审核（管理员）」通过注册申请；其余管理功能请使用网页端

每个用户的数据相互独立。

## 技术栈

| 部分 | 技术 |
|------|------|
| 网页前端 | Vue 3、Vite、Element Plus、Pinia、Vue Router、axios |
| 小程序 | 微信原生小程序（WXML / WXSS / JS） |
| 后端 | Python、Flask、Flask-SQLAlchemy、Flask-JWT-Extended、Flask-CORS |
| 数据库 | MySQL 5.7（PyMySQL 驱动） |
| 图片存储 | 腾讯云 COS（cos-python-sdk-v5） |
| 其他 | Pillow（验证码图片）、python-dotenv（读取 `.env`） |

## 目录结构

```
clothesSort/
├── database.sql              # 建库建表脚本（MySQL 5.7）
├── backend/                  # Flask 后端
│   ├── app.py                # 入口，注册蓝图，启动时自动补建表
│   ├── config.py             # 读取 .env 配置
│   ├── models.py             # 数据模型
│   ├── utils.py              # 公共工具（响应格式、当前用户、日期解析等）
│   ├── timeutil.py           # 北京时间、「好久没穿」天数
│   ├── captcha.py            # 图形验证码
│   ├── cos_storage.py        # 腾讯云 COS 上传 / 删除 / 签名链接（带缓存）
│   ├── routes_auth.py        # 注册、登录、个人资料
│   ├── routes_clothes.py     # 衣服增删改查、图片上传、列表筛选排序
│   ├── routes_categories.py  # 分类
│   ├── routes_locations.py   # 位置
│   ├── routes_wear.py        # 穿着记录与穿着日历
│   ├── routes_outfits.py     # 搭配
│   ├── routes_stats.py       # 统计
│   ├── routes_admin.py       # 管理员接口
│   ├── .env.example          # 配置模板
│   └── requirements.txt
├── frontend/                 # 网页端
│   ├── src/
│   │   ├── views/            # 登录、衣柜、搭配、日历、统计、管理后台
│   │   ├── components/       # 顶栏、衣服表单、分类/位置/个人资料弹窗
│   │   ├── stores/           # Pinia 登录状态
│   │   ├── router/           # 路由与登录守卫
│   │   └── api/              # axios 封装（自动带令牌，过期跳转登录）
│   ├── .env.development      # 开发环境 API 地址
│   └── .env.production       # 生产环境 API 地址
└── miniprogram/              # 微信小程序
    ├── api/                  # 接口封装
    ├── utils/                # 请求封装、登录状态、本地存储（轻量混淆）
    └── pages/                # 衣柜、搭配、添加、统计、日历、管理员、我的等页面
```

## 快速开始

### 1. 初始化数据库

在 MySQL 5.7 中执行建库建表脚本：

```bash
mysql -u <有权限的账号> -p < database.sql
```

脚本会创建数据库 `clothes_sort_mysql` 和七张表（`users`、`categories`、`locations`、`clothes`、`outfits`、`outfit_items`、`wear_logs`），并预置默认管理员账号 **admin / admin123**。**首次登录后请立即修改密码。**

已有数据库升级时，后端启动会自动补建新增的三张表（`outfits`、`outfit_items`、`wear_logs`），不影响已有表。如果数据库账号没有建表权限，请手动执行 `database.sql` 里对应的 `CREATE TABLE IF NOT EXISTS` 语句。

### 2. 配置并启动后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows；macOS / Linux 用 source .venv/bin/activate
pip install -r requirements.txt

copy .env.example .env          # 复制配置模板，然后编辑 .env 填入自己的值
python app.py                   # 运行在 http://127.0.0.1:18888
```

`.env` 里需要填写：

| 变量 | 说明 |
|------|------|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL 连接信息 |
| `JWT_SECRET_KEY` | 登录令牌的签名密钥，**必须改成随机长字符串**，生成方法见模板注释 |
| `COS_SECRET_ID` `COS_SECRET_KEY` | 腾讯云 API 密钥 |
| `COS_BUCKET` `COS_REGION` | 存储桶名称与地域 |

`.env` 已被 `.gitignore` 忽略，不会提交到 GitHub。

### 3. 启动网页端

```bash
cd frontend
npm install
npm run dev                     # 运行在 http://127.0.0.1:5173
```

开发模式下，`/api` 请求由 Vite 代理转发，目标地址在 `frontend/vite.config.js` 的 `server.proxy` 中配置。

> **注意**：当前代理目标是线上后端（`clothessortback.yixianluoshui.top`），不是本地后端。这意味着本地网页里的登录和增删改都会作用于线上数据。想连本地后端，请把 `target` 改为 `http://127.0.0.1:18888`，并先启动本地后端。

Vite 已开启 `host: true`，手机和电脑连同一个 WiFi 时，可以用手机访问 `http://<电脑IP>:5173` 调试。

### 4. 运行小程序

1. 用微信开发者工具导入 `miniprogram/` 目录。
2. 在「详情 → 本地设置」中勾选「不校验合法域名……」，即可请求本地后端。
3. 小程序内「我的 → 服务器地址」可修改后端地址。默认指向线上服务；本地调试时改成 `http://127.0.0.1:18888`，真机调试时改成电脑的局域网 IP。

发布前需要在小程序后台配置服务器域名，详见 [miniprogram/README.md](miniprogram/README.md)。

## 部署

### 后端

1. 服务器上准备好 Python 3 和 MySQL 5.7，在服务器的 `.env` 中填入真实配置（**`JWT_SECRET_KEY` 务必使用随机值**）。
2. 把 `backend/` 上传到服务器，安装依赖：`pip install -r requirements.txt`。
3. 用进程管理工具（宝塔、systemd、supervisor 等）启动。生产环境建议使用 gunicorn 或 waitress 运行 Flask，不建议直接使用 `python app.py`。
4. 用 Nginx 或宝塔反代到后端端口，并配置 HTTPS（小程序要求后端使用 HTTPS 域名）。
5. 每次修改后端代码后，需要**重启**后端进程，新代码才会生效。

### 网页端

```bash
cd frontend
npm run build                   # 产物在 frontend/dist
```

把 `dist/` 交给 Nginx 等静态服务器。`.env.production` 中的 `VITE_API_BASE` 需要指向线上后端的 `/api` 地址，修改后重新构建。

### 小程序

1. 小程序后台配置服务器域名：request 合法域名、uploadFile 合法域名、downloadFile 合法域名（需包含后端域名和腾讯云 COS 的域名）。
2. 把 `miniprogram/utils/config.js` 中的 `DEFAULT_BASE_URL` 改为线上域名（默认值已指向线上服务，通常无需修改）。
3. 用微信开发者工具上传代码，并在公众平台提交审核。

## 注意事项

- 小程序端的「记住密码」只是本地轻量混淆，不是加密，请不要在公用设备上勾选。
- 登录失败保护的计数保存在内存中，服务重启后会清零；多进程部署时各进程之间不共享计数。
