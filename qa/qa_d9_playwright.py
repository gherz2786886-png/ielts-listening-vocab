# -*- coding: utf-8 -*-
"""D9 supplemental playwright checks."""
import pathlib, json, re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab")
URL = (ROOT / "index.html").as_uri()
report = []
def log(*a): print(*a); report.append(" ".join(str(x) for x in a))

reqs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.on("request", lambda r: reqs.append(r.url) if "dictvoice" in r.url else None)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.evaluate("() => { localStorage.clear(); }")
    pg.reload()
    pg.wait_for_timeout(800)

    # ---------- ① bathroom/washroom/toilet 独立按钮 ----------
    cards = pg.locator(".word-card")
    bath = None
    for i in range(cards.count()):
        d = cards.nth(i).locator(".word-display").inner_text()
        if "bathroom" in d:
            bath = cards.nth(i); break
    log("① bathroom card display:", bath.locator(".word-display").inner_text())
    btns = bath.locator(".speak-btn").evaluate_all("els => els.map(e => ({w:e.dataset.speak, a:e.dataset.accent}))")
    log("① speak buttons:", json.dumps(btns, ensure_ascii=False))
    # click each UK button, capture request word
    reqs.clear()
    for w in ["bathroom", "washroom", "toilet"]:
        bath.locator(f'.speak-btn[data-speak="{w}"][data-accent="uk"]').click()
        pg.wait_for_timeout(400)
    log("① UK requests:", [u.split("audio=")[1].split("&")[0] for u in reqs])

    # ---------- ⑤ 进度随勾选变化 + ② 刷新保留 ----------
    prog_before = pg.locator(".progress-meta").inner_text()
    cb = pg.locator('input[data-learn="p02-001"]')
    log("⑤ p02-001 checked before:", cb.is_checked(), "| progress:", prog_before.strip())
    cb.check()
    pg.wait_for_timeout(400)
    prog_after = pg.locator(".progress-meta").inner_text()
    log("⑤ progress after check:", prog_after.strip())
    pg.reload(); pg.wait_for_timeout(800)
    cb2 = pg.locator('input[data-learn="p02-001"]')
    log("② after reload, p02-001 checked:", cb2.is_checked())

    # ---------- ④ 听写美音切换后重放 type=1 ----------
    pg.goto(URL + "#/dictation"); pg.wait_for_timeout(600)
    # pick range = page 2
    try:
        pg.locator('[data-drange="page"]').click()
        pg.wait_for_timeout(200)
    except Exception as e:
        log("  drange click err:", e)
    pg.locator('[data-daccent="us"]').click()
    pg.wait_for_timeout(200)
    pg.locator('[data-dstart]').click()
    pg.wait_for_timeout(900)
    target1 = pg.evaluate("() => window.VocabAudio && window.VocabAudio.current")
    reqs.clear()
    pg.locator('[data-dreplay]').click()
    pg.wait_for_timeout(700)
    log("④ dictation target:", target1)
    log("④ replay requests:", reqs)

    # ---------- ③ 做错一词进错词本 ----------
    pg.locator('textarea, input[type=text], #dictInput, .dl-input').first.fill("zzzzzz")
    # try submit
    pg.locator('[data-dsubmit]').click()
    pg.wait_for_timeout(600)
    # go next
    if pg.locator('[data-dnext]').count():
        pg.locator('[data-dnext]').click(); pg.wait_for_timeout(400)
    # end round
    if pg.locator('[data-dend]').count():
        pg.locator('[data-dend]').click(); pg.wait_for_timeout(400)
    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(800)
    body = pg.locator("body").inner_text()
    log("③ wrong page contains '错词':", ("错词" in body), "| badge:", pg.locator("#wrongBadge").inner_text() if pg.locator("#wrongBadge").count() else "n/a")
    master_btn = pg.locator('[data-master]')
    log("③ active wrong items:", master_btn.count())
    if master_btn.count() > 0:
        hw = master_btn.first.get_attribute("data-master")
        log("③ marking mastered:", hw)
        master_btn.first.click(); pg.wait_for_timeout(500)
        log("③ after master, active wrong:", pg.locator('[data-master]').count(),
            "| mastered area items:", pg.locator('[data-unmaster]').count())
        # 错词本组卷重练
        if pg.locator('[data-wrong-quiz]').count():
            pg.locator('[data-wrong-quiz]').click(); pg.wait_for_timeout(900)
            t = pg.evaluate("() => window.VocabAudio && window.VocabAudio.current")
            log("③ wrong-quiz target:", t, "| route:", pg.evaluate("location.hash"))

    log("page errors:", errs)
    b.close()
