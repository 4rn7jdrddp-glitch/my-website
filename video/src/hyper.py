"""Chatlein Group - hyper motion ad (9:16, ~19 s, 128 BPM, beat-synced)."""
import math, os, subprocess, sys, wave
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import imageio_ffmpeg

import render as R

R.SS = 1  # speed: motion blur via sub-frames hides aliasing
W, H, FPS = R.W, R.H, 30
BPM = 128
BEAT = 60 / BPM
SUB = 3  # motion-blur sub-frames
END_BEAT = 41
DUR = END_BEAT * BEAT + 0.6
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R.HERE, "chatlein-hyper-9x16.mp4")

BLUE, YELLOW, RED, INK, PAPER, WHITE = R.BLUE, R.YELLOW, R.RED, R.INK, R.PAPER, R.WHITE
clamp, prog, ease, eout, mix = R.clamp, R.prog, R.ease, R.eout, R.mix


def B(b):
    return b * BEAT


def since_hit(t, hits):
    """seconds since most recent hit time (<= t), and its index."""
    last, idx = None, -1
    for i, h in enumerate(hits):
        if h <= t:
            last, idx = h, i
    return (t - last if last is not None else 99.0), idx


# ---------- text ----------
def fit_font(c, s, name, wght, maxw, start):
    size = start
    while size > 20:
        f = R.font(name, size, wght, 32)
        if c.textw(s, f) <= maxw:
            return f
        size -= 6
    return R.font(name, size, wght, 32)


def big(c, s, y, col, maxw=940, start=260, name="Inter", wght=900):
    f = fit_font(c, s, name, wght, maxw, start)
    c.text((W / 2, y), s, f, col)
    return f


# ---------- camera + post ----------
def camera(img, z=1.0, rot=0.0, dx=0.0, dy=0.0, fill=(0, 0, 0)):
    if abs(z - 1) < 1e-3 and abs(rot) < 1e-4 and abs(dx) < 0.5 and abs(dy) < 0.5:
        return img
    cx, cy = W / 2, H / 2
    cs, sn = math.cos(rot), math.sin(rot)
    a, b_ = cs / z, sn / z
    d, e = -sn / z, cs / z
    c0 = cx - a * (cx + dx) - b_ * (cy + dy)
    f0 = cy - d * (cx + dx) - e * (cy + dy)
    return img.transform((W, H), Image.AFFINE, (a, b_, c0, d, e, f0), resample=Image.BILINEAR, fillcolor=fill)


def punch(dt, amt=0.55, k=13.0):
    return 1 + amt * math.exp(-dt * k) if dt < 2 else 1.0


def shake(t, dt, amp=26.0, k=16.0):
    if dt > 1:
        return 0.0, 0.0
    s = amp * math.exp(-dt * k)
    return s * math.sin(t * 91.0), s * math.cos(t * 77.0)


# ---------- segments (each returns (image, bg)) ----------
def seg_words(t, b0, words):
    hits = [B(b0 + i) for i in range(len(words))]
    dt, i = since_hit(t, hits)
    i = max(i, 0)
    word, bg, fg = words[i]
    c = R.Ctx(bg)
    big(c, word, H / 2, fg)
    # small brand bars under word
    R.bars_motif(c, W / 2, H / 2 + 170, 360, clamp(dt / 0.25))
    sx, sy = shake(t, dt)
    rot = (0.05 if i % 2 else -0.05) * math.exp(-dt * 10)
    return camera(c.final(), punch(dt, 0.8), rot, sx, sy, bg), bg, dt


def seg_vakman(t):
    b0 = 8
    dt = t - B(b0)
    c = R.Ctx(YELLOW)
    c.text((W / 2, 760), "ÉÉN", R.font("Inter", 230, 900, 32), BLUE)
    c.text((W / 2, 980), "VAKMAN.", fit_font(c, "VAKMAN.", "Inter", 900, 960, 240), BLUE)
    c.text((W / 2, 1180), "van levering tot laatste detail", R.font("Inter", 46, 600, 32), INK,
           alpha=R.fade_in(t, B(b0 + 1), 0.2))
    # zoom-through on last beat
    z = punch(dt, 0.9)
    tail = prog(t, B(b0 + 3.4), B(b0 + 4))
    z *= 1 + 7 * ease(tail) ** 2
    sx, sy = shake(t, dt)
    return camera(c.final(), z, 0, sx, sy, YELLOW), YELLOW, dt


