# -*- coding: utf-8 -*-
import pathlib, pymupdf
PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
OUT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\qa\qa_shots")
doc = pymupdf.open(PDF)
page = doc[5]  # p6
rects = page.search_for("garden")
print("garden rects:", rects)
r = rects[0]
clip = pymupdf.Rect(60, r.y0 - 12, 540, r.y1 + 18)
pix = page.get_pixmap(matrix=pymupdf.Matrix(5, 5), clip=clip, alpha=False)
pix.save(OUT / "zoom_garden.png")
print("saved", pix.width, pix.height)
