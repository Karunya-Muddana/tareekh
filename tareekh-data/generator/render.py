"""Turns note text into the files a lawyer would actually upload.

- handwritten diary page photographed on a phone (JPG)
- certified copy of the court's order sheet, scanned (JPG)
- typed phone note (.txt) and typed case note (.docx)
"""
import datetime as dt
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from docx import Document
from docx.shared import Pt

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "fonts")
WINF = "C:/Windows/Fonts"

HAND = {"Aditya": os.path.join(FONTS, "Kalam-Regular.ttf"), "Divya": os.path.join(FONTS, "Caveat.ttf"), "other": os.path.join(FONTS, "Caveat.ttf")}
HAND_SIZE = {"Aditya": 38, "Divya": 46, "other": 40}   # big, like real handwriting on a pocket diary page
LINE_H = 58                                             # ruled-line spacing, px
PAGE = (900, 1280)                                      # diary / letter page, px
INK = {"Aditya": (22, 34, 112), "Divya": (30, 30, 36), "other": (20, 20, 70)}
SERIF = os.path.join(WINF, "times.ttf")
SERIF_B = os.path.join(WINF, "timesbd.ttf")


def _font(path, size):
    return ImageFont.truetype(path, size)


# ------------------------------------------------------------------ handwriting
def _paper(w, h, rng):
    base = np.full((h, w, 3), (247, 243, 228), np.float32)
    base += np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 3.5, (h, w, 1))
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for y in range(200, h - 40, LINE_H):
        d.line([(0, y), (w, y)], fill=(170, 196, 222), width=2)
    d.line([(90, 0), (90, h)], fill=(214, 120, 120), width=2)
    return img


def _diary_header(img, date, rng):
    d = ImageDraw.Draw(img)
    day = dt.date.fromisoformat(date)
    d.text((108, 40), day.strftime("%Y   %B").upper(), font=_font(SERIF_B, 26), fill=(120, 110, 100))
    d.text((108, 80), day.strftime("%d  %A"), font=_font(SERIF, 40), fill=(120, 110, 100))
    d.text((img.width - 260, 92), "Adv. Aditya Varma", font=_font(SERIF, 22), fill=(160, 150, 140))


def _write_words(img, words, author, rng, y0):
    """Word-by-word handwriting on ruled lines. words: list of (text, struck). Returns (next_y, overflow_words)."""
    font = _font(HAND[author], HAND_SIZE[author])
    ink = INK[author]
    x0, xmax = 108, img.width - 40
    line_h = LINE_H
    x, y = x0 + rng.randint(0, 30), y0
    for i, (w, struck) in enumerate(words):
        if w == "\n":
            x, y = x0 + rng.randint(0, 20), y + line_h
            continue
        size = int(HAND_SIZE[author] * rng.uniform(0.93, 1.07))
        f = _font(HAND[author], size) if size != HAND_SIZE[author] else font
        bbox = f.getbbox(w)
        ww, hh = bbox[2] - bbox[0] + 8, bbox[3] + 14
        if x + ww > xmax:
            x, y = x0 + rng.randint(0, 20), y + line_h
        if y > img.height - 70:
            return y, words[i:]
        tile = Image.new("RGBA", (ww + 10, hh + 10), (0, 0, 0, 0))
        td = ImageDraw.Draw(tile)
        col = tuple(max(0, min(255, c + rng.randint(-12, 12))) for c in ink) + (235,)
        td.text((4, 2), w, font=f, fill=col)
        if struck:
            my = hh // 2 + 2
            td.line([(2, my + rng.randint(-3, 3)), (ww + 4, my + rng.randint(-3, 3))], fill=col, width=3)
        tile = tile.rotate(rng.uniform(-2.2, 2.2), resample=Image.BICUBIC, expand=True)
        img.paste(tile, (int(x), int(y - hh + LINE_H * 0.79 + rng.randint(-2, 2))), tile)
        x += ww + rng.randint(4, 12)
    return y + line_h, []


def _tokenise(text, rng, strike_prob):
    out = []
    for para in text.split("\n"):
        for w in para.split():
            if rng.random() < strike_prob and len(w) > 4 and w.isalpha():
                wrong = w[:-2] + rng.choice("aeiou") + w[-1]
                out.append((wrong, True))
            out.append((w, False))
        out.append(("\n", False))
    return out


