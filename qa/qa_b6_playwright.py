# -*- coding: utf-8 -*-
"""B6: playwright click UK/US buttons, capture dictvoice requests + highlight."""
import pathlib, json
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab")
URL = ROOT.as_uri() + "#/learn"

requests = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    def on_req(req):
        if "dict.youdao.com/dictvoice" in req.url:
            requests.append(req.url)
    pg.on("request", on_req)
    pg.goto((ROOT / "index.html").as_uri())
    pg.wait_for_timeout(800)
    print("route title:", pg.title())
    print("h1/brand:", pg.locator(".brand-text").first.inner_text())

    # find first 3 word cards' speak buttons
    cards = pg.locator(".word-card")
    print("word cards on page:", cards.count())

    def accent_state(card):
        return card.locator(".speak-btn").evaluate_all(
            "els => els.map(e => ({word:e.getAttribute('data-speak'), acc:e.getAttribute('data-accent'), pressed:e.getAttribute('aria-pressed'), cls:e.className, text:e.innerText}))")

    results = []
    for i in range(3):
        card = cards.nth(i)
        disp = card.locator(".word-display").inner_text()
        # click UK
        uk = card.locator('.speak-btn[data-accent="uk"]')
        before = len(requests)
        uk.click()
        pg.wait_for_timeout(700)
        uk_reqs = requests[before:]
        st_uk = accent_state(card)
        # click US
        us = card.locator('.speak-btn[data-accent="us"]')
        before = len(requests)
        us.click()
        pg.wait_for_timeout(700)
        us_reqs = requests[before:]
        st_us = accent_state(card)
        results.append({"display": disp, "uk_reqs": uk_reqs, "us_reqs": us_reqs,
                        "state_after_uk": st_uk, "state_after_us": st_us})
        print(json.dumps(results[-1], ensure_ascii=False, indent=1))

    # single-channel test: click word0 UK then word2 US quickly
    requests.clear()
    cards.nth(0).locator('.speak-btn[data-accent="uk"]').click()
    pg.wait_for_timeout(150)
    cards.nth(2).locator('.speak-btn[data-accent="us"]').click()
    pg.wait_for_timeout(800)
    cur = pg.evaluate("() => window.VocabAudio ? window.VocabAudio.current : null")
    print("single-channel: current =", cur)
    print("all dictvoice reqs after double-click:", requests)

    b.close()
