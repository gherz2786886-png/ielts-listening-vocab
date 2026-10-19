# 雅思听力场景词汇 · 交互式网页词汇本 —— 架构与分工计划（PLAN）

> 产物：把《听力场景词汇（new）.pdf》（共 31 页，新东方南昌分中心国际教育雅思教研听口组）做成一个**双击即可运行、可推送 GitHub Pages** 的交互式网页词汇本。
> 计划模式（本文件）与目标模式（可运行成品网页）并行交付。

> 2026-10-19 勘误：本计划的有道口音映射写反；现行实现已更正为 type=1 英音、type=2 美音。本文保留初始计划，当前行为与验证以 README.md 和 DEBUG_REPORT.md 为准。

## 1. 源文件事实（已由总协调 Agent 探查确认）

- PDF 路径：`C:\Users\33362\Doubao\chats\2026-10-15\new-chat\听力场景词汇.pdf`（1,855,789 字节，有真实文本层，**非扫描件**）。
- 共 31 页：第 1 页封面、第 2–30 页为词汇表、第 31 页结束页（"A BETTER YOU / A BIGGER WORLD"，无词汇）。
- 每页为 **4 列带边框表格**：`单词 | 中文解释 | 英式音标 | 美式音标`；表头只在各场景首页出现。
- 场景（场景标题为加粗大字，出现在该场景首页）：

| 场景 | 起始页 | 结束页 |
|---|---|---|
| 租房场景 | 2 | 5 |
| 旅游场景 | 6 | 11 |
| 运动音乐场景 | 12 | 14 |
| 工作场景 | 15 | 18 |
| 学术场景 | 19 | 24 |
| 动植物场景 | 25 | 30 |

- PyMuPDF `find_tables()` 初步统计约 **1042 个词条**（以 PDF 解析 Agent 逐页渲染核对后的数字为准，QA 复核）。
- 已确认的源文件坑（提取时**照抄不修正**，在质量报告里标注）：
  - 第 3 页 review/honey 等个别行的**印刷音标与单词错位**（源 PDF 自身错误，非提取错误）；发音以在线词典为准，印刷音标仅展示。
  - 单词列存在斜杠并列（`term/ semester`、`dormitory (dorm)/residential college`、`son/daughter`、`cheque/ check`）、多行单元格（`bathroom/washroom /toilet`）、短语（`full-time job`、`(day/night) shift`）。
- 发音接口已实测可用（2026-10-15）：有道 `https://dict.youdao.com/dictvoice?audio=<词>&type=2`（英音）、`type=1`（美音），返回 `audio/mpeg`；短语 URL 编码后同样可用。
- 环境：Windows、PowerShell 5.1、Python 3.13 + PyMuPDF 1.28.2、git 2.56。

## 2. 目录结构与模块划分

```
ielts-listening-vocab/
├── index.html               # 单页应用入口（hash 路由：学习/听写/错词本）
├── css/style.css            # 全部样式（响应式，中文界面）
├── js/
│   ├── audio.js             # 语音模块：英音/美音双通道 + 失败回退（window.VocabAudio）
│   ├── dictation.js         # AI 批改模块：字符对齐 + 错误分类 + 中文原因（window.Dictation）
│   └── app.js               # 应用主体：渲染、分页导航、搜索、进度、听写流程、错词本
├── data/
│   ├── vocab.json           # 规范数据（交付物、供 fetch/二次使用）
│   └── vocab.js             # window.VOCAB = {...} 包装（file:// 双击运行时用 <script> 加载，规避 fetch 限制）
├── scripts/extract_pdf.py   # PDF 提取脚本（可复现）
├── qa/                      # 提取质量报告、QA 记录（不进核心功能）
├── PLAN.md                  # 本文件
└── README.md                # 功能说明、使用方法、截图（GitHub Agent 编写）
```

**为何不是单文件 HTML**：html skill 默认交付单文件，但用户明确要求"变成网页 + 数据 JSON + 推 GitHub"。多文件仓库用经典 `<script src>` 加载，`file://` 双击本地运行与 GitHub Pages 均可用；数据用 `vocab.js`（`window.VOCAB`）而非运行时 fetch，绕开 file:// 的 CORS 限制，同时保留 `vocab.json` 作为规范数据交付。