def _photo(page, rng):
    """Make a flat page look like a phone photo of a diary lying on a desk."""
    W, H = page.width + 50, page.height + 50       # page nearly fills the frame
    bg = np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 6, (H, W, 1)) + np.array([92, 72, 55], np.float32)
    canvas = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
    p = page.rotate(rng.uniform(-2.5, 2.5), resample=Image.BICUBIC, expand=True, fillcolor=(92, 72, 55))
    canvas.paste(p, ((W - p.width) // 2, (H - p.height) // 2))
    # perspective: slight keystone
    dx = rng.randint(10, 45)
    quad = (dx, rng.randint(0, 20), 0, H - rng.randint(0, 20), W, H - rng.randint(0, 20), W - dx, rng.randint(0, 20))
    canvas = canvas.transform((W, H), Image.QUAD, quad, resample=Image.BICUBIC)
    # lighting gradient + shadow corner
    arr = np.asarray(canvas).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = rng.uniform(0.2, 0.8) * W, rng.uniform(0.1, 0.5) * H
    light = 1.08 - 0.28 * np.sqrt(((xx - cx) / W) ** 2 + ((yy - cy) / H) ** 2)
    arr *= light[..., None]
    arr[..., 2] *= 0.95  # warm indoor light
    arr = _lens(arr, rng)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    if rng.random() < 0.3:   # hand shake: short horizontal-ish smear
        img = img.filter(ImageFilter.Kernel((5, 5), [0] * 10 + [1] * 5 + [0] * 10, scale=5))
    return img


def _sample(ch, sy, sx):
    """Bilinear sample of one channel at float coords (edge-clamped)."""
    h, w = ch.shape
    sy, sx = np.clip(sy, 0, h - 1.001), np.clip(sx, 0, w - 1.001)
    y0, x0 = sy.astype(np.int32), sx.astype(np.int32)
    fy, fx = sy - y0, sx - x0
    a, b = ch[y0, x0], ch[y0, x0 + 1]
    c, d = ch[y0 + 1, x0], ch[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def _lens(arr, rng):
    """Cheap phone-camera optics on an HxWx3 float array: barrel distortion, chromatic aberration,
    vignetting, soft corners, and sensor noise that is stronger in the shadows."""
    H, W = arr.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W / 2 + rng.uniform(-0.05, 0.05) * W, H / 2 + rng.uniform(-0.05, 0.05) * H
    nx, ny = (xx - cx) / (W / 2), (yy - cy) / (H / 2)
    r2 = nx ** 2 + ny ** 2
    k = rng.uniform(0.03, 0.08)                      # barrel
    ca = rng.uniform(0.0015, 0.004)                  # red/blue scale mismatch
    out = np.empty_like(arr)
    for ch, s in ((0, 1 + ca), (1, 1.0), (2, 1 - ca)):
        f = (1 + k * r2) * s / (1 + k)               # keep the corners roughly in frame
        out[..., ch] = _sample(arr[..., ch], cy + (yy - cy) * f, cx + (xx - cx) * f)
    out *= (1 - rng.uniform(0.15, 0.3) * r2 / 2)[..., None]              # vignette
    soft = np.asarray(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)), np.float32)
    m = np.clip(r2 / 2, 0, 1)[..., None]
    out = out * (1 - m) + soft * m                                       # corners out of focus
    g = np.random.default_rng(rng.randint(0, 1 << 30))
    sigma = rng.uniform(3, 7) * (1.6 - out.mean(axis=2, keepdims=True) / 255)
    out += g.normal(0, 1, out.shape[:2] + (1,)) * sigma                  # luma noise
    out += g.normal(0, 1, out.shape) * sigma * 0.5                       # chroma noise
    return out


def handwritten_pages(entries, date, author, out_base, rng, strike_prob=0.03):
    """entries: list of text blocks. Writes out_base.jpg (and _p2, _p3 ...). Returns [(path, struck_words)]."""
    words = []
    if author != "Aditya":   # plain notebook, no printed date: the writer puts it on the first line
        words += [(dt.date.fromisoformat(date).strftime("%d/%m/%y"), False), ("\n", False)]
    for e in entries:
        words += _tokenise(e, rng, strike_prob) + [("\n", False)]
    pages, results, n = [], [], 1
    while words:
        page = _paper(*PAGE, rng)
        if author == "Aditya":
            _diary_header(page, date, rng)
        else:
            ImageDraw.Draw(page).text((140, 150), "", font=_font(SERIF, 10))
        _, words = _write_words(page, words, author, rng, 210 if author == "Aditya" else 150)
        pages.append(page)
    for i, pg in enumerate(pages):
        path = f"{out_base}.jpg" if i == 0 else f"{out_base}_p{i + 1}.jpg"
        _photo(pg, rng).save(path, "JPEG", quality=rng.randint(74, 86))
        results.append(path)
    return results


# ------------------------------------------------------------------ certified order sheet
def _wrap(draw, text, font, width):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def order_sheet_scan(case, judge, entries, out_path, rng, applied_on=None):
    """entries: list of (date_iso, text)."""
    W, H = 1240, 1754
    img = Image.new("RGB", (W, H), (252, 252, 250))
    d = ImageDraw.Draw(img)
    hb, hn, body = _font(SERIF_B, 30), _font(SERIF, 27), _font(SERIF, 26)
    y = 90
    head = [f"IN THE COURT OF THE {judge['court'].upper()}", "AT VISAKHAPATNAM"]
    for line in head:
        tw = d.textlength(line, font=hb)
        d.text(((W - tw) / 2, y), line, font=hb, fill=(20, 20, 20))
        y += 42
    y += 10
    tw = d.textlength(case["case_number"], font=hb)
    d.text(((W - tw) / 2, y), case["case_number"], font=hb, fill=(20, 20, 20))
    y += 60
    p, r = case["title"].split(" vs ")
    for line in [f"Between: {p}", f"And: {r}"]:
        for ln in _wrap(d, line, hn, W - 220):
            d.text((110, y), ln, font=hn, fill=(30, 30, 30))
            y += 36
    y += 20
    title = "DOCKET PROCEEDINGS"
    tw = d.textlength(title, font=hb)
    d.text(((W - tw) / 2, y), title, font=hb, fill=(20, 20, 20))
    y += 55
    d.line([(100, y), (W - 100, y)], fill=(40, 40, 40), width=2)
    d.line([(280, y), (280, H - 330)], fill=(40, 40, 40), width=2)
    y += 20
    for date_iso, text in entries:
        ddmm = dt.date.fromisoformat(date_iso).strftime("%d.%m.%Y")
        d.text((112, y), ddmm, font=body, fill=(20, 20, 20))
        for ln in _wrap(d, text, body, W - 400):
            d.text((300, y), ln, font=body, fill=(20, 20, 20))
            y += 34
        y += 26
    # signature squiggle
    sx, sy = W - 360, y + 10
    pts = [(sx + i * 6, sy + 18 * math.sin(i / 2.2) + rng.randint(-4, 4)) for i in range(40)]
    d.line(pts, fill=(25, 25, 90), width=3)
    # certified-copy stamp
    stamp = Image.new("RGBA", (440, 220), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stamp)
    col = (110, 40, 140, 190)
    sd.ellipse([6, 6, 434, 214], outline=col, width=5)
    sd.ellipse([22, 22, 418, 198], outline=col, width=2)
    sf = _font(SERIF_B, 30)
    for i, t in enumerate(["CERTIFIED TO BE", "TRUE COPY"]):
        tw = sd.textlength(t, font=sf)
        sd.text(((440 - tw) / 2, 62 + i * 42), t, font=sf, fill=col)
    stamp = stamp.rotate(rng.uniform(-14, 14), expand=True)
    img.paste(stamp, (130, H - 320), stamp)
    small = _font(SERIF, 22)
    applied = applied_on or entries[-1][0]
    d.text((650, H - 250), f"Copy applied on: {dt.date.fromisoformat(applied).strftime('%d.%m.%Y')}", font=small, fill=(40, 40, 40))
    d.text((650, H - 220), "Copyist / Section Officer", font=small, fill=(40, 40, 40))
    # scanner effects
    arr = np.asarray(img.convert("L")).astype(np.float32)
    arr += np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 5, arr.shape)
    arr = np.clip(arr * 0.97 + 4, 0, 255).astype(np.uint8)
    g = Image.fromarray(arr).convert("RGB")
    # restore stamp colour lightly by blending with the colour version
    g = Image.blend(g, img, 0.45).rotate(rng.uniform(-0.8, 0.8), resample=Image.BICUBIC, fillcolor=(245, 245, 245))
    g.filter(ImageFilter.GaussianBlur(0.4)).save(out_path, "JPEG", quality=82)
    return out_path


