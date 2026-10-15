# -*- coding: utf-8 -*-
"""A2: structural assertions on data/vocab.json (independent)."""
import json, re, collections, sys

VOCAB = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\data\vocab.json"
d = json.load(open(VOCAB, encoding="utf-8"))
words = d["words"]
fails = []

# 1. loadable (already), count
print("total entries:", len(words))
if len(words) != 1078: fails.append(f"total {len(words)} != 1078")

# 2. id unique
ids = [w["id"] for w in words]
if len(set(ids)) != len(ids): fails.append("id not unique")
print("unique ids:", len(set(ids)) == len(ids))

# 3. page in 2..30
bad_page = [w["id"] for w in words if not (2 <= w["page"] <= 30)]
if bad_page: fails.append(f"page out of range: {bad_page[:5]}")

# 4. headwords charset: letters/space/hyphen
pat = re.compile(r"^[A-Za-z \-]+$")
bad_hw = [(w["id"], h) for w in words for h in w["headwords"] if not pat.match(h)]
print("headword charset violations:", bad_hw[:10], "count:", len(bad_hw))
if bad_hw: fails.append(f"headword charset bad: {len(bad_hw)}")

# 5. total headwords count
all_hw = [h for w in words for h in w["headwords"]]
print("total headwords:", len(all_hw))
if len(all_hw) != 1178: fails.append(f"headwords {len(all_hw)} != 1178")

# 6. scenario list
print("scenarios:", json.dumps(d.get("scenarios"), ensure_ascii=False))

# 7. section membership checks
def find(pred):
    return [w for w in words if pred(w)]

p10_first = words[[i for i,w in enumerate(words) if w["page"]==10][0]]
p11_first = words[[i for i,w in enumerate(words) if w["page"]==11][0]]
print("p10 first:", p10_first["display"], "| section:", p10_first["section"])
print("p11 first:", p11_first["display"], "| section:", p11_first["section"])
if p10_first["section"] != "方位词": fails.append("p10 first not 方位词")
if p11_first["section"] != "方位词": fails.append("p11 first not 方位词")

p29_first = [w for w in words if w["page"]==29][0]
print("p29 first:", p29_first["display"], "| section:", p29_first["section"])
if p29_first["display"] != "UK/Britain": fails.append("p29 first not UK/Britain")
if p29_first["section"] != "国家及地区/国籍": fails.append("p29 first section wrong")

season = [w for w in words if w["display"]=="season"][0]
monday = [w for w in words if w["display"]=="Monday"][0]
print("season:", season["section"], "| Monday:", monday["section"])
if season["section"] != "季节": fails.append("season section wrong")
if monday["section"] != "星期&月份": fails.append("Monday section wrong")

# all section values
sec_counts = collections.Counter(w["section"] for w in words)
print("section distribution:", dict(sec_counts))

# 8. sanity: every word has nonempty display/meaning/ipaUk/ipaUs
missing = [w["id"] for w in words if not w.get("display") or not w.get("meaning") or not w.get("ipaUk") or not w.get("ipaUs")]
print("entries with empty fields:", missing[:10], len(missing))
if missing: fails.append(f"empty fields: {len(missing)}")

print("\n=== FAILS ===")
for f in fails: print(" -", f)
print("PASS" if not fails else "HAS FAILURES")
