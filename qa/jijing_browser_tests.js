'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'jijing-results');
fs.mkdirSync(output, { recursive: true });
const url = pathToFileURL(path.join(root, 'index.html')).href;
const results = [];
async function test(browser, name, run, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__plays = [];
    window.Audio = class extends EventTarget {
      constructor(src) { super(); this.src = src; }
      play() { window.__plays.push(this.src); queueMicrotask(() => { this.dispatchEvent(new Event('playing')); this.dispatchEvent(new Event('ended')); }); return Promise.resolve(); }
      load() {} pause() {} removeAttribute(name) { if (name === 'src') this.src = ''; }
    };
  });
  if (options.init) await context.addInitScript(options.init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url + '#/jijing/learn');
    await run(page);
    assert.deepEqual(errors, []);
    results.push({ name, passed: true }); console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, passed: false, error: error.message, errors });
    console.error('FAIL ' + name + ': ' + error.message);
    await page.screenshot({ path: path.join(output, 'failure-' + results.length + '.png'), fullPage: true });
  } finally { await context.close(); }
}
async function listenText(page) {
  return page.evaluate(() => window.__plays.map(url => new URL(url).searchParams.get('audio')));
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    await test(browser, 'library switch and persisted Day selection', async page => {
      assert.equal(await page.locator('[data-jpick]').count(), 40);
      assert.equal(await page.locator('#jijingLibrary').innerText(), '机经词');
      assert.equal(await page.locator('#mainTabs [data-route="dictation"]').getAttribute('href'), '#/jijing/dictation');
      await page.locator('#jDay').selectOption('29');
      assert.equal(await page.locator('[data-jpick]').count(), 38);
      await page.reload();
      assert.equal(await page.locator('#jDay').inputValue(), '29');
      await page.locator('#sceneLibrary').click();
      assert.equal(await page.locator('.word-card').count(), 39);
      assert.equal(await page.locator('#mainTabs [data-route="dictation"]').getAttribute('href'), '#/dictation');
      await page.locator('#jijingLibrary').click();
      assert.equal(await page.locator('#jDay').inputValue(), '29');
    });
    await test(browser, '33 uses double three; numeric mode changes to thirty-three', async page => {
      await page.locator('.j-number-demo summary').click();
      await page.locator('[data-jdemo]').click();
      assert.deepEqual((await listenText(page)).slice(-2), ['double', 'three']);
      assert.match(await page.locator('#jDemoText').innerText(), /33 → double three/);
      await page.locator('#jNumberMode').selectOption('cardinal');
      await page.locator('.j-number-demo summary').click();
      await page.locator('[data-jdemo]').click();
      assert.deepEqual((await listenText(page)).slice(-2), ['thirty', 'three']);
      assert.equal(await page.locator('[data-jpick]').count(), 40);
    });
    await test(browser, 'checkbox selection creates exactly the selected two-item quiz', async page => {
      await page.locator('[data-jselect-none]').click();
      assert.equal(await page.locator('[data-jstart-selected]').isDisabled(), true);
      await page.locator('[data-jpick="j2019-d05-009"]').check();
      await page.locator('[data-jpick="j2019-d05-010"]').check();
      await page.locator('[data-jstart-selected]').click();
      assert.match(await page.locator('.quiz-top').innerText(), /第 1 \/ 2 题/);
      assert.deepEqual(await listenText(page), ['double', 'one'], 'First autoplay must survive routing');
      await page.locator('#jAnswer').fill('11');
      await page.locator('#jAnswer').press('Enter');
      assert.equal(await page.locator('.result-box.ok').count(), 1);
      await page.locator('[data-jnext]').click();
      assert.equal((await listenText(page)).at(-1), 'blue');
      await page.locator('#jAnswer').fill('blue');
      await page.locator('[data-jsubmit]').click();
      await page.locator('[data-jnext]').click();
      assert.match(await page.locator('.panel').innerText(), /已答 2 题，答对 2 题，未答 0 题/);
      assert.equal(await page.locator('.j-score').innerText(), '100%');
    });
    await test(browser, 'wrong answers survive reload independently of scene records', async page => {
      await page.locator('[data-jsingle="j2019-d05-003"]').click();
      await page.locator('#jAnswer').fill('bak door');
      await page.locator('[data-jsubmit]').click();
      assert.equal(await page.locator('.result-box.bad').count(), 1);
      await page.locator('#mainTabs [data-route="wrong"]').click();
      assert.equal(await page.locator('.wrong-item').count(), 1);
      await page.reload();
      assert.match(await page.locator('.wrong-item').innerText(), /bak door → back door/);
      await page.locator('[data-jmaster]').click();
      await page.locator('.panel summary').click();
      await page.locator('[data-junmaster]').click();
      assert.equal(await page.locator('.wrong-item').count(), 1);
      const scene = await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsVocab.wrong')));
      assert.equal(scene.adults.count, 7);
      await page.locator('#sceneLibrary').click();
      assert.equal(await page.locator('#wrongBadge').innerText(), '1');
    }, { init: () => {
      if (!localStorage.getItem('ieltsVocab.wrong')) localStorage.setItem('ieltsVocab.wrong', JSON.stringify({ adults: { headword: 'adults', wordId: 'p02-001', count: 7, reasonTags: ['meaning'] } }));
    } });
    await test(browser, 'date playback and alternate written date are accepted', async page => {
      await page.locator('#jDay').selectOption('29');
      await page.locator('[data-jsingle="j2019-d06-005"]').click();
      assert.deepEqual(await listenText(page), ['the', 'first', 'of', 'August']);
      await page.locator('#jAnswer').fill('August 1st');
      await page.locator('[data-jsubmit]').click();
      assert.equal(await page.locator('.result-box.ok').count(), 1);
    });
    await test(browser, 'source alternatives 4 and 4.00 remain accepted', async page => {
      await page.locator('[data-jsingle="j2019-d05-015"]').click();
      await page.locator('#jAnswer').fill('4.00');
      await page.locator('[data-jsubmit]').click();
      assert.equal(await page.locator('.result-box.ok').count(), 1);
    });
    await test(browser, 'zero-answer early exit and a new setup do not create fake results', async page => {
      await page.locator('[data-jsingle="j2019-d05-001"]').click();
      await page.locator('[data-jend]').click();
      assert.equal(await page.locator('.j-score').innerText(), '暂无成绩');
      await page.locator('[data-jreset]').click();
      await page.locator('#jScope').selectOption('day');
      await page.locator('#jOrder').selectOption('random');
      await page.locator('[data-jstart]').click();
      assert.match(await page.locator('.quiz-top').innerText(), /\/ 40 题/);
    });
    await test(browser, 'unreadable Jijing data is preserved and visibly reported', async page => {
      await page.locator('[data-jmark="j2019-d05-001"]').click();
      assert.match(await page.locator('#appNotice').innerText(), /未覆盖原数据/);
      assert.equal(await page.evaluate(() => localStorage.getItem('ieltsJijing.v1')), '{broken');
    }, { init: () => localStorage.setItem('ieltsJijing.v1', '{broken') });
    for (const width of [320, 375, 390]) {
      await test(browser, 'responsive item selection and hidden-answer quiz at ' + width, async page => {
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const nav = await page.evaluate(() => {
          const brand = document.querySelector('.brand').getBoundingClientRect();
          const tabs = document.querySelector('.tabs').getBoundingClientRect();
          return brand.right <= tabs.left + 1 || brand.bottom <= tabs.top + 1;
        });
        assert.ok(nav, 'Brand and navigation do not overlap');
        await page.screenshot({ path: path.join(output, 'learn-' + width + '.png'), fullPage: true });
        await page.locator('[data-jsingle="j2019-d05-009"]').click();
        assert.equal(await page.locator('#app').innerText().then(text => text.includes('double one')), false, 'Do not reveal the answer or its spoken form before submission');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, 'quiz-' + width + '.png'), fullPage: true });
      }, { viewport: { width, height: 844 } });
    }
    await test(browser, 'desktop learning view, data and readout type remain visible', async page => {
      await page.screenshot({ path: path.join(output, 'learn-desktop.png'), fullPage: false });
      await page.locator('.j-number-demo summary').click();
      await page.locator('[data-jdemo]').click();
      await page.screenshot({ path: path.join(output, 'double-three-desktop.png'), fullPage: false });
    });
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(results.filter(result => result.passed).length + '/' + results.length + ' Jijing browser workflows passed');
  process.exitCode = results.some(result => !result.passed) ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