def kitchen_state_hyper(t):
    b = t / BEAT
    return dict(
        measure=prog(b, 12.0, 13.0),
        cabs=prog(b, 12.8, 14.8),
        level=0,
        worktop=prog(b, 15.0, 15.35),
        wall=prog(b, 15.5, 16.2),
        filler=prog(b, 16.4, 17.0),
        fronts=prog(b, 17.0, 17.6),
        handles=prog(b, 17.8, 19.6),
    )


LABELS = [(12, "METEN"), (14, "MONTEREN"), (16, "PASSEN"), (17.5, "AFWERKEN")]


def seg_kitchen(t):
    c = R.Ctx(PAPER)
    R.kitchen(c, t, kitchen_state_hyper(t))
    b = t / BEAT
    lab = [l for l in LABELS if b >= l[0]][-1]
    ldt = t - B(lab[0])
    f = R.font("Inter", 120, 900, 32)
    w = c.textw(lab[1], f)
    q = eout(clamp(ldt / 0.18))
    c.rect(W / 2 - w / 2 - 30, 300, W / 2 - w / 2 - 30 + (w + 60) * q, 450, fill=BLUE)
    c.text((W / 2, 375), lab[1], f, YELLOW, alpha=clamp(ldt / 0.1))
    hits = [B(x) for x in (12, 13, 13.5, 14, 14.5, 15, 16, 16.5, 17, 17.5, 18, 19)]
    dt, _ = since_hit(t, hits)
    push = 1 + 0.08 * prog(b, 12, 20)
    sx, sy = shake(t, dt, 14)
    return camera(c.final(), push * punch(dt, 0.12, 16), 0, sx, sy, PAPER), PAPER, dt


def seg_level(t):
    b = t / BEAT
    c = R.Ctx(BLUE)
    # macro spirit level filling the frame
    y = 820
    c.rect(-40, y, W + 40, y + 280, fill=(10, 30, 70))
    c.rect(170, y + 60, 910, y + 220, fill=YELLOW, r=80)
    c.line([(470, y + 60), (470, y + 220)], INK, 6)
    c.line([(610, y + 60), (610, y + 220)], INK, 6)
    snap = eout(prog(b, 20.6, 21.0))
    wob = math.sin(t * 30) * 20 * (1 - prog(b, 20.0, 20.6))
    bx = 540 + (1 - snap) * 230 + wob
    c.ellipse(bx - 75, y + 95, bx + 75, y + 185, fill=(255, 250, 225))
    c.ellipse(bx - 40, y + 105, bx, y + 125, fill=WHITE)
    c.text((W / 2, 560), "ALLES", R.font("Inter", 150, 900, 32), WHITE, alpha=prog(b, 21.0, 21.15))
    c.text((W / 2, 1400), "WATERPAS.", fit_font(c, "WATERPAS.", "Inter", 900, 900, 150), YELLOW, alpha=prog(b, 21.0, 21.15))
    dt = t - B(21) if b >= 21 else 99
    z = (1.25 - 0.25 * ease(prog(b, 20, 21))) * punch(dt, 0.35)
    sx, sy = shake(t, dt, 30)
    return camera(c.final(), z, -0.03 * (1 - prog(b, 20, 21)), sx, sy, BLUE), BLUE, dt


def seg_klopt(t):
    b = t / BEAT
    hits = [B(22), B(23)]
    dt, i = since_hit(t, hits)
    c = R.Ctx(BLUE)
    c.text((W / 2, 820), "TOT ALLES", fit_font(c, "TOT ALLES", "Inter", 900, 920, 200), WHITE)
    if i >= 1:
        c.text((W / 2, 1060), "KLOPT.", fit_font(c, "KLOPT.", "Inter", 900, 920, 280), YELLOW)
        R.red_rule(c, W / 2, 1200, 600, clamp(dt / 0.2), h=12)
    sx, sy = shake(t, dt, 34)
    return camera(c.final(), punch(dt, 0.9), 0.04 * math.exp(-dt * 10), sx, sy, BLUE), BLUE, dt


