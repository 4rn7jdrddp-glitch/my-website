"""Render Chatlein Group hero video (9:16, motion graphics) to MP4."""
import math, os, subprocess, sys, wave
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")  # Playfair Display + Inter (Google Fonts, OFL)
LOGO = os.path.join(HERE, "..", "..", "docs", "assets", "logo-chatlein-group.png")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "chatlein-hero-9x16.mp4")

W, H, FPS = 1080, 1920, 30
SS = 2  # supersampling
DUR = 53.4

BLUE = (2, 56, 129)
YELLOW = (255, 222, 84)
RED = (171, 20, 22)
INK = (22, 24, 28)
PAPER = (244, 241, 236)
WHITE = (255, 255, 255)
LINE = (60, 64, 72)
SOFT = (205, 200, 192)


# ---------- helpers ----------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, t0, t1):
    return clamp((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t0)


def ease(x):  # easeInOutCubic
    x = clamp(x)
    return 4 * x * x * x if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def eout(x):  # easeOutCubic
    x = clamp(x)
    return 1 - (1 - x) ** 3


def mix(c1, c2, a):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * a)) for i in range(3))


@lru_cache(maxsize=None)
def font(name, size, wght=400, opsz=None):
    path = os.path.join(FONTS, name + ".ttf")
    f = ImageFont.truetype(path, int(size * SS))
    axes = f.get_variation_axes()
    vals = []
    for ax in axes:
        n = ax["name"].decode() if isinstance(ax["name"], bytes) else ax["name"]
        if n.lower().startswith("weight"):
            vals.append(wght)
        elif n.lower().startswith("optical"):
            vals.append(clamp(opsz or size / 2, ax["minimum"], ax["maximum"]))
        else:
            vals.append(ax["default"])
    f.set_variation_by_axes(vals)
    return f


class Ctx:
    def __init__(self, bg):
        self.img = Image.new("RGB", (W * SS, H * SS), bg)
        self.d = ImageDraw.Draw(self.img)
        self.bg = bg

    def S(self, v):
        return int(round(v * SS))

    def rect(self, x0, y0, x1, y1, fill=None, outline=None, width=1, r=0):
        box = [self.S(x0), self.S(y0), self.S(x1), self.S(y1)]
        if box[2] <= box[0] or box[3] <= box[1]:
            return
        if r:
            self.d.rounded_rectangle(box, radius=self.S(r), fill=fill, outline=outline, width=self.S(width))
        else:
            self.d.rectangle(box, fill=fill, outline=outline, width=self.S(width) if outline else 0)

    def line(self, pts, fill, width=2):
        self.d.line([(self.S(x), self.S(y)) for x, y in pts], fill=fill, width=self.S(width), joint="curve")

    def ellipse(self, x0, y0, x1, y1, fill=None, outline=None, width=1):
        self.d.ellipse([self.S(x0), self.S(y0), self.S(x1), self.S(y1)], fill=fill, outline=outline,
                       width=self.S(width) if outline else 0)

    def text(self, xy, s, f, fill, anchor="mm", alpha=1.0, spacing=0):
        if alpha <= 0:
            return
        col = mix(self.bg_at(xy), fill, alpha) if alpha < 1 else fill
        if spacing:
            self._spaced(xy, s, f, col, anchor, spacing)
        else:
            self.d.text((self.S(xy[0]), self.S(xy[1])), s, font=f, fill=col, anchor=anchor)

    def _spaced(self, xy, s, f, col, anchor, spacing):
        widths = [f.getlength(ch) for ch in s]
        total = sum(widths) + self.S(spacing) * (len(s) - 1)
        x = self.S(xy[0]) - (total / 2 if anchor[0] == "m" else 0)
        for ch, w in zip(s, widths):
            self.d.text((x, self.S(xy[1])), ch, font=f, fill=col, anchor="l" + anchor[1])
            x += w + self.S(spacing)

    def bg_at(self, xy):
        return self.img.getpixel((clamp(self.S(xy[0]), 0, W * SS - 1), clamp(self.S(xy[1]), 0, H * SS - 1)))

    def textw(self, s, f):
        return f.getlength(s) / SS

    def paste(self, im, x, y):
        self.img.paste(im, (self.S(x), self.S(y)), im)

    def final(self):
        return self.img.resize((W, H), Image.LANCZOS)


