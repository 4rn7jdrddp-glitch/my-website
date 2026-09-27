"""Chatlein Group - realistic before/after (real project photos), 9:16 ~18 s + static post image."""
import math, os, subprocess, sys, wave
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import imageio_ffmpeg

import render as R

R.SS = 1
W, H, FPS = R.W, R.H, 30
DUR = 18.0
BA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ba")  # uitsneden uit Facebook-posts Chatleingroupbv
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R.HERE, "chatlein-voor-na-9x16.mp4")
BLUE, YELLOW, RED, INK, PAPER, WHITE = R.BLUE, R.YELLOW, R.RED, R.INK, R.PAPER, R.WHITE
clamp, prog, ease, eout, mix = R.clamp, R.prog, R.ease, R.eout, R.mix

CARD = 640
CX = (W - CARD) // 2
Y1, Y2 = 330, 330 + CARD + 40


@lru_cache(maxsize=None)
def photo(name, size, before=False):
    im = Image.open(os.path.join(BA, name + ".png")).convert("RGB")
    im = ImageOps.fit(im, size, Image.LANCZOS, centering=(0.5, 0.45))
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
    if before:
        im = ImageEnhance.Color(im).enhance(0.55)
        im = ImageEnhance.Brightness(im).enhance(0.95)
    else:
        im = ImageEnhance.Contrast(im).enhance(1.06)
        im = ImageEnhance.Color(im).enhance(1.08)
    return im


@lru_cache(maxsize=None)
def mask(size, r=28):
    m = Image.new("L", size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=r, fill=255)
    return m


def zoomed(im, z):
    if z <= 1.001:
        return im
    w, h = im.size
    cw, ch = w / z, h / z
    return im.crop(((w - cw) / 2, (h - ch) / 2, (w + cw) / 2, (h + ch) / 2)).resize((w, h), Image.BILINEAR)


def card(c, x, y, before_name, after_name, t, t_wipe, t0):
    size = (CARD, CARD)
    z = 1.0 + 0.05 * clamp((t - t0) / 6)
    b = zoomed(photo(before_name, size, True), z)
    a = zoomed(photo(after_name, size, False), z)
    p = ease(prog(t, t_wipe, t_wipe + 0.55))
    img = b.copy()
    if p > 0:
        xcut = int(CARD * p)
        img.paste(a.crop((0, 0, xcut, CARD)), (0, 0))
    # shadow
    sh = Image.new("RGB", size, (0, 0, 0))
    c.img.paste(Image.blend(Image.new("RGB", size, c.bg), sh, 0.25), (x + 8, y + 12), mask(size))
    c.img.paste(img, (x, y), mask(size))
    if 0 < p < 1:
        xl = x + int(CARD * p)
        c.rect(xl - 4, y - 10, xl + 4, y + CARD + 10, fill=YELLOW, r=4)
    # tag
    after = p >= 0.5
    txt, bg, fg = ("NA", BLUE, YELLOW) if after else ("VOOR", RED, WHITE)
    f = R.font("Inter", 34, 900, 32)
    tw = c.textw(txt, f)
    c.rect(x + 22, y + 22, x + 22 + tw + 40, y + 78, fill=bg, r=28)
    c.text((x + 42 + tw / 2, y + 51), txt, f, fg)


def shake(t, t_hit, amp=18):
    dt = t - t_hit
    if dt < 0 or dt > 0.5:
        return 0, 0
    s = amp * math.exp(-dt * 14)
    return s * math.sin(t * 90), s * math.cos(t * 70)


def camera(img, z, dx, dy, fill):
    if abs(z - 1) < 1e-3 and abs(dx) < 0.5 and abs(dy) < 0.5:
        return img
    cx, cy = W / 2, H / 2
    a = 1 / z
    return img.transform((W, H), Image.AFFINE, (a, 0, cx - a * (cx + dx), 0, a, cy - a * (cy + dy)),
                         resample=Image.BILINEAR, fillcolor=fill)


