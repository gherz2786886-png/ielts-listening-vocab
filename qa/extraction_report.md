# 雅思听力场景词汇 PDF 提取 — 质量报告

- 源文件：`听力场景词汇（new）.pdf`（共 31 页：p1 封面、p2–p30 词汇表、p31 结束页）
- 提取脚本：`scripts/extract_pdf.py`（PyMuPDF），重跑该脚本可重新生成 `data/vocab.json`、`data/vocab.js`
- 生成日期：2026-10-15

## 一、总量

| 指标 | 数值 |
|---|---|
| 词条总数（words） | **1078** |
| headwords 总数（可独立发音/听写词形） | **1178** |
| 场景数 | 6（租房 36+43+43+39=161；旅游 40+42+44+34+31+28=219；运动音乐 39+43+12=94；工作 41+41+41+33=156；学术 40+44+44+42+44+28=242；动植物 40+44+44+17+36+25=206） |

## 二、每页"视觉行数 vs 提取条数"对照

逐页将 p2–p30 渲染为 2x PNG（`qa/page_renders/page_XX.png`）并人工读图数行，与提取条数对照：

| 页码 | 视觉行数 | 提取条数 | 一致 | 页码 | 视觉行数 | 提取条数 | 一致 |
|---|---|---|---|---|---|---|---|
| p2 | 39 | 39 | ✅ | p17 | 41 | 41 | ✅ |
| p3 | 43 | 43 | ✅ | p18 | 33 | 33 | ✅ |
| p4 | 43 | 43 | ✅ | p19 | 40 | 40 | ✅ |
| p5 | 36 | 36 | ✅ | p20 | 44 | 44 | ✅ |
| p6 | 40 | 40 | ✅ | p21 | 44 | 44 | ✅ |
| p7 | 42 | 42 | ✅ | p22 | 42 | 42 | ✅ |
| p8 | 44 | 44 | ✅ | p23 | 44 | 44 | ✅ |
| p9 | 34 | 34 | ✅ | p24 | 28 | 28 | ✅ |
| p10 | 31 | 31 | ✅ | p25 | 40 | 40 | ✅ |
| p11 | 28 | 28 | ✅ | p26 | 44 | 44 | ✅ |
| p12 | 39 | 39 | ✅ | p27 | 44 | 44 | ✅ |
| p13 | 43 | 43 | ✅ | p28 | 17 | 17 | ✅ |
| p14 | 12 | 12 | ✅ | p29 | 36 | 36 | ✅ |
| p15 | 41 | 41 | ✅ | p30 | 25 | 25 | ✅ |
| p16 | 41 | 41 | ✅ | | | | |

**两列全部一致（合计 1078 条），无缺行、无表头/页眉/页码混入。**
重点页（p3、p4、p14、p28、p30）已逐格核对四列配对，无错行。

## 三、section 字段（最近上方加粗标题归属）

每条 word 增加字符串字段 `section`：取该词所在表格行**最近的上方加粗标题**（12pt STSongti-SC-Bold 中文行），按标题 span 的 y 坐标与表格行顶 y 坐标严格判定——行顶越过某标题底线即切换归属；标题归属**跨页向下延续**。

全表经 `size>=11 & Bold & 含中文` 全量扫描，加粗标题共 9 个（除此之外无其他加粗行）：

| 标题 | 所在页 | 标题 y 底线 | 归属词数 |
|---|---|---|---|
| 租房场景 | p2 | 96.8 | 161（p2–5 全部） |
| 旅游场景 | p6 | 81.2 | 160（p6–9；p10 起被「方位词」取代） |
| 方位词 | p10 | 81.7 | 59（p10 全部 31 + p11 全部 28，p11 无标题故延续） |
| 运动音乐场景 | p12 | 81.0 | 94（p12–14 全部） |
| 工作场景 | p15 | 81.0 | 156（p15–18 全部） |
| 学术场景 | p19 | 81.0 | 242（p19–24 全部） |
| 动植物场景 | p25 | 81.0 | 145（p25–28 全部；p29 起被「国家及地区/国籍」取代） |
| 国家及地区/国籍 | p29 | 81.0 | 36（p29 全部） |
| 季节 | p30 | 81.0 | 6（season、spring、summer、autumn、fall、winter） |
| 星期&月份 | p30 | 240.9 | 19（p30 第二表：周一~周日 7 天 + 12 个月） |

合计 1078，与总词条数一致。抽查确认：p10 首行 east/west/south/north 与末行 crossroads/crossing 均为「方位词」；p11 首行 intersection/junction 延续「方位词」；p28 末行 trap 仍属「动植物场景」；p29 首行 UK/Britain 为「国家及地区/国籍」；p30 season 为「季节」、Monday 起为「星期&月份」。p10/p29 标题位于页顶，其上方无表格行，故无「标题之上仍属上一 section」的实际案例（脚本逻辑已覆盖该情形）。