## 3. 数据契约（vocab.json，所有模块共同遵守）

```json
{
  "meta": {
    "title": "雅思听力场景词汇",
    "source": "听力场景词汇（new）.pdf",
    "totalPages": 31,
    "contentPages": [2, 30],
    "totalWords": 1042,
    "generatedAt": "2026-10-15"
  },
  "scenarios": [
    {"id": "renting", "name": "租房场景", "startPage": 2, "endPage": 5}
  ],
  "words": [
    {
      "id": "p02-001",
      "page": 2,
      "scenarioId": "renting",
      "scenario": "租房场景",
      "display": "term/ semester",
      "headwords": ["term", "semester"],
      "meaning": "学期",
      "ipaUk": "/tɜːm/ /sɪˈmes.tər/",
      "ipaUs": "/tɝːm/ /səˈmɛs.tɚ/"
    }
  ]
}
```

字段约定（严格执行）：
- `id`：`p{两位页码}-{三位页内序号}`，全表唯一。
- `display`：单词列**照录**原文（仅折叠多余空白/换行为空格），保留括号、斜杠、连字符。
- `headwords`：可独立发音/听写的词形数组。拆分规则：
  - 斜杠 `/` 分隔的并列词逐个拆出（`term/ semester` → `["term","semester"]`）；
  - 括号缩写去掉括号内容（`dormitory (dorm)` → `dormitory`；`(day/night) shift` 这种括号是词义一部分时保留为 `day/night shift` 或 `night shift`/`day shift`，由提取 Agent 按视觉逐例判断并在报告中列出）；
  - 短语不拆（`full-time job` → `["full-time job"]`）；
  - 每个 headword 必须是纯英文/连字符/空格，可直接送入发音接口。
- `meaning`：中文释义照录。
- `ipaUk` / `ipaUs`：照录印刷音标（含源文件的错位错误，不改），无则空字符串。

## 4. 模块接口（冻结，各方按此开发）

### 4.1 js/audio.js —— `window.VocabAudio`
- `urlFor(text, accent)`：返回有道 URL；`accent` 为 `'uk'`（type=2）或 `'us'`（type=1），`text` 经 `encodeURIComponent`。
- `play(text, accent, {onEnd, onError}={})` → Promise：**全局唯一播放器**，新播放立即停止上一个（英音/美音两按钮各自独立、可随时打断/停止，不依赖整页长录音）；有道请求失败/超时/无可播放音频时，**自动回退** `speechSynthesis`（`en-GB` / `en-US`）。
- `stop()`：停止一切播放。
- `preload(text)`：可选预取。
- 同时提供每个按钮的播放/停止态视觉钩子（播放中的按钮加 class，由前端定样式）。

### 4.2 js/dictation.js —— `window.Dictation`
- `check(input, answer)` → 结果对象：
  - `accepted: boolean`（拼写正确；仅大小写/空格/连字符差异时为 true 并给格式提示）；
  - `pairs: [{a: 期望字符|'', g: 所填字符|'', op: 'equal'|'sub'|'del'|'ins'|'trans'|'case'|'space'|'punct'}]`：基于 Damerau–Levenshtein（含相邻换位、双写）回溯的逐字符对齐；
  - `errorKinds: [{code, labelCn}]`；
  - `reasonCn: string`：**中文错误原因**，由对齐结果经确定性规则生成，例如：
    "漏写了字母 a"、"多写了字母 e"、"把 t 写成了 d"、"相邻字母 e/i 顺序颠倒"、"双写错误：p 应双写（app…）"、
    "后缀混淆：-er/-or"、"英式/美式拼写差异（-our/-or 等，英式 -our / 美式 -or）"、
    "漏写了不发音字母 k（kn- 中 k 不发音）"；
  - `highlightHtml: string`：带 `<span class="dl-...">` 的逐字符高亮 HTML（dl-sub 错写红 / dl-del 漏写橙 / dl-ins 多写蓝 / dl-trans 颠倒紫 / dl-case·dl-space·dl-punct 灰 / dl-ukus 青）。
