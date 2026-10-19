"""Build the full text library; never alter source PDFs/media or infer recording proof.

Run with --root D:/Study/IELTS. PDF layout repairs below are explicit and auditable.
The original pilot extractor remains available as the Day28-30 recovery reference.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader

CN = r"[\u4e00-\u9fff]"
# Video start/middle/end frames establish these ranges, including repeated groups.
VIDEO_2021 = {
    9: ["5.8", "5.15"], 10: ["5.20", "5.22"],
    11: ["5.29", "6.5", "6.12"], 12: ["6.17", "6.19"],
    13: ["6.26", "7.1"], 14: ["7.10", "7.17"], 15: ["7.24", "7.31"],
    16: ["8.7", "8.12"], 17: ["8.14", "8.21"], 18: ["8.28", "9.4"],
    19: ["9.11", "9.18"], 20: ["9.18", "9.19"], 21: ["9.25", "9.26"],
    22: ["10.9", "10.16"], 23: ["10.17", "10.23"], 24: ["10.30", "11.6"],
    25: ["11.6", "11.11", "11.20", "11.27"], 26: ["12.2", "12.4"],
    27: ["12.11", "12.18"], 28: ["12.25", "12.30"],
}


def source_text(path, year):
    text, offsets = "", []
    for number, page in enumerate(PdfReader(path).pages, 1):
        content = page.extract_text() or ""
        lines = [line for line in content.splitlines()
                 if not re.fullmatch(r"\s*\d+\s*", line)
                 and not re.search(fr"{year}\s*听力机经词汇", line)]
        offsets.append((len(text), number))
        text += "\n".join(lines) + "\n"
    return text, offsets


def answers_for(part, year, group):
    # Chinese parentheticals explain the preceding word, rather than replace it.
    part = re.sub(r"\([^()]*" + CN + r"[^()]*\)", "", part)
    if year == 2022:
        # Numbered answers are split by the expected ordinal, not arbitrary digit dots:
        # 2.9.50, 9.11.15am and 3.16 October,1980 must remain intact.
        matches = list(re.finditer(r"(?<!\d)1\.\s*", part))
        if matches:
            start = matches[0].end()
            rest = part[start:]
            result = []
            for number in range(2, 21):
                # The source prints 19.Grateley for its tenth answer.
                printed = 19 if group == "7.16" and number == 10 and "19.Grateley" in rest else number
                marker = re.search(fr"(?<!\d){printed}\.\s*", rest)
                if not marker:
                    break
                result.append(rest[:marker.start()])
                rest = rest[marker.end():]
            result.append(rest)
            return [re.sub(r"\s+", " ", value).strip().strip(",，") for value in result]
    lines = []
    for line in part.splitlines():
        numbered = year == 2019 and re.match(r"^\s*[12]\.", line) and not re.match(r"^\s*1\.5\s+million", line)
        if lines and numbered:
            lines.append(",")
        line = re.sub(r"^\s*[12]\.\s*", "", line.strip()) if numbered else line.strip()
        line = re.sub(r"^.*" + CN + r"\s*[:：]?\s*", "", line)
        if line:
            lines.append(line)
    joined = " ".join(lines)
    # Repairs verified against rendered pages; spelling otherwise follows the PDF.
    if year == 2021:
        joined = joined.replace("packagin g", "packaging")
        joined = joined.replace("walls.concrete", "walls,concrete").replace("architecture.identical", "architecture,identical")
        joined = joined.replace("10,000", "10000")
        joined = joined.replace("farm forest", "farm,forest")
        if group == "6.5":
            joined = re.sub(r"^poppy garden\s+", "", joined)
        if group == "4.29":
            joined = re.sub(r"^Charcol\s+", "", joined)
    if year == 2020 and group == "39":
        joined = re.sub(r"^land dive\s+", "", joined)
    return [re.sub(r"\s+", " ", value).strip() for value in re.split("[,，]", joined) if value.strip()]


def parse_groups(path, year):
    text, offsets = source_text(path, year)
    pattern = r"S\s*1\s*[:：]" if year < 2021 else (
        r"(?m)^(\d{1,2}\.\d{1,2})\s+P1\s*[:：]?" if year == 2021
        else r"(?m)^2022\.(\d{1,2}\.\d{1,2})\s*")
    starts = list(re.finditer(pattern, text, re.I))
    expected = {2019: 24, 2020: 39, 2021: 58, 2022: 44}
    assert len(starts) == expected[year], (year, len(starts))
    groups = []
    for n, boundary in enumerate(starts):
        end = starts[n + 1].start() if n + 1 < len(starts) else len(text)
        raw = text[boundary.start():end].strip()
        key = str(n + 1) if year < 2021 else boundary.group(1)
        body = raw if year < 2021 else ("P1:" if year == 2021 else "") + text[boundary.end():end]
        parts = list(re.finditer(r"(?:^|\n)\s*([SP])\s*([1-4])\s*[:：]?", body, re.I))
        items = []
        for i, match in enumerate(parts):
            chunk = body[match.end():parts[i + 1].start() if i + 1 < len(parts) else len(body)]
            chunk = re.sub(r"\([^()]*" + CN + r"[^()]*\)", "", chunk)
            # A section's first line can contain an English topic followed by Chinese.
            # Its numeric answer list may begin on that same line (e.g. 2022.5.21 P3).
            lines = chunk.splitlines()
            if lines and re.search(CN, lines[0]):
                lines[0] = re.sub(r"^.*" + CN + r"\s*[:：]?\s*", "", lines[0])
            elif year == 2022 and lines and not re.match(r"\s*1\.", lines[0]):
                # Rebranding, Kakapo and baby party are topic headings.
                if key in ("7.7", "7.23", "12.31"):
                    lines[0] = ""
            for answer in answers_for("\n".join(lines), year, key):
                answer = re.sub(r"\$\s+(?=\d)", "$", answer)
                if not answer or re.search(CN, answer) or not re.match(r"[A-Za-z0-9$£]", answer):
                    raise ValueError((year, key, answer))
                aliases = [value.strip() for value in answer.split("/")]
                if answer == "463 Beacon Street/Avenue":
                    aliases = ["463 Beacon Street", "463 Beacon Avenue"]
                items.append({"id": f"g{year}-{n+1:02d}-{len(items)+1:03d}",
                              "answer": answer, "answers": aliases,
                              "part": match.group(1).upper() + match.group(2),
                              "group": key})
        pages = sorted({number for offset, number in offsets if boundary.start() <= offset < end} |
                       {next(number for offset, number in reversed(offsets) if offset <= boundary.start())})
        groups.append({"key": key, "index": n + 1, "year": year, "pages": pages,
                       "sourceText": raw, "items": items})
    return groups


def build(root):
    sources, by_year = {}, {}
    for year in range(2019, 2023):
        path = next(root.glob(f"{year}*/*.pdf"))
        by_year[year] = parse_groups(path, year)
        sources[str(year)] = {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                              "reviewedPages": list(range(1, len(PdfReader(path).pages) + 1)),
                              "groupCount": len(by_year[year])}
    days = []
    for year, count, offset in [(2019, 24, 23), (2020, 19, 47), (2021, 28, 66), (2022, 7, 94)]:
        for source_day in range(1, count + 1):
            if source_day + offset < 28:
                continue
            groups = by_year[year]
            status = "structure"
            if year == 2019:
                selected = [groups[source_day - 1]]
                alignment = f"按 PDF 第 {source_day} 组与打卡整理表编排；未逐项核对原录音。"
            elif year == 2021 and source_day in VIDEO_2021:
                selected = [next(g for g in groups if g['key'] == key) for key in VIDEO_2021[source_day]]
                status = "video"
                alignment = "已从本日原视频的开头、中段及末段画面核对题组范围；未逐词听校。"
            elif year == 2022:
                selected = groups[(source_day - 1) * 2:source_day * 2]
                status = "video"
                alignment = "已从本日原视频的开头、中段及末段画面核对两个日期题组；未逐词听校。"
            else:
                # Explicit study plan only, never represented as a transcription of the day's recording.
                selected = groups[(source_day - 1) * 2:source_day * 2]
                if source_day == count or (year == 2021 and source_day == 8):
                    selected = groups[(source_day - 1) * 2:39 if year == 2020 else 17]
                status = "practice"
                alignment = "练习编排，未核对原录音：按 PDF 顺序安排连续题组，不代表这段原录音的实际范围。可切换下方 PDF 题组直接自选。"
            day_items = []
            for group in selected:
                for item in group['items']:
                    copied = dict(item)
                    copied['id'] = f"j{year}-d{source_day:02d}-{len(day_items)+1:03d}"
                    day_items.append(copied)
            days.append({"day": source_day + offset, "year": year, "sourceDay": source_day,
                         "pages": sorted({p for g in selected for p in g['pages']}),
                         "groups": [g['key'] for g in selected], "status": status, "alignment": alignment,
                         "items": day_items, "sourceText": "\n\n".join(g['sourceText'] for g in selected)})
    # A source-only selector exposes all PDF groups without inventing additional check-in Days.
    collections = []
    for year, groups in by_year.items():
        for group in groups:
            if year == 2019 and group['index'] < 5:
                continue
            collections.append({**group, "day": f"pdf-{year}-{group['index']}", "sourceDay": None,
                                "label": f"PDF · {year} · " + (f"第{group['key']}组" if year < 2021 else group['key']),
                                "status": "source", "alignment": "按 PDF 原题组练习；此入口不表示新的打卡日。"})
    return {"version": 2, "sources": sources, "days": days, "collections": collections}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data')
    args = parser.parse_args()
    data = build(args.root)
    # Keep every pilot ID, answer and accepted alternative stable.
    previous = json.loads((args.output / 'jijing.json').read_text(encoding='utf-8'))
    for old, new in zip(previous['days'][:3], data['days'][:3]):
        assert [(i['id'], i['answer'], i['answers'], i['part']) for i in old['items']] == [
            (i['id'], i['answer'], i['answers'], i['part']) for i in new['items']], new['day']
    encoded = json.dumps(data, ensure_ascii=False, indent=2)
    (args.output / 'jijing.json').write_text(encoded + '\n', encoding='utf-8')
    (args.output / 'jijing.js').write_text('window.JIJING = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(json.dumps({'days': len(data['days']), 'dayItems': sum(len(d['items']) for d in data['days']),
                      'pdfGroups': len(data['collections']), 'pdfItems': sum(len(d['items']) for d in data['collections'])}))


if __name__ == '__main__':
    main()
