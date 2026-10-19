# -*- coding: utf-8 -*-
"""A5-A8：错词本筛选计数/叠加/重练范围、条目标签切换持久化、手动vs听写文案、听写收录标签并集。"""
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
    pg = br.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto(URL); pg.wait_for_timeout(400)
    sc0 = pg.evaluate("VOCAB.scenarios[0].id")
    sc1 = pg.evaluate("VOCAB.scenarios[1].id")

    # 预置 4 条：覆盖三种标签 + 一条多标签，跨两个场景
    seed = {
        "cab":            {"headword":"cab","display":"cab","meaning":"出租车","count":0,"manual":True,
                           "wordId":"p02-005","page":2,"scenarioId":sc0,"scenario":"租房场景","reasonTags":["meaning"],"updatedAt":1000},
        "apartment":      {"headword":"apartment","display":"flat/apartment","meaning":"公寓","count":0,"manual":True,
                           "wordId":"p02-018","page":2,"scenarioId":sc0,"scenario":"租房场景","reasonTags":["spelling"],"updatedAt":2000},
        "refrigerator":   {"headword":"refrigerator","display":"refrigerator/fridge","meaning":"冰箱","count":0,"manual":True,
                           "wordId":"p06-010","page":6,"scenarioId":sc1,"scenario":"旅游场景","reasonTags":["meaning","spelling"],"updatedAt":3000},
        "restaurant":     {"headword":"restaurant","display":"restaurant","meaning":"餐厅","count":2,
                           "wordId":"p03-006","page":3,"scenarioId":sc0,"scenario":"租房场景","reasonTags":["spelling"],
                           "lastReason":"把 a 写成了 e","updatedAt":4000},
    }
    pg.evaluate("(v)=>{localStorage.setItem('ieltsVocab.wrong', JSON.stringify(v));}", seed)
    pg.reload(); pg.wait_for_timeout(500)
    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(500)

    # ---------- A5：筛选计数 ----------
    chips = pg.eval_on_selector_all("[data-reason-filter]",
        "els=>els.map(e=>({k:e.getAttribute('data-reason-filter'), t:e.textContent.trim()}))")
    check("A5 筛选chip=全部/意思/拼写/听错", [c["k"] for c in chips] == ["all","meaning","spelling","listening"], str(chips))
    def chip_count(k):
        c = [c for c in chips if c["k"] == k][0]
        return c["t"]
    check("A5 全部=4", chip_count("all") == "全部 4", chip_count("all"))
    check("A5 意思=2(cab+refrigerator)", chip_count("meaning") == "意思 2", chip_count("meaning"))
    check("A5 拼写=3(apartment+refrigerator+restaurant)", chip_count("spelling") == "拼写 3", chip_count("spelling"))
    check("A5 听错=0", chip_count("listening") == "听错 0", chip_count("listening"))

    # 点 意思 → 仅 cab/refrigerator
    pg.click('[data-reason-filter="meaning"]'); pg.wait_for_timeout(300)
    hw = pg.eval_on_selector_all(".wrong-item .wrong-headword", "els=>els.map(e=>e.textContent.trim())")
    check("A5 点意思后列表过滤为 cab/refrigerator", set(hw) == {"cab","refrigerator"}, str(hw))

    # 叠加场景筛选：意思 + 租房 → 仅 cab
    pg.select_option("#wrongFilterSelect", sc0); pg.wait_for_timeout(300)
    hw = pg.eval_on_selector_all(".wrong-item .wrong-headword", "els=>els.map(e=>e.textContent.trim())")
    check("A5 错因×场景叠加过滤", hw == ["cab"], str(hw))
    pg.screenshot(path=str(ROOT/"qa"/"iter_shots"/"a5_filter.png"))

    # 重练范围不受筛选影响（回到全部）
    pg.select_option("#wrongFilterSelect", "all"); pg.wait_for_timeout(200)
    pg.click('[data-reason-filter="meaning"]'); pg.wait_for_timeout(200)  # 当前在 意思 筛选下
    pg.click("[data-wrong-quiz]"); pg.wait_for_timeout(700)
    prog_txt = pg.eval_on_selector(".quiz-progress", "e=>e.textContent")
    check("A5 重练范围=全部活跃4条(不受错因筛选影响)", "4 题" in prog_txt, prog_txt.strip())
    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(400)

    # ---------- A6：条目直接改标签 + 持久化 + 拒绝取消最后一个 ----------
    # cab 当前 [meaning]，点 spelling → 变 [meaning, spelling]
    pg.click('[data-entry-tag="cab"][data-tag="spelling"]'); pg.wait_for_timeout(300)
    on = pg.eval_on_selector_all('.wrong-item[data-x] , .wrong-item', "els=>els.map(e=>e)")  # placeholder noop
    cab_tags = pg.evaluate("""()=>{
      const items=[...document.querySelectorAll('.wrong-item')];
      const it=items.find(e=>e.querySelector('.wrong-headword').textContent.trim()==='cab');
      return [...it.querySelectorAll('.chip-tag.on')].map(e=>e.textContent.trim());
    }""")
    check("A6 cab 点spelling后变[意思,拼写]", set(cab_tags)=={"意思","拼写"}, str(cab_tags))
    pg.reload(); pg.wait_for_timeout(400)
    cab_tags2 = pg.evaluate("""()=>{
      const items=[...document.querySelectorAll('.wrong-item')];
      const it=items.find(e=>e.querySelector('.wrong-headword').textContent.trim()==='cab');
      return [...it.querySelectorAll('.chip-tag.on')].map(e=>e.textContent.trim());
    }""")
    check("A6 刷新后标签持久", set(cab_tags2)=={"意思","拼写"}, str(cab_tags2))

    # 拒绝取消最后一个标签：restaurant 当前[spelling]，再点 spelling → 拒绝，仍保留
    pg.click('[data-entry-tag="restaurant"][data-tag="spelling"]'); pg.wait_for_timeout(400)
    rest_tags = pg.evaluate("""()=>{
      const items=[...document.querySelectorAll('.wrong-item')];
      const it=items.find(e=>e.querySelector('.wrong-headword').textContent.trim()==='restaurant');
      return [...it.querySelectorAll('.chip-tag.on')].map(e=>e.textContent.trim());
    }""")
    check("A6 取消最后标签被拒(仍保留拼写)", rest_tags==["拼写"], str(rest_tags))

    # ---------- A7：手动标记 vs 听写收录文案 ----------
    manual_lbl = pg.evaluate("""()=>{
      const it=[...document.querySelectorAll('.wrong-item')].find(e=>e.querySelector('.wrong-headword').textContent.trim()==='cab');
      return it.querySelector('.wrong-count').textContent.trim();
    }""")
    check("A7 count=0 条目显示'手动标记'", manual_lbl=="手动标记", manual_lbl)
    rest = pg.evaluate("""()=>{
      const it=[...document.querySelectorAll('.wrong-item')].find(e=>e.querySelector('.wrong-headword').textContent.trim()==='restaurant');
      return {cnt:it.querySelector('.wrong-count').textContent.trim(), reason:(it.querySelector('.wrong-reason')||{textContent:'无'}).textContent.trim()};
    }""")
    check("A7 听写条目显示错N次+最近原因", rest["cnt"]=="错 2 次" and "把 a 写成了 e" in rest["reason"], str(rest))

    # ---------- A8：听写收录自动带拼写标签；与手动标签并集 ----------
    # 先清掉预置，只手动标记 adults=meaning
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400)
    pg.goto(URL + "#/learn"); pg.wait_for_timeout(500)
    # 手动标记 p2 第一张卡 adults 为 意思
    pg.click(".wrong-toggle"); pg.wait_for_timeout(200)
    pg.click('[data-wtag="meaning"]'); pg.wait_for_timeout(100)
    pg.click("[data-wconfirm]"); pg.wait_for_timeout(300)
    # 进入听写：范围=指定页 2，开始
    pg.goto(URL + "#/dictation"); pg.wait_for_timeout(400)
    pg.click('[data-drange="page"]'); pg.wait_for_timeout(200)
    pg.select_option("#singlePageSelect", "2"); pg.wait_for_timeout(100)
    pg.click("[data-dstart]"); pg.wait_for_timeout(500)
    # 第一题顺序词=adults，故意拼错
    pg.fill("#quizInput", "adult"); pg.wait_for_timeout(100)
    pg.click("[data-dsubmit]"); pg.wait_for_timeout(500)
    result_txt = pg.eval_on_selector(".result-reason", "e=>e.textContent")
    ans = pg.eval_on_selector(".answer-line b", "e=>e.textContent")
    check("A8 听写错拼后出批改结果", "adult" in ans, f"answer={ans} reason={result_txt.strip()}")
    pg.goto(URL + "#/wrong"); pg.wait_for_timeout(400)
    adults_e = pg.evaluate("localStorage.getItem('ieltsVocab.wrong')").__class__ and json.loads(pg.evaluate("localStorage.getItem('ieltsVocab.wrong')"))
    ae = adults_e.get("adults", {})
    check("A8 adults 标签=并集[意思,拼写]", sorted(ae.get("reasonTags",[]))==["meaning","spelling"], str(ae.get("reasonTags")))
    check("A8 adults count 累加到1", ae.get("count")==1, f"count={ae.get('count')}")
    check("A8 adults 保留最近原因", bool(ae.get("lastReason")), str(ae.get("lastReason")))

    check("无 console error", len(errs)==0, str(errs[:3]))
    br.close()

print("\n==== SUMMARY ====")
fails=[r for r in results if not r[1]]
print(f"total={len(results)} pass={len(results)-len(fails)} fail={len(fails)}")
for f in fails: print("FAIL:", f)
