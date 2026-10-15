# -*- coding: utf-8 -*-
"""复核：10 条修复词条当前 JSON 值 + 全库相邻重复汉字扫描。"""
import json, re, collections
VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
d = json.load(open(VOCAB, encoding="utf-8"))
words = d["words"]

targets = ["p03-027","p04-026","p04-027","p05-028","p17-026",
           "p18-026","p18-027","p19-024","p24-025","p26-028"]
print("=== 10 条修复词条当前 JSON ===")
by_id = {w["id"]: w for w in words}
for t in targets:
    w = by_id[t]
    print(f'{t}: display={w["display"]!r} meaning={w["meaning"]!r} page={w["page"]}')

print("\n=== 全库相邻重复汉字扫描（meaning 中 CJK 相邻同字）===")
cjk = re.compile(r'[\u4e00-\u9fff]')
hits = []
for w in words:
    m = w["meaning"]
    for i in range(1, len(m)):
        if cjk.match(m[i]) and m[i] == m[i-1]:
            hits.append((w["id"], w["display"], m, i))
for h in hits:
    print(h)
print("相邻重复汉字总数:", len(hits))

# 结构复核
ids = [w["id"] for w in words]
all_hw = [h for w in words for h in w["headwords"]]
print("\n总词条:", len(words), "| id 唯一:", len(set(ids)) == len(ids), "| headwords:", len(all_hw))
