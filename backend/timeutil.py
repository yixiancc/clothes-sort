"""时间相关的公共常量/函数（不依赖 models，避免循环导入）"""
from datetime import datetime, timedelta, timezone

# 业务按北京时间判断「今天」，与服务器所在时区无关
CN_TZ = timezone(timedelta(hours=8))

# 超过这么多天没穿，就算「好久没穿」
STALE_DAYS = 30


def today_cn():
    return datetime.now(CN_TZ).date()