def sc_title(t):
    c = R.Ctx(BLUE)
    f = R.font("Inter", 230, 900, 32)
    c.text((W / 2, 720), "VOOR", f, WHITE, alpha=clamp(t / 0.12))
    c.text((W / 2, 900), "&", R.font("PlayfairDisplay-Italic", 150, 600), YELLOW, alpha=clamp((t - 0.3) / 0.12))
    c.text((W / 2, 1090), "NA", f, YELLOW, alpha=clamp((t - 0.55) / 0.12))
    c.text((W / 2, 1300), "Echt project · Chatlein Group", R.font("Inter", 40, 600, 32), (190, 205, 230),
           alpha=clamp((t - 0.7) / 0.2))
    hits = [0, 0.3, 0.55]
    last = max(h for h in hits if h <= t) if t >= 0 else 0
    z = 1 + 0.35 * math.exp(-(t - last) * 14)
    return camera(c.final(), z, *shake(t, last), BLUE)


def sc_pair(t):
    c = R.Ctx(PAPER)
    before = t < 4.6
    cap = "Kale ruimte. Leidingen uit de muur." if before else "Hoge kasten, inbouwoven, strak afgewerkt."
    a = R.fade_in(t, 1.4 if before else 5.2, 0.3)
    c.text((W / 2, 200), cap, R.font("Inter", 46, 800, 32), INK, alpha=a)
    R.bars_motif(c, W / 2, 250, 300, prog(t, 1.3, 2.0))
    card(c, CX, Y1, "C_voor1", "C_na1", t, 4.3, 1.2)
    card(c, CX, Y2, "C_voor2", "C_na2", t, 4.8, 1.2)
    c.text((W / 2, Y2 + CARD + 70), "Zelfde project · foto's van Chatlein Group, nov. 2021",
           R.font("Inter", 30, 500, 32), R.LINE, alpha=R.fade_in(t, 5.4, 0.4))
    hit = 4.85 if t >= 4.85 else (4.35 if t >= 4.35 else -1)
    z = 1 + (0.06 * math.exp(-(t - hit) * 12) if hit > 0 else 0)
    return camera(c.final(), z, *shake(t, hit, 12), PAPER)


def sc_extra(t):
    t0 = 9.0
    c = R.Ctx(INK)
    im = photo("D_na", (1000, 1340), False)
    z = 1.0 + 0.07 * clamp((t - t0) / 2.5)
    im = zoomed(im, z)
    c.img.paste(im, (40, 300), mask((1000, 1340), 30))
    f = R.font("Inter", 34, 900, 32)
    c.rect(70, 330, 70 + c.textw("NA", f) + 40, 386, fill=BLUE, r=28)
    c.text((90 + c.textw("NA", f) / 2, 359), "NA", f, YELLOW)
    c.text((W / 2, 190), "En nog één.", R.font("PlayfairDisplay", 90, 700), WHITE, alpha=R.fade_in(t, t0 + 0.1, 0.3))
    c.text((W / 2, 1720), "Montage door Gerbian · vaste partners voor", R.font("Inter", 36, 600, 32), (210, 210, 210),
           alpha=R.fade_in(t, t0 + 0.8, 0.4))
    c.text((W / 2, 1770), "leidingwerk, elektra, tegel- en stucwerk", R.font("Inter", 36, 600, 32), (210, 210, 210),
           alpha=R.fade_in(t, t0 + 0.9, 0.4))
    return c.final()


