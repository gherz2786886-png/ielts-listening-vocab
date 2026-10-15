# -*- coding: utf-8 -*-
import json
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
d = json.load(open(VOCAB, encoding="utf-8"))
words = d["words"]
for kw in ["semester", "shift", "cheque", "check"]:
    hits = [w for w in words if kw.lower() in w["display"].lower()]
    for w in hits:
        print(json.dumps(w, ensure_ascii=False))
