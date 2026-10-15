# -*- coding: utf-8 -*-
import json
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
d = json.load(open(VOCAB, encoding="utf-8"))
all_hw = sorted(set(h.lower() for w in d["words"] for h in w["headwords"]))
for t in ["restaurant","accommodation","wednesday","library","necessary","behaviour","behavior",
          "litre","liter","catalogue","catalog","friendly","separate","definitely","government",
          "environment","receive","believe","until","travelling","traveling","centre","center",
          "organise","organize","colour","color","cheque","check"]:
    print(f"{t:15s}", "YES" if t in all_hw else "no")
