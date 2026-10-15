# -*- coding: utf-8 -*-
import json, urllib.parse, subprocess, collections
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
d = json.load(open(VOCAB, encoding="utf-8"))
words = d["words"]
all_hw = sorted(set(h for w in words for h in w["headwords"]))

picks = ["accommodation", "restaurant", "full-time job", "national holidays",
         "library", "wednesday", "cheque", "beautiful", "environment", "january"]
present = {h: h in all_hw for h in picks}
print("picks present in headwords:", present)

def url_for(text, accent):
    t = 2 if accent == "uk" else 1
    return "https://dict.youdao.com/dictvoice?audio=" + urllib.parse.quote(text) + "&type=" + str(t)

for h in picks:
    if not present[h]:
        print(f"{h}: NOT IN LEXICON, skip")
        continue
    for accent in ["uk", "us"]:
        u = url_for(h, accent)
        # curl.exe: -s -o file -w status_code + size
        out = subprocess.run(
            ["curl.exe", "-s", "-L", "-o", "NUL",
             "-w", "%{http_code} %{size_download}", u],
            capture_output=True, text=True, timeout=30)
        print(f"{h:18s} {accent}: {out.stdout.strip()}  {u}")
