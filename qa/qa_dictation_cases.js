/* qa_dictation_cases.js — 独立验收：dictation.js 批改引擎案例测试（node 运行）
 * 用法: node qa/qa_dictation_cases.js
 * 加载 ../js/dictation.js，跑【已有24案例的独立重跑】+【本QA新增17案例】，
 * 逐案例输出 accepted / pairs对齐 / errorKinds / reasonCn / 高亮class，并断言。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'dictation.js'), 'utf8');
// dictation.js 在 node 下绑定 globalThis.Dictation
new Function(src)();
const D = globalThis.Dictation;
if (!D) { console.error('FAIL: Dictation not loaded'); process.exit(1); }

// ============ 案例定义 ============
// expect.accepted, expect.kindsInclude[], expect.kindsExclude[], expect.reasonIncludes[],
// expect.hasTrans (bool), expect.highlightMustContain[], expect.highlightMustNotContain[]
const CASES = [
  // ---- 已有自测页 24 案例的独立重跑（与 dictation_test.html 对齐）----
  { name: '已有#1 完全正确', input: 'adults', answer: 'adults',
    expect: { accepted: true, reasonIncludes: ['拼写正确'] } },
  { name: '已有#2 accomodate漏m应双写', input: 'accomodate', answer: 'accommodate',
    expect: { accepted: false, kindsInclude: ['del', 'double'], reasonIncludes: ['应双写'] } },
  { name: '已有#3 freinds颠倒', input: 'freinds', answer: 'friends',
    expect: { accepted: false, kindsInclude: ['trans'], hasTrans: true } },
  { name: '已有#4 ned漏e', input: 'ned', answer: 'need',
    expect: { accepted: false, kindsExclude: ['double'], reasonIncludes: ['漏写了字母 e'] } },
  { name: '已有#5 dormidory t→d', input: 'dormidory', answer: 'dormitory',
    expect: { accepted: false, reasonIncludes: ['把 t 写成了 d'] } },
  { name: '已有#6 bocket u→o', input: 'bocket', answer: 'bucket',
    expect: { accepted: false, reasonIncludes: ['把 u 写成了 o'] } },
  { name: '已有#7 untill多l', input: 'untill', answer: 'until',
    expect: { accepted: false, kindsInclude: ['ins', 'double'], reasonIncludes: ['多写了一个 l'] } },
  { name: '已有#8 teh颠倒', input: 'teh', answer: 'the',
    expect: { accepted: false, kindsInclude: ['trans'], hasTrans: true } },
  { name: '已有#9 stoped p应双写', input: 'stoped', answer: 'stopped',
    expect: { accepted: false, kindsInclude: ['double'] } },
  { name: '已有#10 begining n应双写', input: 'begining', answer: 'beginning',
    expect: { accepted: false, kindsInclude: ['double'] } },
  { name: '已有#11 acter后缀', input: 'acter', answer: 'actor',
    expect: { accepted: false, kindsInclude: ['suffix'] } },
  { name: '已有#12 collecter后缀', input: 'collecter', answer: 'collector',
    expect: { accepted: false, kindsInclude: ['suffix'] } },
  { name: '已有#13 colour/color英美判对', input: 'colour', answer: 'color',
    expect: { accepted: true, kindsInclude: ['ukus'], reasonIncludes: ['两种拼写都算对'] } },
  { name: '已有#14 organise/organize英美', input: 'organise', answer: 'organize',
    expect: { accepted: true, kindsInclude: ['ukus'] } },
  { name: '已有#15 cheque/check英美', input: 'cheque', answer: 'check',
    expect: { accepted: true, kindsInclude: ['ukus'] } },
  { name: '已有#16 centre/center英美', input: 'centre', answer: 'center',
    expect: { accepted: true, kindsInclude: ['ukus'] } },
  { name: '已有#17 travelling/traveling英美', input: 'travelling', answer: 'traveling',
    expect: { accepted: true, kindsInclude: ['ukus'] } },
  { name: '已有#18 nife不发音k', input: 'nife', answer: 'knife',
    expect: { accepted: false, kindsInclude: ['del', 'silent'] } },
  { name: '已有#19 clime不发音b', input: 'clime', answer: 'climb',
    expect: { accepted: false, kindsInclude: ['silent'] } },
  { name: '已有#20 full time→full-time格式', input: ' full time ', answer: 'full-time',
    expect: { accepted: true, kindsInclude: ['punct'] } },
  { name: '已有#21 ADULTS大小写', input: 'ADULTS', answer: 'adults',
    expect: { accepted: true, kindsInclude: ['case'] } },
  { name: '已有#22 day shift多空格折叠', input: '  day   shift ', answer: 'day shift',
    expect: { accepted: true, kindsInclude: ['space'] } },
  { name: '已有#23 dayshift漏空格判对', input: 'dayshift', answer: 'day shift',
    expect: { accepted: true, kindsInclude: ['space'] } },
  { name: '已有#24 admistration连续漏写', input: 'admistration', answer: 'administration',
    expect: { accepted: false, kindsInclude: ['del'] } },

  // ============ 本次 QA 新增 17 案例（答案侧均为真实英文词） ============
  { name: '新#1 resturant少a', input: 'resturant', answer: 'restaurant',
    expect: { accepted: false } },
  { name: '新#2 accomodation少m应双写', input: 'accomodation', answer: 'accommodation',
    expect: { accepted: false, kindsInclude: ['double'] } },
  { name: '新#3 wensday漏d', input: 'wensday', answer: 'wednesday',
    expect: { accepted: false, kindsInclude: ['del'] } },
  { name: '新#4 libary漏r', input: 'libary', answer: 'library',
    expect: { accepted: false, kindsInclude: ['del'], kindsExclude: ['double'] } },
  { name: '新#5 neccessary多c', input: 'neccessary', answer: 'necessary',
    expect: { accepted: false, kindsInclude: ['double'] } },
  { name: '新#6 behaviour/behavior英美判对', input: 'behavior', answer: 'behaviour',
    expect: { accepted: true, kindsInclude: ['ukus'], reasonIncludes: ['-our', '两种拼写都算对'] } },
  { name: '新#7 litre/liter英美判对', input: 'liter', answer: 'litre',
    expect: { accepted: true, kindsInclude: ['ukus'], reasonIncludes: ['-re', '-er', '两种拼写都算对'] } },
  { name: '新#8 catalog/catalogue英美判对', input: 'catalog', answer: 'catalogue',
    expect: { accepted: true, kindsInclude: ['ukus'], reasonIncludes: ['-ogue', '两种拼写都算对'] } },
  { name: '新#9 freindly ie/ei颠倒', input: 'freindly', answer: 'friendly',
    expect: { accepted: false, kindsInclude: ['trans'], kindsExclude: ['sub'], hasTrans: true } },
  { name: '新#10 seperate a→e', input: 'seperate', answer: 'separate',
    expect: { accepted: false, reasonIncludes: ['把 a 写成了 e'] } },
  { name: '新#11 definately i→a', input: 'definately', answer: 'definitely',
    expect: { accepted: false, reasonIncludes: ['把 i 写成了 a'] } },
  { name: '新#12 goverment漏n', input: 'goverment', answer: 'government',
    expect: { accepted: false, kindsInclude: ['del'], kindsExclude: ['double'] } },
  { name: '新#13 enviroment漏n', input: 'enviroment', answer: 'environment',
    expect: { accepted: false, kindsInclude: ['del'] } },
  { name: '新#14 recieve ie/ei颠倒', input: 'recieve', answer: 'receive',
    expect: { accepted: false, kindsInclude: ['trans'], kindsExclude: ['sub'], hasTrans: true } },
  { name: '新#15 beleive ie/ei颠倒', input: 'beleive', answer: 'believe',
    expect: { accepted: false, kindsInclude: ['trans'], kindsExclude: ['sub'], hasTrans: true } },
  { name: '新#16 nationalholidays漏空格判对', input: 'nationalholidays', answer: 'national holidays',
    expect: { accepted: true, kindsInclude: ['space'] } },
  { name: '新#17 full time job→full-time job连字符判对', input: 'full time job', answer: 'full-time job',
    expect: { accepted: true, kindsInclude: ['punct'] } },
];

// ============ 断言执行 ============
let passCount = 0; const rows = [];
for (const c of CASES) {
  const res = D.check(c.input, c.answer);
  const e = c.expect;
  const problems = [];
  if (res.accepted !== e.accepted) problems.push(`accepted=${res.accepted}(期望${e.accepted})`);
  const codes = res.errorKinds.map(k => k.code);
  (e.kindsInclude || []).forEach(k => { if (!codes.includes(k)) problems.push(`缺类别${k}(实:${codes.join(',')})`); });
  (e.kindsExclude || []).forEach(k => { if (codes.includes(k)) problems.push(`多了类别${k}`); });
  (e.reasonIncludes || []).forEach(s => { if (!res.reasonCn.includes(s)) problems.push(`reason缺"${s}"(实:${res.reasonCn})`); });
  const hasTransPair = res.pairs.some(p => p.op === 'trans');
  if (e.hasTrans === true && !hasTransPair) problems.push('应有trans对齐对但没有(退化成sub?)');
  if (e.hasTrans === false && hasTransPair) problems.push('意外出现trans');

  // 高亮 class 与 pair op 一致性校验
  const opToClass = { sub: 'dl-sub', del: 'dl-del', ins: 'dl-ins', trans: 'dl-trans' };
  const renderedClasses = (res.highlightHtml.match(/class="(dl-[\w-]+)"/g) || []).map(s => s.replace('class="', '').replace('"', ''));
  const expectedErrClasses = res.pairs.filter(p => p.op in opToClass || p.ukus).map(p => p.ukus ? 'dl-ukus' : opToClass[p.op]);
  // ukus accepted 路径下全部差异对都应是 dl-ukus
  if (e.accepted === true && codes.includes('ukus')) {
    if (renderedClasses.length && !renderedClasses.every(x => x === 'dl-ukus' || x === 'dl-space' || x === 'dl-punct' || x === 'dl-case'))
      problems.push(`ukus高亮class不纯: ${renderedClasses.join(',')}`);
  }
  // trans 路径下高亮必须含 dl-trans（ukus 判对路径除外：差异区统一改标 dl-ukus，属设计）
  const inUkusAccepted = e.accepted === true && codes.includes('ukus');
  if (hasTransPair && !renderedClasses.includes('dl-trans') && !inUkusAccepted) problems.push('高亮缺dl-trans');

  const pass = problems.length === 0;
  if (pass) passCount++;
  rows.push({ name: c.name, input: c.input, answer: c.answer,
    accepted: res.accepted, kinds: codes.join('/'), reason: res.reasonCn,
    hl: res.highlightHtml, pass, problems });
}

// ============ 输出表格 ============
console.log('| # | 案例 | 所填 | 答案 | accepted | 类别 | reasonCn | 结果 |');
console.log('|---|------|------|------|----------|------|-----------|------|');
rows.forEach((r, i) => {
  console.log(`| ${i + 1} | ${r.name} | ${r.input} | ${r.answer} | ${r.accepted} | ${r.kinds} | ${r.reason} | ${r.pass ? 'PASS' : '**FAIL**'} |`);
});
console.log('\n--- 失败案例明细 ---');
rows.filter(r => !r.pass).forEach(r => {
  console.log(`[${r.name}] input=${r.input} answer=${r.answer}`);
  console.log(`  problems: ${r.problems.join(' ; ')}`);
  console.log(`  highlight: ${r.hl}`);
});
console.log(`\n通过 ${passCount} / ${rows.length}`);
process.exit(passCount === rows.length ? 0 : 2);
