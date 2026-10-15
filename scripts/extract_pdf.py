# -*- coding: utf-8 -*-
"""
extract_pdf.py — 雅思听力场景词汇 PDF 结构化提取
=================================================
输入:  ../听力场景词汇.pdf (相对本脚本上一级目录)
输出:
  data/vocab.json
  data/vocab.js   (window.VOCAB = ...;)

提取策略:
  1) PyMuPDF find_tables() 定位表格与行, 行内各单元格 bbox;
  2) 对每个单元格 bbox 用 page.get_text(clip=...) 取文本 —— 比 table.extract()
     更忠实于印刷 (次重音 ˌ / 鼻化符号 ̬ 等不再被拆成独立尾行, 分号排序也正确);
  3) 对每一行按"内容特征"归列 (不同页列数/列位漂移):
       - 首个含拉丁字母的格                -> 单词 display
       - 其后连续的含中文格(去重复后缀)    -> 中文释义
       - 其余非空格                        -> 音标片段, 按规则拼合英音/美音
  4) 空行 / 表头(单词|中文解释) / 纯中文章节标题行 跳过。

  已知源文件/拆分特殊点以 MANUAL_* 表照录方式处理, 详见报告。
"""

import json
import re
from pathlib import Path

import pymupdf

BASE = Path(__file__).resolve().parent.parent
PDF_PATH = BASE.parent / "听力场景词汇.pdf"
DATA_DIR = BASE / "data"
QA_DIR = BASE / "qa"

SCENARIOS = [
    {"id": "renting",         "name": "租房场景",   "startPage": 2,  "endPage": 5},
    {"id": "travel",          "name": "旅游场景",   "startPage": 6,  "endPage": 11},
    {"id": "sports_music",    "name": "运动音乐场景", "startPage": 12, "endPage": 14},
    {"id": "work",            "name": "工作场景",   "startPage": 15, "endPage": 18},
    {"id": "academic",        "name": "学术场景",   "startPage": 19, "endPage": 24},
    {"id": "animals_plants",  "name": "动植物场景", "startPage": 25, "endPage": 30},
]

CJK_RE = re.compile(r"[\u4e00-\u9fff]")
LATIN_RE = re.compile(r"[A-Za-z]")