def sc_quote(t):
    t0 = 11.6
    c = R.Ctx(BLUE)
    for i in range(5):
        q = eout(prog(t, t0 + 0.1 + i * 0.08, t0 + 0.3 + i * 0.08))
        if q > 0:
            R.star(c, W / 2 - 200 + i * 100, 470, 40 * q, YELLOW)
    fq = R.font("PlayfairDisplay-Italic", 74, 600)
    lines = ["“De montage en plaatsing", "van onze nieuwe keuken", "was nog beter dan de", "nieuwe keuken zelf.”"]
    for j, ln in enumerate(lines):
        c.text((W / 2, 680 + j * 104 + R.rise(t, t0 + 0.3 + j * 0.1, dist=20)), ln, fq, WHITE if j < 2 else YELLOW,
               alpha=R.fade_in(t, t0 + 0.3 + j * 0.1, 0.3))
    c.text((W / 2, 1150), "Rob S. · 5 sterren op Google", R.font("Inter", 36, 600, 32), (190, 205, 230),
           alpha=R.fade_in(t, t0 + 0.9))
    a = R.fade_in(t, t0 + 1.2)
    c.rect(W / 2 - 300, 1260, W / 2 + 300, 1370, outline=mix(BLUE, YELLOW, a), width=3, r=55)
    c.text((W / 2, 1315), "4,7 ★  ·  38 Google-reviews", R.font("Inter", 42, 800, 32), YELLOW, alpha=a)
    return c.final()


def sc_end(t):
    t0 = 14.2
    c = R.Ctx(PAPER)
    q = eout(prog(t, t0, t0 + 0.5))
    lg = R.logo_variant(False, 860)
    c.paste(lg, W / 2 - 430, 470)
    c.text((W / 2, 900), "Nieuwe keuken gepland?", R.font("PlayfairDisplay", 66, 600), INK, alpha=R.fade_in(t, t0 + 0.5))
    a = R.fade_in(t, t0 + 0.8)
    c.rect(W / 2 - 330, 990, W / 2 + 330, 1120, fill=mix(PAPER, BLUE, a), r=65)
    c.text((W / 2, 1056), "06 49 11 03 60", R.font("Inter", 70, 900, 32), mix(PAPER, YELLOW, a), alpha=1 if a > 0 else 0)
    c.text((W / 2, 1180), "WhatsApp  ·  @chatleingroup", R.font("Inter", 40, 600, 32), BLUE, alpha=R.fade_in(t, t0 + 1.0))
    c.text((W / 2, 1270), "Tot alles klopt.", R.font("PlayfairDisplay-Italic", 54, 600), R.LINE, alpha=R.fade_in(t, t0 + 1.3))
    return camera(c.final(), 1 + 0.6 * (1 - q), 0, 0, PAPER)


SCENES = [(0.0, 1.2, sc_title), (1.2, 9.0, sc_pair), (9.0, 11.6, sc_extra), (11.6, 14.2, sc_quote), (14.2, DUR, sc_end)]
XF = 0.2


def frame(i):
    t = i / FPS
    for k, (a, b, fn) in enumerate(SCENES):
        if a <= t < b or k == len(SCENES) - 1:
            img = fn(t)
            if k + 1 < len(SCENES) and t > b - XF:
                p = ease((t - (b - XF)) / XF)
                nxt = SCENES[k + 1][2](b + 0.001)
                canvas = img.copy()
                canvas.paste(nxt, (int(W * (1 - p)), 0))
                canvas.paste(img.crop((0, 0, W, H)), (int(-W * p), 0))
                img = canvas
            if t > DUR - 0.4:
                img = Image.blend(img, Image.new("RGB", img.size, PAPER), (t - (DUR - 0.4)) / 0.4)
            return img.tobytes()


SR = 48000


