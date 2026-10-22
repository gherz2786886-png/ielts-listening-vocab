'use strict';
// Real MP3 decoding and app playback, independent of dictionary and OS voices.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'connected-speech-results');
fs.mkdirSync(output, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/jijing-recordings.json'), 'utf8'));
const inventory = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts/list_jijing_readouts.js')], { encoding: 'utf8' }));
assert.deepEqual(Object.keys(manifest.clips).sort(), inventory.texts);
for (const accents of Object.values(manifest.clips)) for (const clip of Object.values(accents)) {
  const bytes = fs.readFileSync(path.join(root, clip.src));
  assert.equal(bytes.length, clip.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), clip.sha256);
}
const mediaRequests = [], errors = [], results = [];
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const stat = fs.statSync(file);
  if (file.endsWith('.mp3')) mediaRequests.push(relative);
  const headers = { 'Content-Type': file.endsWith('.mp3') ? 'audio/mpeg' : file.endsWith('.js') ? 'application/javascript' :
    file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8', 'Accept-Ranges': 'bytes' };
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else { res.writeHead(200, { ...headers, 'Content-Length': stat.size }); fs.createReadStream(file).pipe(res); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.__nativeClips = [];
    window.Audio = function (src) { const audio = new NativeAudio(src); window.__nativeClips.push(audio); return audio; };
    // No speech service is available in this fixture: known source readouts must still play.
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/#/jijing/learn`);
    assert.equal(mediaRequests.length, 0, 'No audio downloaded before playback');
    const scenarios = [
      ['29', 'j2019-d06-005', 'the first of August'],
      ['28', 'j2019-d05-003', 'back door'],
      ['28', 'j2019-d05-004', 'two seven one nine six three']
    ];
    for (const [day, id, text] of scenarios) for (const accent of ['uk', 'us']) {
      await page.locator('#jDay').selectOption(day);
      await page.locator('#jAccent').selectOption(accent);
      const before = await page.evaluate(() => window.__nativeClips.length);
      await page.locator(`[data-jplay="${id}"]`).click();
      await page.waitForFunction(() => /连读音频/.test(document.querySelector('#jPlayback').textContent) &&
        window.__nativeClips.at(-1).currentTime > 0.03);
      const actual = await page.evaluate(() => {
        const audio = window.__nativeClips.at(-1);
        return { src: audio.currentSrc, time: audio.currentTime, duration: audio.duration,
          elements: window.__nativeClips.length, starts: Number(document.querySelector('#jPlayback').dataset.starts) };
      });
      const clip = manifest.clips[text][accent];
      assert.ok(actual.src.endsWith(clip.src));
      assert.ok(Math.abs(actual.duration - clip.duration) < 0.2);
      assert.equal(actual.elements - before, 1);
      assert.equal(actual.starts, 1);
      await page.waitForFunction(() => window.VocabAudio.current === null, null, { timeout: 10000 });
      assert.equal(await page.locator('#appNotice').isVisible(), false);
      results.push({ text, accent, duration: actual.duration, starts: actual.starts, passed: true });
      console.log('PASS complete native recording: ' + accent + ' / ' + text);
    }
    // Both voices for representative money and code readouts also decode and play.
    for (const text of ['twenty-five thousand dollars', 'A C eight double three T', 'eight pounds and fifty pence']) {
      for (const accent of ['uk', 'us']) {
        const clip = manifest.clips[text][accent];
        await page.evaluate(src => new Promise((resolve, reject) => {
          const audio = new Audio(src);
          audio.onerror = () => reject(new Error('Native MP3 decode failed'));
          audio.onplaying = () => setTimeout(() => { audio.pause(); audio.removeAttribute('src'); audio.load(); resolve(); }, 80);
          audio.play().catch(reject);
        }), '/' + clip.src);
        results.push({ text, accent, passed: true });
        console.log('PASS native money/code sample: ' + accent + ' / ' + text);
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ sourceReadouts: inventory.sourceCount,
      files: inventory.texts.length * 2, errors, results }, null, 2) + '\n');
  }
  console.log(results.length + '/12 real-media playback samples passed');
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