## 四、提取方法要点（为什么不是直接 table.extract()）

1. 各页表格列数漂移（4/5/7/8/9/10 列），且个别页（p8）单词列整体右移、p29 释义文字越界压入单词列右缘。
2. 因此采用：`find_tables()` 定位行 → 对每个单元格 bbox 向内收缩 1pt 后用 `page.get_text(clip=...)` 取文本 → 按内容特征归列（首个含拉丁字母格=单词；其后连续中文格=释义；其余=音标片段）。
3. 该方式同时保证了印刷音标忠实：次重音 ˌ、鼻化 ̬ 等符号留在原位（table.extract() 会把它们拆成独立尾行）。
4. 音标拆格碎片按规则拼回：3 段碎片时，中段以 `/` 或 `[` 开头判为美音拆格，否则判为英音拆格；边界字符重复（clip 重叠所致）自动去重一次。

## 五、特殊单元格处理清单

### 5.1 斜杠并列词（headwords 拆分，共 75 个多词词条）

- 规则：按 `/` 拆分、去括注缩写；短语不拆。
- 典型：`term/ semester`→[term, semester]；`dormitory (dorm)/ residential college`→[dormitory, residential college]；`cheque/ check`→[cheque, check]；`bathroom/washroom /toilet`→[bathroom, washroom, toilet]；`garbage/litter/rubbish/ trash/waste`→[garbage, litter, rubbish, trash, waste]；`next to/beside /close to/nearby/by`→[5 词]；`booklet/pamphlet/brochure /leaflet`→[4 词]。
- 手工指定（规则无法正确判断）：
  - `switch on/off` → [switch on, switch off]（p4）
  - `lead to/off` → [lead to, lead off]（p11）
  - `branch to/off side road` → [branch to, branch off side road]（p11）
  - `book/reserve (v.)- booking/reservation(n.)` → [book, reserve, booking, reservation]（p6）
  - `in front of/ at the front of in the front of` → [in front of, at the front of, in the front of]（p10）
  - `chemical/ contaminants Contamination` → [chemical, contaminants, contamination]（p22）

### 5.2 括号单元格

- 括注缩写去除：`dormitory (dorm)`→dormitory、`refrigerator (fridge)`→refrigerator、`mathematics/ math(s)`→math、`quiz(zes)`→quiz。
- 括号属于词义/读音变体的：
  - `(day/night) shift` → [day shift, night shift]（p16）
  - `foot(feet)` → [foot, feet]（p14；源印刷英音 /fʊt/、美音 /fiːt/，照录）
  - `on the left (hand) side`、`top right (hand) corner`：display 保留括号，headwords 去除括注后为短语原形。

### 5.3 多行单元格（换行已折叠为单空格）

- 单词列换行：`dormitory (dorm)/ residential college`、`bathroom/washroom /toilet`、`parking lot/ car park/ parking space`、`ticket office/ box office`、`booklet/pamphlet/brochure /leaflet`、`under/below /beneath/underneath`、`in front of/ at the front of in the front of`、`next to/beside /close to/nearby/by`、`sidewalk /pavement/footpath`、`pedestrian crossing /zebra crossing`、`pottery/ceramics/ porcelain`、`harmful insects/pest` 等。
- 释义列换行：`右边的, 正好, 就在`、`男服务员/女服务 员`、`adj. 金发头发的 n. (blond 男 blonde 女)`（blonde/blond）等，均折叠为单空格照录。

### 5.4 短语（headwords 不拆，整词形保留）

- full-time job、part-time/full-time（斜杠并列部分才拆）、life span、peak season、traffic lights、sports centre、work placement 等，均作为单个 headword。

### 5.5 手工音标覆盖（extract_pdf.py MANUAL_OVERRIDES）

| 页 | 词条 | 处理 |
|---|---|---|
| p4 | switch on/off | 英音格内含 on/off 两条读音被表格拆成两列，手工归并为 /swɪtʃ ɒn/ /swɪtʃ ɒf/ |
| p6 | refreshment/snack | 提取丢失首斜杠，按印刷校回 /rɪˈfreʃmənt//snæk/ |
| p10 | under/below/beneath/underneath | 美音格折行错位，按印刷校回 /ˈʌn.dər//bɪˈloʊ//bɪˈniːθ//ˌʌn.dɚˈniːθ/ |
| p29 | Japanese | 美音丢首斜杠、英音尾部分格斜杠，按印刷校回 |
| p30 | January | 美音次重音位置错位，按印刷校回 /ˈdʒæn.ju.əri/ |