def fold_ws(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip()


# 手工特殊处理 (page, display) -> dict 覆盖
MANUAL_OVERRIDES = {
    # p6 refreshment/snack: 源印刷英音为 /rɪˈfreʃmənt//snæk/ (提取曾丢首斜杠)
    (6, "refreshment/snack"): {"ipaUk": "/rɪˈfreʃmənt//snæk/"},
    # p4 switch on/off: 英音格内含 on/off 两条读音, 被表格拆成两列
    (4, "switch on/off"): {"ipaUk": "/swɪtʃ ɒn/ /swɪtʃ ɒf/",
                           "ipaUs": "/swɪtʃ ɑ: n//swɪtʃ ɔ: f/"},
    # p10 under/below/beneath/underneath: 美音格折行错位
    (10, "under/below /beneath/underneath"): {
        "ipaUs": "/ˈʌn.dər//bɪˈloʊ//bɪˈni: θ//ˌʌn.dɚˈni: θ/"},
    # p29 Japanese: 美音丢首斜杠, 英音尾部分格斜杠
    (29, "Japanese"): {"ipaUk": "/ˌdʒæp.ənˈi: z/", "ipaUs": "/ˌja-pə-ˈnēz/"},
    # p30 January: 美音次重音位置错位
    (30, "January"): {"ipaUs": "/ˈdʒæn.ju.əri/"},
}

# headwords 手工表: display(折叠后) -> headwords
MANUAL_HEADWORDS = {
    "(day/night) shift": ["day shift", "night shift"],
    "foot(feet)": ["foot", "feet"],
    "book/reserve (v.)- booking/reservation(n.)": [
        "book", "reserve", "booking", "reservation",
    ],
    "switch on/off": ["switch on", "switch off"],
    "in front of/ at the front of in the front of": [
        "in front of", "at the front of", "in the front of",
    ],
    "lead to/off": ["lead to", "lead off"],
    "branch to/off side road": ["branch to", "branch off side road"],
    "chemical/ contaminants Contamination": [
        "chemical", "contaminants", "contamination",
    ],
}


def collect_headings(page):
    """返回 [(y_bottom, text), ...] 按 y 升序 —— 12pt 加粗中文标题行。

    包含 6 个场景大标题 + p10「方位词」+ p29「国家及地区/国籍」
    + p30「季节」「星期&月份」（已全量扫描确认，无其他加粗行）。
    """
    heads = []
    d = page.get_text("dict")
    for b in d["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = s["text"].strip()
                if (t and "Bold" in s["font"] and s["size"] >= 11.0
                        and CJK_RE.search(t)):
                    heads.append((s["bbox"][3], t))
    heads.sort()
    return heads


def cell_text(page, bbox):
    # 向内收缩 1pt, 避免吞入相邻格的边界字符
    x0, y0, x1, y1 = bbox
    clip = pymupdf.Rect(x0 + 1.0, y0 + 0.5, x1 - 1.0, y1 - 0.5)
    return page.get_text("text", clip=clip, sort=True)


def join_pieces(a: str, b: str) -> str:
    """拼接两个拆格碎片; 若边界字符重复(clip 重叠所致)则去重一次。"""
    if a and b and a[-1] == b[0] and a[-1] not in "/ [":
        return a + b[1:]
    return a + b


def parse_row(page, row):
    """返回 dict 或 None。"""
    raw = []
    for cb in row.cells:
        if cb is None:
            raw.append("")
        else:
            raw.append(cell_text(page, cb))

    # 单词格: 第一个含拉丁字母的格; 若格内中英混排, 拆出拉丁部分, 中文尾段并入释义
    wi = None
    for i, c in enumerate(raw):
        cs = c.strip()
        if cs and LATIN_RE.search(cs):
            wi = i
            break
    if wi is None:
        return None

    cell0 = raw[wi]
    if CJK_RE.search(cell0):
        latin_part = re.split(r"[\u4e00-\u9fff]", cell0, 1)[0]
        cjk_tail = cell0[len(latin_part):]
        raw[wi] = latin_part
        # 中文尾段塞进释义序列最前面
        raw.insert(wi + 1, cjk_tail)

    # 释义: 其后连续中文格。同一释义格在表格线处被切成相邻单元格时,
    # 边界字符(如"合理|理的价格"的"理")会被两侧 clip 各收录一次,
    # 因此按"joined 后缀 == cs 前缀"的最长重叠去除后再拼接。
    meaning_parts = []
    j = wi + 1
    while j < len(raw):
        cs = raw[j].strip()
        if not cs:
            j += 1
            continue
        if CJK_RE.search(cs):
            joined = "".join(meaning_parts)
            if not joined:
                meaning_parts.append(cs)
            else:
                k = min(len(joined), len(cs))
                while k > 0 and not joined.endswith(cs[:k]):
                    k -= 1
                meaning_parts = [joined + cs[k:]]
            j += 1
        else:
            break

    ipa_frags = [raw[k].strip() for k in range(j, len(raw)) if raw[k].strip()]

    meaning = "".join(meaning_parts)

    if not ipa_frags:
        uk, us = "", ""
    elif len(ipa_frags) == 1:
        uk, us = ipa_frags[0], ""
    elif len(ipa_frags) == 2:
        uk, us = ipa_frags[0], ipa_frags[1]
    elif len(ipa_frags) == 3:
        f0, f1, f2 = ipa_frags
        if f1.strip() == "/":
            uk, us = join_pieces(f0, f1), f2
        elif f1.strip().startswith(("/", "[")):
            uk, us = f0, join_pieces(f1, f2)
        else:
            uk, us = join_pieces(f0, f1), f2
    else:
        uk, us = ipa_frags[0], " ".join(ipa_frags[1:])

    return {
        "word": fold_ws(raw[wi]),
        "meaning": fold_ws(meaning),
        "uk": fold_ws(uk),
        "us": fold_ws(us),
        "nfrag": len(ipa_frags),
    }


def to_headwords(display: str):
    if display in MANUAL_HEADWORDS:
        return list(MANUAL_HEADWORDS[display])
    out = []
    for p in display.split("/"):
        p = re.sub(r"\([^)]*\)", "", p)
        p = p.replace("’", "").replace("'", "")
        p = fold_ws(p).strip(" -")
        if p:
            out.append(p)
    return out


def scenario_of_page(pno):
    for s in SCENARIOS:
        if s["startPage"] <= pno <= s["endPage"]:
            return s
    return None


def main():
    doc = pymupdf.open(PDF_PATH)
    words = []
    per_page = {}
    odd = []
    current_section = None  # 跨页向下延续的"最近上方加粗标题"

    for pno in range(2, 31):
        page = doc[pno - 1]
        heads = collect_headings(page)
        tabs = page.find_tables()
        seq = 0
        for t in tabs.tables:
            for row in t.rows:
                # 按 y 坐标归属: 行顶在某个加粗标题底线之下时, 切换 section
                ry = row.bbox[1]
                while heads and heads[0][0] <= ry:
                    current_section = heads.pop(0)[1]
                if current_section is None:
                    current_section = scenario_of_page(pno)["name"]

                res = parse_row(page, row)
                if res is None:
                    continue
                seq += 1
                sc = scenario_of_page(pno)
                display = res["word"]
                uk, us = res["uk"], res["us"]
                ov = MANUAL_OVERRIDES.get((pno, display))
                if ov:
                    uk = ov.get("ipaUk", uk)
                    us = ov.get("ipaUs", us)
                hw = to_headwords(display)
                words.append({
                    "id": f"p{pno:02d}-{seq:03d}",
                    "page": pno,
                    "scenarioId": sc["id"],
                    "scenario": sc["name"],
                    "section": current_section,
                    "display": display,
                    "headwords": hw,
                    "meaning": res["meaning"],
                    "ipaUk": uk,
                    "ipaUs": us,
                })
                if res["nfrag"] != 2:
                    odd.append((pno, display, res["nfrag"], uk, us, res["meaning"]))
        per_page[pno] = seq

    data = {
        "meta": {
            "title": "雅思听力场景词汇",
            "source": "听力场景词汇（new）.pdf",
            "totalPages": doc.page_count,
            "contentPages": [2, 30],
            "totalWords": len(words),
            "generatedAt": "2026-10-15",
        },
        "scenarios": SCENARIOS,
        "words": words,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "vocab.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    js = "window.VOCAB = " + json.dumps(data, ensure_ascii=False, indent=2) + ";"
    js = js.replace("</script>", "<\\/script>")
    (DATA_DIR / "vocab.js").write_text(js, encoding="utf-8")

    print("总词条数:", len(words))
    for p, c in per_page.items():
        print(f"  p{p:02d}: {c}")
    print("headwords 总数:", sum(len(w["headwords"]) for w in words))
    from collections import Counter
    print("section 分布:")
    for sec, n in Counter(w["section"] for w in words).items():
        print(f"   {sec}: {n}")
    print("非2音标碎片行:")
    for o in odd:
        print("  ", o)


if __name__ == "__main__":
    main()
