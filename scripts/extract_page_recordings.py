"""Copy original AAC tracks into small, seekable M4A files without re-encoding.

Original files are read-only. Verify compressed audio-packet hashes before publishing.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def inspect(probe, path):
    return json.loads(subprocess.check_output([
        str(probe), '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)
    ], encoding='utf-8'))


def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--ffmpeg', type=Path, required=True)
    parser.add_argument('--ffprobe', type=Path, required=True)
    parser.add_argument('--output-root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    sources = {}
    for source in args.source_root.iterdir():
        match = re.match(r'^P(\d+)(?:面)?-顺序版\.mp3$', source.name, re.I)
        if match:
            page = int(match[1])
            if page in sources:
                raise ValueError(f'Duplicate page {page}')
            sources[page] = source
    if sorted(sources) != list(range(2, 31)):
        raise ValueError(f'Expected pages 2-30, got {sorted(sources)}')
    output = args.output_root / 'audio/pages'
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    for page, source in sorted(sources.items()):
        target = output / f'p{page:02d}.m4a'
        if target.exists():
            raise FileExistsError(f'Refusing to overwrite {target}')
        before = inspect(args.ffprobe, source)
        audio = next(stream for stream in before['streams'] if stream['codec_type'] == 'audio')
        if audio['codec_name'] != 'aac':
            raise ValueError(f'Expected AAC for stream copy: {source.name}')
        source_hash = file_hash(source)
        # Both outputs receive the same packets in a single read of the large source.
        command = [str(args.ffmpeg), '-hide_banner', '-v', 'error', '-i', str(source),
                   '-map', '0:a:0', '-c:a', 'copy', '-vn', '-sn', '-dn',
                   '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', '-n', str(target),
                   '-map', '0:a:0', '-c:a', 'copy', '-f', 'hash', '-hash', 'sha256', '-']
        original_packets = subprocess.check_output(command, encoding='utf-8').strip()
        copied_packets = subprocess.check_output([
            str(args.ffmpeg), '-hide_banner', '-v', 'error', '-i', str(target),
            '-map', '0:a:0', '-c:a', 'copy', '-f', 'hash', '-hash', 'sha256', '-'
        ], encoding='utf-8').strip()
        if original_packets != copied_packets:
            raise ValueError(f'Audio packet hash mismatch: {source.name}')
        after = inspect(args.ffprobe, target)
        if len(after['streams']) != 1 or after['streams'][0]['codec_type'] != 'audio':
            raise ValueError(f'Unexpected non-audio streams: {target}')
        entries.append({
            'page': page, 'src': f'audio/pages/{target.name}', 'type': 'audio/mp4',
            'duration': float(after['format']['duration']), 'bytes': target.stat().st_size,
            'sha256': file_hash(target), 'sourceFile': source.name, 'sourceBytes': source.stat().st_size,
            'sourceSha256': source_hash, 'audioPacketSha256': original_packets.split('=')[-1],
        })
        print(json.dumps({'page': page, 'bytes': target.stat().st_size, 'duration': entries[-1]['duration'],
                          'packetCopyVerified': True}), flush=True)
    data = {'version': 1, 'method': 'AAC stream copy, no re-encoding', 'pages': entries}
    (args.output_root / 'data/page-recordings.json').write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (args.output_root / 'data/page-recordings.js').write_text(
        'window.PAGE_RECORDINGS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(json.dumps({'pages': len(entries), 'sourceBytes': sum(e['sourceBytes'] for e in entries),
                      'audioBytes': sum(e['bytes'] for e in entries)}))


if __name__ == '__main__':
    main()
