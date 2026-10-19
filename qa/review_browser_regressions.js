'use strict';
// Fresh, disposable browser contexts. Never attach to the user's browser/profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'review-results');
fs.mkdirSync(output, { recursive: true });
const url = pathToFileURL(path.join(root, 'index.html')).href;
const results = [];
const silentAudio = () => {
  window.__plays = [];
  window.Audio = class extends EventTarget {
    constructor(src) { super(); this.src = src; }
    play() {
      window.__plays.push(this.src);
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    }
    pause() {}
    load() {}
    removeAttribute(name) { if (name === 'src') this.src = ''; }
  };
};
async function check(browser, name, run, init, viewport) {
  const context = await browser.newContext({ viewport: viewport || { width: 1440, height: 900 } });
  const errors = [];
  await context.addInitScript(silentAudio);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url);
    await run(page);
    assert.deepEqual(errors, [], 'No uncaught page errors');
    results.push({ name, passed: true });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, passed: false, error: error.message, pageErrors: errors });
    console.error('FAIL ' + name + ': ' + error.message);
    await page.screenshot({ path: path.join(output, 'failure-' + results.length + '.png'), fullPage: true });
  } finally { await context.close(); }
}
async function go(page, hash) { await page.goto(url + hash); }
async function start(page) {
  await go(page, '#/dictation');
  await page.locator('[data-dstart]').click();
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    await check(browser, 'learning data, pagination, source notes and unchanged word count', async page => {
      assert.equal(await page.locator('.word-card').count(), 39);
      assert.equal(await page.evaluate(() => window.VOCAB.words.length), 1078);
      assert.notEqual(await page.evaluate(() => document.activeElement.id), 'searchInput');
      await page.locator('#pageSelect').selectOption('3');
      assert.equal(await page.locator('.source-note').count(), 2);
      assert.match(await page.locator('.source-note').first().innerText(), /hotel/);
      await page.screenshot({ path: path.join(output, 'source-notes-desktop.png'), fullPage: true });
    });
    await check(browser, 'early exit with zero answers has no artificial zero-percent grade', async page => {
      await start(page);
      await page.locator('[data-dend]').click();
      assert.match(await page.locator('#app').innerText(), /已作答 0 题，未作答 161 题/);
      assert.match(await page.locator('#app').innerText(), /暂无成绩/);
    });
    await check(browser, 'early exit scores submitted answers only and retains planned range', async page => {
      await start(page);
      await page.locator('#quizInput').fill('adults');
      await page.locator('[data-dsubmit]').click();
      await page.locator('[data-dend]').click();
      assert.match(await page.locator('#app').innerText(), /答对 \/ 已答 1 题（100%）/);
      assert.match(await page.locator('#app').innerText(), /未作答 160 题/);
      await page.screenshot({ path: path.join(output, 'score-desktop.png'), fullPage: true });
    });
    await check(browser, 'wrong answer stores reason tags, reload retains history, single review works', async page => {
      await start(page);
      await page.locator('#quizInput').fill('adult');
      await page.locator('[data-dsubmit]').click();
      await go(page, '#/wrong');
      assert.match(await page.locator('.wrong-item').innerText(), /adults/);
      assert.equal(await page.locator('[data-single-quiz]').count(), 1);
      await page.reload();
      assert.equal(await page.locator('[data-single-quiz]').count(), 1);
      await page.locator('[data-single-quiz]').click();
      assert.equal(await page.locator('.quiz-progress').innerText(), '第 1 / 1 题');
      await page.locator('#quizInput').fill('adults');
      await page.locator('[data-dsubmit]').click();
      await page.locator('[data-dfinish]').click();
      assert.match(await page.locator('#app').innerText(), /单词重练/);
      assert.match(await page.locator('#app').innerText(), /100%/);
    });
    await check(browser, 'manual reason tags survive dictation and mastered/unmastered transitions', async page => {
      await page.locator('[data-wmark="p02-001"]').click();
      await page.locator('[data-wtag="meaning"]').click();
      await page.locator('[data-wconfirm]').click();
      await start(page);
      await page.locator('#quizInput').fill('adult');
      await page.locator('[data-dsubmit]').click();
      const data = await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsVocab.wrong')).adults);
      assert.deepEqual(data.reasonTags, ['meaning', 'spelling']);
      assert.equal(data.count, 1);
      await go(page, '#/wrong');
      await page.locator('[data-master]').click();
      await page.locator('[data-toggle-mastered]').click();
      assert.equal(await page.locator('[data-unmaster]').count(), 1);
      await page.locator('[data-unmaster]').click();
      assert.equal(await page.locator('[data-single-quiz]').count(), 1);
    });
    await check(browser, 'old wrong, mastered and learned storage is preserved', async page => {
      await go(page, '#/wrong');
      assert.match(await page.locator('#app').innerText(), /adults/);
      await page.locator('[data-toggle-mastered]').click();
      assert.match(await page.locator('#app').innerText(), /parking lot/);
      const old = await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsVocab.learned')));
      assert.equal(old['p02-001'], 1);
    }, () => {
      if (localStorage.getItem('qa.seeded')) return;
      localStorage.setItem('ieltsVocab.wrong', JSON.stringify({ adults: { headword: 'adults', wordId: 'p02-001', count: 2 } }));
      localStorage.setItem('ieltsVocab.mastered', JSON.stringify({ 'parking lot': 1 }));
      localStorage.setItem('ieltsVocab.learned', JSON.stringify({ 'p02-001': 1 }));
      localStorage.setItem('qa.seeded', '1');
    });
    await check(browser, 'IME composition does not replace the focused search element', async page => {
      const result = await page.evaluate(() => {
        const input = document.getElementById('searchInput');
        input.focus();
        input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        input.value = '租';
        input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
        const retained = document.getElementById('searchInput') === input;
        input.value = '租金';
        input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        return { retained, query: document.getElementById('searchInput').value, hits: document.querySelectorAll('.search-item').length };
      });
      assert.equal(result.retained, true);
      assert.equal(result.query, '租金');
      assert.ok(result.hits > 0);
    });
    await check(browser, 'blocked storage reports unsaved records without breaking UI', async page => {
      await page.locator('[data-wmark="p02-001"]').click();
      await page.locator('[data-wtag="spelling"]').click();
      await page.locator('[data-wconfirm]').click();
      assert.match(await page.locator('#appNotice').innerText(), /未能保存/);
      assert.equal(await page.locator('.word-card.marked').count(), 1);
    }, () => {
      Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
    });
    await check(browser, 'navigation cancels pending autoplay and accent switch schedules once', async page => {
      await start(page);
      await page.waitForFunction(() => window.__plays.length === 1);
      await page.locator('[data-daccent="us"]').click();
      await page.waitForFunction(() => window.__plays.length === 2);
      await page.waitForTimeout(350);
      assert.equal(await page.evaluate(() => window.__plays.length), 2);
      assert.match(await page.evaluate(() => window.__plays[1]), /type=2$/);
      await page.locator('#mainTabs [data-route="learn"]').click();
      const before = await page.evaluate(() => window.__plays.length);
      await page.waitForTimeout(350);
      assert.equal(await page.evaluate(() => window.__plays.length), before);
      assert.equal(await page.evaluate(() => window.VocabAudio.current), null);
    });
    await check(browser, 'unreadable existing data is reported and never overwritten', async page => {
      await page.locator('[data-wmark="p02-001"]').click();
      await page.locator('[data-wtag="spelling"]').click();
      await page.locator('[data-wconfirm]').click();
      assert.match(await page.locator('#appNotice').innerText(), /未覆盖原数据/);
      assert.equal(await page.evaluate(() => localStorage.getItem('ieltsVocab.wrong')), '{broken-record');
    }, () => { localStorage.setItem('ieltsVocab.wrong', '{broken-record'); });
    for (const width of [375, 390]) {
      await check(browser, 'mobile ' + width + ' learning, wrong book and quiz do not overflow', async page => {
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok(await page.locator('#mainTabs .tab').first().evaluate(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect().height < 30;
        }), 'Navigation labels must remain on one line');
        await page.locator('[data-wmark="p02-001"]').click();
        await page.locator('[data-wtag="listening"]').click();
        await page.locator('[data-wconfirm]').click();
        await go(page, '#/wrong');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, 'wrong-mobile-' + width + '.png'), fullPage: true });
        await page.locator('[data-single-quiz]').click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, 'quiz-mobile-' + width + '.png'), fullPage: true });
      }, null, { width, height: 844 });
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter(result => !result.passed).length;
  console.log(`${results.length - failed}/${results.length} browser regressions passed`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