def wrap(s, f, maxw, c):
    words, lines, cur = s.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if c.textw(t, f) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def bars_motif(c, cx, y, width, p, h=7):
    """Logo's top bar motif (blue / yellow / blue) drawing in from left."""
    segs = [(0.0, 0.48, BLUE), (0.52, 0.80, YELLOW), (0.84, 1.0, BLUE)]
    x0 = cx - width / 2
    for i, (a, b, col) in enumerate(segs):
        q = eout(prog(p, i * 0.15, i * 0.15 + 0.55))
        if q <= 0:
            continue
        c.rect(x0 + a * width, y, x0 + (a + (b - a) * q) * width, y + h, fill=col, r=h / 2)


def red_rule(c, cx, y, width, p, h=6):
    q = eout(p)
    if q > 0:
        c.rect(cx - width / 2, y, cx - width / 2 + width * q, y + h, fill=RED, r=h / 2)


# ---------- logo ----------
@lru_cache(maxsize=None)
def logo_variant(white, width):
    im = Image.open(LOGO).convert("RGBA")
    a = np.array(im).astype(np.int16)
    if white:
        rgb, al = a[..., :3], a[..., 3]
        dark = (rgb.max(axis=2) < 90) & (al > 0)
        a[dark, 0:3] = 255
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")
    bbox = im.getbbox()
    im = im.crop(bbox)
    w = int(width * SS)
    return im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)


# ---------- kitchen drawing ----------
FLOOR = 1420
KX0, KX1 = 110, 970
BASE_TOP = FLOOR - 300
WT = 26  # worktop thickness
WALL_BOT = BASE_TOP - WT - 230
WALL_TOP = WALL_BOT - 260
CAB_W = [210, 210, 200, 200]  # base cabinets widths (sum 820)
GAP = KX1 - KX0 - sum(CAB_W)  # 40 -> filler


def base_x(i):
    return KX0 + sum(CAB_W[:i])


