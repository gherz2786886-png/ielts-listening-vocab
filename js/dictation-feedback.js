/* Word-aware display layer. Acceptance remains exclusively in Dictation.check. */
(function (global) {
  'use strict';
  var pending = {}, nextId = 0, loading = false, unavailable = false;
  var source = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '';
  function loadLexicon() {
    if (global.FEEDBACK_LEXICON || loading || typeof document === 'undefined') return;
    loading = true;
    var script = document.createElement('script');
    script.src = source ? new URL('../data/feedback-lexicon.js?v=20261023-word-feedback-1', source).href :
      'data/feedback-lexicon.js?v=20261023-word-feedback-1';
    script.onload = function () {
      Object.keys(pending).forEach(function (id) {
        var element = document.querySelector('[data-feedback-id="' + id + '"]');
        var args = pending[id];
        if (element) element.outerHTML = render(args.input, args.answer, args.result, args.context);
      });
      pending = {};
    };
    // A missing pronunciation index must leave the ordinary correction usable.
    script.onerror = function () { unavailable = true; pending = {}; };
    document.head.appendChild(script);
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function tokens(value) {
    var values = [], pattern = /\S+/g, match;
    while ((match = pattern.exec(value))) values.push({ text: match[0], start: match.index, end: pattern.lastIndex });
    return values;
  }
  function normalized(value) { return value.toLowerCase().replace(/[.,!?;:]$/, ''); }
  function distance(a, b) {
    var row = [], next, i, j;
    for (j = 0; j <= b.length; j++) row[j] = j;
    for (i = 1; i <= a.length; i++) {
      next = [i];
      for (j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row = next;
    }
    return row[b.length];
  }
  function soundHint(input, answer) {
    var entries = (global.FEEDBACK_LEXICON || {}).entries || {};
    var a = entries[normalized(input)], b = entries[normalized(answer)];
    if (!Array.isArray(a) || !Array.isArray(b)) return null;
    var best = 1;
    a.forEach(function (left) { b.forEach(function (right) {
      var x = left.split(' '), y = right.split(' ');
      if (Math.min(x.length, y.length) >= 3) best = Math.min(best, distance(x, y) / Math.max(x.length, y.length));
    }); });
    return { knownWords: true, similar: best <= 0.5 };
  }
  function wordPairs(answer, input) {
    var n = answer.length, m = input.length, rows = [], i, j;
    for (i = 0; i <= n; i++) { rows[i] = [i]; for (j = 1; j <= m; j++) rows[i][j] = i ? 0 : j; }
    for (i = 1; i <= n; i++) for (j = 1; j <= m; j++) rows[i][j] = Math.min(
      rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] +
      (normalized(answer[i - 1].text) === normalized(input[j - 1].text) ? 0 : 1));
    var pairs = []; i = n; j = m;
    while (i || j) {
      if (i && j && rows[i][j] === rows[i - 1][j - 1] +
          (normalized(answer[i - 1].text) === normalized(input[j - 1].text) ? 0 : 1)) {
        pairs.push({ a: --i, g: --j });
      } else if (j && rows[i][j] === rows[i][j - 1] + 1) pairs.push({ a: null, g: --j });
      else pairs.push({ a: --i, g: null, nextG: j });
    }
    return pairs.reverse();
  }
  function red(text, extra) { return '<span class="feedback-error' + (extra ? ' feedback-extra' : '') + '">' + esc(text) + '</span>'; }
  function missing(text) { return '<span class="feedback-missing" role="img" aria-label="漏写 ' + esc(text) +
    '" title="此处漏写 ' + esc(text) + '">⌃</span>'; }
  function letterMarkup(input, pairs) {
    var cursor = 0;
    return pairs.map(function (pair) {
      if (!pair.g) return missing(pair.a);
      var original = input.slice(cursor, cursor + pair.g.length); cursor += pair.g.length;
      return pair.op === 'equal' || pair.op === 'case' ? esc(original) : red(original, pair.op === 'ins');
    }).join('');
  }
  function build(input, answer, result, context) {
    input = String(input == null ? '' : input); answer = String(answer == null ? '' : answer);
    result = result || global.Dictation.check(input, answer); context = context || {};
    if (result.accepted) return { summary: result.reasonCn, inputHtml: esc(input), answerHtml: esc(answer),
      comparisons: [], details: [], level: 'accepted' };
    var given = tokens(input), expected = tokens(answer), rendered = {}, omissions = {}, details = [], comparisons = [];
    var level = 'letters', hasWordDifference = false;
    // Type mismatches are complete answers, never arbitrary letter edits across a date/number.
    if (/\d/.test(input) !== /\d/.test(answer)) {
      return { summary: /日期/.test(context.kind || '') ? '答案类型不符：此项应填写日期。' :
        /号码|编码|数值|金额|时间|百分比/.test(context.kind || '') ? '答案类型不符：请填写对应的数字或编码。' : '答案内容不符，请对照原答案复听。',
        inputHtml: red(input), answerHtml: red(answer), comparisons: [], details: [], level: 'answer' };
    }
    wordPairs(expected, given).forEach(function (pair) {
      var left = pair.a === null ? null : expected[pair.a], right = pair.g === null ? null : given[pair.g];
      if (!left) { rendered[pair.g] = red(right.text, true); hasWordDifference = true; return; }
      if (!right) {
        // Anchor an omission before the next submitted token, without changing the original text.
        var anchor = pair.nextG;
        omissions[anchor] = (omissions[anchor] || '') + missing(left.text); hasWordDifference = true; return;
      }
      if (normalized(left.text) === normalized(right.text)) { rendered[pair.g] = esc(right.text); return; }
      var local = global.Dictation.check(right.text, left.text);
      var edits = local.pairs.reduce(function (total, p) {
        return total + (p.op === 'equal' || p.op === 'case' ? 0 : p.op === 'trans' ? 0.5 : 1);
      }, 0);
      var size = Math.max(left.text.length, right.text.length);
      var small = edits <= 2 && (edits / size <= 0.4 || (size < 5 && edits === 1)) && /^[a-z]+$/i.test(left.text + right.text);
      if (small) {
        rendered[pair.g] = letterMarkup(right.text, local.pairs);
        details.push(right.text + ' → ' + left.text + '：' + local.reasonCn);
      } else { rendered[pair.g] = red(right.text); hasWordDifference = true; }
      if (/^[a-z]+$/i.test(left.text) && /^[a-z]+$/i.test(right.text)) {
        var hint = soundHint(right.text, left.text);
        if (hint) comparisons.push({ input: right.text, answer: left.text, nearSound: hint.similar });
      }
    });
    var cursor = 0, inputHtml = '';
    given.forEach(function (token, index) {
      inputHtml += esc(input.slice(cursor, token.start)) + (omissions[index] || '') + rendered[index]; cursor = token.end;
    });
    inputHtml += esc(input.slice(cursor)) + (omissions[given.length] || '');
    var nearSound = comparisons.some(function (pair) { return pair.nearSound; });
    if (hasWordDifference) level = 'words';
    return { summary: nearSound ? '可能近音混淆：请分别听你写的词和正确词。' : hasWordDifference ?
      '词语或内容不符：红色标出了不同的部分。' : '拼写有误：红色标出错写、多写或漏写的位置。',
      inputHtml: inputHtml, answerHtml: esc(answer), comparisons: comparisons.slice(0, 3), details: details, level: level };
  }
  function render(input, answer, result, context) {
    var feedback = build(input, answer, result, context);
    var id = String(++nextId);
    if (!global.FEEDBACK_LEXICON && !unavailable && feedback.level !== 'answer' && feedback.level !== 'accepted') {
      pending[id] = { input: input, answer: answer, result: result, context: context };
      loadLexicon();
    }
    return '<div class="dictation-feedback" data-feedback-id="' + id + '" data-feedback-level="' + feedback.level + '">' +
      '<p class="feedback-summary">' + esc(feedback.summary) + '</p>' +
      '<div class="feedback-label">你的答案</div><div class="feedback-input highlight-line">' + feedback.inputHtml + '</div>' +
      '<div class="feedback-label">正确答案</div><div class="feedback-answer">' + feedback.answerHtml + '</div>' +
      (feedback.details.length ? '<p class="feedback-detail">' + feedback.details.map(esc).join('；') + '</p>' : '') +
      feedback.comparisons.map(function (pair) {
        return '<div class="feedback-compare"><button class="btn btn-sm" type="button" data-feedback-play="' + esc(pair.input) +
          '">听你写的词：' + esc(pair.input) + '</button><button class="btn btn-sm" type="button" data-feedback-play="' + esc(pair.answer) +
          '">听正确词：' + esc(pair.answer) + '</button></div>';
      }).join('') + (feedback.comparisons.some(function (pair) { return pair.nearSound; }) ?
        '<p class="feedback-detail">读音相近提示参考美音词典；仅凭文字不能确定是听错还是拼写错误。</p>' : '') + '</div>';
  }
  global.DictationFeedback = { build: build, render: render };
})(typeof window !== 'undefined' ? window : globalThis);
