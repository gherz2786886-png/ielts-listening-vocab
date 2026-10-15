# 雅思听力场景词汇网页 — 独立端到端 QA 验收报告

- 验收日期：2026-10-15
- 验收方式：独立复核（未复用构建方结论；所有结论均由本次新写脚本/渲染/实测得出）
- 边界：未修改 index.html / css / js / data / scripts 任何源码；新增脚本全部位于 `qa/`
- 源 PDF：`听力场景词汇.pdf`（31 页）

## 结论速览

| 项 | 结果 |
|----|------|
| A1 数据行数与渲染核对 | **通过**（发现 1 处数据错误，见下） |
| A2 JSON 结构断言 | 通过 |
| A3 特殊词条抽查 | 通过 |
| A4 印刷错误照录 | 通过 |
| B5 发音 URL 抽测 | 通过 |
| B6 发音代码审查 + 浏览器实测 | 通过 |
| C7/C8 批改引擎 41 案例 | 通过 |
| D9 集成检查 + 5 项补充实测 | 通过 |
| D10 截图视觉检查 | 通过 |
| D11 静态检查 | 通过 |

**总计：11 个验收项全部通过功能验收；发现 1 处内容级数据错误（p03-027 释义叠字），需修复后即可放行。**

---

## A. 数据保真

### A1. PDF 行数独立统计 + 渲染肉眼核对 —— 通过（附 1 处数据错误）

**行数统计（脚本 `qa/qa_a1_rowcount.py`，PyMuPDF `find_tables` 独立提取）：**

| 页 | PDF 数据行 | JSON 条数 | 页 | PDF 数据行 | JSON 条数 |
|----|----|----|----|----|----|
| p2 | 39 | 39 | p17 | 41 | 41 |
| p3 | 43 | 43 | p18 | 33 | 33 |
| p4 | 43 | 43 | p19 | 40 | 40 |
| p5 | 36 | 36 | p20 | 44 | 44 |
| p6 | 40 | 40 | p21 | 44 | 44 |
| p7 | 42 | 42 | p22 | 42 | 42 |
| p8 | 44 | 44 | p23 | 44 | 44 |
| p9 | 34 | 34 | p24 | 28 | 28 |
| p10 | 31 | 31 | p25 | 40 | 40 |
| p11 | 28 | 28 | p26 | 44 | 44 |
| p12 | 39 | 39 | p27 | 44 | 44 |
| p13 | 43 | 43 | p28 | 17 | 17 |
| p14 | 12 | 12 | p29 | 36 | 36 |
| p15 | 41 | 41 | p30 | 25 | 25 |
| p16 | 41 | 41 | | | |

合计 **1078 = 1078，29 页逐页相等**。分类规则：列头行（含"单词/中文解释"）、section 标题行（仅单格内容如"方位词""星期&月份"）、空行均不计入；p30 首表 6 条（季节）+ 次表 19 条（星期&月份）= 25，与基准一致。

**渲染肉眼核对（脚本 `qa/qa_render.py`，2.2x 渲染，另对疑点行 5x 放大）：**
核对页面：p3、p10、p14、p20（加抽）、p29、p30，共 **191 行**。
- 单词/释义/英音标/美音标四列无错行、无漏词；
- 并行词形与并行音标一一对应（p10 方位词、p2 bathroom/washroom/toilet）；
- 跨格切分造成的音标拼接（Japanese/Korean/January 等）已逐格还原，与 JSON 一致；
- 次要重音符号位置（ˌ）与 PDF 视觉位置一致（提取脚本会把它游离到行尾，属提取噪声，非数据错误）。

截图证据：`qa/qa_shots/pdf_p03.png`、`pdf_p10.png`、`pdf_p14.png`、`pdf_p20.png`、`pdf_p29.png`、`pdf_p30.png`、`pdf_p03_zoom_rows.png`（放大锁定行）。

> ### ⚠️ 发现的数据错误（1 处）
> **词条 p03-027「reasonable price」释义叠字**
> - 复现：打开 PDF p3 第 27 行，肉眼/放大截图见释义为「**合理的价格**」（5 字）；`data/vocab.json` 中 `meaning` =「**合理理的价格**」（6 字，多一个"理"）。
> - PDF 原始单元格切分：`['reasonable price', '合理', '的价格', …]` → 应为「合理的价格」。
> - 期望：`"meaning": "合理的价格"`；实际：`"meaning": "合理理的价格"`。
> - 影响：仅学习页释义显示，不影响发音与批改（该词未作听写答案）。
> - 证据：`qa/qa_shots/pdf_p03.png`（整页）、`pdf_p03_zoom_rows.png`（5x 放大行）。