def kitchen(c, t, st):
    """st: dict of progress values 0..1 for build phases."""
    # wall & floor
    c.rect(0, FLOOR, W, H, fill=(232, 228, 221))
    c.line([(60, FLOOR), (W - 60, FLOOR)], LINE, 3)
    # utility stubs on wall (water & power) - visible until covered
    if st["cabs"] < 1:
        c.line([(610, FLOOR), (610, FLOOR - 170)], (90, 120, 160), 6)
        c.line([(650, FLOOR), (650, FLOOR - 150)], (90, 120, 160), 6)
        c.rect(760, FLOOR - 190, 800, FLOOR - 150, outline=LINE, width=3, r=4)
    # measuring: dimension lines & laser
    m = st["measure"]
    if m > 0:
        L = KX0 + (KX1 - KX0) * ease(m)
        y = FLOOR + 70
        c.line([(KX0, y), (L, y)], BLUE, 3)
        c.line([(KX0, y - 18), (KX0, y + 18)], BLUE, 3)
        if m > 0.98:
            c.line([(KX1, y - 18), (KX1, y + 18)], BLUE, 3)
        # vertical dim
        Hh = FLOOR - (FLOOR - WALL_TOP) * ease(m)
        x = KX1 + 50
        c.line([(x, FLOOR), (x, Hh)], BLUE, 3)
        c.line([(x - 18, FLOOR), (x + 18, FLOOR)], BLUE, 3)
        # laser line (dashed red), fades once cabinets placed
        la = 1 - st["cabs"]
        if la > 0:
            col = mix((244, 241, 236), (220, 40, 40), la * min(1, m * 1.5))
            xx = 60
            while xx < W - 60:
                c.line([(xx, BASE_TOP), (min(xx + 26, W - 60), BASE_TOP)], col, 3)
                xx += 42
    # base cabinets dropping in
    cb = st["cabs"]
    for i in range(4):
        q = eout(prog(cb, i * 0.18, i * 0.18 + 0.4))
        if q <= 0:
            continue
        dy = (1 - q) * -120
        x0, x1 = base_x(i), base_x(i + 1)
        c.rect(x0, BASE_TOP + dy, x1, FLOOR - 60 + dy, fill=(252, 251, 248), outline=LINE, width=3)
        # adjustable legs
        for lx in (x0 + 24, x1 - 24):
            c.line([(lx, FLOOR - 60 + dy), (lx, FLOOR + dy * 0)], LINE, 4)
    # worktop
    wt = st["worktop"]
    if wt > 0:
        q = eout(wt)
        c.rect(KX0 - 10, BASE_TOP - WT - (1 - q) * 160, KX1 + 10, BASE_TOP - (1 - q) * 160,
               fill=(70, 66, 62), outline=(50, 47, 44), width=2)
    # wall cabinets
    wc = st["wall"]
    for i in range(3):
        q = eout(prog(wc, i * 0.2, i * 0.2 + 0.5))
        if q <= 0:
            continue
        w3 = (KX1 - KX0 - 300) / 3
        x0 = KX0 + i * w3
        dy = (1 - q) * -100
        c.rect(x0, WALL_TOP + dy, x0 + w3, WALL_BOT + dy, fill=(252, 251, 248), outline=LINE, width=3)
    # hood space / window placeholder on right
    if wc > 0.6:
        a = prog(wc, 0.6, 1)
        c.rect(KX1 - 260, WALL_TOP + 20, KX1 - 20, WALL_BOT - 20, outline=mix(PAPER, SOFT, a), width=3, r=6)
        c.line([(KX1 - 140, WALL_TOP + 20), (KX1 - 140, WALL_BOT - 20)], mix(PAPER, SOFT, a), 3)
    # spirit level on worktop during mounting
    lv = st["level"]
    if lv > 0:
        a = min(1, lv * 4, (1 - lv) * 4)
        y = BASE_TOP - WT - 34
        c.rect(300, y, 700, y + 30, fill=mix(PAPER, BLUE, a), r=6)
        c.rect(470, y + 6, 530, y + 24, fill=mix(PAPER, YELLOW, a), r=8)
        bx = 500 + (1 - ease(prog(lv, 0.1, 0.7))) * 22
        c.ellipse(bx - 8, y + 9, bx + 8, y + 21, fill=mix(PAPER, WHITE, a))
        c.line([(488, y + 6), (488, y + 24)], mix(PAPER, INK, a), 2)
        c.line([(512, y + 6), (512, y + 24)], mix(PAPER, INK, a), 2)
    # filler piece (passtuk)
    fp = st["filler"]
    if fp > 0:
        q = eout(fp)
        gx0 = base_x(4)
        hl = 1 - prog(fp, 0.7, 1.0) * 0.6
        # gap highlight
        c.rect(gx0, BASE_TOP, KX1, FLOOR - 60, outline=mix(PAPER, RED, (1 - q) * hl), width=3)
        y_off = (1 - q) * 260
        c.rect(gx0, BASE_TOP + y_off - 0, KX1, FLOOR - 60 + y_off, fill=mix((252, 251, 248), YELLOW, 0.55 * hl),
               outline=LINE, width=3)
    # fronts, handles, plinth
    fr = st["fronts"]
    if fr > 0:
        for i in range(4):
            q = prog(fr, i * 0.12, i * 0.12 + 0.35)
            if q <= 0:
                continue
            x0, x1 = base_x(i) + 4, base_x(i + 1) - 4
            col = mix((252, 251, 248), (226, 223, 216), q)
            c.rect(x0, BASE_TOP + 6, x1, FLOOR - 64, fill=col, outline=LINE, width=2)
            # drawer line on first two
            if i in (0, 3):
                c.line([(x0, BASE_TOP + 90), (x1, BASE_TOP + 90)], LINE, 2)
        for i in range(3):
            q = prog(fr, 0.1 + i * 0.12, 0.45 + i * 0.12)
            if q <= 0:
                continue
            w3 = (KX1 - KX0 - 300) / 3
            x0 = KX0 + i * w3
            c.rect(x0 + 4, WALL_TOP + 4, x0 + w3 - 4, WALL_BOT - 4, fill=mix((252, 251, 248), (226, 223, 216), q),
                   outline=LINE, width=2)
    hd = st["handles"]
    if hd > 0:
        # alignment guide
        gy = BASE_TOP + 44
        ga = min(1, hd * 3) * (1 - prog(hd, 0.75, 1))
        if ga > 0:
            xx = KX0 - 30
            while xx < KX1 + 30:
                c.line([(xx, gy), (xx + 16, gy)], mix(PAPER, BLUE, ga), 2)
                xx += 28
        for i in range(4):
            q = eout(prog(hd, 0.1 + i * 0.1, 0.4 + i * 0.1))
            if q <= 0:
                continue
            cx = (base_x(i) + base_x(i + 1)) / 2
            yy = gy + (1 - q) * 30
            c.rect(cx - 45, yy - 5, cx + 45, yy + 5, fill=INK, r=5)
        wy = WALL_BOT - 36
        for i in range(3):
            q = eout(prog(hd, 0.3 + i * 0.1, 0.6 + i * 0.1))
            if q <= 0:
                continue
            w3 = (KX1 - KX0 - 300) / 3
            cx = KX0 + i * w3 + w3 / 2
            c.rect(cx - 40, wy - 5, cx + 40, wy + 5, fill=INK, r=5)
        # plinth
        pq = eout(prog(hd, 0.5, 0.9))
        if pq > 0:
            c.rect(KX0, FLOOR - 58, KX0 + (KX1 - KX0) * pq, FLOOR - 2, fill=(58, 55, 52))
        # silicone line along worktop / wall
        sq = prog(hd, 0.7, 1.0)
        if sq > 0:
            c.line([(KX0 - 10, BASE_TOP - WT - 2), (KX0 - 10 + (KX1 - KX0 + 20) * sq, BASE_TOP - WT - 2)], WHITE, 3)