QUOTES = [(26, ["“Hij nam ons", "echt de", "stress weg.”"]),
          (28, ["“Let op details", "en gaat door tot", "het echt goed is.”"])]


def seg_reviews(t):
    b = t / BEAT
    c = R.Ctx(BLUE)
    hits = [B(24 + k * 0.4) for k in range(5)] + [B(26), B(28)]
    dt, _ = since_hit(t, hits)
    for k in range(5):
        q = eout(prog(b, 24 + k * 0.4, 24 + k * 0.4 + 0.25))
        if q > 0:
            big_star = 1.6 - 0.6 * q
            R.star(c, W / 2 - 320 + k * 160, 470, 62 * big_star * q, YELLOW)
    c.text((W / 2, 600), "5 STERREN OP GOOGLE", R.font("Inter", 44, 800, 32), (190, 205, 230), alpha=prog(b, 24.5, 24.8))
    cur = [qq for qq in QUOTES if b >= qq[0]]
    if cur:
        t0, lines = cur[-1]
        f = R.font("PlayfairDisplay-Italic", 104, 700)
        for j, ln in enumerate(lines):
            a = clamp((b - t0 - j * 0.18) / 0.12)
            c.text((W / 2, 900 + j * 140), ln, f, WHITE if j < 2 else YELLOW, alpha=a)
    sx, sy = shake(t, dt, 18)
    return camera(c.final(), punch(dt, 0.35), 0, sx, sy, BLUE), BLUE, dt


def seg_score(t):
    b = t / BEAT
    c = R.Ctx(YELLOW)
    v = 4.8 * eout(prog(b, 30, 31.5))
    s = f"{v:.1f}".replace(".", ",")
    c.text((W / 2, 880), s, R.font("Inter", 400, 900, 32), BLUE)
    c.text((W / 2, 1110), "/ 5  OP WERKSPOT", R.font("Inter", 64, 800, 32), BLUE, alpha=prog(b, 30.3, 30.6))
    hits = [B(30), B(31.5)]
    dt, _ = since_hit(t, hits)
    sx, sy = shake(t, dt, 22)
    return camera(c.final(), punch(dt, 0.5), 0, sx, sy, YELLOW), YELLOW, dt


def seg_cta_words(t):
    return seg_words(t, 32, [("NIEUWE KEUKEN", BLUE, WHITE), ("GEPLAND?", PAPER, BLUE)])


def seg_end(t):
    b = t / BEAT
    c = R.Ctx(PAPER)
    lg = R.logo_variant(False, 880)
    q = eout(prog(b, 34, 34.6))
    c.paste(lg, W / 2 - 440, 430)
    a = prog(b, 35, 35.2)
    pulse = 1 + 0.04 * math.exp(-((t - B(math.floor(b))) * 10)) if b >= 35 else 1
    pw, ph = 330 * pulse, 70 * pulse
    c.rect(W / 2 - pw, 1060 - ph, W / 2 + pw, 1060 + ph, fill=mix(PAPER, BLUE, a), r=ph)
    c.text((W / 2, 1062), "06 49 11 03 60", R.font("Inter", 76, 900, 32), mix(PAPER, YELLOW, a), alpha=1 if a > 0 else 0)
    c.text((W / 2, 900), "APP GERBIAN", R.font("Inter", 70, 900, 32), INK, alpha=prog(b, 35, 35.2))
    c.text((W / 2, 1200), "WhatsApp  ·  @chatleingroup", R.font("Inter", 42, 600, 32), BLUE, alpha=prog(b, 35.5, 35.8))
    c.text((W / 2, 1300), "Tot alles klopt.", R.font("PlayfairDisplay-Italic", 56, 600), R.LINE, alpha=prog(b, 36, 36.4))
    img = c.final()
    dt = t - B(34)
    z = 1 + 1.2 * (1 - q)
    return camera(img, z * punch(max(0, t - B(35)) if b >= 35 else 9, 0.08), 0, 0, 0, PAPER), PAPER, dt


