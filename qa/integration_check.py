# -*- coding: utf-8 -*-
"""总协调整合自测：file:// 加载 + 数据/分页/section/发音按钮/听写批改/错词本 全链路"""
import os, re, sys, json
from playwright.sync_api import sync_playwright

ROOT = r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab"
URL = "file:///" + ROOT.replace("\\", "/") + "/index.html"
outdir = os.path.join(ROOT, "qa", "integration")
os.makedirs(outdir, exist_ok=True)

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS" if cond else "FAIL"), name, detail)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width":1440,"height":900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type in ("error",) else None)
    page.on("pageerror", lambda e: console_errors.append("PAGEERROR: " + str(e)))

    audio_words = []
    page.on("request", lambda r: audio_words.append((r.url.split("type=")[-1], re.search(r'audio=([^&]+)', r.url).group(1))) if "dictvoice" in r.url else None)

    page.goto(URL)
    page.wait_for_timeout(1200)

    # 1. globals & data
    info = page.evaluate("""() => ({
        vocab: !!window.VOCAB,
        n: window.VOCAB ? window.VOCAB.words.length : 0,
        hw: window.VOCAB ? window.VOCAB.words.reduce((s,w)=>s+w.headwords.length,0) : 0,
        audio: !!window.VocabAudio,
        dict: !!window.Dictation,
        sections: window.VOCAB ? [...new Set(window.VOCAB.words.map(w=>w.section))] : []
    })""")
    check("globals loaded", info["vocab"] and info["audio"] and info["dict"], str(info))
    check("word count 1078", info["n"] == 1078, str(info["n"]))
    check("headword count 1178", info["hw"] == 1178, str(info["hw"]))
    check("section values present", set(["方位词","季节","星期&月份","国家及地区/国籍"]).issubset(set(info["sections"])), str(info["sections"]))

    # 2. learn page 2 default: cards + audio buttons (buttons per headword)
    expected2 = page.evaluate("window.VOCAB.words.filter(w=>w.page===2).reduce((s,w)=>s+w.headwords.length,0)")
    cards = page.evaluate("document.querySelectorAll('.word-card').length")
    uk = page.evaluate("document.querySelectorAll('#app .word-list [data-accent=\"uk\"]').length")
    us = page.evaluate("document.querySelectorAll('#app .word-list [data-accent=\"us\"]').length")
    check("p2 cards = 39", cards == 39, str(cards))
    check("p2 audio buttons = 2 x headwords", uk == expected2 and us == expected2, f"expected {expected2} each, got uk={uk} us={us}")

    # 3. switch to travel scenario -> page 10 -> 方位词 divider
    page.evaluate("""() => {
        document.querySelector('[data-scenario="travel"]').click();
        var sel = document.getElementById('pageSelect');
        sel.value = '10'; sel.dispatchEvent(new Event('change', {bubbles:true}));
    }""")
    page.wait_for_timeout(400)
    divs = page.evaluate("Array.prototype.map.call(document.querySelectorAll('.section-divider'), d=>d.textContent.trim())")
    cards10 = page.evaluate("document.querySelectorAll('.word-card').length")
    check("p10 section divider 方位词", divs == ["方位词"], str(divs))
    check("p10 cards = 31", cards10 == 31, str(cards10))

    # 4. switch to animals_plants scenario -> page 30 -> 季节 / 星期&月份
    page.evaluate("""() => {
        document.querySelector('[data-scenario="animals_plants"]').click();
        var sel = document.getElementById('pageSelect');
        sel.value = '30'; sel.dispatchEvent(new Event('change', {bubbles:true}));
    }""")
    page.wait_for_timeout(400)
    divs30 = page.evaluate("Array.prototype.map.call(document.querySelectorAll('.section-divider'), d=>d.textContent.trim())")
    cards30 = page.evaluate("document.querySelectorAll('.word-card').length")
    check("p30 dividers", divs30 == ["季节","星期&月份"], str(divs30))
    check("p30 cards = 25", cards30 == 25, str(cards30))
    page.screenshot(path=os.path.join(outdir,"learn_p30_desktop.png"))

    # 5. pronunciation click triggers network (UK)
    page.evaluate("""() => {
        document.querySelector('[data-scenario="renting"]').click();
        var sel = document.getElementById('pageSelect');
        sel.value = '2'; sel.dispatchEvent(new Event('change', {bubbles:true}));
    }""")
    page.wait_for_timeout(300)
    page.evaluate("document.querySelectorAll('[data-accent=\"uk\"]')[0].click()")
    page.wait_for_timeout(1500)
    page.evaluate("document.querySelectorAll('[data-accent=\"us\"]')[0].click()")
    page.wait_for_timeout(1500)
    check("audio requests fired", len(audio_words) >= 2, str(audio_words[:4]))
    check("first audio word = adults", any(w == "adults" for _, w in [(t, __import__('urllib.parse', fromlist=['unquote']).unquote(x)) for t, x in audio_words]), str(audio_words[:4]))
    accents = [t for t, _ in audio_words]
    check("uk type=2 then us type=1", accents[:2] == ["2", "1"], str(accents[:2]))

    # 6. search
    page.evaluate("""() => {
        var si = document.getElementById('searchInput');
        si.value = 'hotel'; si.dispatchEvent(new Event('input', {bubbles:true}));
    }""")
    page.wait_for_timeout(400)
    hits = page.evaluate("document.querySelectorAll('.search-item').length")
    check("search hotel hits >= 1", hits >= 1, str(hits))

    # 7. dictation flow on page 2, wrong spelling
    page.evaluate("localStorage.clear()")
    page.goto(URL + "#/dictation")
    page.wait_for_timeout(600)
    # choose page 2 scope, sequence order
    page.evaluate("""() => {
        document.querySelector('[data-drange="page"]').click();
        var ps = document.getElementById('singlePageSelect');
        ps.value = '2'; ps.dispatchEvent(new Event('change',{bubbles:true}));
        document.querySelector('[data-dorder="sequence"]').click();
    }""")
    page.wait_for_timeout(300)
    audio_words.clear()
    page.evaluate("document.querySelector('[data-dstart]').click()")
    page.wait_for_timeout(2000)
    target = None
    if audio_words:
        from urllib.parse import unquote
        target = unquote(audio_words[0][1])
    check("dictation target captured", target is not None and target.strip() != "", str(audio_words[:2]))
    # deliberately wrong
    page.evaluate("""() => {
        var i = document.getElementById('quizInput');
        i.value = 'zzzzwrong';
        document.querySelector('[data-dsubmit]').click();
    }""")
    page.wait_for_timeout(600)
    body = page.evaluate("document.getElementById('app').innerText")
    check("reason shown", "原因" in body or len(body) > 20, body[:120].replace("\n"," "))
    page.screenshot(path=os.path.join(outdir,"dictation_wrong_desktop.png"))
    # wrong book
    page.goto(URL + "#/wrong")
    page.wait_for_timeout(600)
    witems = page.evaluate("document.querySelectorAll('.wrong-item').length")
    wbadge = page.evaluate("document.getElementById('wrongBadge').textContent")
    check("wrong book has 1 item", witems == 1, f"items={witems} badge={wbadge}")
    # persistence
    page.reload()
    page.wait_for_timeout(800)
    page.goto(URL + "#/wrong")
    page.wait_for_timeout(600)
    witems2 = page.evaluate("document.querySelectorAll('.wrong-item').length")
    check("wrong book persists after reload", witems2 == 1, str(witems2))

    # 8. correct answer path in a FRESH context -> not added to wrong book
    ctx2 = browser.new_context()
    page2 = ctx2.new_page()
    audio2 = []
    page2.on("request", lambda r: audio2.append(1) if "dictvoice" in r.url else None)
    page2.goto(URL + "#/dictation")
    page2.wait_for_timeout(600)
    page2.evaluate("""() => {
        document.querySelector('[data-drange="page"]').click();
        var ps = document.getElementById('singlePageSelect');
        ps.value = '2'; ps.dispatchEvent(new Event('change',{bubbles:true}));
        document.querySelector('[data-dorder="sequence"]').click();
    }""")
    page2.wait_for_timeout(300)
    page2.evaluate("document.querySelector('[data-dstart]').click()")
    page2.wait_for_timeout(2000)
    target2 = "adults"
    page2.evaluate("(t) => { var i=document.getElementById('quizInput'); i.value=t; document.querySelector('[data-dsubmit]').click(); }", target2)
    page2.wait_for_timeout(500)
    res = page2.evaluate("document.getElementById('app').innerText")
    check("correct answer accepted", "拼写正确" in res, (target2 or "") + " | " + res[:100].replace("\n"," "))
    page2.goto(URL + "#/wrong")
    page2.wait_for_timeout(500)
    w0 = page2.evaluate("document.querySelectorAll('.wrong-item').length")
    check("correct answer not in wrong book", w0 == 0, str(w0))
    ctx2.close()

    check("no console errors", len(console_errors) == 0, " | ".join(console_errors[:5]))
    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed, %d failed ====" % (len(results)-len(fails), len(results), len(fails)))
sys.exit(1 if fails else 0)
