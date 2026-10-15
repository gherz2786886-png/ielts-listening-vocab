# -*- coding: utf-8 -*-
"""For 6 sample pages: extract data-row cells from PDF tables, align in order
with JSON entries, and compare word/meaning/UK/US phone strings."""
import json, pymupdf

PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"

doc = pymupdf.open(PDF)
data = json.load(open(VOCAB, encoding="utf-8"))
words = data["words"]
by_page = {}
for w in words:
    by_page.setdefault(w["page"], []).append(w)

def clean(s):
    return (s or "").replace("\n", "").replace(" ", "").strip()

def extract_data_rows(pno):
    page = doc[pno - 1]
    rows_out = []
    for t in page.find_tables().tables:
        for r in t.extract():
            cells = [clean(c) for c in r]
            nonempty = [c for c in cells if c]
            if not nonempty: continue
            if nonempty == ["单词"] or ("单词" in nonempty and any("中文" in c for c in nonempty)):
                continue
            if len(nonempty) == 1:  # section header
                continue
            # find the 4 fields: first nonempty = word; second = meaning (Chinese)
            word = nonempty[0]
            meaning = nonempty[1]
            # ipa cells: entries starting with /
            ipas = [c for c in nonempty[2:] if c.startswith("/")]
            uk = ipas[0] if len(ipas) >= 1 else ""
            us = ipas[1] if len(ipas) >= 2 else (ipas[0] if ipas else "")
            rows_out.append((word, meaning, uk, us))
    return rows_out

total_checked = 0
total_mismatch = 0
for pno in [3, 10, 14, 20, 29, 30]:
    pdf_rows = extract_data_rows(pno)
    json_rows = by_page[pno]
    print(f"\n===== p{pno}: pdf_rows={len(pdf_rows)} json_rows={len(json_rows)}")
    if len(pdf_rows) != len(json_rows):
        print("  !! ROW COUNT DIFFERS")
    for i, (pr, jr) in enumerate(zip(pdf_rows, json_rows)):
        total_checked += 1
        pw, pm, pk, ps = pr
        jw = clean(jr["display"]); jm = clean(jr["meaning"]); jk = clean(jr["ipaUk"]); js = clean(jr["ipaUs"])
        diffs = []
        if pw != jw: diffs.append(f"word pdf[{pw}] vs json[{jw}]")
        if pm != jm: diffs.append(f"meaning pdf[{pm}] vs json[{jm}]")
        if pk != jk: diffs.append(f"uk pdf[{pk}] vs json[{jk}]")
        if ps != js: diffs.append(f"us pdf[{ps}] vs json[{js}]")
        if diffs:
            total_mismatch += 1
            print(f"  row{i+1} (id={jr['id']}): " + " | ".join(diffs))
print(f"\nTOTAL rows compared on 6 pages: {total_checked}, mismatches: {total_mismatch}")