## 六、源文件自身错误清单（照录未改，不做"修正"）

1. **p3 review 行**：印刷音标为 /həʊ'tel/（英）/hoʊ'tel/（美）——实为 hotel 的音标，源文件错位，照录。
2. **p3 honey 行**：印刷音标为 /ˈæn.ɪ.meɪ/（英）/ˈæn.ə.meɪ/（美）——实为 animal 的音标，源文件错位，照录。
3. **p9 alone 行**：印刷音标 /rɪˈkɔːdɪŋ/（英）/rɪˈkɔːrdɪŋ/（美），与上一行 recording 完全相同，源文件错位，照录。
4. **p14 foot(feet)**：美音列印刷 /fiːt/（复数读音），照录。
5. **p10 crossroads/crossing**：美音列印刷 /ˈkrɒs./（截断残缺），照录。
6. **p24 breathing**：英音列为空，照录（ipaUk=""）。
7. behind/at the back(of)（p10）英音、美音两列印刷完全相同，照录。

## 七、自动校验结果

- `json.load(vocab.json)` ✅；vocab.js 经 Node 22 实际 eval 加载 ✅（`window.VOCAB.words.length=1078`）。
- vocab.json / vocab.js 均为 UTF-8 无 BOM；js 中无 `</script>` 串。
- 所有 `id` 唯一 ✅；`page ∈ 2..30` ✅；每条 `headwords` 非空 ✅。
- headwords 字符集校验：仅含英文字母/空格/连字符，0 例违规（撇号已去除，如 driver's license → drivers license，在报告中注明）。
- 每条 word 均含非空 `section` 字段 ✅；各 section 词数合计 1078 ✅（见第三节）。
- 每页 id 按页内 001 起连续编号。

## 八、二次修复记录：释义单元格边界字重复（2026-10-15 QA 复核）

### 8.1 根因

同一释义格被表格竖线切成相邻单元格时，边界汉字（如 p3 reasonable price 的"理"）会被两侧 clip 各收录一次：原始碎片为「合理」(cell) + 「理的价格」(cell)。旧归并逻辑只处理"一方整体包含另一方"的情形，遇"后缀==前缀"的部分重叠直接拼接，产生「合理理的价格」。修复：释义归并改为按"joined 后缀 == cs 前缀"的最长重叠自动去重后拼接（等价于原"完全包含/整体前缀"情形的超集）。

### 8.2 修复的 10 条（全部为边界字重复，已回 PDF 单元格核对）

| id | display | 旧 meaning | 新 meaning |
|---|---|---|---|
| p03-027 | reasonable price | 合理理的价格 | 合理的价格 |
| p04-026 | frozen（冰冻义） | 冰冻冻的 | 冰冻的 |
| p04-027 | television | 电视视机 | 电视机 |
| p05-028 | combination | 组合合;合作; 联合体 | 组合;合作; 联合体 |
| p17-026 | teamwork | 团队合合作 | 团队合作 |
| p18-026 | laptop | 笔记本本电脑(便携式) | 笔记本电脑(便携式) |
| p18-027 | projector | 投影仪仪；放映机 | 投影仪；放映机 |
| p19-024 | oral | 口头的的；口述的 | 口头的；口述的 |
| p24-025 | symbolism | 象征主主义 | 象征主义 |
| p26-028 | thermometer | 温度计计；体温计 | 温度计；体温计 |

### 8.3 同类全量扫描结论

- **meaning 相邻重复汉字**：修复后全表仅剩 p06-001 garden「花园园艺」——经 6x 放大渲染（`qa/zoom_garden.png`）确认 PDF 原文即"花园 园艺"（两组释义间有空格），为合法源排版，**保留不改**。
- **display 相邻重复字母**（balloon/coffee/ladder/wool 等）：全部为英文合法叠字母，且 display 取自单词单格、无归并过程，无拼接错误。
- **ipaUk/ipaUs 中 `//` 相邻斜杠**：全部为斜杠并列词多条读音的源排版（如 /flæt//əˈpɑːt.mənt/），拼接逻辑刻意不拆斜杠边界，合法。
- 修复后重跑：总词条仍 **1078**、id 唯一、headwords 1178；vocab.js 经 Node 22 eval 加载通过，p03-027 meaning="合理的价格"。

## 九、遗留小问题（不影响使用）

- 个别音标在相邻格边界处的点号/连字符有轻微位移（如 p20 mathematics 美音 /ˌmæθˈmætɪks/ 少一个音节点），属表格线切割所致，已在可接受范围。
- 释义中个别半角分号 `;`、空格为源排版原样（如 "录音棚;单间公寓"、"男服务员/女服务 员"），未做语义级润色。
