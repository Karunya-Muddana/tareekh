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

HAND = {"Meera": os.path.join(FONTS, "Kalam-Regular.ttf"), "Sai Kiran": os.path.join(FONTS, "Caveat.ttf")}
HAND_SIZE = {"Meera": 34, "Sai Kiran": 44}
INK = {"Meera": (22, 34, 112), "Sai Kiran": (30, 30, 36)}
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
    for y in range(230, h - 40, 56):
        d.line([(0, y), (w, y)], fill=(170, 196, 222), width=2)
    d.line([(118, 0), (118, h)], fill=(214, 120, 120), width=2)
    return img


def _diary_header(img, date, rng):
    d = ImageDraw.Draw(img)
    day = dt.date.fromisoformat(date)
    d.text((140, 60), day.strftime("%Y   %B").upper(), font=_font(SERIF_B, 30), fill=(120, 110, 100))
    d.text((140, 110), day.strftime("%d  %A"), font=_font(SERIF, 44), fill=(120, 110, 100))
    d.text((img.width - 330, 120), "Adv. Meera Rao", font=_font(SERIF, 24), fill=(160, 150, 140))


def _write_words(img, words, author, rng, y0):
    """Word-by-word handwriting on ruled lines. words: list of (text, struck). Returns (next_y, overflow_words)."""
    font = _font(HAND[author], HAND_SIZE[author])
    ink = INK[author]
    x0, xmax = 140, img.width - 70
    line_h = 56
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
        img.paste(tile, (int(x), int(y - hh + 44 + rng.randint(-3, 3))), tile)
        x += ww + rng.randint(6, 16)
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
    W, H = page.width + 160, page.height + 160
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
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    return img.resize((int(W * 0.85), int(H * 0.85)), Image.LANCZOS)


def handwritten_pages(entries, date, author, out_base, rng, strike_prob=0.03):
    """entries: list of text blocks. Writes out_base.jpg (and _p2, _p3 ...). Returns [(path, struck_words)]."""
    words = []
    for e in entries:
        words += _tokenise(e, rng, strike_prob) + [("\n", False)]
    pages, results, n = [], [], 1
    while words:
        page = _paper(1240, 1754, rng)
        if author == "Meera":
            _diary_header(page, date, rng)
        else:
            ImageDraw.Draw(page).text((140, 150), "", font=_font(SERIF, 10))
        _, words = _write_words(page, words, author, rng, 240 if author == "Meera" else 184)
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
    if judge["level"] == "High Court":
        head = ["HIGH COURT FOR THE STATE OF TELANGANA", "AT HYDERABAD"]
        jur = {"wp": "(Special Original Jurisdiction)", "crp": "(Civil Revisional Jurisdiction)", "cma": "(Appellate Side)"}.get(case["kind"], "")
        head.append(jur)
    else:
        head = [f"IN THE COURT OF THE {judge['court_hall'].replace('Court of the ', '').upper()}", "CITY CIVIL COURT, AT HYDERABAD"]
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
    title = "PROCEEDINGS" if judge["level"] == "High Court" else "DOCKET PROCEEDINGS"
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
    head = f"{day.strftime('%d %b %Y, %a')} - court notes" + (" (Sai)" if author == "Sai Kiran" else "")
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
