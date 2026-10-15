# -*- coding: utf-8 -*-
"""Render chosen PDF pages to PNG for visual row-by-row verification."""
import pathlib, pymupdf

PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
OUT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\qa\qa_shots")
OUT.mkdir(parents=True, exist_ok=True)

doc = pymupdf.open(PDF)
for pno in [3, 10, 14, 20, 29, 30]:
    page = doc[pno - 1]
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2.2, 2.2), alpha=False)
    p = OUT / f"pdf_p{pno:02d}.png"
    pix.save(p)
    print(p, pix.width, "x", pix.height)
