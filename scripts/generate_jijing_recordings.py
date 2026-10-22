"""Generate whole readouts once for static hosting; no runtime service or API key.

Maintenance dependencies: edge-tts 7.3.1, Node.js, FFmpeg and FFprobe.
Existing validated clips are reused. Retries are bounded; incomplete runs do not
publish a partial manifest. No original source media or browser records are read.
"""
import argparse
import asyncio
import hashlib
import json
import subprocess
import urllib.request
from pathlib import Path


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--ffprobe', required=True)
    parser.add_argument('--tool-deps', type=Path)
    parser.add_argument('--concurrency', type=int, default=4)
    args = parser.parse_args()
    if args.tool_deps:
        import sys
        sys.path.insert(0, str(args.tool_deps))
    import edge_tts
    inventory = json.loads(subprocess.check_output(
        ['node', str(args.root / 'scripts/list_jijing_readouts.js')], encoding='utf-8'))
    folder = args.root / 'audio/jijing'
    folder.mkdir(parents=True, exist_ok=True)
    voices = {'uk': 'en-GB-SoniaNeural', 'us': 'en-US-JennyNeural'}
    semaphore = asyncio.Semaphore(max(1, min(args.concurrency, 6)))
    proxy = urllib.request.getproxies().get('https')
    entries = {text: {} for text in inventory['texts']}
    completed = 0
    failures = []

    def inspect(target):
        info = json.loads(subprocess.check_output([args.ffprobe, '-v', 'error',
            '-show_format', '-show_streams', '-of', 'json', str(target)], encoding='utf-8'))
        if len(info['streams']) != 1 or info['streams'][0]['codec_type'] != 'audio':
            raise ValueError('Expected audio only')
        duration = float(info['format']['duration'])
        if duration <= 0.1 or target.stat().st_size < 1000:
            raise ValueError('Empty or too short recording')
        subprocess.run([args.ffmpeg, '-hide_banner', '-v', 'error', '-i', str(target),
                        '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        return {'src': 'audio/jijing/' + target.name, 'duration': duration,
                'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}

    async def generate(text, accent, voice):
        nonlocal completed
        async with semaphore:
            digest = hashlib.sha256(text.encode('utf-8')).hexdigest()[:20]
            target = folder / f'{digest}-{accent}.mp3'
            try:
                if target.exists():
                    result = await asyncio.to_thread(inspect, target)
                else:
                    partial = target.with_suffix('.partial.mp3')
                    for attempt in range(2):
                        try:
                            await asyncio.wait_for(edge_tts.Communicate(text, voice, rate='-5%',
                                proxy=proxy, connect_timeout=10, receive_timeout=20).save(str(partial)), 35)
                            result = await asyncio.to_thread(inspect, partial)
                            partial.rename(target)
                            result['src'] = 'audio/jijing/' + target.name
                            break
                        except Exception:
                            if attempt: raise
                            await asyncio.sleep(2)
                entries[text][accent] = result
                completed += 1
                if completed % 25 == 0 or completed == len(entries) * 2:
                    print(json.dumps({'completed': completed, 'total': len(entries) * 2}), flush=True)
            except Exception as error:
                failures.append({'text': text, 'accent': accent, 'error': type(error).__name__ + ': ' + str(error)[:180]})
                print(json.dumps(failures[-1]), flush=True)

    await asyncio.gather(*(generate(text, accent, voice) for text in inventory['texts'] for accent, voice in voices.items()))
    if failures:
        raise RuntimeError(f'{len(failures)} clips failed; existing output retained, manifest not published')
    manifest = {'version': 1, 'generator': 'edge-tts ' + edge_tts.__version__,
                'rate': '-5%', 'voices': voices, 'sourceReadouts': inventory['sourceCount'], 'clips': entries}
    (args.root / 'data/jijing-recordings.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    browser = {'version': 1, 'clips': {text: {accent: value['src'] for accent, value in clips.items()}
                                    for text, clips in entries.items()}}
    (args.root / 'data/jijing-recordings.js').write_text(
        'window.JIJING_RECORDINGS = ' + json.dumps(browser, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(json.dumps({'readouts': len(entries), 'files': completed,
                      'bytes': sum(clip['bytes'] for clips in entries.values() for clip in clips.values())}), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