SEGS = [
    (0, 4, lambda t: seg_words(t, 0, [("NIEUWE", BLUE, WHITE), ("KEUKEN", YELLOW, BLUE),
                                      ("GEKOCHT?", PAPER, BLUE), ("EN NU?", RED, WHITE)])),
    (4, 8, lambda t: seg_words(t, 4, [("LEVERING.", PAPER, INK), ("MONTAGE.", BLUE, YELLOW),
                                      ("PASSTUKKEN.", PAPER, BLUE), ("AFWERKING.", BLUE, WHITE)])),
    (8, 12, seg_vakman),
    (12, 20, seg_kitchen),
    (20, 22, seg_level),
    (22, 24, seg_klopt),
    (24, 30, seg_reviews),
    (30, 32, seg_score),
    (32, 34, seg_cta_words),
    (34, END_BEAT + 2, seg_end),
]
WHIP = {12, 20, 24, 30, 34}  # segment starts that whip in
WHIP_T = 0.12


def seg_at(t):
    b = t / BEAT
    for k, (s, e, fn) in enumerate(SEGS):
        if s <= b < e:
            return k
    return len(SEGS) - 1


def render_t(t):
    k = seg_at(t)
    s, e, fn = SEGS[k]
    img, bg, dt = fn(t)
    # whip transition into next segment
    if k + 1 < len(SEGS) and SEGS[k + 1][0] in WHIP and t > B(e) - WHIP_T:
        p = ease((t - (B(e) - WHIP_T)) / WHIP_T)
        nxt, nbg, _ = SEGS[k + 1][2](B(e) + 0.001)
        canvas = Image.new("RGB", (W, H), bg)
        canvas.paste(img, (int(-W * p), 0))
        canvas.paste(nxt, (int(W * (1 - p)), 0))
        img = canvas
    arr = np.asarray(img, dtype=np.float32)
    # chromatic split on impacts
    if dt < 0.12:
        sh = int(14 * math.exp(-dt * 25))
        if sh > 0:
            arr = arr.copy()
            arr[:, :, 0] = np.roll(arr[:, :, 0], sh, axis=1)
            arr[:, :, 2] = np.roll(arr[:, :, 2], -sh, axis=1)
    # white flash on the exact hit frame
    if dt < 1 / 60:
        arr = arr * 0.6 + 255 * 0.4
    return arr


def frame(i):
    t0 = i / FPS
    acc = None
    for s in range(SUB):
        a = render_t(t0 + s / (FPS * SUB))
        acc = a if acc is None else acc + a
    out = acc / SUB
    t = t0
    if t > DUR - 0.35:
        out = out * clamp((DUR - t) / 0.35) + np.array(PAPER, np.float32) * (1 - clamp((DUR - t) / 0.35))
    return np.clip(out, 0, 255).astype(np.uint8).tobytes()


# ---------- audio: 128 BPM beat ----------
SR = 48000


