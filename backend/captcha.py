"""图形验证码：4位数字，内存存储，5分钟有效，一次性使用。"""
import base64
import io
import random
import time
import uuid

from PIL import Image, ImageDraw, ImageFont

_store = {}  # captcha_id -> (code, expire_ts)
TTL = 300

# 可爱粉彩配色
_COLORS = [(255, 143, 179), (195, 155, 255), (127, 184, 232),
           (255, 171, 94), (126, 203, 146), (217, 160, 91)]


def _font(size):
    for name in ("DejaVuSans-Bold.ttf", "arial.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def new_captcha():
    code = "".join(random.choices("0123456789", k=4))
    captcha_id = uuid.uuid4().hex
    _store[captcha_id] = (code, time.time() + TTL)

    # 清理过期
    now = time.time()
    for k in [k for k, v in _store.items() if v[1] < now]:
        _store.pop(k, None)

    w, h = 120, 48
    img = Image.new("RGB", (w, h), (255, 245, 250))
    draw = ImageDraw.Draw(img)
    font = _font(30)

    # 干扰线
    for _ in range(4):
        color = random.choice(_COLORS)
        draw.line([(random.randint(0, w), random.randint(0, h)),
                   (random.randint(0, w), random.randint(0, h))],
                  fill=color, width=2)
    # 干扰点
    for _ in range(40):
        draw.point((random.randint(0, w - 1), random.randint(0, h - 1)),
                   fill=random.choice(_COLORS))

    # 数字：随机颜色、位置抖动
    x = 12
    for ch in code:
        color = random.choice(_COLORS)
        y = random.randint(4, 12)
        draw.text((x, y), ch, font=font, fill=color)
        x += 26

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return captcha_id, f"data:image/png;base64,{b64}"


def verify_captcha(captcha_id, code):
    """一次性校验，无论对错都作废。"""
    item = _store.pop(captcha_id or "", None)
    if not item:
        return False
    saved, expire = item
    if time.time() > expire:
        return False
    return saved == (code or "").strip()