# ------------------------------------------------------------------ typed
def write_txt(path, date, author, entries):
    day = dt.date.fromisoformat(date)
    head = f"{day.strftime('%d %b %Y, %a')} - court notes" + (" (Divya)" if author == "Divya" else "")
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + "\n\n" + "\n\n".join(entries) + "\n")
    return path


def write_docx(path, date, author, title, text):
    doc = Document()
    st = doc.styles["Normal"]
    st.font.name, st.font.size = "Calibri", Pt(11)
    doc.add_heading(title, level=2)
    p = doc.add_paragraph()
    p.add_run(f"Date of hearing: {dt.date.fromisoformat(date).strftime('%d.%m.%Y')}    Note by: {author}").italic = True
    for para in text.split("\n"):
        doc.add_paragraph(para)
    doc.save(path)
    return path


def printed_cause_list(lines, out_pdf, out_png):
    W, H = 1240, 1754
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    y = 70
    for text, bold in lines:
        f = _font(SERIF_B if bold else SERIF, 25 if bold else 23)
        for ln in _wrap(d, text, f, W - 160) or [""]:
            d.text((80, y), ln, font=f, fill="black")
            y += 32
    img.save(out_png)
    img.save(out_pdf, "PDF", resolution=150)


# ------------------------------------------------------------------ other documents
def document(out_base, pages, rng, stamp=None, stamp_paper=None, sign=(), photo=False, tint=(250, 249, 244)):
    """Typed/printed document. pages: list of pages, each a list of (kind, text) with kind in
    h (centred bold heading), p (paragraph), r (right-aligned), s (small print), gap.
    stamp: text for a round office seal on the last page. stamp_paper: text of a non-judicial stamp band on page 1.
    sign: signature labels on the last page (a squiggle above each). photo=True makes it a phone photo."""
    out = []
    for pi, items in enumerate(pages):
        W, H = 1240, 1754
        img = Image.new("RGB", (W, H), tint)
        d = ImageDraw.Draw(img)
        y = 80
        if pi == 0 and stamp_paper:
            d.rectangle([60, 40, W - 60, 330], fill=(226, 236, 214), outline=(90, 120, 80), width=3)
            for i in range(0, W - 140, 22):
                d.arc([70 + i, 60, 110 + i, 100], 0, 180, fill=(160, 190, 150), width=2)
            for i, t in enumerate(stamp_paper):
                f = _font(SERIF_B, 34 if i == 0 else 26)
                tw = d.textlength(t, font=f)
                d.text(((W - tw) / 2, 130 + i * 48), t, font=f, fill=(60, 90, 60))
            y = 370
        for kind, text in items:
            if kind == "gap":
                y += 24
                continue
            f = {"h": _font(SERIF_B, 30), "p": _font(SERIF, 26), "r": _font(SERIF, 26), "s": _font(SERIF, 21)}[kind]
            for ln in _wrap(d, text, f, W - 220) or [""]:
                if kind == "h":
                    x = (W - d.textlength(ln, font=f)) / 2
                elif kind == "r":
                    x = W - 110 - d.textlength(ln, font=f)
                else:
                    x = 110
                d.text((x, y), ln, font=f, fill=(25, 25, 25))
                y += int(f.size * 1.35)
            y += 10
        if pi == len(pages) - 1:
            y = min(max(y + 60, 900), H - 420)
            for i, label in enumerate(sign):
                sx, sy = 120 + (i % 2) * 560, y + (i // 2) * 190
                if not label.startswith("(unsigned)"):
                    pts = [(sx + 20 + k * 7, sy + 40 + 16 * math.sin(k / rng.uniform(1.6, 2.8)) + rng.randint(-5, 5)) for k in range(34)]
                    d.line(pts, fill=(20, 30, 110), width=3)
                d.line([(sx, sy + 75), (sx + 420, sy + 75)], fill=(60, 60, 60), width=1)
                lf = _font(SERIF, 21)
                for k, ln in enumerate(_wrap(d, label.replace("(unsigned) ", ""), lf, 440)):
                    d.text((sx, sy + 82 + k * 26), ln, font=lf, fill=(40, 40, 40))
            if stamp:
                st = Image.new("RGBA", (380, 380), (0, 0, 0, 0))
                sd = ImageDraw.Draw(st)
                col = (40, 50, 150, 170)
                sd.ellipse([8, 8, 372, 372], outline=col, width=5)
                sd.ellipse([30, 30, 350, 350], outline=col, width=2)
                sf = _font(SERIF_B, 24)
                for i, t in enumerate(stamp):
                    sd.text(((380 - sd.textlength(t, font=sf)) / 2, 140 + i * 34), t, font=sf, fill=col)
                st = st.rotate(rng.uniform(-20, 20), expand=True)
                img.paste(st, (W - 520, H - 520), st)
        path = f"{out_base}.jpg" if pi == 0 else f"{out_base}_p{pi + 1}.jpg"
        if photo:
            _photo(img, rng).save(path, "JPEG", quality=rng.randint(72, 84))
        else:
            arr = np.asarray(img).astype(np.float32)
            arr += np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 5, arr.shape[:2] + (1,))
            g = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
            g = g.rotate(rng.uniform(-0.9, 0.9), resample=Image.BICUBIC, fillcolor=(240, 240, 238)).filter(ImageFilter.GaussianBlur(0.5))
            g.save(path, "JPEG", quality=rng.randint(70, 82))
        out.append(path)
    return out


def handwritten_letter(out_base, text, rng):
    """A letter handwritten on plain paper by someone outside the chamber, photographed."""
    page = Image.new("RGB", PAGE, (244, 240, 230))
    rest = _tokenise(text, rng, 0)
    _write_words(page, rest, "other", rng, 110)
    path = f"{out_base}.jpg"
    _photo(page, rng).save(path, "JPEG", quality=rng.randint(72, 84))
    return [path]
