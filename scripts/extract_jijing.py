"""Extract the reviewed 2019 pilot groups without altering the source PDF.

Usage: python scripts/extract_jijing.py --source /path/to/2019.pdf
The 24 S1 starts are structural group boundaries, not printed Day headings.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader


def extract(source):
    pages = []
    for number, page in enumerate(PdfReader(str(source)).pages, 1):
        text = page.extract_text() or ""
        lines = [line for line in text.splitlines()
                 if not re.fullmatch(r"\s*\d+\s*", line)
                 and "2019 听力机经词汇" not in line]
        pages.append((number, "\n".join(lines)))
    text = ""
    page_starts = []
    for number, content in pages:
        page_starts.append((len(text), number))
        text += content + "\n"
    boundaries = list(re.finditer(r"S\s*1\s*[:：]", text, re.I))
    if len(boundaries) != 24:
        raise ValueError(f"Expected 24 source groups; found {len(boundaries)}")

    days = []
    for source_day in (5, 6, 7):
        start = boundaries[source_day - 1].start()
        end = boundaries[source_day].start()
        raw = text[start:end].strip()
        parts = list(re.finditer(r"S\s*([1-4])\s*[:：]", raw, re.I))
        items = []
        for index, part in enumerate(parts):
            part_end = parts[index + 1].start() if index + 1 < len(parts) else len(raw)
            lines = []
            for line in raw[part.end():part_end].splitlines():
                if lines and re.match(r"^\s*[12]\.", line):
                    lines.append(",")
                line = re.sub(r"^\s*[12]\.\s*", "", line.strip())
                # In this reviewed pilot, Chinese text is the preceding topic heading.
                line = re.sub(r"^.*[\u4e00-\u9fff]\s*", "", line)
                if line:
                    lines.append(line)
            answers = [re.sub(r"\s+", " ", word).strip()
                       for word in " ".join(lines).split(",")]
            for answer in filter(None, answers):
                if not re.fullmatch(r"[A-Za-z0-9 /.'’$%&()\-]+", answer):
                    raise ValueError(f"Unreviewed token in group {source_day}: {answer}")
                items.append({
                    "id": f"j2019-d{source_day:02d}-{len(items) + 1:03d}",
                    "answer": answer,
                    "answers": [value.strip() for value in answer.split("/")],
                    "part": "S" + part.group(1),
                })
        relevant_pages = sorted({number for offset, number in page_starts
                                 if start <= offset < end} |
                                {next(number for offset, number in reversed(page_starts)
                                      if offset <= start)})
        days.append({
            "day": source_day + 23,
            "year": 2019,
            "sourceDay": source_day,
            "pages": relevant_pages,
            "alignment": f"本日按 PDF 第 {source_day} 组与打卡整理表编排；尚未逐项核对原录音。",
            "items": items,
            "sourceText": raw,
        })
    expected = {28: 40, 29: 38, 30: 32}
    for day in days:
        if len(day["items"]) != expected[day["day"]]:
            raise ValueError(f"Reviewed pilot count changed: {day['day']}")
    return {
        "version": 1,
        "source": {"file": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                   "reviewedPages": [1, 2], "groupCount": 24},
        "days": days,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    args = parser.parse_args()
    data = extract(args.source)
    args.output.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(data, ensure_ascii=False, indent=2)
    (args.output / "jijing.json").write_text(encoded + "\n", encoding="utf-8")
    (args.output / "jijing.js").write_text("window.JIJING = " + encoded + ";\n", encoding="utf-8")
    print({day["day"]: len(day["items"]) for day in data["days"]})


if __name__ == "__main__":
    main()