### A2. JSON 结构断言 —— 通过

脚本 `qa/qa_a2_struct.py`，输出要点：
- 顶层 `{meta, scenarios, words}`，words=**1078**；
- id 全唯一；page 全部 ∈ [2,30]；无空字段；
- headwords 合计 **1178**，字符集仅 `[A-Za-z -]`（0 违规）；
- section 归属：p10 首行 east/west/south/north=方位词、p11 首行 intersection/junction=方位词、p29 首行 UK/Britain=国家及地区/国籍、season=季节、Monday=星期&月份 —— 全部与基准一致；
- 6 大场景页段：租房 p2-5 / 旅游 p6-11 / 运动音乐 p12-14 / 工作 p15-18 / 学术 p19-24 / 动植物 p25-30。

### A3. 特殊词条抽查（8 组）—— 通过

| 词条 | display | headwords | 判定 |
|------|---------|-----------|------|
| 斜杠并列 | term/ semester | [term, semester] | 合理 |
| 斜杠并列 | son/daughter | [son, daughter] | 合理 |
| 括号简称 | dormitory (dorm)/ residential college | [dormitory, residential college] | 合理（(dorm) 为括注，未误当独立词形） |
| 括号变形 | foot(feet) | [foot, feet] | 合理 |
| 三并列 | bathroom/washroom /toilet | [bathroom, washroom, toilet] | 合理 |
| 短语 | full-time job | [full-time job] | 合理 |
| 短语 | (day/night) shift | [day shift, night shift] | 合理 |
| 英式词 | cheque/ check | [cheque, check] | 合理 |

### A4. 印刷错误照录确认 —— 通过

- p03-004 review：`ipaUk = "/həʊ'tel/"`（PDF 印刷即为 hotel 音标，已照录）✓
- p03-005 honey：`ipaUk = "/ˈæn.ɪ.meɪ/"`（PDF 印刷即为 animal 式音标，已照录）✓

---

## B. 发音

### B5. dictvoice URL 抽测 —— 通过

脚本 `qa/qa_b5_curl.py` / `qa_b5_curl2.py`，curl.exe 实测（英 type=2 / 美 type=1）：

| 词 | 英 | 美 |
|----|----|----|
| restaurant | 200 / 12333B | 200 / 12717B |
| full-time job | 200 / 37920B | 200 / 36480B |
| national holidays | 200 / 42240B | 200 / 43680B |
| library | 200 / 12717B | 200 / 12525B |
| Wednesday | 200 / 12909B | 200 / 12556B |
| cheque | 200 / 8877B | 200 / 10797B |
| January | 200 / 13485B | 200 / 12909B |
| pedestrian crossing（长词） | 200 / 45770B | 200 / 30381B |
| endangered species（长词） | 200 / 47021B | 200 / 51391B |
| residential college（长词） | 200 / 44160B | 200 / 45120B |

共 20 请求全部 HTTP 200、音频字节 8.8KB–51KB。（说明：accommodation/beautiful/environment 不在本词库 headwords 中，已改抽词库真实长词。）

### B6. audio.js 代码审查 + 浏览器实测 —— 通过

代码审查（`js/audio.js` 全文）：
- 全局单通道：`play()` 开头即 `teardown()`，pause/清空上一 Audio 并 `speechSynthesis.cancel()`，无叠音 ✓
- 10s 超时看门狗 `CANPLAY_TIMEOUT_MS=10000`，超时→回退 ✓
- `audio.error` / `play()` reject → 回退 TTS ✓
- TTS 语言 `en-GB` / `en-US`，按 lang 前缀选 voice ✓
- URL 用 `encodeURIComponent(text)` ✓
- 全程 `new Audio(url)`，**未使用 fetch** ✓

Playwright 实测（脚本 `qa/qa_b6_playwright.py`）：
- 点 adults / gender / full-time job 的「英」→ 请求 `…&type=2`；点「美」→ `…&type=1` ✓
- 短语 `full-time job` → `audio=full-time%20job` 正确编码 ✓
- 按钮高亮：点击按钮 `aria-pressed=true` + 类 `speak-btn playing`，另一按钮自动取消 ✓
- 连点两词：`VocabAudio.current` 只指向最新播放，无叠音 ✓

---

## C. 批改引擎

### C7/C8. 41 案例测试 —— 通过

