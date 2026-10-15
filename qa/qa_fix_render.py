# -*- coding: utf-8 -*-
import pathlib, pymupdf
PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
OUT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\qa\qa_shots")
doc = pymupdf.open(PDF)

# (page, search word, out name)
targets = [
    (4, "frozen", "fix_p04_frozen_tv"),
    (5, "combination", "fix_p05_combination"),
    (17, "teamwork", "fix_p17_teamwork"),
    (18, "laptop", "fix_p18_laptop_projector"),
    (19, "oral", "fix_p19_oral"),
    (24, "symbolism", "fix_p24_symbolism"),
    (26, "thermometer", "fix_p26_thermometer"),
]
for pno, word, name in targets:
    page = doc[pno - 1]
    rects = page.search_for(word)
    if not rects:
        print(f"p{pno} {word}: not found"); continue
    y0 = min(r.y0 for r in rects) - 15
    y1 = max(r.y1 for r in rects) + 25
    clip = pymupdf.Rect(60, y0, 540, y1 + (40 if word in ("laptop","frozen") else 0))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(4, 4), clip=clip, alpha=False)
    p = OUT / f"{name}.png"
    pix.save(p)
    print(p.name, pix.width, pix.height)
