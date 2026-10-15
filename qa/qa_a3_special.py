# -*- coding: utf-8 -*-
import json
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
d = json.load(open(VOCAB, encoding="utf-8"))
words = d["words"]

targets = ["term/semester", "son/daughter", "dormitory", "foot(feet)",
           "bathroom", "full-time job", "day/night shift", "national holidays",
           "cheque/check", "reasonable price", "review", "honey"]
for t in targets:
    hits = [w for w in words if t.lower() in w["display"].lower()]
    for w in hits:
        print(json.dumps(w, ensure_ascii=False))
    if not hits:
        print(f"!! NOT FOUND: {t}")