def kitchen_state(t):
    return dict(
        measure=prog(t, 17.4, 20.0),
        cabs=prog(t, 21.3, 23.6),
        level=prog(t, 23.4, 25.6),
        worktop=prog(t, 24.2, 25.2),
        wall=prog(t, 25.0, 26.2),
        filler=prog(t, 27.0, 29.6),
        fronts=prog(t, 31.0, 32.6),
        handles=prog(t, 32.4, 35.0),
    )


FINAL_STATE = dict(measure=0, cabs=1, level=0, worktop=1, wall=1, filler=1, fronts=1, handles=1)


# ---------- scenes ----------
def fade_in(t, t0, d=0.5):
    return eout(prog(t, t0, t0 + d))


def rise(t, t0, d=0.6, dist=40):
    return (1 - eout(prog(t, t0, t0 + d))) * dist


def sc_level(t):
    c = Ctx(PAPER)
    f = font("PlayfairDisplay", 92, 500)
    a1 = fade_in(t, 0.2, 0.7)
    c.text((W / 2, 610 + rise(t, 0.2)), "Een keuken kopen", f, INK, alpha=a1)
    c.text((W / 2, 725 + rise(t, 0.45)), "is één ding.", f, INK, alpha=fade_in(t, 0.45, 0.7))
    # spirit level
    y = 1020
    c.rect(140, y, 940, y + 110, fill=BLUE, r=16)
    for x in (200, 880):
        c.ellipse(x - 14, y + 41, x + 14, y + 69, fill=(20, 70, 140))
    c.rect(400, y + 25, 680, y + 85, fill=YELLOW, r=30)
    c.line([(505, y + 25), (505, y + 85)], INK, 3)
    c.line([(575, y + 25), (575, y + 85)], INK, 3)
    off = (1 - ease(prog(t, 0.8, 3.1))) * 95
    wob = math.sin(t * 9) * 3 * (1 - prog(t, 2.6, 3.1))
    bx = 540 + off + wob
    c.ellipse(bx - 28, y + 38, bx + 28, y + 72, fill=(255, 250, 225))
    c.ellipse(bx - 14, y + 42, bx + 2, y + 50, fill=WHITE)
    return c


def sc_vak(t):
    c = Ctx(BLUE)
    f = font("PlayfairDisplay", 84, 500)
    c.text((W / 2, 760 + rise(t, 4.2)), "Zorgen dat", f, WHITE, alpha=fade_in(t, 4.2))
    c.text((W / 2, 865 + rise(t, 4.4)), "alles klopt?", f, WHITE, alpha=fade_in(t, 4.4))
    fb = font("PlayfairDisplay", 104, 700)
    a = fade_in(t, 5.7, 0.6)
    c.text((W / 2, 1060 + rise(t, 5.7)), "Dat is een", fb, WHITE, alpha=a)
    c.text((W / 2, 1180 + rise(t, 5.9)), "vak apart.", fb, YELLOW, alpha=fade_in(t, 5.9, 0.6))
    uq = eout(prog(t, 6.4, 7.1))
    wv = c.textw("vak apart.", fb)
    if uq > 0:
        c.rect(W / 2 - wv / 2, 1250, W / 2 - wv / 2 + wv * uq, 1258, fill=YELLOW, r=4)
    return c


