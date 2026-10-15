# -*- coding: utf-8 -*-
"""Probe: how does PyMuPDF see the tables on a few PDF pages?"""
import sys, pymupdf

PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"

doc = pymupdf.open(PDF)
for pno in [2, 3, 10, 14, 29, 30]:  # 1-indexed PDF pages
    page = doc[pno - 1]
    tabs = page.find_tables()
    print(f"=== PDF page {pno}: {len(tabs.tables)} tables ===")
    for ti, t in enumerate(tabs.tables):
        rows = t.extract()
        print(f"  table{ti}: {len(rows)} rows, {len(rows[0]) if rows else 0} cols")
        for r in rows[:3]:
            print("    ", [ (c or "").replace("\n"," ")[:22] for c in r ])
