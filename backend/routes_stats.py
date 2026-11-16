from datetime import timedelta

from flask import Blueprint, current_app
from flask_jwt_extended import jwt_required

from cos_storage import get_image_url
from models import Category, Clothes, Location, Outfit, WearLog, db
from timeutil import STALE_DAYS, today_cn
from utils import ok, current_user, wear_map

bp = Blueprint("stats", __name__, url_prefix="/api/stats")

SEASONS = [("spring", "春"), ("summer", "夏"), ("autumn", "秋"), ("winter", "冬")]
TOP_N = 5
MONTHS = 6


def _breakdown(rows, key_index, names, unnamed):
    """按分类/位置汇总数量，返回 [{id, name, count}]，数量多的在前；没有归属的归为「未分类/未设置」"""
    counts = {}
    for r in rows:
        k = r[key_index]
        counts[k] = counts.get(k, 0) + 1
    out = [{"id": k, "name": names.get(k, unnamed) if k else unnamed, "count": n}
           for k, n in counts.items()]
    out.sort(key=lambda x: (-x["count"], x["name"]))
    return out


def _brief(row, wear, extra=None):
    cid, name, image = row[0], row[1], row[2]
    cnt, last = wear.get(cid, (0, None))
    d = {
        "id": cid,
        "name": name,
        "image_url": get_image_url(current_app, image),
        "wear_count": int(cnt or 0),
        "last_worn": last.strftime("%Y-%m-%d") if last else None,
    }
    if extra:
        d.update(extra)
    return d


@bp.get("/overview")
@jwt_required()
def overview():
    """衣橱总览：数量分布 + 穿着排行 + 近 6 个月穿着趋势。全部只统计当前用户。"""
    user = current_user()
    today = today_cn()
    cutoff = today - timedelta(days=STALE_DAYS)

    # 列顺序：0 id, 1 name, 2 image, 3 seasons, 4 category_id, 5 location_id, 6 created_at
    rows = db.session.query(Clothes.id, Clothes.name, Clothes.image, Clothes.seasons,
                            Clothes.category_id, Clothes.location_id, Clothes.created_at
                            ).filter(Clothes.user_id == user.id).all()
    wear = wear_map(user_id=user.id)

    cat_names = {c.id: c.name for c in Category.query.filter_by(user_id=user.id).all()}
    loc_names = {l.id: l.name for l in Location.query.filter_by(user_id=user.id).all()}

    season_count = {k: 0 for k, _ in SEASONS}
    for r in rows:
        for s in (r[3] or "").split(","):
            if s in season_count:
                season_count[s] += 1

    worn_total = sum(1 for r in rows if wear.get(r[0], (0, None))[0])

    # 压箱底：参考日期 = 最近穿着日，从没穿过的用入库日；超过 STALE_DAYS 天算「好久没穿」
    stale = []
    for r in rows:
        last = wear.get(r[0], (0, None))[1]
        ref = last or (r[6].date() if r[6] else today)
        if ref < cutoff:
            stale.append((ref, r))
    stale.sort(key=lambda x: (x[0], x[1][0]))  # 最久没穿的在前

    most = sorted((r for r in rows if wear.get(r[0], (0, None))[0]),
                  key=lambda r: (-wear[r[0]][0], -(wear[r[0]][1].toordinal()), r[0]))[:TOP_N]

    # 近 6 个月穿着记录数（一件衣服穿一天算 1 次）
    y, m = today.year, today.month
    month_keys = []
    for _ in range(MONTHS):
        month_keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    month_keys.reverse()
    first_day = today.replace(day=1)
    fy, fm = first_day.year, first_day.month - (MONTHS - 1)
    while fm <= 0:
        fy, fm = fy - 1, fm + 12
    start = first_day.replace(year=fy, month=fm)
    monthly = {k: 0 for k in month_keys}
    for (d,) in db.session.query(WearLog.worn_on).filter(WearLog.user_id == user.id,
                                                          WearLog.worn_on >= start).all():
        k = d.strftime("%Y-%m")
        if k in monthly:
            monthly[k] += 1

    recent_start = today - timedelta(days=29)
    logs_30d = WearLog.query.filter(WearLog.user_id == user.id, WearLog.worn_on >= recent_start).count()

    return ok({
        "total": len(rows),
        "worn_total": worn_total,
        "never_worn": len(rows) - worn_total,
        "stale_count": len(stale),
        "stale_days": STALE_DAYS,
        "outfit_count": Outfit.query.filter_by(user_id=user.id).count(),
        "wear_logs_30d": logs_30d,
        "by_season": [{"key": k, "label": label, "count": season_count[k]} for k, label in SEASONS],
        "by_category": _breakdown(rows, 4, cat_names, "未分类"),
        "by_location": _breakdown(rows, 5, loc_names, "未设置"),
        "most_worn": [_brief(r, wear) for r in most],
        "least_worn": [_brief(r, wear, {"days_unworn": (today - ref).days})
                       for ref, r in stale[:TOP_N]],
        "monthly": [{"month": k, "count": monthly[k]} for k in month_keys],
    })