def sc_questions(t):
    c = Ctx(PAPER)
    fs = font("Inter", 34, 500)
    c.text((W / 2, 520), "TUSSEN LEVERING EN JE EERSTE KOFFIE", fs, BLUE, alpha=fade_in(t, 8.2), spacing=2)
    bars_motif(c, W / 2, 570, 380, prog(t, 8.2, 9.2))
    f = font("PlayfairDisplay", 72, 500)
    qs = [("Klopt de aansluiting?", 8.8), ("Past alles zoals gepland?", 9.9), ("Wie lost het op", 11.0),
          ("als het anders loopt?", 11.2)]
    ys = [760, 930, 1100, 1190]
    for (s, t0), y in zip(qs, ys):
        a = fade_in(t, t0)
        c.text((W / 2 + (1 - eout(prog(t, t0, t0 + 0.6))) * 30, y), s, f, INK, alpha=a)
    return c


def sc_name(t):
    c = Ctx(PAPER)
    # portrait placeholder circle with initials (no real footage available)
    a = fade_in(t, 13.1, 0.6)
    r = 150
    cy = 690
    c.ellipse(W / 2 - r, cy - r, W / 2 + r, cy + r, fill=mix(PAPER, BLUE, a))
    c.text((W / 2, cy + 6), "GC", font("PlayfairDisplay", 120, 500), WHITE, alpha=a)
    bars_motif(c, W / 2, 920, 560, prog(t, 13.4, 14.6))
    fn = font("PlayfairDisplay", 78, 500)
    c.text((W / 2, 1010 + rise(t, 13.7)), "GERBIAN CHATLEIN", fn, INK, alpha=fade_in(t, 13.7), spacing=2)
    red_rule(c, W / 2, 1068, 560, prog(t, 14.0, 14.8))
    c.text((W / 2, 1115), "keukenmonteur · Chatlein Group", font("Inter", 36, 500), LINE, alpha=fade_in(t, 14.2))
    fq = font("PlayfairDisplay-Italic", 60, 500)
    c.text((W / 2, 1270 + rise(t, 15.0)), "“Ik kijk verder", fq, BLUE, alpha=fade_in(t, 15.0))
    c.text((W / 2, 1350 + rise(t, 15.2)), "dan de kasten.”", fq, BLUE, alpha=fade_in(t, 15.2))
    return c


STEPS = [
    (17.0, "1", "VOORBEREIDEN", "Eerst meten en controleren."),
    (21.2, "2", "MONTEREN", "Waterpas, recht, strak."),
    (26.4, "3", "OPLOSSEN", "Muur niet recht? Dan maken we het passend."),
    (30.6, "4", "AFWERKEN", "Goed gemonteerd is nog niet goed afgewerkt."),
]


def sc_build(t):
    c = Ctx(PAPER)
    kitchen(c, t, kitchen_state(t))
    # step header
    cur = max(i for i, s in enumerate(STEPS) if t >= s[0] - 0.01) if t >= STEPS[0][0] else 0
    t0, n, name, cap = STEPS[cur]
    a = fade_in(t, t0, 0.4)
    nxt = STEPS[cur + 1][0] if cur + 1 < len(STEPS) else 35.2
    a *= 1 - prog(t, nxt - 0.3, nxt)
    # progress dots
    for i in range(4):
        x = W / 2 - 90 + i * 60
        fill = BLUE if i <= cur else SOFT
        c.ellipse(x - 9, 190 - 9, x + 9, 190 + 9, fill=fill)
    c.text((W / 2, 275), n, font("PlayfairDisplay", 120, 500), BLUE, alpha=a)
    c.text((W / 2, 370), name, font("PlayfairDisplay", 58, 500), INK, alpha=a, spacing=6)
    red_rule(c, W / 2, 418, 220 * a, 1.0, h=5)
    # caption (subtitle style)
    fcap = font("Inter", 46, 600, 32)
    lines = wrap(cap, fcap, 880, c)
    for j, ln in enumerate(lines):
        c.text((W / 2, 485 + j * 60 + rise(t, t0 + 0.3, dist=20)), ln, fcap, INK, alpha=fade_in(t, t0 + 0.3) * (1 - prog(t, nxt - 0.3, nxt)))
    return c


QUOTE = "Heel netjes gewerkt, vaatwasser moest worden aangesloten. Verder was er de communicatie ook erg goed."


