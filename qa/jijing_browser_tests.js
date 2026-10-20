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
function holdWordAudio() {
  window.__heldAudios = [];
  window.Audio = class extends EventTarget {
    constructor(src) { super(); this.src = src; this.paused = true; window.__heldAudios.push(this); }
    play() { this.paused = false; window.__plays.push(this.src); queueMicrotask(() => this.dispatchEvent(new Event('playing'))); return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {} removeAttribute(name) { if (name === 'src') this.src = ''; }
  };
  if (!localStorage.getItem('ieltsJijing.v1')) localStorage.setItem('ieltsJijing.v1', JSON.stringify({
    settings: { day: 28, accent: 'uk' },
    records: { 'j2019-d05-003': { attempts: 4, errors: 2, wrong: true, lastInput: 'bak door', lastReason: '拼写错误' } }
  }));
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    await test(browser, 'all 74 days and 161 PDF groups render with their source counts', async page => {
      const expected = JSON.parse(fs.readFileSync(path.join(root, 'data/jijing.json'), 'utf8'));
      assert.equal(await page.locator('#jDay option').count(), 235);
      for (const entry of expected.days.concat(expected.collections)) {
        await page.locator('#jDay').selectOption(String(entry.day));
        assert.equal(await page.locator('[data-jpick]').count(), entry.items.length, String(entry.day));
        assert.match(await page.locator('.j-alignment').innerText(), new RegExp(entry.year + '机经词汇.pdf'));
      }
    });
    await test(browser, 'practice-only alignment is prominent; video ranges retain repeated groups', async page => {
      await page.locator('#jDay').selectOption('48');
      assert.match(await page.locator('.j-alignment[role="note"]').innerText(), /练习编排，未核对原录音/);
      await page.locator('#jDay').selectOption('91');
      assert.match(await page.locator('.j-alignment').innerText(), /题组 11.6、11.11、11.20、11.27/);
      await page.locator('#jDay').selectOption('101');
      assert.match(await page.locator('.j-alignment').innerText(), /题组 4.23、4.30/);
      assert.equal(await page.locator('[data-jpick]').count(), 40);
      await page.screenshot({ path: path.join(output, 'day101-desktop.png'), fullPage: false });
    });
    await test(browser, 'PDF source-only selection persists and can be graded without a fabricated Day', async page => {
      await page.locator('#jDay').selectOption('pdf-2022-44');
      await page.reload();
      assert.equal(await page.locator('#jDay').inputValue(), 'pdf-2022-44');
      assert.match(await page.locator('.j-heading').innerText(), /PDF · 2022 · 12.31/);
      await page.locator('[data-jsingle]').first().click();
      assert.match(await page.locator('.quiz-top').innerText(), /PDF · 2022 · 12.31/);
      await page.locator('#jAnswer').fill('125');
      await page.locator('[data-jsubmit]').click();
      assert.equal(await page.locator('.result-box.ok').count(), 1);
    });
    await test(browser, 'existing pilot wrong-item history remains usable after extension', async page => {
      assert.equal(await page.locator('#jDay').inputValue(), '30');
      await page.locator('#mainTabs [data-route="wrong"]').click();
      assert.match(await page.locator('.wrong-item').innerText(), /bak door → back door/);
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsJijing.v1')).records);
      await page.locator('#mainTabs [data-route="learn"]').click();
      await page.locator('#jDay').selectOption('101');
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsJijing.v1')).records), before);
    }, { init: () => {
      if (!localStorage.getItem('ieltsJijing.v1')) localStorage.setItem('ieltsJijing.v1', JSON.stringify({settings:{day:30},records:{'j2019-d05-003':{attempts:4,errors:2,wrong:true,lastInput:'bak door',lastReason:'拼写错误'}}}));
    } });
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
    for (const [name, control, value] of [
      ['day change', '#jDay', '29'],
      ['PDF group change', '#jDay', 'pdf-2022-44'],
      ['accent change', '#jAccent', 'us']
    ]) {
      await test(browser, name + ' stops old audio and queued fragments without changing records', async page => {
        const records = await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsJijing.v1')).records);
        await page.locator('[data-jplay="j2019-d05-004"]').click();
        await page.waitForFunction(() => window.__heldAudios.length === 1 && !!window.VocabAudio.current);
        await page.locator(control).selectOption(value);
        assert.equal(await page.evaluate(() => window.VocabAudio.current), null, 'Old audio is still active after changing settings');
        assert.equal(await page.evaluate(() => window.__heldAudios[0].paused && !window.__heldAudios[0].src), true);
        await page.evaluate(() => {
          window.__heldAudios[0].dispatchEvent(new Event('ended'));
          window.__heldAudios[0].dispatchEvent(new Event('playing'));
        });
        assert.equal(await page.evaluate(() => window.__plays.length), 1, 'Cancelled sequence must not start the next fragment');
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsJijing.v1')).records), records);
        assert.equal(await page.locator('#jPlayback').innerText(), '发音就绪');
        await page.locator('[data-jplay]').first().click();
        await page.waitForFunction(() => window.__heldAudios.length === 2);
        assert.equal(await page.evaluate(() => new URL(window.__plays[1]).searchParams.get('type')), control === '#jAccent' ? '2' : '1');
        await page.reload();
        assert.equal(await page.locator(control).inputValue(), value);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsJijing.v1')).records), records);
      }, { init: holdWordAudio });
    }
    await test(browser, 'automatic code, phone, number and money readings have no manual selector', async page => {
      assert.equal(await page.locator('#jNumberMode').count(), 0);
      await page.locator('.j-number-demo summary').click();
      await page.locator('[data-jdemo]').click();
      assert.deepEqual(await listenText(page), ['A', 'C', 'eight', 'three', 'two', 'T']);
      assert.match(await page.locator('#jDemoText').innerText(), /AC832T → A C eight three two T/);
      for (const [value, expected] of [
        ['Phone: 33', ['double', 'three']],
        ['33', ['thirty', 'three']],
        ['$25000', ['twenty', 'five', 'thousand', 'dollars']],
        ['8.50 pounds', ['eight', 'pounds', 'and', 'fifty', 'pence']],
        ['AC833T', ['A', 'C', 'eight', 'double', 'three', 'T']]
      ]) {
        const before = (await listenText(page)).length;
        await page.locator('#jDemo').fill(value);
        await page.locator('[data-jdemo]').click();
        assert.deepEqual((await listenText(page)).slice(before), expected, value);
      }
      await page.screenshot({path:path.join(output,'automatic-reading-desktop.png'),fullPage:false});
      await page.locator('#mainTabs [data-route="dictation"]').click();
      assert.equal(await page.locator('#jNumberMode').count(), 0);
      assert.doesNotMatch(await page.locator('#app').innerText(), /纯数字读法/);
    }, { init: () => {
      if (!localStorage.getItem('ieltsJijing.v1')) localStorage.setItem('ieltsJijing.v1', JSON.stringify({settings:{numberMode:'cardinal'},records:{}}));
    } });
    await test(browser, 'checkbox selection creates exactly the selected two-item quiz', async page => {
      await page.locator('[data-jselect-none]').click();
      assert.equal(await page.locator('[data-jstart-selected]').isDisabled(), true);
      await page.locator('[data-jpick="j2019-d05-009"]').check();
      await page.locator('[data-jpick="j2019-d05-010"]').check();
      await page.locator('[data-jstart-selected]').click();
      assert.match(await page.locator('.quiz-top').innerText(), /第 1 \/ 2 题/);
      assert.deepEqual(await listenText(page), ['eleven'], 'Short ordinary numbers use cardinal reading automatically');
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
        assert.equal(await page.locator('#app').innerText().then(text => text.includes('eleven')), false, 'Do not reveal the answer or its spoken form before submission');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, 'quiz-' + width + '.png'), fullPage: true });
      }, { viewport: { width, height: 844 } });
    }
    await test(browser, 'desktop learning view, data and readout type remain visible', async page => {
      await page.screenshot({ path: path.join(output, 'learn-desktop.png'), fullPage: false });
      await page.locator('.j-number-demo summary').click();
      await page.locator('[data-jdemo]').click();
      await page.screenshot({ path: path.join(output, 'automatic-code-desktop.png'), fullPage: false });
    });
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(results.filter(result => result.passed).length + '/' + results.length + ' Jijing browser workflows passed');
  process.exitCode = results.some(result => !result.passed) ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
