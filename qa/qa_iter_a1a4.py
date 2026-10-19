# -*- coding: utf-8 -*-
"""A1-A4 独立验收：学习页已错按钮/popover/多选确认/持久化/移除/进度文案。"""
import json, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab")
URL = (ROOT / "index.html").resolve().as_uri()
SHOTS = ROOT / "qa" / "iter_shots"
SHOTS.mkdir(parents=True, exist_ok=True)

results = []
def check(name, cond, evidence=""):
    results.append((name, bool(cond), evidence))
    print(("PASS" if cond else "FAIL"), name, "|", evidence)

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))

    # 干净起步
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)

    # ---------- A1 ----------
    cards = pg.query_selector_all(".word-card")
    check("A1 学习页有词卡", len(cards) > 0, f"{len(cards)} cards on p2")
    old_ui = pg.query_selector_all(".learn-toggle")
    old_text = pg.evaluate("document.body.innerText.includes('已学')")
    toggles = pg.query_selector_all(".wrong-toggle")
    check("A1 无 .learn-toggle 旧控件", len(old_ui) == 0, f"old_ui={len(old_ui)}")
    check("A1 页面无'已学'文案", not old_text, f"已学 in body={old_text}")
    check("A1 每卡均有已错按钮", len(toggles) == len(cards), f"{len(toggles)} wrong-toggle / {len(cards)} cards")
    check("A1 按钮初始文案=已错", all(t.inner_text().strip() == "已错" for t in toggles),
          toggles[0].inner_text() if toggles else "none")

    # 点第一张卡 → popover
    toggles[0].click(); pg.wait_for_timeout(300)
    pop = pg.query_selector(".word-card.marked-by-open .pop") or pg.query_selector(".pop")
    check("A1 点击后弹出 popover", pop is not None, "")
    chips = pg.query_selector_all(".pop .chip-tag")
    chip_texts = [c.inner_text().strip() for c in chips]
    check("A1 popover 含意思/拼写/听错三 chip", chip_texts == ["意思", "拼写", "听错"], str(chip_texts))
    confirm = pg.query_selector("[data-wconfirm]")
    check("A1 0选中时确认 disabled", confirm is not None and confirm.get_attribute("disabled") is not None,
          f"disabled={confirm.get_attribute('disabled') if confirm else 'none'}")
    cancel = pg.query_selector("[data-wcancel]")
    remove = pg.query_selector("[data-wremove]")
    check("A1 有取消按钮", cancel is not None, "")
    check("A1 未标记时无移除按钮", remove is None, f"remove={remove}")
    pg.screenshot(path=str(SHOTS / "a1_popover.png"))

    # ---------- A2：选 拼写+听错 确认 ----------
    pg.click('[data-wtag="spelling"]'); pg.wait_for_timeout(150)
    pg.click('[data-wtag="listening"]'); pg.wait_for_timeout(150)
    confirm = pg.query_selector("[data-wconfirm]")
    check("A2 选中2个后确认 enabled", confirm is not None and confirm.get_attribute("disabled") is None, "")
    marked_display = pg.eval_on_selector(".word-card .word-display", "e=>e.textContent")
    pg.click("[data-wconfirm]"); pg.wait_for_timeout(400)

    t0 = pg.query_selector(".word-card .wrong-toggle")
    label = t0.inner_text().strip()
    check("A2 确认后按钮文案=已错 · 拼写 / 听错", label == "已错 · 拼写 / 听错", repr(label))
    card_marked = "marked" in (t0.evaluate("e=>e.closest('.word-card').className"))
    check("A2 卡片选中态样式(marked)", card_marked, "")
    badge = pg.query_selector("#wrongBadge")
    badge_txt = badge.inner_text().strip() if badge and not badge.evaluate("e=>e.hidden") else "0(hidden)"
    check("A2 顶栏错词 badge=1", badge_txt == "1", f"badge={badge_txt}")

    # 进度文案
    prog = pg.eval_on_selector(".progress-meta", "e=>e.textContent")
    check("A2 进度文案=已错 x / y", "已错" in prog and "全局" in prog, prog.strip())

    # localStorage 持久
    raw = pg.evaluate("localStorage.getItem('ieltsVocab.wrong')")
    wdata = json.loads(raw) if raw else {}
    key = list(wdata.keys())[0] if wdata else None
    check("A2 localStorage 已写 wrong 条目", key is not None, f"key={key} tags={wdata[key].get('reasonTags') if key else None}")

    # 刷新后仍在
    pg.reload(); pg.wait_for_timeout(500)
    t0 = pg.query_selector(".word-card .wrong-toggle")
    label2 = t0.inner_text().strip()
    check("A2 刷新后仍标记", label2 == "已错 · 拼写 / 听错", repr(label2))
    badge = pg.query_selector("#wrongBadge")
    badge_txt2 = badge.inner_text().strip() if badge and not badge.evaluate("e=>e.hidden") else "0"
    check("A2 刷新后 badge=1", badge_txt2 == "1", f"badge={badge_txt2}")

    # 错词本可见该条且带两个标签
    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(600)
    items = pg.query_selector_all(".wrong-item")
    tags_in_item = pg.eval_on_selector_all(".wrong-item .chip-tag.on", "els=>els.map(e=>e.textContent.trim())")
    check("A2 错词本见该条且带拼写+听错标签", len(items) >= 1 and set(tags_in_item) >= {"拼写", "听错"},
          f"items={len(items)} on_tags={tags_in_item}")
    pg.screenshot(path=str(SHOTS / "a2_wrongbook_tags.png"))

    # ---------- A3：重开面板预选 + 移除 ----------
    pg.goto(URL + "#/learn"); pg.wait_for_timeout(500)
    t0 = pg.query_selector(".word-card .wrong-toggle")
    t0.click(); pg.wait_for_timeout(300)
    pre = pg.eval_on_selector_all(".pop .chip-tag.on", "els=>els.map(e=>e.textContent.trim())")
    check("A3 重开面板预选当前标签", set(pre) == {"拼写", "听错"}, str(pre))
    rm = pg.query_selector("[data-wremove]")
    check("A3 已标记面板出现移除标记", rm is not None, "")
    rm.click(); pg.wait_for_timeout(400)
    t0 = pg.query_selector(".word-card .wrong-toggle")
    check("A3 移除后按钮恢复'已错'", t0.inner_text().strip() == "已错", repr(t0.inner_text()))
    badge = pg.query_selector("#wrongBadge")
    badge_hidden = badge.evaluate("e=>e.hidden")
    check("A3 移除后 badge 回落(隐藏)", badge_hidden, "")
    prog = pg.eval_on_selector(".progress-meta", "e=>e.textContent")
    check("A3 移除后进度 x=0", "已错 0 /" in prog, prog.strip())
    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(400)
    empty = pg.query_selector(".empty-state")
    check("A3 错词本已空", empty is not None and "空" in empty.inner_text(), "")

    # ---------- A4 进度变化：标记第二词 ----------
    pg.goto(URL + "#/learn"); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400)
    before = pg.eval_on_selector(".progress-meta", "e=>e.textContent")
    # 标记第2、3张卡
    for i in (1, 2):
        t = pg.query_selector_all(".wrong-toggle")[i]
        t.click(); pg.wait_for_timeout(150)
        pg.click('[data-wtag="meaning"]'); pg.wait_for_timeout(100)
        pg.click("[data-wconfirm]"); pg.wait_for_timeout(250)
    after = pg.eval_on_selector(".progress-meta", "e=>e.textContent")
    check("A4 进度随标记变化(0→2)", "已错 2 /" in after, f"before={before.strip()} after={after.strip()}")
    glob = pg.eval_on_selector(".progress-meta span:last-child", "e=>e.textContent")
    check("A4 全局 x/1078", "1078" in glob, glob.strip())

    check("无 console error", len(errs) == 0, f"errs={errs[:3]}")
    br.close()

print("\n==== SUMMARY ====")
fails = [r for r in results if not r[1]]
print(f"total={len(results)} pass={len(results)-len(fails)} fail={len(fails)}")
for f in fails: print("FAIL_ITEM:", f)