REVIEWS = [
    (35.9, "Hij nam ons echt de stress weg."),
    (38.9, "Is meerdere keren teruggekomen om nalevering te installeren."),
    (41.9, "Let op details en gaat door tot het echt goed is."),
]
REV_END = 44.4
SHIFT = REV_END - 41.0  # later scenes move by this much


def star(c, cx, cy, R, fill):
    pts = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5
        rr = R if k % 2 == 0 else R * 0.45
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    c.d.polygon([(c.S(x), c.S(y)) for x, y in pts], fill=fill)


def sc_review(t):
    c = Ctx(BLUE)
    c.text((W / 2, 400), "WAT KLANTEN ZEGGEN", font("Inter", 34, 600), (190, 205, 230), alpha=fade_in(t, 35.2), spacing=4)
    bars_motif(c, W / 2, 450, 420, prog(t, 35.2, 36.0))
    for i in range(5):
        q = eout(prog(t, 35.5 + i * 0.12, 35.8 + i * 0.12))
        if q > 0:
            star(c, W / 2 - 200 + i * 100, 580, 38 * (0.6 + 0.4 * q), YELLOW)
    fq = font("PlayfairDisplay-Italic", 70, 500)
    for k, (t0, q) in enumerate(REVIEWS):
        t1 = REVIEWS[k + 1][0] if k + 1 < len(REVIEWS) else REV_END + 1
        a = fade_in(t, t0, 0.5) * (1 - prog(t, t1 - 0.45, t1 - 0.05))
        if a <= 0:
            continue
        lines = wrap("“" + q + "”", fq, 780, c)
        y0 = 900 - (len(lines) - 1) * 48
        for j, ln in enumerate(lines):
            c.text((W / 2, y0 + j * 96 + rise(t, t0 + j * 0.08, dist=24)), ln, fq, WHITE, alpha=a)
        c.text((W / 2, y0 + len(lines) * 96 + 30), "5 sterren · Google-review", font("Inter", 34, 500), (190, 205, 230), alpha=a)
    # progress ticks for the three quotes
    for k, (t0, _) in enumerate(REVIEWS):
        x = W / 2 - 50 + k * 50
        on = t >= t0
        c.rect(x - 16, 1250, x + 16, 1255, fill=YELLOW if on else (60, 95, 160), r=2)
    a = fade_in(t, 36.4)
    c.rect(W / 2 - 250, 1330, W / 2 + 250, 1430, outline=mix(BLUE, YELLOW, a), width=3, r=50)
    c.text((W / 2, 1380), "4,8 / 5 op Werkspot", font("Inter", 42, 700, 32), YELLOW, alpha=a)
    return c