def audio(path):
    n = int(DUR * SR)
    out = np.zeros(n)
    rs = np.random.RandomState(3)
    beat = 60 / 100

    def add(at, sig, g=1.0):
        i0 = int(at * SR)
        if 0 <= i0 < n:
            L = min(len(sig), n - i0)
            out[i0:i0 + L] += sig[:L] * g

    def env_t(d):
        return np.arange(int(d * SR)) / SR

    tt = env_t(0.4); kick = np.sin(2 * np.pi * np.cumsum(45 + 100 * np.exp(-tt * 28)) / SR) * np.exp(-tt * 7)
    th = env_t(0.05); hat = np.diff(np.concatenate([[0], rs.randn(len(th))])) * np.exp(-th * 80) * 0.4
    ti = env_t(1.2); impact = np.sin(2 * np.pi * np.cumsum(30 + 80 * np.exp(-ti * 8)) / SR) * np.exp(-ti * 3) + rs.randn(len(ti)) * np.exp(-ti * 12) * 0.3
    tw = env_t(0.4); x = rs.randn(len(tw)); whoosh = (np.convolve(x, np.ones(6) / 6, "same") - np.convolve(x, np.ones(40) / 40, "same")) * np.sin(np.pi * tw / 0.4) ** 2
    t = np.arange(n) / SR
    for note, s, e in [(220.0, 0, 4.3), (174.6, 4.3, 9.0), (196.0, 9.0, 14.2), (220.0, 14.2, DUR)]:
        env = np.clip((t - s) / 0.3, 0, 1) * np.clip((e + 0.3 - t) / 0.3, 0, 1)
        for m in (1, 1.25, 1.5, 2):
            out += np.sin(2 * np.pi * note * m * t) * env * 0.03
    b = 0.0
    while b < DUR - 0.5:
        if not (3.9 < b < 4.35):
            add(b, kick, 0.8)
            add(b + beat / 2, hat, 0.4)
        b += beat
    for at in (0, 0.3, 0.55, 4.35, 4.85, 9.0, 14.2):
        add(at, impact, 0.5)
    for at in (1.0, 4.15, 4.65, 8.8, 11.4, 14.0):
        add(at, whoosh, 0.7)
    out *= np.clip((DUR - t) / 0.6, 0, 1)
    out = np.tanh(out * 1.2)
    out = out / np.abs(out).max() * 0.89
    pcm = (np.stack([out, out], 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def post_image(path):
    """Static 1080x1350 before/after for feed posts."""
    Wp, Hp = 1080, 1350
    img = Image.new("RGB", (Wp, Hp), PAPER)
    half = 500
    b1 = photo("C_voor1", (half, half), True); a1 = photo("C_na1", (half, half), False)
    b2 = photo("C_voor2", (half, half), True); a2 = photo("C_na2", (half, half), False)
    x0, x1, y0, y1 = 33, 547, 250, 250 + half + 14
    for im, x, y in [(b1, x0, y0), (a1, x1, y0), (b2, x0, y1), (a2, x1, y1)]:
        img.paste(im, (x, y), mask((half, half), 20))
    c = R.Ctx(PAPER)
    c.img = img
    from PIL import ImageDraw
    c.d = ImageDraw.Draw(img)
    c.text((Wp / 2, 95), "VOOR  &  NA", R.font("Inter", 88, 900, 32), BLUE)
    R.bars_motif(c, Wp / 2, 160, 300, 1.0)
    f = R.font("Inter", 32, 900, 32)
    for txt, x, bg, fg in [("VOOR", x0 + half / 2, RED, WHITE), ("NA", x1 + half / 2, BLUE, YELLOW)]:
        w = c.textw(txt, f)
        c.rect(x - w / 2 - 22, 196, x + w / 2 + 22, 240, fill=bg, r=22)
        c.text((x, 219), txt, f, fg)
    c.text((Wp / 2, 1308), "Chatlein Group  ·  4,7 ★ Google  ·  App 06 49 11 03 60", R.font("Inter", 30, 700, 32), INK)
    img.save(path, quality=95)


def main():
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    wav = os.path.join(R.HERE, "ba.wav")
    audio(wav)
    nframes = int(DUR * FPS)
    cmd = [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", "-shortest", OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for buf in pool.imap(frame, range(nframes), chunksize=4):
            p.stdin.write(buf)
    p.stdin.close(); p.wait()
    post_image(os.path.join(R.HERE, "chatlein-voor-na-post.jpg"))
    print("done", OUT)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "stills":
        os.makedirs(os.path.join(R.HERE, "bstills"), exist_ok=True)
        for ts in sys.argv[2:]:
            Image.frombytes("RGB", (W, H), frame(int(float(ts) * FPS))).save(os.path.join(R.HERE, "bstills", f"t{ts}.png"))
        post_image(os.path.join(R.HERE, "chatlein-voor-na-post.jpg"))
        print("stills ok")
    else:
        main()
