# -*- coding: utf-8 -*-
"""从 PDF 提取 10 条目标词的原始释义单元格，与 JSON 对照。"""
import json, pymupdf, re
PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
doc = pymupdf.open(PDF)
data = json.load(open(VOCAB, encoding="utf-8"))
by_id = {w["id"]: w for w in data["words"]}

targets = {
    "p03-027": 3, "p04-026": 4, "p04-027": 4, "p05-028": 5, "p17-026": 17,
    "p18-026": 18, "p18-027": 18, "p19-024": 19, "p24-025": 24, "p26-028": 26,
}

# 收集每页所有表格行的完整原始单元格
pages_needed = sorted(set(targets.values()))
raw_rows = {}
for pno in pages_needed:
    page = doc[pno - 1]
    rows = []
    for t in page.find_tables().tables:
        for r in t.extract():
            cells = [(c or "").replace("\n", " ") for c in r]
            rows.append(cells)
    raw_rows[pno] = rows

def meaning_cells(row):
    # 第0格是单词；其后到音标格（以/开头）之间的中文格即释义碎片
    parts = []
    for c in row[1:]:
        s = c.strip()
        if not s: continue
        if s.startswith("/"): break
        parts.append(s)
    return parts

for tid, pno in targets.items():
    w = by_id[tid]
    disp = w["display"].split("/")[0].strip().split("(")[0].strip().lower()
    found = None
    for row in raw_rows[pno]:
        first = (row[0] or "").strip().lower().replace(" ", "")
        if disp.replace(" ", "") in first or first in disp.replace(" ", ""):
            found = row; break
    if not found:
        print(f"{tid} ({w['display']}): PDF 行未定位！")
        continue
    parts = meaning_cells(found)
    pdf_mean = "".join(parts)
    j = w["meaning"]
    ok = (pdf_mean.replace(" ", "") == j.replace(" ", ""))
    print(f'{tid} {w["display"]!r}: PDF释义碎片={parts} → 合并={pdf_mean!r} | JSON={j!r} | {"一致" if ok else "*** 不一致 ***"}')
