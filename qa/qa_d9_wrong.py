# -*- coding: utf-8 -*-
"""D9-③ focused: wrong book mastery move + quiz scope."""
import pathlib, json
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab")
URL = (ROOT / "index.html").as_uri()

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.goto(URL); pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)

    # start dictation, page 2, uk
    pg.goto(URL + "#/dictation"); pg.wait_for_timeout(500)
    pg.locator('[data-drange="page"]').click(); pg.wait_for_timeout(150)
    pg.locator('[data-dstart]').click(); pg.wait_for_timeout(800)

    def cur_target():
        return pg.evaluate("() => window.VocabAudio && window.VocabAudio.current && window.VocabAudio.current.text")

    t1 = cur_target()
    pg.locator('.dl-input, textarea, input[type=text]').first.fill("zzz1")
    pg.locator('[data-dsubmit]').click(); pg.wait_for_timeout(500)
    pg.locator('[data-dnext]').click(); pg.wait_for_timeout(700)
    t2 = cur_target()
    pg.locator('.dl-input, textarea, input[type=text]').first.fill("yyy2")
    pg.locator('[data-dsubmit]').click(); pg.wait_for_timeout(500)
    if pg.locator('[data-dend]').count():
        pg.locator('[data-dend]').click(); pg.wait_for_timeout(400)
    print("two wrong targets:", t1, t2)

    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(700)
    active = pg.locator('[data-master]').evaluate_all("els => els.map(e=>e.dataset.master)")
    print("active wrong:", active)
    # master the first
    pg.locator(f'[data-master="{active[0]}"]').click(); pg.wait_for_timeout(400)
    active_after = pg.locator('[data-master]').evaluate_all("els => els.map(e=>e.dataset.master)")
    print("active after mastering:", active_after)
    btn_label = pg.locator('[data-toggle-mastered]').inner_text()
    print("toggle-mastered label:", btn_label)
    pg.locator('[data-toggle-mastered]').click(); pg.wait_for_timeout(300)
    mastered = pg.locator('[data-unmaster]').evaluate_all("els => els.map(e=>e.dataset.unmaster)")
    print("mastered area:", mastered)
    quiz_disabled = pg.locator('[data-wrong-quiz]').is_disabled()
    print("quiz button disabled?", quiz_disabled)
    # start wrong-quiz
    pg.locator('[data-wrong-quiz]').click(); pg.wait_for_timeout(900)
    qt = cur_target()
    print("wrong-quiz first target:", qt, "| remaining active:", active_after)
    print("SCOPE OK:" , qt in active_after and qt not in mastered)
    b.close()