def sc_final(t):
    c = Ctx(PAPER)
    # warm light glow
    glow = eout(prog(t, 41.3, 42.3))
    if glow > 0:
        g = Image.new("L", (W * SS // 8, H * SS // 8), 0)
        gd = ImageDraw.Draw(g)
        cx, cy = W // 2 // 8 * SS, int(WALL_BOT + 40) // 8 * SS
        gd.ellipse([cx - 90 * SS // 2, cy - 30 * SS // 2, cx + 90 * SS // 2, cy + 50 * SS // 2], fill=int(150 * glow))
        g = g.filter(ImageFilter.GaussianBlur(14 * SS // 2)).resize(c.img.size, Image.BILINEAR)
        warm = Image.new("RGB", c.img.size, (255, 226, 160))
        c.img = Image.composite(warm, c.img, g)
        c.d = ImageDraw.Draw(c.img)
    kitchen(c, t, FINAL_STATE)
    # under-cabinet light strip
    if glow > 0:
        w3 = (KX1 - KX0 - 300) / 3
        c.rect(KX0 + 10, WALL_BOT + 2, KX0 + 3 * w3 - 10, WALL_BOT + 8, fill=mix((226, 223, 216), (255, 236, 170), glow))
    # coffee cup
    ca = fade_in(t, 42.0, 0.6)
    if ca > 0:
        cx, cy = 360, BASE_TOP - WT
        dy = (1 - ca) * -30
        c.rect(cx - 36, cy - 70 + dy, cx + 36, cy - 4 + dy, fill=mix(PAPER, WHITE, ca), outline=mix(PAPER, LINE, ca), width=3, r=10)
        c.ellipse(cx + 26, cy - 58 + dy, cx + 58, cy - 26 + dy, outline=mix(PAPER, LINE, ca), width=4)
        c.rect(cx - 50, cy - 6 + dy, cx + 50, cy + dy, fill=mix(PAPER, LINE, ca), r=3)
        # steam
        for k in range(3):
            ph = t * 1.6 + k * 1.3
            sx = cx - 18 + k * 18
            pts = [(sx + math.sin(ph + j * 0.6) * 8, cy - 84 - j * 14 + dy) for j in range(7)]
            sa = ca * 0.7 * (0.6 + 0.4 * math.sin(ph))
            c.line(pts, mix(PAPER, (170, 170, 170), sa), 3)
    f = font("PlayfairDisplay", 110, 700)
    a = fade_in(t, 42.6, 0.8)
    c.text((W / 2, 330 + rise(t, 42.6)), "Tot alles klopt.", f, BLUE, alpha=a)
    bars_motif(c, W / 2, 420, 420, prog(t, 43.0, 44.0))
    return c


def sc_end(t):
    c = Ctx(PAPER)
    p = prog(t, 45.2, 46.8)
    lg = logo_variant(False, 860)
    # reveal logo: wipe from left
    q = eout(p)
    if q > 0:
        crop = lg.crop((0, 0, max(1, int(lg.width * q)), lg.height))
        al = crop.split()[3].point(lambda v: int(v * min(1, q * 1.4)))
        crop.putalpha(al)
        c.img.paste(crop, (c.S(W / 2 - 430), c.S(470)), crop)
    f = font("PlayfairDisplay", 68, 500)
    c.text((W / 2, 960 + rise(t, 46.6)), "Nieuwe keuken gepland?", f, INK, alpha=fade_in(t, 46.6))
    c.text((W / 2, 1060), "Stuur Gerbian een appje", font("Inter", 44, 500, 32), LINE, alpha=fade_in(t, 47.0))
    a = fade_in(t, 47.4)
    c.rect(W / 2 - 330, 1140, W / 2 + 330, 1270, fill=mix(PAPER, BLUE, a), r=65)
    c.text((W / 2, 1206), "06 49 11 03 60", font("Inter", 66, 800, 32), mix(PAPER, YELLOW, a), alpha=1 if a > 0 else 0)
    c.text((W / 2, 1330), "WhatsApp  ·  @chatleingroup", font("Inter", 38, 500), BLUE, alpha=fade_in(t, 47.8))
    return c


SCENES = [
    (0.0, 4.0, sc_level),
    (4.0, 8.0, sc_vak),
    (8.0, 13.0, sc_questions),
    (13.0, 17.0, sc_name),
    (17.0, 35.2, sc_build),
    (35.2, REV_END, sc_review),
    (REV_END, 45.0 + SHIFT, lambda t: sc_final(t - SHIFT)),
    (45.0 + SHIFT, DUR, lambda t: sc_end(t - SHIFT)),
]
XF = 0.35  # crossfade seconds


def frame(i):
    t = i / FPS
    for k, (a, b, fn) in enumerate(SCENES):
        if a <= t < b or (k == len(SCENES) - 1 and t >= a):
            img = fn(t).final()
            # crossfade into next scene
            if k + 1 < len(SCENES) and t > b - XF:
                nxt = SCENES[k + 1][2](t).final()
                img = Image.blend(img, nxt, ease((t - (b - XF)) / XF))
            # global fade in/out
            if t < 0.3:
                img = Image.blend(Image.new("RGB", img.size, PAPER), img, t / 0.3)
            if t > DUR - 0.6:
                pass
            return img.tobytes()
    raise ValueError(t)


# ---------- audio ----------
SR = 48000


def audio(path):
    n = int(DUR * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))

    def note(f):
        return 440.0 * 2 ** ((f - 69) / 12)

    chords = [  # (start, [midi notes])
        (0.0, [48, 55, 64, 71]),   # Cmaj7
        (8.0, [45, 52, 60, 67]),   # Am7
        (17.0, [41, 48, 57, 64]),  # Fmaj7
        (26.4, [43, 50, 59, 62]),  # G
        (35.2, [41, 48, 57, 64, 67]),  # Fmaj9
        (41.0 + SHIFT, [48, 55, 64, 67, 71]),  # Cmaj7
    ]
    for idx, (s, notes) in enumerate(chords):
        e = chords[idx + 1][0] if idx + 1 < len(chords) else DUR
        env = np.clip((t - s) / 1.5, 0, 1) * np.clip((e + 1.5 - t) / 1.5, 0, 1)
        env = env ** 1.5
        for j, m in enumerate(notes):
            fr = note(m)
            ph = np.random.RandomState(idx * 10 + j).rand() * 6.28
            v = np.sin(2 * np.pi * fr * t + ph) + 0.25 * np.sin(2 * np.pi * fr * 2.003 * t + ph)
            trem = 0.85 + 0.15 * np.sin(2 * np.pi * (0.13 + 0.03 * j) * t + j)
            pan = 0.35 + 0.3 * (j / max(1, len(notes) - 1))
            sig = v * env * trem * 0.045
            out[:, 0] += sig * (1 - pan)
            out[:, 1] += sig * pan
    # soft pulse from build section
    beat = 60 / 84
    pulse_t = np.arange(17.0, 41.0 + SHIFT, beat)
    for pt in pulse_t:
        i0 = int(pt * SR)
        L = int(0.35 * SR)
        tt = np.arange(L) / SR
        k = np.sin(2 * np.pi * (55 + 40 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9) * 0.10
        out[i0:i0 + L, 0] += k[: n - i0]
        out[i0:i0 + L, 1] += k[: n - i0]

    def click(at, gain=0.35, tone=2400, decay=90):
        i0 = int(at * SR)
        L = int(0.12 * SR)
        tt = np.arange(L) / SR
        rs = np.random.RandomState(int(at * 100))
        s = (rs.randn(L) * 0.4 + np.sin(2 * np.pi * tone * tt)) * np.exp(-tt * decay) * gain
        out[i0:i0 + L, 0] += s[: n - i0]
        out[i0:i0 + L, 1] += s[: n - i0]

    def chime(at, f=1318.5, gain=0.12):
        i0 = int(at * SR)
        L = int(1.2 * SR)
        tt = np.arange(L) / SR
        s = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2 * tt)) * np.exp(-tt * 4) * gain
        out[i0:i0 + L, 0] += s[: n - i0]
        out[i0:i0 + L, 1] += s[: n - i0]

    click(3.1, 0.5, 1800, 70)  # level settles
    click(5.7, 0.2, 900, 60)
    for at in (8.8, 9.9, 11.0):
        click(at, 0.15, 1200, 80)
    for i in range(4):  # cabinets land
        click(21.3 + (i * 0.18 + 0.4) * 2.3, 0.35, 700, 50)
    click(25.2, 0.45, 500, 35)  # worktop
    click(29.3, 0.45, 2000, 90)  # filler clicks in
    for i in range(4):
        click(32.4 + (0.4 + i * 0.1) * 2.6, 0.25, 2600, 110)  # handles
    for i in range(5):
        chime(35.6 + i * 0.12, [1046.5, 1174.7, 1318.5, 1568.0, 1760.0][i], 0.07)
    for t0, _ in REVIEWS:
        click(t0, 0.12, 1400, 80)
    click(41.4 + SHIFT, 0.3, 3000, 120)  # light switch
    click(46.6 + SHIFT, 0.35, 1600, 70)  # logo
    # fade in/out
    fade = np.clip(t / 0.4, 0, 1) * np.clip((DUR - t) / 1.5, 0, 1)
    out *= fade[:, None]
    peak = np.abs(out).max()
    out = out / peak * 0.7
    pcm = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    wav = os.path.join(HERE, "audio.wav")
    audio(wav)
    nframes = int(DUR * FPS)
    cmd = [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", "-shortest", OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    only = os.environ.get("FRAMES")
    rng = range(nframes)
    with Pool(os.cpu_count()) as pool:
        for k, buf in enumerate(pool.imap(frame, rng, chunksize=4)):
            p.stdin.write(buf)
            if k % 150 == 0:
                print(f"frame {k}/{nframes}", flush=True)
    p.stdin.close()
    p.wait()
    print("done", OUT)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "stills":
        os.makedirs(os.path.join(HERE, "stills"), exist_ok=True)
        for ts in sys.argv[2:]:
            i = int(float(ts) * FPS)
            Image.frombytes("RGB", (W, H), frame(i)).save(os.path.join(HERE, "stills", f"t{ts}.png"))
        print("stills ok")
    else:
        main()
