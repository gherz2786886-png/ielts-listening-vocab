# -*- coding: utf-8 -*-
import json, urllib.parse, subprocess
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
d = json.load(open(VOCAB, encoding="utf-8"))
words = d["words"]
all_hw = sorted(set(h for w in words for h in w["headwords"]))
lower_map = {h.lower(): h for h in all_hw}

# longest headwords
longest = sorted(all_hw, key=len, reverse=True)[:8]
print("longest headwords:", longest)

picks = ["accommodation", "restaurant", "full-time job", "national holidays",
         "library", "wednesday", "cheque", "beautiful", "environment", "january"]
resolved = []
for h in picks:
    real = lower_map.get(h.lower())
    if real is None:
        print(f"NOT IN LEXICON: {h}")
    else:
        resolved.append(real)
print("resolved picks:", resolved)

def url_for(text, accent):
    t = 2 if accent == "uk" else 1
    return "https://dict.youdao.com/dictvoice?audio=" + urllib.parse.quote(text) + "&type=" + str(t)

for h in resolved:
    for accent in ["uk", "us"]:
        u = url_for(h, accent)
        out = subprocess.run(
            ["curl.exe", "-s", "-L", "-o", "NUL",
             "-w", "%{http_code} %{size_download}", u],
            capture_output=True, text=True, timeout=30)
        print(f"{h:22s} {accent}: {out.stdout.strip()}")
