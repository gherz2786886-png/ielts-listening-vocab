# -*- coding: utf-8 -*-
import json, pymupdf
PDF = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf"
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
doc = pymupdf.open(PDF)
data = json.load(open(VOCAB, encoding="utf-8"))

targets = {"p03-027", "p20-027", "p20-028", "p29-018", "p29-020", "p30-014", "p10-008"}
for w in data["words"]:
    if w["id"] in targets:
        print(json.dumps(w, ensure_ascii=False))

# raw rows containing the corresponding words
needles = {"reasonable", "古典", "实验", "Korean", "Japanese", "January", "under"}
for pno in [3, 10, 20, 29, 30]:
    page = doc[pno-1]
    for t in page.find_tables().tables:
        for r in t.extract():
            joined = " ".join((c or "").replace("\n"," ") for c in r)
            if any(n in joined for n in ["reasonable","classical","lab","Korean","Japanese","January","under/over"]):
                print(f"p{pno} RAW:", [ (c or '').replace(chr(10),' ') for c in r ])
