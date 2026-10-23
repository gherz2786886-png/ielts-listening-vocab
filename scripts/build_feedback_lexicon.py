"""Build a bounded local pronunciation index; raw CMU data stays outside the repo."""
import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REVISION = '74790861f652b15e4ac49015a90074ad62a27690'
BASE = f'https://raw.githubusercontent.com/cmusphinx/cmudict/{REVISION}/'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    for name in ['cmudict.dict', 'LICENSE']:
        cached = args.cache / name
        if not cached.exists():
            with urllib.request.urlopen(BASE + name, timeout=40) as response:
                cached.write_bytes(response.read())
    entries = defaultdict(list)
    for line in (args.cache / 'cmudict.dict').read_text(encoding='utf-8').splitlines():
        word, _, phones = line.partition(' ')
        word = re.sub(r'\(\d+\)$', '', word)
        if not re.fullmatch(r"[a-z]+(?:'[a-z]+)?", word):
            continue
        phones = re.sub('[012]', '', phones.split('#')[0]).strip()
        if phones and phones not in entries[word]:
            entries[word].append(phones)
    seeds = {'loyal', 'although', 'hot', 'cold', 'waste', 'west'}
    vocab = json.loads((ROOT / 'data/vocab.json').read_text(encoding='utf-8'))
    jijing = json.loads((ROOT / 'data/jijing.json').read_text(encoding='utf-8'))

    def collect(value):
        if isinstance(value, str):
            seeds.update(re.findall(r"[a-z]+(?:'[a-z]+)?", value.lower()))
        elif isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, dict):
            for key in ['display', 'headwords', 'answer', 'answers', 'words', 'items', 'days', 'collections']:
                if key in value:
                    collect(value[key])

    collect(vocab)
    collect(jijing)
    # One-phoneme neighbours cover additional submitted words without shipping the full dictionary.
    signatures = set()
    for word in seeds:
        for phones in entries.get(word, []):
            parts = phones.split()
            signatures.add(tuple(parts))
            signatures.update(tuple(parts[:i] + parts[i + 1:]) for i in range(len(parts)))
    selected = {}
    for word, readings in entries.items():
        if word in seeds:
            selected[word] = readings
            continue
        for phones in readings:
            parts = phones.split()
            if len(parts) < 4:
                continue
            if tuple(parts) in signatures or any(tuple(parts[:i] + parts[i + 1:]) in signatures for i in range(len(parts))):
                selected[word] = readings
                break
    data = {'source': 'CMUdict US English; pronunciation similarity is only a hint', 'revision': REVISION,
            'entries': dict(sorted(selected.items()))}
    target = ROOT / 'data/feedback-lexicon.js'
    target.write_text('/* CMUdict-derived subset. License: data/CMUDICT-LICENSE.txt */\nwindow.FEEDBACK_LEXICON = ' +
                      json.dumps(data, ensure_ascii=True, separators=(',', ':')) + ';\n', encoding='utf-8')
    (ROOT / 'data/CMUDICT-LICENSE.txt').write_bytes((args.cache / 'LICENSE').read_bytes())
    report = {'revision': REVISION, 'words': len(selected), 'bytes': target.stat().st_size,
              'rawSha256': hashlib.sha256((args.cache / 'cmudict.dict').read_bytes()).hexdigest(),
              'sourceWordCount': len(seeds), 'sourceWordsCovered': len(seeds.intersection(entries))}
    (ROOT / 'data/feedback-lexicon-source.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
