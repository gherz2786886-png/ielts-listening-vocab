# -*- coding: utf-8 -*-
"""A9-A10：旧 localStorage 数据平滑兼容；已掌握/移回错词本流程；已掌握区标签只读。"""
import json, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab")
URL = (ROOT / "index.html").resolve().as_uri()
results = []
def check(name, cond, ev=""):
    results.append((name, bool(cond), ev))
    print(("PASS" if cond else "FAIL"), name, "|", ev)

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width":1440,"height":900})
    errs=[]
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto(URL); pg.wait_for_timeout(300)
    # ① 预置旧格式数据
    old = {
        "wrong": {"restaurant": {"headword":"restaurant","display":"restaurant","meaning":"餐厅","count":2,"page":3,"scenarioId":"rent","scenario":"租房场景"}},  # 无 reasonTags
        "mastered": {"parking lot": 1},
        "learned": {"p02-001": 1},
    }
    pg.evaluate("""(o)=>{
      localStorage.setItem('ieltsVocab.wrong', JSON.stringify(o.wrong));
      localStorage.setItem('ieltsVocab.mastered', JSON.stringify(o.mastered));
      localStorage.setItem('ieltsVocab.learned', JSON.stringify(o.learned));
    }""", old)
    pg.reload(); pg.wait_for_timeout(500)
    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(500)

    # 旧 wrong 自动显示 拼写 标签
    rest_tags = pg.evaluate("""()=>{
      const it=[...document.querySelectorAll('.wrong-item')].find(e=>e.querySelector('.wrong-headword').textContent.trim()==='restaurant');
      return it ? [...it.querySelectorAll('.chip-tag.on')].map(e=>e.textContent.trim()) : null;
    }""")
    check("A9 旧wrong自动补'拼写'标签", rest_tags==["拼写"], str(rest_tags))

    # mastered 记录不丢：展开已掌握区
    pg.click("[data-toggle-mastered]"); pg.wait_for_timeout(300)
    master_txt = pg.eval_on_selector(".panel, #app", "e=>e.textContent")
    check("A9 mastered 记录不丢(parking lot 可见)", "parking lot" in master_txt, "")
    # learned key 仍在 localStorage
    learned = pg.evaluate("localStorage.getItem('ieltsVocab.learned')")
    check("A9 旧 learned key 仍在", json.loads(learned)=={"p02-001":1}, learned)

    # ---------- A10：标记已掌握 / 移回错词本 / 已掌握区标签只读 ----------
    # restaurant 标记已掌握
    pg.click('[data-master="restaurant"]'); pg.wait_for_timeout(400)
    active = pg.evaluate("""()=>[...document.querySelectorAll('.wrong-item:not(.mastered-dim) .wrong-headword')].map(e=>e.textContent.trim())""")
    check("A10 restaurant标记已掌握后移出活跃", "restaurant" not in active, f"active={active}")
    # 已掌握区有 restaurant（且 parking lot 也在）
    mastered_list = pg.evaluate("""()=>[...document.querySelectorAll('.wrong-item.mastered-dim .wrong-headword')].map(e=>e.textContent.trim())""")
    check("A10 已掌握区含restaurant", set(mastered_list)>={"restaurant","parking lot"}, str(mastered_list))
    # 已掌握区 chip 只读（无 data-entry-tag）
    ro = pg.evaluate("""()=>{
      const h=[...document.querySelectorAll('.wrong-item.mastered-dim .wrong-headword')].find(e=>e.textContent.trim()==='restaurant');
      if(!h) return 'no-mastered-item';
      const row=h.closest('.wrong-item');
      return row.querySelector('.wrong-tags-row').innerHTML;
    }""")
    check("A10 已掌握区标签只读(span无data-entry-tag)", "data-entry-tag" not in ro, "")
    # 移回错词本
    pg.click('[data-unmaster="restaurant"]'); pg.wait_for_timeout(400)
    active = pg.evaluate("""()=>[...document.querySelectorAll('.wrong-item:not(.mastered-dim) .wrong-headword')].map(e=>e.textContent.trim())""")
    check("A10 移回错词本后restaurant回到活跃", active==["restaurant"], f"active={active}")

    check("无 console error", len(errs)==0, str(errs[:3]))
    br.close()

print("\n==== SUMMARY ====")
fails=[r for r in results if not r[1]]
print(f"total={len(results)} pass={len(results)-len(fails)} fail={len(fails)}")
for f in fails: print("FAIL:", f)