脚本 `qa/qa_dictation_cases.js`（node 加载 `js/dictation.js`），**41/41 全部通过**：
- 重跑已有自测页 24 案例（全部与自测页断言一致）；
- 新增 17 个案例（答案侧取真实英文词）：resturant、accomodation、wensday、libary、neccessary、behavior→behaviour、liter→litre、catalog→catalogue、freindly、seperate、definately、goverment、enviroment、recieve、beleive、nationalholidays、full time job→full-time job。

重点项：
- **trans 相邻颠倒**：freinds/freindly/recieve/beleive/teh 均识别为 `trans`（reason「相邻字母 X、Y 顺序颠倒」），**未退化成两个 sub**（kindsExclude sub 断言通过）；高亮含 `dl-trans`。
- **ukus 英美变体判对**：behaviour/behavior（-our/-or）、litre/liter（-re/-er）、catalog/catalogue（-ogue/-og）、cheque/check（-que/-ck）均 `accepted=true`，reasonCn 给出具体规则+「两种拼写都算对」；差异区统一高亮 `dl-ukus`（此路径下 trans 对被设计性地改标 ukus，属预期）。
- **短语空格/连字符**：nationalholidays→national holidays（space 判对）、full time job→full-time job（punct 判对）。
- 高亮 HTML 的 class 与 pairs 的 op 类别一一对应（dl-sub/dl-del/dl-ins/dl-trans/dl-ukus/dl-case/dl-space/dl-punct）。

---

## D. 应用

### D9. 集成检查 + 补充实测 —— 通过

`python qa/integration_check.py`：**21/21 通过**（globals、词数 1078/headwords 1178、各页卡片数、按钮数、type=2/1 请求、搜索、错词本持久化、正确答案判对、无 console 错误）。

补充实测（脚本 `qa/qa_d9_playwright.py`、`qa/qa_d9_wrong.py`）：
1. **并列词形按钮**：bathroom 卡片共 6 个按钮（bathroom/washroom/toilet × 英/美），逐个点击 UK 实际请求词分别为 bathroom、washroom、toilet ✓
2. **已学持久化**：勾选 p02-001 后刷新仍为勾选 ✓
3. **错词本**：做错 2 词（garden、parking lot）；标记 parking lot 已掌握 → 活跃错词仅剩 garden，「显示已掌握（1）」展开后 parking lot 在已掌握区；「错词本组卷重练」首题 = garden（**不含已掌握词**，范围正确）✓
4. **听写美音切换**：听写设置选美音后，重听请求 = `audio=garden&type=1` ✓
5. **学习进度**：勾选后进度 租房场景 已学 0/161 → 1/161 ✓

### D10. 截图视觉检查 —— 通过

shot.py 产出（`qa/qa_shots/`）：
- 桌面：`v1_learn/index_desktop.jpg`（学习）、`v2_dict_setup/index_desktop.jpg`（听写设置）、`v3_dict_session/index_desktop.jpg`（听写答题+批改结果）、`v4_wrong/index_desktop_fixed.jpg`（错词本）、`v5_summary/index_desktop_fixed.jpg`（成绩页）
- 移动：`v6_learn_mobile/index_mobile_p1of2.jpg`

逐项肉眼检查：
- 无破版、无横向溢出（shot report `horizontalOverflow: []`、`consoleErrors: []`、`resourceErrors: []`）；
- 全中文界面；发音按钮为文字「英/美」，**无 emoji 当图标**；
- 无空挂按钮（禁用态如错词重练在无活跃错词时正确 disabled）。
- 附注：shot.py 报 1 条 `slopFontsWarning`（CSS 使用 Arial 系统字体），属设计风格类提示，非功能缺陷，可忽略。

### D11. 静态检查 —— 通过

- `index.html` 以 4 个经典 `<script>` 标签加载 `data/vocab.js`、`js/audio.js`、`js/dictation.js`、`js/app.js`（无 ES module）；
- 全项目 grep `fetch(`/`XMLHttpRequest`/`import`/`require(`：业务源码 0 命中（仅 dictation.js 注释与本次 QA 脚本）；
- `node --check` 对 js/app.js、js/audio.js、js/dictation.js、data/vocab.js 全部通过。

---

## 不通过项清单

| # | 位置 | 问题 | 期望 | 实际 | 严重度 |
|---|------|------|------|------|--------|
| 1 | data/vocab.json id=p03-027 | 释义叠字 | `"meaning": "合理的价格"` | `"meaning": "合理理的价格"` | 低（仅显示，不影响发音/批改） |

