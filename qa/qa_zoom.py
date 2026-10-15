# -*- coding: utf-8 -*-
"""High-zoom clip of p3 rows: seafood (~row19) and reasonable price (~row27)."""
import pymupdf
PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
OUT = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\qa\qa_shots"
doc = pymupdf.open(PDF)
page = doc[2]  # p3
# find y positions of the words
for target in ["seafood", "reasonable price", "review", "honey"]:
    rects = page.search_for(target)
    print(target, rects)
# clip middle band of the page
r = page.rect
clip = pymupdf.Rect(r.x0+60, r.height*0.44, r.x1-60, r.height*0.60)
pix = page.get_pixmap(matrix=pymupdf.Matrix(4,4), clip=clip, alpha=False)
pix.save(OUT + r"\pdf_p03_zoom_mid.png")
print("saved zoom")
