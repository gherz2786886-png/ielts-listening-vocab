/*
 * dictation.js — 雅思听写「AI 批改」引擎（本地确定性，零依赖）
 * 纯经典脚本，挂载全局 window.Dictation。
 * 算法：Damerau–Levenshtein 编辑距离 + 回溯对齐 + 有限规则表
 *      （双写 / 英美变体 / 后缀混淆 / 不发音字母 / 大小写空格格式宽容）。
 * 严禁任何外部 API / import / 构建工具。
 */
(function (global) {
  'use strict';

  /* ============ 基础工具 ============ */

  // 大小写折叠 + trim + 空白折叠
  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  var CONSONANTS = 'bcdfghjklmnpqrstvwxyz';
  function isConsonant(ch) {
    return ch.length === 1 && CONSONANTS.indexOf(ch.toLowerCase()) >= 0;
  }

  /* ============ 英美变体规则表（可读数组，便于扩充） ============
   * 每条：{a: 词尾形态A, b: 词尾形态B, ruleCn: 中文说明}
   * 命中方向自动双向检测（输入=英式/答案=美式，或反之）。
   */
  var UK_US_RULES = [
    { a: 'our',   b: 'or',   ruleCn: '英式 -our 对应美式 -or（如 colour/color、neighbour/neighbor）' },
    { a: 're',    b: 'er',   ruleCn: '英式 -re 对应美式 -er（如 centre/center、theatre/theater）' },
    { a: 'ise',   b: 'ize',  ruleCn: '英式 -ise 对应美式 -ize（如 organise/organize、realise/realize）' },
    { a: 'lled',  b: 'led',  ruleCn: '英式双写 l 过去式对应美式单写 l（如 cancelled/canceled）' },
    { a: 'lling', b: 'ling', ruleCn: '英式双写 l 现在分词对应美式单写 l（如 travelling/traveling）' },
    { a: 'ller',  b: 'ler',  ruleCn: '英式双写 l 施动者对应美式单写 l（如 traveller/traveler）' },
    { a: 'nce',   b: 'nse',  ruleCn: '英式名词 -nce 对应美式 -nse（如 licence/license、defence/defense）' },
    { a: 'que',   b: 'ck',   ruleCn: '英式 -que 对应美式 -ck（如 cheque/check）' },
    { a: 'mme',   b: 'm',    ruleCn: '英式 -mme 对应美式 -m（如 programme/program）' },
    { a: 'ogue',  b: 'og',   ruleCn: '英式 -ogue 对应美式 -og（如 catalogue/catalog）' },
    { a: 'grey',  b: 'gray',  ruleCn: '英式 grey 对应美式 gray' }
  ];

  // 公共接口：判断 a、b（任意字符串，内部会归一化）是否英美变体
  function isUkUsVariant(rawA, rawB) {
    var a = normalize(rawA);
    var b = normalize(rawB);
    if (a === b) return { match: false, ruleCn: '' };
    for (var i = 0; i < UK_US_RULES.length; i++) {
      var r = UK_US_RULES[i];
      if (a.length > r.a.length && b.length > r.b.length) {
        if (a.slice(-r.a.length) === r.a && b.slice(-r.b.length) === r.b &&
            a.slice(0, a.length - r.a.length) === b.slice(0, b.length - r.b.length)) {
          return { match: true, ruleCn: r.ruleCn };
        }
        if (a.slice(-r.b.length) === r.b && b.slice(-r.a.length) === r.a &&
            a.slice(0, a.length - r.b.length) === b.slice(0, b.length - r.a.length)) {
          return { match: true, ruleCn: r.ruleCn };
        }
      }
    }
    return { match: false, ruleCn: '' };
  }

  /* ============ 后缀混淆表（判错，不算英美变体） ============ */
  var SUFFIX_CONFUSIONS = [
    ['or', 'er'], ['er', 'or'],
    ['ar', 'er'], ['er', 'ar'],
    ['able', 'ible'], ['ible', 'able'],
    ['ary', 'ery'], ['ery', 'ary'],
    ['ance', 'ence'], ['ence', 'ance']
  ];

  var KIND_LABELS = {
    sub: '错写字母', del: '漏写字母', ins: '多写字母', trans: '字母顺序颠倒',
    double: '双写错误', suffix: '后缀混淆', ukus: '英式/美式差异',
    silent: '不发音字母', case: '大小写', space: '空格', punct: '连字符'
  };

  /* ============ Damerau–Levenshtein 对齐 ============
   * A：期望（答案），G：所填（输入），均为小写字符串。
   * 返回正向 pairs：{a, g, op, ai?, gi?, ukus?}
   * 回溯优先级：equal > trans > del > ins > sub（尽量识别相邻换位）。
   */
  function align(A, G) {
    var n = A.length, m = G.length;
    var d = [];
    var i, j;
    for (i = 0; i <= n; i++) d.push(new Array(m + 1).fill(0));
    for (i = 0; i <= n; i++) d[i][0] = i;
    for (j = 0; j <= m; j++) d[0][j] = j;
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        var cost = A[i - 1] === G[j - 1] ? 0 : 1;
        var best = d[i - 1][j - 1] + cost;
        if (d[i - 1][j] + 1 < best) best = d[i - 1][j] + 1;
        if (d[i][j - 1] + 1 < best) best = d[i][j - 1] + 1;
        if (i > 1 && j > 1 && A[i - 1] === G[j - 2] && A[i - 2] === G[j - 1]) {
          if (d[i - 2][j - 2] + 1 < best) best = d[i - 2][j - 2] + 1;
        }
        d[i][j] = best;
      }
    }
    var pairs = [];
    i = n; j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && A[i - 1] === G[j - 1] && d[i][j] === d[i - 1][j - 1]) {
        pairs.push({ a: A[i - 1], g: G[j - 1], op: 'equal', ai: i - 1, gi: j - 1 });
        i--; j--;
      } else if (i > 1 && j > 1 && A[i - 1] === G[j - 2] && A[i - 2] === G[j - 1] &&
                 d[i][j] === d[i - 2][j - 2] + 1) {
        // 回溯整体会 reverse，故先 push 后一个对，保证正向顺序：
        // 第一对 (期望A[i-2], 实际G[j-2])，第二对 (期望A[i-1], 实际G[j-1])
        pairs.push({ a: A[i - 1], g: G[j - 1], op: 'trans', ai: i - 1, gi: j - 1 });
        pairs.push({ a: A[i - 2], g: G[j - 2], op: 'trans', ai: i - 2, gi: j - 2 });
        i -= 2; j -= 2;
      } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
        pairs.push({ a: A[i - 1], g: '', op: 'del', ai: i - 1 });
        i--;
      } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
        pairs.push({ a: '', g: G[j - 1], op: 'ins', gi: j - 1 });
        j--;
      } else {
        pairs.push({ a: A[i - 1], g: G[j - 1], op: 'sub', ai: i - 1, gi: j - 1 });
        i--; j--;
      }
    }
    pairs.reverse();
    return pairs;
  }

  /* ============ 格式路径（仅大小写/空格/连字符差异） ============
   * TI/TA：已 trim 的原始输入/答案；两侧 loose-norm 后完全一致。
   */
  function formatPairs(TI, TA) {
    var pairs = [];
    var i = 0, j = 0;
    function isWs(c) { return c === ' ' || c === '-' || c === '\t'; }
    while (i < TI.length || j < TA.length) {
      var iw = '', jw = '';
      while (i < TI.length && isWs(TI[i])) { iw += TI[i]; i++; }
      while (j < TA.length && isWs(TA[j])) { jw += TA[j]; j++; }
      if (iw.length || jw.length) {
        if (iw !== jw) {
          if (iw.indexOf('-') >= 0 || jw.indexOf('-') >= 0) {
            pairs.push({ a: jw.charAt(0) || '-', g: iw.charAt(0) || ' ', op: 'punct' });
          } else {
            pairs.push({ a: jw, g: iw, op: 'space' });
          }
        }
      }
      var k = 0;
      while (i < TI.length && !isWs(TI[i]) && j < TA.length && !isWs(TA[j])) {
        if (TI[i] === TA[j]) pairs.push({ a: TA[j], g: TI[i], op: 'equal' });
        else pairs.push({ a: TA[j], g: TI[i], op: 'case' });
        i++; j++; k++;
      }
    }
    return pairs;
  }

  /* ============ 规则二次识别 ============ */

  // 双写识别（仅辅音）：del 且相邻 equal 同字母 → 应双写；ins 且相邻 equal 同字母 → 多写
  function detectDoubles(pairs) {
    var reasons = [];
    var flags = {}; // pair index -> true
    for (var k = 0; k < pairs.length; k++) {
      var p = pairs[k];
      if (p.op === 'del' && isConsonant(p.a)) {
        var prevEq = k > 0 && pairs[k - 1].op === 'equal' && pairs[k - 1].g === p.a;
        var nextEq = k + 1 < pairs.length && pairs[k + 1].op === 'equal' && pairs[k + 1].a === p.a;
        if (prevEq || nextEq) {
          flags[k] = true;
          reasons.push('双写错误：字母 ' + p.a + ' 应双写');
        }
      } else if (p.op === 'ins' && isConsonant(p.g)) {
        var prevEqI = k > 0 && pairs[k - 1].op === 'equal' && pairs[k - 1].g === p.g;
        var nextEqI = k + 1 < pairs.length && pairs[k + 1].op === 'equal' && pairs[k + 1].a === p.g;
        if (prevEqI || nextEqI) {
          flags[k] = true;
          reasons.push('双写错误：多写了一个 ' + p.g);
        }
      }
    }
    return { flags: flags, reasons: reasons };
  }

  // 后缀混淆：从第一个非 equal/case 对起取词尾片段，命中混淆表
  // 返回 {reason, regionStart}（regionStart 起的非 equal 对不再重复给通用原因）或 null
  function detectSuffix(pairs) {
    var k0 = -1;
    for (var k = 0; k < pairs.length; k++) {
      if (pairs[k].op !== 'equal' && pairs[k].op !== 'case') { k0 = k; break; }
    }
    if (k0 < 0) return null;
    // 错误区域必须集中在词尾：其后只剩 equal/case
    for (var t = k0 + 1; t < pairs.length; t++) {
      if (pairs[t].op !== 'equal' && pairs[t].op !== 'case') return null;
    }
    var aTail = '', gTail = '';
    for (var x = k0; x < pairs.length; x++) {
      if (pairs[x].a) aTail += pairs[x].a;
      if (pairs[x].g) gTail += pairs[x].g;
    }
    if (aTail.length > 6) return null;
    for (var c = 0; c < SUFFIX_CONFUSIONS.length; c++) {
      var x = SUFFIX_CONFUSIONS[c][0], y = SUFFIX_CONFUSIONS[c][1];
      if (aTail === x && gTail === y) {
        return { reason: '后缀混淆：-' + x + ' 与 -' + y, regionStart: k0 };
      }
    }
    return null;
  }

  // 不发音字母（有限规则），返回 {reason, pairIndex} 或 null
  function detectSilent(pairs, LA) {
    var first = pairs[0];
    if (first && first.op === 'del') {
      if (LA.indexOf('kn') === 0 && first.a === 'k') return { reason: '漏写了不发音字母 k（kn- 开头的 k 不发音）', index: 0 };
      if (LA.indexOf('wr') === 0 && first.a === 'w') return { reason: '漏写了不发音字母 w（wr- 开头的 w 不发音）', index: 0 };
      if (LA.indexOf('gn') === 0 && first.a === 'g') return { reason: '漏写了不发音字母 g（gn- 开头的 g 不发音）', index: 0 };
    }
    var last = pairs.length - 1;
    if (last >= 0 && (pairs[last].op === 'del' || pairs[last].op === 'sub')) {
      if (LA.lastIndexOf('mb') === LA.length - 2 && pairs[last].a === 'b')
        return { reason: '漏写了不发音字母 b（词尾 -mb 的 b 不发音）', index: last };
      if (LA.lastIndexOf('mn') === LA.length - 2 && pairs[last].a === 'n')
        return { reason: '漏写了不发音字母 n（词尾 -mn 的 n 不发音）', index: last };
    }
    return null;
  }

  // 英美变体区域标记：找公共前缀/后缀，落在区域内的 pair 打 ukus 标记
  function markUkusRegion(pairs, LA, LI) {
    var p = 0;
    while (p < LA.length && p < LI.length && LA[p] === LI[p]) p++;
    var s = 0;
    while (s < LA.length - p && s < LI.length - p &&
           LA[LA.length - 1 - s] === LI[LI.length - 1 - s]) s++;
    for (var k = 0; k < pairs.length; k++) {
      var pair = pairs[k];
      if (pair.ai !== undefined && pair.ai >= p && pair.ai < LA.length - s) pair.ukus = true;
      else if (pair.gi !== undefined && pair.gi >= p && pair.gi < LI.length - s) pair.ukus = true;
    }
  }

  /* ============ 渲染高亮 HTML（基于 pairs，可表达漏写占位符） ============ */
  function renderHighlight(pairs) {
    var html = '';
    for (var k = 0; k < pairs.length; k++) {
      var p = pairs[k];
      switch (p.op) {
        case 'equal':
          html += escapeHtml(p.g);
          break;
        case 'case':
          html += '<span class="dl-case">' + escapeHtml(p.g) + '</span>';
          break;
        case 'space':
          html += '<span class="dl-space">' + (p.g ? escapeHtml(p.g) : '<u>&nbsp;</u>') + '</span>';
          break;
        case 'punct':
          html += '<span class="dl-punct">' + escapeHtml(p.g || ' ') + '</span>';
          break;
        case 'del':
          html += '<span class="' + (p.ukus ? 'dl-ukus' : 'dl-del') + '"><u>' + escapeHtml(p.a) + '</u></span>';
          break;
        case 'ins':
          html += '<span class="' + (p.ukus ? 'dl-ukus' : 'dl-ins') + '">' + escapeHtml(p.g) + '</span>';
          break;
        case 'sub':
          html += '<span class="' + (p.ukus ? 'dl-ukus' : 'dl-sub') + '">' + escapeHtml(p.g) + '</span>';
          break;
        case 'trans':
          html += '<span class="' + (p.ukus ? 'dl-ukus' : 'dl-trans') + '">' + escapeHtml(p.g) + '</span>';
          break;
        default:
          html += escapeHtml(p.g || p.a || '');
      }
    }
    return html;
  }

  /* ============ 主入口：check(input, answer) ============ */
  function check(input, answer) {
    var rawIn = String(input == null ? '' : input);
    var rawAns = String(answer == null ? '' : answer);
    var TI = rawIn.trim();   // 输入 trim 后
    var TA = rawAns.trim();  // 答案 trim 后

    var nIn = normalize(TI);
    var nAns = normalize(TA);

    var result = {
      accepted: false,
      exact: false,
      pairs: [],
      errorKinds: [],
      reasonCn: '',
      highlightHtml: ''
    };

    // 收集错误类别（去重保序）
    var kindSet = [];
    function addKind(code) {
      if (KIND_LABELS[code] && kindSet.indexOf(code) < 0) kindSet.push(code);
    }

    // ---- 1) loose-norm：小写 + 连字符→空格 + 空白折叠后一致 → 格式差异，判对 ----
    function loose(s) {
      return s.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    var lIn = loose(TI), lAns = loose(TA);

    if (lIn === lAns) {
      result.pairs = formatPairs(TI, TA);
      result.exact = (TI === TA);
      result.accepted = true;
      var hasCase = false, hasSpacePunct = false;
      for (var i = 0; i < result.pairs.length; i++) {
        var op = result.pairs[i].op;
        if (op === 'case') hasCase = true;
        if (op === 'space' || op === 'punct') hasSpacePunct = true;
        if (op !== 'equal') addKind(op);
      }
      if (result.exact) {
        result.reasonCn = '拼写正确';
      } else {
        result.reasonCn = '大小写/空格/连字符问题，已按正确处理';
      }
      result.highlightHtml = renderHighlight(result.pairs);
      result.errorKinds = kindSet.map(function (c) { return { code: c, labelCn: KIND_LABELS[c] }; });
      return result;
    }

    // ---- 2) 短语容错：去掉所有空格后一致 → 漏/多空格，判对 ----
    var cIn = lIn.replace(/ /g, ''), cAns = lAns.replace(/ /g, '');
    if (cIn === cAns && cIn.length > 0) {
      // 空格应插入位置 = 答案（loose）中第一个空格的下标
      var sp = lAns.indexOf(' ');
      if (sp < 0) sp = lIn.indexOf(' ');
      result.pairs = [];
      for (var q = 0; q < cAns.length; q++) {
        if (q === sp) result.pairs.push({ a: ' ', g: '', op: 'space' });
        result.pairs.push({ a: cAns[q], g: cIn[q], op: 'equal' });
      }
      result.accepted = true;
      result.exact = false;
      addKind('space');
      result.reasonCn = '短语空格差异（漏/多了空格），已按正确处理';
      result.highlightHtml = renderHighlight(result.pairs);
      result.errorKinds = kindSet.map(function (c) { return { code: c, labelCn: KIND_LABELS[c] }; });
      return result;
    }

    // ---- 3) 英美变体：先于普通对齐判定，判对但给提示 ----
    var uv = isUkUsVariant(TI, TA);
    if (uv.match) {
      result.pairs = align(nAns, nIn);
      markUkusRegion(result.pairs, nAns, nIn);
      // 规则命中时前缀完全一致，所有非 equal/case 对必然落在差异区域内
      for (var uk = 0; uk < result.pairs.length; uk++) {
        if (result.pairs[uk].op !== 'equal' && result.pairs[uk].op !== 'case') {
          result.pairs[uk].ukus = true;
        }
      }
      result.accepted = true;
      result.exact = false;
      addKind('ukus');
      result.reasonCn = uv.ruleCn + '，两种拼写都算对';
      result.highlightHtml = renderHighlight(result.pairs);
      result.errorKinds = kindSet.map(function (c) { return { code: c, labelCn: KIND_LABELS[c] }; });
      return result;
    }

    // ---- 4) 普通对齐（判错路径） ----
    result.pairs = align(nAns, nIn);
    result.exact = (TI === TA);
    result.accepted = false;

    // equal 对按原始字符细分 case
    for (var e = 0; e < result.pairs.length; e++) {
      var pr = result.pairs[e];
      if (pr.op === 'equal' && pr.ai !== undefined && pr.gi !== undefined) {
        if (TA[pr.ai] !== TI[pr.gi]) pr.op = 'case';
      }
    }

    var doubles = detectDoubles(result.pairs);
    var suffixRes = detectSuffix(result.pairs);
    var silentRes = detectSilent(result.pairs, nAns);

    // 组装中文原因（按 pairs 顺序）
    var reasons = [];
    var k;
    for (k = 0; k < result.pairs.length; k++) {
      var p = result.pairs[k];
      addKind(p.op);
      if (p.op === 'trans') {
        var p2 = result.pairs[k + 1];
        if (p2 && p2.op === 'trans') {
          reasons.push('相邻字母 ' + p.a + '、' + p2.a + ' 顺序颠倒');
          k++; // 跳过成对的第二对
        }
        continue;
      }
      if (doubles.flags[k]) continue; // 双写原因统一在下面追加
      if (suffixRes && k >= suffixRes.regionStart && p.op !== 'equal' && p.op !== 'case') continue;
      if (silentRes && k === silentRes.index) continue;
      if (p.op === 'del') reasons.push('漏写了字母 ' + p.a);
      else if (p.op === 'ins') reasons.push('多写了字母 ' + p.g);
      else if (p.op === 'sub') reasons.push('把 ' + p.a + ' 写成了 ' + p.g);
      else if (p.op === 'case') reasons.push('大小写不规范：' + p.g + ' 应为 ' + p.a);
    }
    for (k = 0; k < doubles.reasons.length; k++) reasons.push(doubles.reasons[k]);
    if (suffixRes) reasons.push(suffixRes.reason);
    if (silentRes) reasons.push(silentRes.reason);

    // 双写/后缀/不发音类别登记
    if (doubles.reasons.length) addKind('double');
    if (suffixRes) addKind('suffix');
    if (silentRes) addKind('silent');

    // 去重保序
    var seen = {};
    var uniq = [];
    for (k = 0; k < reasons.length; k++) {
      if (!seen[reasons[k]]) { seen[reasons[k]] = true; uniq.push(reasons[k]); }
    }
    result.reasonCn = uniq.join('；');
    result.highlightHtml = renderHighlight(result.pairs);
    result.errorKinds = kindSet.map(function (c) { return { code: c, labelCn: KIND_LABELS[c] }; });
    return result;
  }

  /* ============ 导出 ============ */
  var Dictation = {
    check: check,
    normalize: normalize,
    isUkUsVariant: isUkUsVariant,
    UK_US_RULES: UK_US_RULES,
    SUFFIX_CONFUSIONS: SUFFIX_CONFUSIONS
  };

  global.Dictation = Dictation;
})(typeof window !== 'undefined' ? window : globalThis);