def audio(path):
    n = int(DUR * SR)
    out = np.zeros(n)
    rs = np.random.RandomState(7)

    def add(at, sig, g=1.0):
        i0 = int(at * SR)
        if i0 >= n:
            return
        L = min(len(sig), n - i0)
        out[i0:i0 + L] += sig[:L] * g

    def kick():
        L = int(0.4 * SR); tt = np.arange(L) / SR
        f = 45 + 110 * np.exp(-tt * 28)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)

    def hat():
        L = int(0.05 * SR); tt = np.arange(L) / SR
        x = rs.randn(L); x = np.diff(np.concatenate([[0], x]))
        return x * np.exp(-tt * 80) * 0.5

    def clap():
        L = int(0.2 * SR); tt = np.arange(L) / SR
        x = rs.randn(L)
        env = np.exp(-tt * 25) + 0.6 * np.exp(-np.maximum(tt - 0.012, 0) * 30) * (tt > 0.012)
        return np.diff(np.concatenate([[0], x])) * env * 0.5

    def impact():
        L = int(1.2 * SR); tt = np.arange(L) / SR
        boom = np.sin(2 * np.pi * np.cumsum(30 + 80 * np.exp(-tt * 8)) / SR) * np.exp(-tt * 3)
        nz = rs.randn(L) * np.exp(-tt * 12) * 0.4
        return boom + nz

    def whoosh(d=0.25):
        L = int(d * SR); tt = np.arange(L) / SR
        x = rs.randn(L)
        env = np.sin(np.pi * tt / d) ** 2
        # crude band-pass sweep via moving average of varying length
        y = np.convolve(x, np.ones(6) / 6, "same") - np.convolve(x, np.ones(40) / 40, "same")
        return y * env * 1.2

    def riser(d):
        L = int(d * SR); tt = np.arange(L) / SR
        x = rs.randn(L)
        y = x - np.convolve(x, np.ones(20) / 20, "same")
        return y * (tt / d) ** 2 * 0.5

    def tick():
        L = int(0.06 * SR); tt = np.arange(L) / SR
        return (np.sin(2 * np.pi * 2200 * tt) + rs.randn(L) * 0.3) * np.exp(-tt * 90)

    def bass(freq, d):
        L = int(d * SR); tt = np.arange(L) / SR
        s = np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(2 * np.pi * freq * 2 * tt) + 0.15 * np.sin(2 * np.pi * freq * 3 * tt)
        return s * np.minimum(1, tt / 0.01) * np.exp(-tt * 2.5)

    def stab(freqs, d=0.35):
        L = int(d * SR); tt = np.arange(L) / SR
        s = sum(np.sign(np.sin(2 * np.pi * f * tt)) * 0.3 + np.sin(2 * np.pi * f * tt) for f in freqs)
        return s * np.exp(-tt * 9) * 0.25

    kick_s, hat_s, clap_s, imp_s = kick(), hat(), clap(), impact()
    roots = [55.0, 55.0, 43.65, 49.0]  # A, A, F, G
    chords = [[220, 261.6, 329.6], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]]
    for b in range(END_BEAT):
        at = B(b)
        quiet = 20 <= b < 21  # breath before the level snaps
        if quiet:
            continue
        add(at, kick_s, 0.9)
        add(at + BEAT / 2, hat_s, 0.35)
        if b % 2 == 1:
            add(at, clap_s, 0.45)
        bar = (b // 4) % 4
        add(at + BEAT / 2, bass(roots[bar] * 2, BEAT / 2), 0.28)
        add(at, bass(roots[bar], BEAT / 2), 0.35)
        if b in (0, 4, 8, 12, 16, 24, 28, 32):
            add(at, stab(chords[bar]), 0.9)
        if 12 <= b < 20:
            add(at + BEAT / 4, hat_s, 0.2)
            add(at + 3 * BEAT / 4, hat_s, 0.2)
    for b in (0, 8, 12, 21, 23, 24, 30, 34):
        add(B(b), imp_s, 0.55)
    for b in WHIP:
        add(B(b) - 0.18, whoosh(), 0.8)
    add(B(8) - B(2), riser(B(2)), 1.0)
    add(B(22) - B(2) - B(0), riser(B(1)), 0.6)
    add(B(34) - B(2), riser(B(2)), 1.0)
    for x in (13, 13.5, 14, 14.5, 17.8, 18.2, 18.6, 19.0):
        add(B(x), tick(), 0.35)
    for k in range(5):
        add(B(24 + k * 0.4), tick(), 0.3)
    # 20-21: ticking level
    for x in np.arange(20, 21, 0.25):
        add(B(x), tick(), 0.25)
    # sidechain-ish pump
    t = np.arange(n) / SR
    ph = (t % BEAT) / BEAT
    pump = 0.55 + 0.45 * np.minimum(1, ph / 0.35)
    out = out * pump
    fade = np.clip((DUR - t) / 0.5, 0, 1)
    out *= fade
    out = np.tanh(out * 1.3)
    out = out / np.abs(out).max() * 0.89
    st = np.stack([out, out], 1)
    pcm = (st * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    wav = os.path.join(R.HERE, "hyper.wav")
    audio(wav)
    nframes = int(DUR * FPS)
    cmd = [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
           "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "256k", "-shortest", OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for k, buf in enumerate(pool.imap(frame, range(nframes), chunksize=4)):
            p.stdin.write(buf)
            if k % 150 == 0:
                print(f"frame {k}/{nframes}", flush=True)
    p.stdin.close()
    p.wait()
    print("done", OUT, round(DUR, 2), "s")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "stills":
        os.makedirs(os.path.join(R.HERE, "hstills"), exist_ok=True)
        for bs in sys.argv[2:]:
            i = int(float(bs) * BEAT * FPS)
            Image.frombytes("RGB", (W, H), frame(i)).save(os.path.join(R.HERE, "hstills", f"b{bs}.png"))
        print("stills ok")
    else:
        main()
