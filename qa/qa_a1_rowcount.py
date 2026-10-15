# -*- coding: utf-8 -*-
"""A1 independent: count vocab data rows per PDF page (p2..p30) using raw
table extraction, classify each row as data/header/section-header, and compare
with data/vocab.json per-page counts. Does NOT trust existing extraction code."""
import json, re, pymupdf, collections

PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"

doc = pymupdf.open(PDF)

def row_kind(cells):
    """cells: list of stripped cell strings (may be None)."""
    nonempty = [ (c or "").strip() for c in cells if (c or "").strip() != "" ]
    if not nonempty:
        return "empty"
    joined = " ".join(nonempty)
    if nonempty == ["单词"] or ("单词" in nonempty and "中文解释" in joined):
        return "colheader"
    # section header: only one nonempty cell and it's Chinese/short label
    if len(nonempty) == 1:
        return "section:" + nonempty[0]
    return "data"

pdf_counts = {}
pdf_rows_detail = {}
for pno in range(2, 31):  # PDF pages 2..30 (1-indexed)
    page = doc[pno - 1]
    tabs = page.find_tables()
    data_rows = 0
    detail = []
    for t in tabs.tables:
        rows = t.extract()
        for r in rows:
            kind = row_kind(r)
            detail.append(kind)
            if kind == "data":
                data_rows += 1
    pdf_counts[pno] = data_rows
    pdf_rows_detail[pno] = detail

# load json
with open(VOCAB, encoding="utf-8") as f:
    vocab = json.load(f)
print("top-level type:", type(vocab).__name__)
if isinstance(vocab, dict):
    print("keys:", list(vocab.keys()))
    entries = vocab.get("entries") or vocab.get("words") or vocab.get("items")
else:
    entries = vocab
print("entries:", len(entries))
print("sample entry:", json.dumps(entries[0], ensure_ascii=False))

json_counts = collections.Counter(e["page"] for e in entries)
print("\npage | PDF_rows | JSON_rows | match")
ok = True
for pno in range(2, 31):
    jc = json_counts.get(pno, 0)
    pc = pdf_counts.get(pno, 0)
    mark = "OK" if jc == pc else "*** DIFF ***"
    if jc != pc: ok = False
    print(f"p{pno:>2}  | {pc:>8} | {jc:>9} | {mark}")
print("\nTOTAL pdf data rows:", sum(pdf_counts.values()))
print("TOTAL json entries:", len(entries))
print("ALL MATCH:", ok)

# dump detail for pages with mismatch or special pages
for pno in [14, 30, 10, 11, 29]:
    print(f"\n--- p{pno} row kinds: {pdf_rows_detail[pno]}")
