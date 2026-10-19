'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const roots = [process.argv[3], path.resolve(__dirname, '..')];
if (!roots[0]) throw new Error('Supply the baseline checkout as the second argument');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const values = [[], []];
  try {
    for (let round = 0; round < 12; round++) {
      for (const index of (round % 2 ? [1, 0] : [0, 1])) {
        const context = await browser.newContext();
        await context.addInitScript(() => {
          const started = performance.now();
          document.addEventListener('DOMContentLoaded', () => { window.__appReadyMs = performance.now() - started; });
        });
        const page = await context.newPage();
        await page.goto(pathToFileURL(path.join(roots[index], 'index.html')).href);
        await page.locator('.word-card').first().waitFor();
        values[index].push(await page.evaluate(() => window.__appReadyMs));
        await context.close();
      }
    }
  } finally { await browser.close(); }
  const summary = values.map((samples, index) => {
    const sorted = samples.slice().sort((a, b) => a - b);
    return { version: index ? 'review' : 'baseline', samples, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
  });
  fs.writeFileSync(path.join(__dirname, 'review-results', 'startup-comparison.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary.map(({ version, medianMs, p95Ms }) => ({ version, medianMs, p95Ms }))));
})().catch(error => { console.error(error); process.exitCode = 1; });