- 规则要求：原因必须由算法+有限规则表推出，**禁止编造**；内置英/美式拼写变体表（-our/-or、-re/-er、-ise/-ize、-ll-/-l-、-ce/-se、-que/-ck、programme/program、cheque/check 等），命中时给"英式/美式拼写差异"提示且 `accepted` 视为正确（柔和提示）；短语答案折叠多余空格判对但提示空格。
- 纯本地 JS、无外部依赖、无 API key。

### 4.3 js/app.js —— 前端（前端 Agent 所有）
- 三个 hash 视图：
  1. **学习模式**：场景标签 + 按 PDF 页码分页（上一页/下一页/页码跳转，每页显示该页词卡）；词卡含 display、中文、双音标、**英音/美音两个独立按钮**、并列词形每个可单独发音；搜索框（匹配英文/中文，跨页）；"已学"标记（localStorage 持久化）+ 进度条。
  2. **听写模式**：范围选择（当前页/当前场景/全部/错词本）、顺序/随机；从所选词条的 headwords 中确定目标词并播放（英/美可切换、可重听）；输入框提交后调用 `Dictation.check`，展示逐字符高亮 + 中文原因 + 正确答案与释义；错词自动入错词本；支持"下一题"、本轮正确率。
  3. **错词本**：错词列表（按场景/错误次数筛选）、单条重练、整组重练、"已掌握"移除标记；localStorage 持久化。
- 界面中文、响应式（窄屏可用）、无僵尸按钮；加载 `data/vocab.js`（file://）与 `data/vocab.json`（Pages，二选一容错）。

## 5. 七个 Agent 编制与波次

| # | Agent | 职责 | 产出 | 依赖 |
|---|---|---|---|---|
| 1 | 总协调（Organizer，本 Agent） | 探查、架构、接口冻结、PLAN.md、整合、最终验证与总结 | PLAN.md、整合后的成品 | — |
| 2 | PDF 解析 Agent | 逐页表格提取、渲染核对、双格式数据、提取脚本与质量报告 | data/vocab.json、data/vocab.js、scripts/extract_pdf.py、qa/extraction_report.md | 无 |
| 3 | 语音方案 Agent | 验证发音接口、audio.js、独立测试页 | js/audio.js、qa/audio_test.html | 无 |
| 4 | 网页前端 Agent | index.html、style.css、app.js（学习/听写/错词本三视图） | 网页主体 | #2、#3、#5 接口 |
| 5 | AI 批改 Agent | dictation.js（对齐/分类/原因/高亮）+ 测试夹具 | js/dictation.js、qa/dictation_test.html | 仅依赖本契约 |
| 6 | GitHub Agent | git init、README、.gitignore、远程创建/推送、Pages；失败则交付本地仓库+指引 | git 仓库、README.md、仓库链接 | 成品网页 |
| 7 | QA 验证 Agent | 词数/页码核对、双音播放、错拼案例批改验证、截图 UI 检查、问题回修复验 | qa/qa_report.md | 成品网页 |

- **第 1 波（并行）**：#2 PDF 解析、#3 语音方案、#5 AI 批改（#5 只依赖接口契约）。
- **第 2 波**：#4 前端（消费 #2 数据、#3 模块、#5 接口）。
- **整合**：#1 合并 #5 模块到前端页面并自测。
- **第 3 波（并行）**：#6 GitHub（先初始化/提交）与 #7 QA；QA 问题回修后 #6 补提交并推送。

## 6. 验收清单（QA 逐条签字）

1. 词条数与 PDF 第 2–30 页逐页视觉清点一致；场景/页码归属正确；并列词、短语、括号、多行单元格无遗漏；音标照录（含源文件错位）。
2. 每个词条（含每个并列词形）都能独立播放英音、美音；两按钮互不阻塞、可打断；断网时 Web Speech 兜底有提示。
3. 双击 index.html（file://）可离线运行（除在线音频外）；GitHub Pages 亦可运行。
4. 听写批改：覆盖 错写/漏写/多写/相邻颠倒/双写/-er·-or/英美拼写/大小写空格 共 ≥12 个预设错拼案例，高亮与中文原因全部正确。
5. 错词本自动收集、可重练、可标记掌握，刷新后保留。
6. 搜索、分页、场景切换、进度标记全部真实可用；中文 UI；页面截图无破版。
7. GitHub 仓库可访问（或本地仓库 + 最简推送指引完整）；README 含功能、用法、截图。
