'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[3] || path.join(__dirname, 'feedback-results'));
fs.mkdirSync(output, { recursive: true });
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/jijing.json'), 'utf8'));
const find = answer => data.days.flatMap(day => day.items).find(item => item.answer === answer);
const records = {};
for (const [answer, input] of [['1 August', 'although'], ['27 April', '27 Apeil'], ['cold drinks', 'hot drinks'], ['lawyer', 'loyal'], ['west', 'waste']]) {
  const item = find(answer); assert.ok(item, answer);
  records[item.id] = { attempts: 2, errors: 2, wrong: true, lastInput: input, lastReason: 'OLD LETTER REASON', customHistory: ['must stay'] };
}
const results = [];
const url = pathToFileURL(path.join(root, 'index.html')).href;
async function contextFor(browser, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.addInitScript(records => {
    if (!localStorage.getItem('qa.feedback.seeded')) {
      localStorage.setItem('ieltsJijing.v1', JSON.stringify({ settings: { day: 30, accent: 'uk' }, records }));
      localStorage.setItem('qa.feedback.seeded', '1');
    }
    window.__audio = [];
    window.Audio = class extends EventTarget {
      constructor(src) { super(); this.src = src; }
      play() { window.__audio.push(this.src); queueMicrotask(() => { this.dispatchEvent(new Event('playing')); this.dispatchEvent(new Event('ended')); }); return Promise.resolve(); }
      pause() {} load() {} removeAttribute(name) { if (name === 'src') this.src = ''; }
    };
  }, records);
  return context;
}
async function test(browser, name, run, width, route = 'jijing/wrong') {
  const context = await contextFor(browser, width); const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try { await page.goto(url + '#/' + route); await run(page); assert.deepEqual(errors, []); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack, errors }); console.error('FAIL ' + name + ': ' + error.message); }
  finally { await context.close(); }
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    await test(browser, 'pronunciation index loads only when needed and updates only the visible correction', async page => {
      assert.equal(await page.evaluate(() => !!window.FEEDBACK_LEXICON), false);
      const item = find('lawyer'); await page.locator('[data-jsingle="' + item.id + '"]').click();
      assert.equal(await page.evaluate(() => !!window.FEEDBACK_LEXICON), false);
      await page.locator('#jAnswer').fill('loyal'); await page.locator('[data-jsubmit]').click();
      await page.waitForFunction(() => /可能近音/.test(document.querySelector('.feedback-summary').textContent));
      assert.equal(await page.locator('.feedback-input').innerText(), 'loyal');
      assert.equal(await page.locator('[data-jnext]').count(), 1);
      assert.equal(await page.evaluate(() => document.querySelectorAll('script[src*="feedback-lexicon.js"]').length), 1);
    }, undefined, 'jijing/learn');
    await test(browser, 'existing wrong entries render new corrections without rewriting original history', async page => {
      assert.equal(await page.locator('.wrong-item').count(), 5);
      assert.doesNotMatch(await page.locator('#app').innerText(), /OLD LETTER REASON/);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsJijing.v1')).records);
      assert.deepEqual(saved, records);
      const april = page.locator('.wrong-item').filter({ has: page.locator('b', { hasText: /^27 April$/ }) });
      assert.equal(await april.locator('.feedback-error').innerText(), 'e');
      const phrase = page.locator('.wrong-item').filter({ has: page.locator('b', { hasText: /^cold drinks$/ }) });
      assert.equal(await phrase.locator('.feedback-input').innerText(), 'hot drinks');
      assert.equal(await phrase.locator('.feedback-error').innerText(), 'hot');
      await page.screenshot({ path: path.join(output, 'wrong-feedback-desktop.png'), fullPage: true });
    });
    await test(browser, 'loyal/lawyer contrast plays each requested word once with the selected accent', async page => {
      const card = page.locator('.wrong-item').filter({ has: page.locator('b', { hasText: /^lawyer$/ }) });
      assert.match(await card.locator('.feedback-summary').innerText(), /可能近音/);
      await card.locator('[data-feedback-play="loyal"]').click();
      await card.locator('[data-feedback-play="lawyer"]').click();
      const clips = await page.evaluate(() => window.__audio);
      assert.equal(clips.length, 2);
      assert.equal(new URL(clips[0]).searchParams.get('audio'), 'loyal');
      assert.equal(new URL(clips[1]).searchParams.get('audio'), 'lawyer');
      assert.equal(new URL(clips[0]).searchParams.get('type'), '1');
      await card.screenshot({ path: path.join(output, 'loyal-lawyer-contrast.png') });
    });
    await test(browser, 'new Jijing quiz keeps grading and raw submitted text', async page => {
      await page.goto(url + '#/jijing/learn'); const item = find('lawyer');
      await page.locator('[data-jsingle="' + item.id + '"]').click();
      assert.equal(await page.locator('.feedback-answer').count(), 0);
      await page.locator('#jAnswer').fill('loyal'); await page.locator('[data-jsubmit]').click();
      assert.equal(await page.locator('.feedback-input').innerText(), 'loyal');
      assert.equal(await page.locator('.feedback-answer').innerText(), 'lawyer');
      assert.match(await page.locator('.feedback-summary').innerText(), /可能近音/);
      const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('ieltsJijing.v1')).records[id], item.id);
      assert.equal(saved.lastInput, 'loyal'); assert.equal(saved.errors, 3); assert.equal(saved.attempts, 3);
      assert.equal(await page.locator('.result-box.bad').count(), 1);
    });
    await test(browser, 'scene quiz saves original spelling and renders the same correction after reload', async page => {
      await page.goto(url + '#/learn');
      await page.locator('[data-wmark]').first().click(); await page.locator('[data-wtag="meaning"]').click(); await page.locator('[data-wconfirm]').click();
      await page.goto(url + '#/wrong'); await page.locator('[data-single-quiz]').first().click();
      await page.locator('#quizInput').fill('adullts'); await page.locator('[data-dsubmit]').click();
      assert.equal(await page.locator('.feedback-input').innerText(), 'adullts');
      assert.equal(await page.locator('.feedback-extra').innerText(), 'l');
      await page.goto(url + '#/wrong'); await page.reload();
      assert.equal(await page.locator('.feedback-input').innerText(), 'adullts');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ieltsVocab.wrong')).adults);
      assert.equal(saved.lastInput, 'adullts'); assert.deepEqual(saved.reasonTags, ['meaning', 'spelling']);
    });
    for (const width of [320, 390, 768]) await test(browser, 'correction cards and contrast buttons fit width ' + width, async page => {
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, actual: document.documentElement.scrollWidth }));
      assert.ok(dimensions.actual <= dimensions.viewport);
      if (width === 390) await page.screenshot({ path: path.join(output, 'wrong-feedback-mobile.png'), fullPage: true });
    }, width);
  } finally { await browser.close(); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
  if (results.some(result => !result.passed)) process.exitCode = 1;
  console.log(results.filter(result => result.passed).length + '/' + results.length + ' feedback browser checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
