'use strict';
// Native media in disposable Edge contexts, served with HTTP byte ranges.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'page-recording-results');
fs.mkdirSync(output, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/page-recordings.json'), 'utf8'));
const results = [], requests = [];
let failAudio = false;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const isAudio = file.endsWith('.m4a');
  if (isAudio) {
    requests.push({ path: pathname, range: req.headers.range || null });
    if (failAudio) { res.writeHead(503).end(); return; }
  }
  const stat = fs.statSync(file);
  const headers = { 'Content-Type': isAudio ? 'audio/mp4' : file.endsWith('.js') ? 'application/javascript' :
    file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8', 'Accept-Ranges': 'bytes' };
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else { res.writeHead(200, { ...headers, 'Content-Length': stat.size }); fs.createReadStream(file).pipe(res); }
});
let url;
async function test(browser, name, run, width = 1440) {
  failAudio = false;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(() => {
    window.__wordPaused = 0;
    window.Audio = class extends EventTarget {
      constructor(src) { super(); this.src = src; }
      play() { queueMicrotask(() => this.dispatchEvent(new Event('playing'))); return Promise.resolve(); }
      pause() { window.__wordPaused++; }
      load() {} removeAttribute() {}
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url);
    await run(page);
    assert.deepEqual(errors, []);
    results.push({ name, passed: true }); console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, passed: false, error: error.message, errors });
    console.error('FAIL ' + name + ': ' + error.message);
    await page.screenshot({ path: path.join(output, 'failure-' + results.length + '.png') });
  } finally { await context.close(); }
}
async function selectPage(page, number) {
  const vocab = JSON.parse(fs.readFileSync(path.join(root, 'data/vocab.json'), 'utf8'));
  const scenario = vocab.scenarios.find(s => number >= s.startPage && number <= s.endPage);
  await page.locator(`[data-scenario="${scenario.id}"]`).click();
  await page.locator('#pageSelect').selectOption(String(number));
}
async function play(page) {
  await page.locator('audio[data-page-recording]').click({ position: { x: 18, y: 20 } });
  await page.waitForFunction(() => {
    const audio = document.querySelector('audio[data-page-recording]');
    // paused changes synchronously; play/playing handlers run in later media tasks.
    // On resume, an existing currentTime must not let us skip those handlers.
    return !audio.paused && audio.currentTime > 0.03 &&
      document.querySelector('#pageRecordingSlot').dataset.recordingState === 'playing';
  });
}
(async () => {
  assert.deepEqual(manifest.pages.map(p => p.page), Array.from({ length: 29 }, (_, i) => i + 2));
  for (const entry of manifest.pages) {
    const bytes = fs.readFileSync(path.join(root, entry.src));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/#/learn`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    await test(browser, 'no recording bytes load at startup; desktop control is to the right of page number', async page => {
      const before = requests.length;
      assert.equal(await page.locator('audio').getAttribute('preload'), 'none');
      assert.equal(await page.locator('.page-recording button').isVisible(), false);
      const aligned = await page.evaluate(() => {
        const badge = document.querySelector('.pagenum').getBoundingClientRect();
        const player = document.querySelector('.page-recording').getBoundingClientRect();
        return player.left > badge.right && Math.abs(player.top - badge.top) < 20;
      });
      assert.ok(aligned);
      await page.locator('#pageSelect').selectOption('3');
      assert.equal(requests.length, before);
    });
    await test(browser, 'all 29 page recordings decode and actually start playing', async page => {
      for (const entry of manifest.pages) {
        await selectPage(page, entry.page);
        await play(page);
        const actual = await page.locator('audio').evaluate(a => ({ duration: a.duration, src: a.currentSrc }));
        assert.ok(Math.abs(actual.duration - entry.duration) < 0.1, 'Duration p' + entry.page);
        assert.ok(actual.src.endsWith(entry.src));
        await page.locator('audio').evaluate(a => a.pause());
      }
    });
    await test(browser, 'seek, pause/resume and same-page wrong marks retain the native audio position', async page => {
      await selectPage(page, 27); await play(page);
      await page.locator('audio').evaluate(a => { a.currentTime = 45; });
      await page.waitForFunction(() => document.querySelector('audio').currentTime >= 45 && !document.querySelector('audio').seeking);
      await page.locator('[data-wmark]').first().click();
      await page.locator('[data-wtag="listening"]').click();
      await page.locator('[data-wconfirm]').click();
      assert.equal(await page.locator('audio').evaluate(a => a.paused), false);
      assert.ok(await page.locator('audio').evaluate(a => a.currentTime >= 45));
      await page.locator('audio').evaluate(a => a.pause());
      const position = await page.locator('audio').evaluate(a => a.currentTime);
      await play(page);
      assert.ok(await page.locator('audio').evaluate((a, pos) => a.currentTime >= pos, position));
      await page.screenshot({ path: path.join(output, 'p27-desktop.png') });
    });
    await test(browser, 'page changes stop and release the old recording; late errors cannot affect the new page', async page => {
      await play(page);
      await page.evaluate(() => { window.__oldRecording = document.querySelector('audio'); });
      await page.locator('[data-page-next]').click();
      assert.equal(await page.locator('audio').getAttribute('data-page-recording'), '3');
      assert.equal(await page.locator('audio').evaluate(a => a.paused && a.currentTime === 0), true);
      assert.equal(await page.evaluate(() => window.__oldRecording.paused && !window.__oldRecording.getAttribute('src')), true);
      await page.evaluate(() => window.__oldRecording.dispatchEvent(new Event('error')));
      assert.equal(await page.locator('#pageRecordingSlot').getAttribute('data-recording-state'), 'ready');
    });
    await test(browser, 'search and route switches stop recording and never autoplay another page', async page => {
      await play(page);
      await page.evaluate(() => { window.__oldRecording = document.querySelector('audio'); });
      await page.locator('#searchInput').fill('agriculture');
      assert.equal(await page.locator('audio').count(), 0);
      assert.equal(await page.evaluate(() => window.__oldRecording.paused), true);
      await page.locator('#searchInput').fill('');
      assert.equal(await page.locator('audio').evaluate(a => a.paused), true);
      await play(page);
      await page.locator('#jijingLibrary').click();
      assert.equal(await page.locator('audio').count(), 0);
      await page.locator('#sceneLibrary').click();
      assert.equal(await page.locator('audio').evaluate(a => a.paused), true);
    });
    await test(browser, 'word audio and original page recording interrupt each other', async page => {
      await play(page);
      await page.locator('[data-speak]').first().click();
      assert.equal(await page.locator('audio').evaluate(a => a.paused), true);
      assert.equal(await page.evaluate(() => !!window.VocabAudio.current), true);
      await play(page);
      assert.equal(await page.evaluate(() => window.VocabAudio.current), null);
      assert.ok(await page.evaluate(() => window.__wordPaused > 0));
    });
    await test(browser, 'load errors are visible and one manual retry restores original playback', async page => {
      failAudio = true;
      await page.locator('audio').click({ position: { x: 18, y: 20 } });
      await page.locator('.page-recording-error').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.page-recording button').isVisible(), true);
      failAudio = false;
      await page.locator('.page-recording button').click();
      await page.waitForFunction(() => document.querySelector('audio').currentTime > 0.03 && !document.querySelector('audio').paused);
      assert.equal(await page.locator('.page-recording-error').isVisible(), false);
    });
    for (const width of [320, 375, 390]) {
      await test(browser, 'mobile recording controls do not overflow at ' + width, async page => {
        await selectPage(page, 27); await play(page);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, 'p27-' + width + '.png') });
      }, width);
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ pages: 29, mediaBytes: manifest.pages.reduce((n, p) => n + p.bytes, 0), results }, null, 2));
  console.log(results.filter(r => r.passed).length + '/' + results.length + ' page-recording workflows passed');
  process.exitCode = results.some(r => !r.passed) ? 1 : 0;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
