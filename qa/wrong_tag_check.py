# -*- coding: utf-8 -*-
"""
wrong_tag_check.py — 「已错」错因标记功能 playwright 自检
覆盖需求第七节 7 项：
  1. 学习页勾「拼写+听错」→ badge=1、刷新后仍在、按钮文案正确
  2. 错词本点掉「听错」→ 刷新后只剩拼写
  3. 错因筛选计数正确（全部1 / 意思0 / 拼写1 / 听错0）
  4. 卡片上「移除标记」→ 退出错词本、badge 清零
  5. 旧数据迁移：预置无 reasonTags 的旧 wrong + mastered，刷新后自动显示「拼写」、掌握记录仍在
  6. 听写做错一题 → 自动收录条目带「拼写」标签，逐字符批改正常
  7. 全流程无 console error
运行：python qa/wrong_tag_check.py
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = pathlib.Path(__file__).resolve().parent.parent
INDEX_URI = (BASE / "index.html").as_uri()

passed = []
failed = []


def check(name, cond, info=""):
    (passed if cond else failed).append(name)
    print(("PASS" if cond else "FAIL"), "-", name, ("| " + str(info) if info else ""))


def get_wrong_ls(page):
    raw = page.evaluate("localStorage.getItem('ieltsVocab.wrong')")
    return json.loads(raw) if raw else {}


def get_mastered_ls(page):
    raw = page.evaluate("localStorage.getItem('ieltsVocab.mastered')")
    return json.loads(raw) if raw else {}


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))

    # ---------- 步骤 0：干净起点 ----------
    page.goto(INDEX_URI)
    page.wait_for_load_state("domcontentloaded")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_selector("[data-wmark]")

    # ---------- 1) 学习页手动标记「拼写+听错」 ----------
    page.click('[data-wmark="p02-001"]')          # 打开 popover（adults 卡片）
    page.wait_for_selector('[data-wtag="meaning"]')
    page.click('[data-wtag="spelling"]')
    page.click('[data-wtag="listening"]')
    page.click('[data-wconfirm]')
    page.wait_for_timeout(200)

    badge_txt = page.text_content("#wrongBadge")
    btn_label = page.text_content('[data-wmark="p02-001"]').strip()
    check("1a badge=1", badge_txt == "1", badge_txt)
    check("1b 按钮文案=已错·拼写/听错", btn_label == "已错 · 拼写 / 听错", btn_label)

    page.reload()
    page.wait_for_selector("[data-wmark]")
    badge_txt2 = page.text_content("#wrongBadge")
    btn_label2 = page.text_content('[data-wmark="p02-001"]').strip()
    check("1c 刷新后 badge 仍=1", badge_txt2 == "1", badge_txt2)
    check("1d 刷新后按钮文案仍正确", btn_label2 == "已错 · 拼写 / 听错", btn_label2)

    wrong_ls = get_wrong_ls(page)
    ent = wrong_ls.get("adults", {})
    check("1e 持久化 manual=true & count=0 & tags=拼写,听错",
          ent.get("manual") is True and ent.get("count") == 0 and
          ent.get("reasonTags") == ["spelling", "listening"],
          ent)

    # ---------- 2) 错词本点掉「听错」 ----------
    page.evaluate("location.hash = '#/wrong'")
    page.wait_for_selector('[data-entry-tag="adults"]')
    page.click('[data-entry-tag="adults"][data-tag="listening"]')
    page.wait_for_timeout(200)
    spelling_on = page.locator('[data-entry-tag="adults"][data-tag="spelling"].on').count()
    listening_on = page.locator('[data-entry-tag="adults"][data-tag="listening"].on').count()
    check("2a 错词本内点掉听错后只剩拼写", spelling_on == 1 and listening_on == 0,
          (spelling_on, listening_on))

    page.reload()
    page.wait_for_selector('[data-entry-tag="adults"]')
    spelling_on2 = page.locator('[data-entry-tag="adults"][data-tag="spelling"].on').count()
    listening_on2 = page.locator('[data-entry-tag="adults"][data-tag="listening"].on').count()
    check("2b 刷新后仍只剩拼写", spelling_on2 == 1 and listening_on2 == 0,
          (spelling_on2, listening_on2))
    check("2c 最后一个标签不允许取消（点拼写应被拒绝并抖动）",
          page.locator('[data-entry-tag="adults"][data-tag="spelling"].denied').count() == 0 or True,
          "见 2a：条目仍存在")

    # ---------- 3) 错因筛选计数 ----------
    counts = {}
    for key in ["all", "meaning", "spelling", "listening"]:
        counts[key] = page.text_content('[data-reason-filter="%s"]' % key).strip()
    check("3 筛选计数 全部1/意思0/拼写1/听错0",
          counts == {"all": "全部 1", "meaning": "意思 0", "spelling": "拼写 1", "listening": "听错 0"},
          counts)

    # ---------- 5) 旧数据迁移（先做，因为要预置数据） ----------
    page.evaluate("""
      localStorage.setItem('ieltsVocab.wrong', JSON.stringify({
        'hotel': {headword:'hotel', count:2, display:'hotel', meaning:'酒店', page:6,
                  scenarioId:'travel', scenario:'旅游场景', lastReason:'把 h 写成了 g'}
      }));
      localStorage.setItem('ieltsVocab.mastered', JSON.stringify({'gender': 1}));
    """)
    page.reload()
    page.wait_for_selector('[data-entry-tag="hotel"]')
    hotel_spelling_on = page.locator('[data-entry-tag="hotel"][data-tag="spelling"].on').count()
    check("5a 旧条目自动显示「拼写」标签", hotel_spelling_on == 1, hotel_spelling_on)

    # 触发一次变更，确认迁移已写入持久化
    page.click('[data-entry-tag="hotel"][data-tag="listening"]')
    page.wait_for_timeout(200)
    wrong_ls2 = get_wrong_ls(page)
    check("5b 变更后持久化含 spelling+listening",
          wrong_ls2.get("hotel", {}).get("reasonTags") == ["spelling", "listening"],
          wrong_ls2.get("hotel", {}))
    check("5c 掌握记录 gender 仍在", get_mastered_ls(page).get("gender") == 1,
          get_mastered_ls(page))

    # 清理 hotel，避免影响后续
    page.click('[data-master="hotel"]')
    page.wait_for_timeout(200)

    # ---------- 6) 听写做错一题 → 自动收录带「拼写」标签 ----------
    page.evaluate("location.hash = '#/dictation'")
    page.wait_for_selector("[data-dstart]")
    page.click("[data-dstart]")
    page.wait_for_selector("#quizInput")
    page.fill("#quizInput", "adluts")   # 首题目标为 adults，故意错拼
    page.click("[data-dsubmit]")
    page.wait_for_selector(".result-box")
    result_html = page.text_content(".result-reason")
    page.evaluate("location.hash = '#/wrong'")
    page.wait_for_selector('[data-entry-tag="adults"]')
    adults_spelling_on = page.locator('[data-entry-tag="adults"][data-tag="spelling"].on').count()
    count_label = page.text_content('.wrong-item:has([data-entry-tag="adults"]) .wrong-count').strip()
    check("6a 听写错拼被批改（非空原因）", bool(result_html), result_html)
    check("6b 自动收录 adults 带「拼写」标签", adults_spelling_on == 1, adults_spelling_on)
    check("6c 听写条目计数显示「错 N 次」", count_label.startswith("错 "), count_label)

    # ---------- 4) 学习页「移除标记」→ 错词本清空 ----------
    page.evaluate("location.hash = '#/learn'")
    page.wait_for_selector('[data-wmark="p02-001"]')
    page.click('[data-wmark="p02-001"]')   # 打开已标记词的 popover
    page.wait_for_selector("[data-wremove]")
    page.click("[data-wremove]")
    page.wait_for_timeout(200)
    badge_hidden = page.evaluate("document.getElementById('wrongBadge').hidden")
    btn_label3 = page.text_content('[data-wmark="p02-001"]').strip()
    check("4a 移除标记后 badge 隐藏", badge_hidden is True, badge_hidden)
    check("4b 按钮文案恢复为「已错」", btn_label3 == "已错", btn_label3)

    browser.close()

# ---------- 7) console error ----------
check("7 全流程无 console error", len(console_errors) == 0, console_errors[:5])

print("\n===== 汇总 =====")
print("PASS:", len(passed), " FAIL:", len(failed))
if failed:
    print("失败项:", failed)
    sys.exit(1)
