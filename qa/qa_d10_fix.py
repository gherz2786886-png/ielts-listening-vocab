# -*- coding: utf-8 -*-
import pathlib, sys
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab")
URL = (ROOT / "index.html").as_uri()
OUT = ROOT / "qa" / "qa_shots"

SEED = """(() => {
  localStorage.setItem('ieltsVocab.wrong', JSON.stringify({
    garden:{headword:'garden',count:2,display:'garden',meaning:'花园',page:6,scenarioId:'travel',scenario:'旅游场景',lastReason:'漏写了字母 e',updatedAt:Date.now()},
    restaurant:{headword:'restaurant',count:1,display:'restaurant',meaning:'餐厅',page:3,scenarioId:'renting',scenario:'租房场景',lastReason:'把 a 写成了 e',updatedAt:Date.now()-1000}}));
  localStorage.setItem('ieltsVocab.mastered', JSON.stringify({'parking lot':1}));
  localStorage.setItem('ieltsVocab.learned', JSON.stringify({'p02-001':1,'p02-002':1}));
})()"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})

    pg.goto(URL); pg.evaluate(SEED); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_timeout(700)   # full boot so store reads seeded localStorage
    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(900)
    t = pg.locator('[data-toggle-mastered]')
    if t.count(): t.click(); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / "v4_wrong" / "index_desktop_fixed.jpg"), quality=80, type="jpeg")
    print("v4 active:", pg.locator('[data-master]').count(),
          "mastered:", pg.locator('[data-unmaster]').count(), flush=True)

    pg.goto(URL + "#/dictation"); pg.wait_for_timeout(500)
    pg.locator('[data-dstart]').click(); pg.wait_for_timeout(800)
    pg.locator('.dl-input, textarea, input[type=text]').first.fill("zzz"); pg.wait_for_timeout(200)
    pg.locator('[data-dsubmit]').click(); pg.wait_for_timeout(500)
    pg.locator('[data-dend]').click(); pg.wait_for_timeout(1200)
    pg.screenshot(path=str(OUT / "v5_summary" / "index_desktop_fixed.jpg"), quality=80, type="jpeg")
    print("v5 hash:", pg.evaluate("location.hash"), flush=True)
    print("v5 body head:", pg.locator("main").inner_text()[:200], flush=True)
    b.close()