其余 10 个验收项（A2/A3/A4/B5/B6/C7/C8/D9/D10/D11）全部通过。

## 总体结论

**功能验收通过。** 数据行数（1078）、词形数（1178）、场景与 section 归属、发音链路（URL 可用性 + 单通道 + TTS 回退）、批改引擎（trans/ukus/短语宽容）、应用交互（持久化/错词本范围/美音 type）、版式与静态检查均独立复核无误。

**唯一需修复**：p03-027「reasonable price」释义 `合理理的价格` → `合理的价格`（照录 PDF 原文即可）。修复该 1 处后即可正式放行。

## 本次新增 QA 脚本（均在 qa/）

- `qa_a1_rowcount.py`、`qa_render.py`、`qa_a1_visual.py`、`qa_a1_inspect.py`、`qa_a2_struct.py`、`qa_a3_special.py`、`qa_a3_special2.py`、`qa_c_lexicon.py`
- `qa_b5_curl.py`、`qa_b5_curl2.py`、`qa_b6_playwright.py`、`qa_b6_debug.py`、`qa_zoom.py`、`qa_zoom2.py`、`qa_probe.py`
- `qa_dictation_cases.js`
- `qa_d9_playwright.py`、`qa_d9_wrong.py`、`qa_d10_shots.py`、`qa_d10_fix.py`

---

# 修复复核（2026-10-15 二轮）

数据方对边界汉字被两侧单元格碎片重复收录的同类问题做了根因修复（共 10 处）。本节为独立复核记录，未修改任何源码与数据。

## 1. 10 条修复词条逐条对照 PDF

方法：脚本 `qa/qa_fix_pdf.py` 从 PDF 表格提取原始释义碎片并合并，与 JSON `meaning` 比对；另对 8 页做 4x 定向放大渲染（`qa/qa_shots/fix_*.png`）肉眼核对。

| id | display | PDF 原文（碎片合并） | JSON 当前 meaning | 结论 |
|----|---------|----------------------|--------------------|------|
| p03-027 | reasonable price | 合理+的价格 = 合理的价格 | 合理的价格 | ✓ 一致（原叠字「合理理的价格」已消除） |
| p04-026 | frozen | 冰冻+的 = 冰冻的 | 冰冻的 | ✓ 一致 |
| p04-027 | television/TV | 电视+机 = 电视机 | 电视机 | ✓ 一致 |
| p05-028 | combination | 组合+;合作; 联合体 | 组合;合作; 联合体 | ✓ 一致 |
| p17-026 | teamwork | 团队+合作 = 团队合作 | 团队合作 | ✓ 一致 |
| p18-026 | laptop | 笔记+本电脑(便携式) | 笔记本电脑(便携式) | ✓ 一致 |
| p18-027 | projector | 投影+仪；放映机 | 投影仪；放映机 | ✓ 一致（双释义正常） |
| p19-024 | oral | 口头+的；口述的 | 口头的；口述的 | ✓ 一致 |
| p24-025 | symbolism | 象征+主义 = 象征主义 | 象征主义 | ✓ 一致 |
| p26-028 | thermometer | 温度+计；体温计 | 温度计；体温计 | ✓ 一致 |

放大证据：`fix_p03_zoom_rows.png`、`fix_p04_frozen_tv.png`、`fix_p05_combination.png`、`fix_p17_teamwork.png`、`fix_p18_laptop_projector.png`、`fix_p19_oral.png`、`fix_p26_thermometer.png`（p24 symbolism 为程序比对一致）。

## 2. 重跑验证项

| 验证 | 结果 |
|------|------|
| 总词条 / headwords / id 唯一 | **1078 / 1178 / 唯一 ✓** |
| 全库相邻重复汉字扫描（`qa/qa_fix_check.py`） | 仅剩 1 处：p06-001 garden「花园园艺」—— PDF 原文即「花园 园艺」两组释义（放大留证 `qa_shots/zoom_garden.png`），属合法双释义；**无残留叠字** ✓ |
| node 加载 `data/vocab.js` | 成功：words=1078、headwords=1178、scenarios=6 ✓ |
| `python qa/integration_check.py` | **21/21 通过，0 失败** ✓ |

## 3. 放行结论

10 条修复词条逐条与 PDF 原文一致，同类叠字无残留，结构/加载/集成回归全绿。
**结论由「修复后放行」更新为：已复核放行。** （原「不通过项清单」第 1 项关闭。）
