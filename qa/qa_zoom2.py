# -*- coding: utf-8 -*-
import pymupdf
PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
OUT = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\qa\qa_shots"
doc = pymupdf.open(PDF)
page = doc[2]
clip = pymupdf.Rect(60, 398, 540, 520)
pix = page.get_pixmap(matrix=pymupdf.Matrix(5,5), clip=clip, alpha=False)
pix.save(OUT + r"\pdf_p03_zoom_rows.png")
print("ok", pix.width, pix.height)
