/* ============================================================
 * app.js — 雅思听力场景词汇 单页应用
 * 视图：#/learn 学习模式 · #/dictation 听写模式 · #/wrong 错词本
 * 依赖：window.VOCAB / window.VocabAudio / window.Dictation
 * 无框架、无 fetch（file:// 双击可运行）；状态持久化 localStorage
 * ============================================================ */
(function () {
  'use strict';

  var VOCAB = window.VOCAB;
  var appEl = document.getElementById('app');
  var storageReadFailures = {};

  function notify(message, storageError) {
    var notice = document.getElementById('appNotice');
    if (!notice || (notice.dataset.storageError && !storageError)) return;
    notice.textContent = message;
    notice.hidden = !message;
    if (storageError) notice.dataset.storageError = 'true';
  }

  function fatal(msg) {
    appEl.innerHTML = '<div class="empty-state"><div class="big">页面数据未就绪</div><p>' +
      msg + '</p></div>';
  }
  if (!VOCAB || !VOCAB.words || !VOCAB.words.length) {
    fatal('data/vocab.js 未正确加载，请检查文件是否与 index.html 同目录。');
    return;
  }

  /* ---------------- 工具 ---------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      throw new Error('Invalid saved data');
    } catch (e) {
      storageReadFailures[key] = true;
      notify('学习记录暂时无法读取。请保留当前浏览器数据，检查浏览器的存储权限。', true);
      return fallback;
    }
  }

  function saveJSON(key, val) {
    if (storageReadFailures[key]) {
      notify('原有学习记录无法读取，本次未覆盖原数据。请先保留浏览器数据，再检查存储权限或记录文件。', true);
      return;
    }
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { notify('本次学习记录未能保存，刷新或关闭页面可能丢失。请检查浏览器存储空间和权限。', true); }
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------- 持久化存储 ---------------- */

  var LS = {
    LEARNED: 'ieltsVocab.learned',
    WRONG: 'ieltsVocab.wrong',
    MASTERED: 'ieltsVocab.mastered',
    SETTINGS: 'ieltsVocab.settings'
  };

  var store = {
    learned: loadJSON(LS.LEARNED, {}),     // {wordId: 1}
    wrong: loadJSON(LS.WRONG, {}),         // {headword: {…}}
    mastered: loadJSON(LS.MASTERED, {}),   // {headword: 1}
    settings: loadJSON(LS.SETTINGS, {})     // {scenarioId, page, range, order, accent, singlePage}
  };

  function persistLearn() { saveJSON(LS.LEARNED, store.learned); }
  function persistWrong() { saveJSON(LS.WRONG, store.wrong); }
  function persistMastered() { saveJSON(LS.MASTERED, store.mastered); }
  function persistSettings() { saveJSON(LS.SETTINGS, store.settings); }

  /* ---------------- 错因标签（固定顺序：意思 → 拼写 → 听错） ---------------- */

  var REASON_ORDER = ['meaning', 'spelling', 'listening'];
  var REASON_LABELS = { meaning: '意思', spelling: '拼写', listening: '听错' };

  // 旧数据幂等迁移：历史错词条无 reasonTags 时默认归为「拼写」
  // （仅内存中迁移，首次变更时随 persist 写回；绝不清空已有 wrong/mastered 记录）
  Object.keys(store.wrong).forEach(function (k) {
    var e = store.wrong[k];
    if (e && (!e.reasonTags || !e.reasonTags.length)) e.reasonTags = ['spelling'];
  });

  // 按固定顺序整理标签数组
  function orderedTags(tags) {
    var set = {};
    (tags || []).forEach(function (t) { set[t] = true; });
    return REASON_ORDER.filter(function (t) { return set[t]; });
  }

  function reasonTagsOf(e) {
    var t = orderedTags(e && e.reasonTags);
    return t.length ? t : ['spelling'];
  }

  function tagLabel(tags) {
    return tags.map(function (t) { return REASON_LABELS[t] || t; }).join(' / ');
  }

  /* ---------------- 全局状态 ---------------- */

  var state = {
    route: 'learn',
    scenarioId: store.settings.scenarioId || VOCAB.scenarios[0].id,
    page: store.settings.page || VOCAB.scenarios[0].startPage,
    query: '',
    dSetup: {
      range: store.settings.range || 'scenario', // scenario|page|all|wrong
      singlePage: store.settings.singlePage || 6,
      order: store.settings.order || 'sequence',
      accent: store.settings.accent || 'uk'
    },
    dSession: null, // {queue, index, correct, exact, wrongNew, answered}
    wPop: null,     // 学习页错因面板：{wordId, draft:[]}，同时只开一个
    wrongReasonFilter: 'all', // 错词本错因筛选：all|meaning|spelling|listening
    wrongFilter: 'all',       // 错词本场景筛选
    showMastered: false,      // 错词本是否展开已掌握区
    quizTimer: null
  };

  function persistViewSettings() {
    store.settings.scenarioId = state.scenarioId;
    store.settings.page = state.page;
    store.settings.range = state.dSetup.range;
    store.settings.singlePage = state.dSetup.singlePage;
    store.settings.order = state.dSetup.order;
    store.settings.accent = state.dSetup.accent;
    persistSettings();
  }

  function scenarioById(id) {
    for (var i = 0; i < VOCAB.scenarios.length; i++) {
      if (VOCAB.scenarios[i].id === id) return VOCAB.scenarios[i];
    }
    return VOCAB.scenarios[0];
  }

  function wordsByScenario(id) {
    return VOCAB.words.filter(function (w) { return w.scenarioId === id; });
  }

  function wordsByPage(p) {
    return VOCAB.words.filter(function (w) { return w.page === p; });
  }

  function findWordById(id) {
    for (var i = 0; i < VOCAB.words.length; i++) {
      if (VOCAB.words[i].id === id) return VOCAB.words[i];
    }
    return null;
  }

  /* ---------------- 发音按钮 ---------------- */

  function speak(text, accent) {
    if (!window.VocabAudio) return;
    var cur = VocabAudio.current;
    if (cur && cur.text === text && cur.accent === accent) {
      VocabAudio.stop();
      return;
    }
    VocabAudio.play(text, accent).catch(function () {});
  }

  function refreshSpeakButtons() {
    var cur = VocabAudio ? VocabAudio.current : null;
    var btns = appEl.querySelectorAll('[data-speak]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var on = cur && cur.playing &&
        b.getAttribute('data-speak') === cur.text &&
        b.getAttribute('data-accent') === cur.accent;
      b.classList.toggle('playing', !!on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  if (document.addEventListener) {
    document.addEventListener('vocab-audio-state', refreshSpeakButtons);
    document.addEventListener('vocab-audio-fallback', function () {
      notify('在线发音暂不可用，已切换为浏览器语音；实际口音和离线可用性取决于已安装的语音。');
    });
    document.addEventListener('vocab-audio-error', function () {
      notify('暂时无法播放发音，请再次点击重听，或检查浏览器的声音设置。');
    });
  }

  /* ---------------- 错词本写入 ---------------- */

  function addWrong(target, word, reasonCn) {
    var key = target;
    var prev = store.wrong[key] || {
      headword: target, count: 0
    };
    prev.count = (prev.count || 0) + 1;
    prev.wordId = word.id || prev.wordId || null;
    prev.display = word.display || target;
    prev.meaning = word.meaning || '';
    prev.page = word.page || prev.page || null;
    prev.scenarioId = word.scenarioId || prev.scenarioId || '';
    prev.scenario = word.scenario || prev.scenario || '';
    prev.lastReason = reasonCn || '';
    prev.updatedAt = Date.now();
    // 听写自动收录：与 ['spelling'] 取并集，手动标记的其他标签不被覆盖
    prev.reasonTags = orderedTags((prev.reasonTags || []).concat(['spelling']));
    store.wrong[key] = prev;
    if (store.mastered[key]) delete store.mastered[key];
    persistWrong();
    persistMastered();
    updateBadge();
  }

  /** 学习页手动标记：key 取第一个 headword；已存在则补 manual=true，标签整体替换 */
  function manualMarkWrong(word, tags) {
    var key = (word.headwords && word.headwords[0]) || word.display;
    var e = store.wrong[key] || { headword: key, count: 0 };
    e.count = e.count || 0;
    e.manual = true;
    e.wordId = word.id || e.wordId || null;
    e.display = word.display || e.display || key;
    e.meaning = word.meaning || e.meaning || '';
    e.page = word.page || e.page || null;
    e.scenarioId = word.scenarioId || e.scenarioId || '';
    e.scenario = word.scenario || e.scenario || '';
    e.reasonTags = orderedTags(tags);
    e.updatedAt = Date.now();
    store.wrong[key] = e;
    if (store.mastered[key]) delete store.mastered[key];
    persistWrong();
    persistMastered();
    updateBadge();
  }

  /** 删除某词关联的活跃错词条目（按 wordId 匹配，否则按 headword 是否在 headwords 中） */
  function removeWrongForWord(word) {
    Object.keys(store.wrong).forEach(function (k) {
      var e = store.wrong[k];
      var match = (e.wordId && word.id && e.wordId === word.id) ||
        ((word.headwords || []).indexOf(e.headword) >= 0);
      if (match) {
        delete store.wrong[k];
        delete store.mastered[k];
      }
    });
    persistWrong();
    persistMastered();
    updateBadge();
  }

  /** 错词本内直接修改标签（tags 至少 1 个，由 UI 保证） */
  function setEntryTags(key, tags) {
    var e = store.wrong[key];
    if (!e) return;
    e.reasonTags = orderedTags(tags);
    e.updatedAt = Date.now();
    persistWrong();
    updateBadge();
  }

  /** 查某词的活跃（未掌握）错词条目，无则 null */
  function findWrongEntryForWord(word) {
    for (var k in store.wrong) {
      if (store.mastered[k]) continue;
      var e = store.wrong[k];
      if (!e) continue;
      if (e.wordId && word.id && e.wordId === word.id) return e;
      if ((word.headwords || []).indexOf(e.headword) >= 0) return e;
    }
    return null;
  }

  function isWordWrong(word) {
    return !!findWrongEntryForWord(word);
  }

  function activeWrongEntries() {
    var out = [];
    Object.keys(store.wrong).forEach(function (k) {
      var e = store.wrong[k];
      if (!store.mastered[k]) out.push(e);
    });
    out.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return out;
  }

  function updateBadge() {
    var badge = document.getElementById('wrongBadge');
    if (!badge) return;
    var n = activeWrongEntries().length;
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }

  /* ---------------- 渲染：学习模式 ---------------- */

  function renderWordCard(w) {
    var ipa = [];
    if (w.ipaUk) ipa.push('英 ' + w.ipaUk);
    if (w.ipaUs) ipa.push('美 ' + w.ipaUs);
    var sourceNotes = {
      'review': '原 PDF 音标疑误：此行印成 hotel 的音标。',
      'honey': '原 PDF 音标疑误：印刷音标与此词不对应。',
      'alone': '原 PDF 音标疑误：此行与 recording 音标相同。',
      'foot(feet)': '原 PDF 美音列标的是复数 feet 的读音。',
      'crossroads/crossing': '原 PDF 美音音标不完整。'
    };
    var sourceNote = sourceNotes[w.display] || '';
    var hwBtns = '';
    (w.headwords || []).forEach(function (hw) {
      hwBtns +=
        '<button class="speak-btn" type="button" data-speak="' + esc(hw) +
        '" data-accent="uk" aria-pressed="false">英</button>' +
        '<button class="speak-btn" type="button" data-speak="' + esc(hw) +
        '" data-accent="us" aria-pressed="false">美</button>';
    });

    // ---- 已错标记 + popover 面板 ----
    var entry = findWrongEntryForWord(w);
    var isMarked = !!entry;
    var tags = isMarked ? reasonTagsOf(entry) : [];
    var toggleLabel = isMarked ? '已错 · ' + tagLabel(tags) : '已错';

    var popHtml = '';
    if (state.wPop && state.wPop.wordId === w.id) {
      var draft = state.wPop.draft;
      var tagBtns = REASON_ORDER.map(function (t) {
        return '<button type="button" class="chip-tag t-' + t +
          (draft.indexOf(t) >= 0 ? ' on' : '') +
          '" data-wtag="' + t + '">' + REASON_LABELS[t] + '</button>';
      }).join('');
      popHtml =
        '<div class="pop" role="dialog">' +
          '<p class="field-label">错因（可多选）</p>' +
          '<div class="pop-tags">' + tagBtns + '</div>' +
          '<div class="pop-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-wcancel>取消</button>' +
            (isMarked ? '<button type="button" class="btn btn-danger btn-sm" data-wremove>移除标记</button>' : '') +
            '<button type="button" class="btn btn-primary btn-sm" data-wconfirm' +
              (draft.length ? '' : ' disabled') + '>确认</button>' +
          '</div>' +
        '</div>';
    }

    return '' +
      '<div class="word-card' + (isMarked ? ' marked' : '') + '">' +
        '<div class="word-head">' +
          '<div style="flex:1;min-width:0">' +
            '<div class="word-display">' + esc(w.display) + '</div>' +
            '<div class="word-meaning">' + esc(w.meaning) + '</div>' +
          '</div>' +
          '<button type="button" class="wrong-toggle' + (isMarked ? ' marked' : '') +
            '" data-wmark="' + esc(w.id) + '">' + esc(toggleLabel) + '</button>' +
        '</div>' +
        '<div class="hw-line">' +
          hwBtns +
          (ipa.length ? '<span class="ipa">' + esc(ipa.join(' · ')) + '</span>' : '') +
        '</div>' +
        (sourceNote ? '<p class="source-note">' + esc(sourceNote) + ' 保留原文供对照，请结合发音学习。</p>' : '') +
        popHtml +
      '</div>';
  }

  function renderLearn() {
    var sc = scenarioById(state.scenarioId);
    var q = state.query.trim().toLowerCase();

    // 场景标签
    var chips = VOCAB.scenarios.map(function (s) {
      return '<button class="chip' + (s.id === sc.id ? ' on' : '') +
        '" type="button" data-scenario="' + esc(s.id) + '">' +
        esc(s.name) + '<span class="chip-pages">p' + s.startPage + '–' + s.endPage + '</span></button>';
    }).join('');

    var html = '<div class="scenario-chips">' + chips + '</div>';

    // 搜索框
    html +=
      '<div class="searchbox"><input class="input" id="searchInput" type="search" ' +
      'placeholder="搜索英文单词或中文释义…" value="' + esc(state.query) + '"></div>';

    if (q) {
      // ---- 搜索结果 ----
      var hits = [];
      VOCAB.words.forEach(function (w) {
        if (hits.length >= 60) return;
        var inEn = (w.display || '').toLowerCase().indexOf(q) >= 0 ||
          (w.headwords || []).some(function (h) { return h.toLowerCase().indexOf(q) >= 0; });
        var inZh = (w.meaning || '').indexOf(state.query.trim()) >= 0;
        if (inEn || inZh) hits.push(w);
      });
      html += '<div class="result-meta">找到 ' + hits.length + ' 条结果' +
        (hits.length >= 60 ? '（仅显示前 60 条，请细化关键词）' : '') + '</div>';
      if (!hits.length) {
        html += '<div class="empty-state"><div class="big">没有匹配的词</div>' +
          '<p>换个关键词试试，支持英文片段与中文释义。</p></div>';
      } else {
        html += hits.map(function (w) {
          return '<div class="search-item" data-goto-word="' + esc(w.id) + '">' +
            '<div class="word-head"><div style="flex:1;min-width:0">' +
              '<div class="word-display">' + esc(w.display) + '</div>' +
              '<div class="word-meaning">' + esc(w.meaning) + '</div>' +
            '</div></div>' +
            '<div class="hw-line">' +
              '<button class="speak-btn" type="button" data-speak="' + esc((w.headwords || [w.display])[0]) +
              '" data-accent="uk">英</button>' +
              '<button class="speak-btn" type="button" data-speak="' + esc((w.headwords || [w.display])[0]) +
              '" data-accent="us">美</button>' +
              '<span class="wrong-tags">p' + w.page + ' · ' + esc(w.scenario || '') + '</span>' +
            '</div></div>';
        }).join('');
      }
      appEl.innerHTML = html;
      afterLearnRender();
      return;
    }

    // ---- 页码导航 ----
    var pageOpts = '';
    for (var p = sc.startPage; p <= sc.endPage; p++) {
      pageOpts += '<option value="' + p + '"' + (p === state.page ? ' selected' : '') + '>第 ' + p + ' 页</option>';
    }
    html +=
      '<div class="pagebar">' +
        '<button class="btn btn-ghost" type="button" data-page-prev' +
          (state.page <= sc.startPage ? ' disabled' : '') + '>上一页</button>' +
        '<select class="select pageselect" id="pageSelect">' + pageOpts + '</select>' +
        '<button class="btn btn-ghost" type="button" data-page-next' +
          (state.page >= sc.endPage ? ' disabled' : '') + '>下一页</button>' +
        '<span class="pagenum">p' + state.page + '</span>' +
      '</div>';

    // ---- 进度（已错）----
    var scWords = wordsByScenario(sc.id);
    var wrongCnt = scWords.filter(isWordWrong).length;
    var totalWrong = VOCAB.words.filter(isWordWrong).length;
    var pct = scWords.length ? Math.round(wrongCnt / scWords.length * 100) : 0;
    html +=
      '<div class="progress-wrap">' +
        '<div class="progress-meta"><span>' + esc(sc.name) + ' 已错 ' + wrongCnt + ' / ' + scWords.length +
          '</span><span>全局 ' + totalWrong + ' / ' + VOCAB.words.length + '</span></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';

    // ---- 当前页词卡（按 section 分组）----
    var pageWords = wordsByPage(state.page);
    var listHtml = '';
    var lastSection = null;
    pageWords.forEach(function (w) {
      var sec = w.section || null;
      if (sec && sec !== w.scenario && sec !== lastSection) {
        listHtml += '<div class="section-divider">' + esc(sec) + '</div>';
        lastSection = sec;
      }
      listHtml += renderWordCard(w);
    });
    if (!pageWords.length) {
      listHtml = '<div class="empty-state"><div class="big">本页没有词条</div></div>';
    }
    html += '<div class="word-list">' + listHtml + '</div>';

    appEl.innerHTML = html;
    afterLearnRender();
  }

  function afterLearnRender() {
    var si = document.getElementById('searchInput');
    if (si) {
      si.addEventListener('input', function (event) {
        state.query = si.value;
        if (event.isComposing) return;
        renderLearnKeepFocus();
      });
      si.addEventListener('compositionend', function () {
        state.query = si.value;
        renderLearnKeepFocus();
      });
    }
    var ps = document.getElementById('pageSelect');
    if (ps) {
      ps.addEventListener('change', function () {
        state.page = parseInt(ps.value, 10) || state.page;
        persistViewSettings();
        renderLearn();
      });
    }
    refreshSpeakButtons();
  }

  // 搜索输入时重渲染但保持焦点与光标
  function renderLearnKeepFocus() {
    var si = document.getElementById('searchInput');
    var caret = si ? si.selectionStart : 0;
    renderLearn();
    var ni = document.getElementById('searchInput');
    if (ni) {
      ni.focus();
      try { ni.setSelectionRange(caret, caret); } catch (e) {}
    }
  }

  /* ---------------- 渲染：听写模式 ---------------- */

  function currentTargetItem() {
    var s = state.dSession;
    if (!s || s.finished) return null;
    return s.queue[s.index] || null;
  }

  function playCurrentTarget() {
    clearQuizTimer();
    var item = currentTargetItem();
    if (state.route !== 'dictation' || !item || !window.VocabAudio) return;
    VocabAudio.play(item.target, state.dSetup.accent).catch(function () {});
  }

  function clearQuizTimer() {
    if (state.quizTimer !== null) clearTimeout(state.quizTimer);
    state.quizTimer = null;
  }

  function stopQuizAudio() {
    clearQuizTimer();
    if (window.VocabAudio) VocabAudio.stop();
  }

  function buildQueue() {
    var range = state.dSetup.range;
    var words = [];
    var wrongItems = [];
    if (range === 'scenario') {
      words = wordsByScenario(state.scenarioId);
    } else if (range === 'page') {
      words = wordsByPage(state.dSetup.singlePage);
    } else if (range === 'all') {
      words = VOCAB.words.slice();
    } else if (range === 'wrong') {
      activeWrongEntries().forEach(function (e) {
        var w = e.wordId ? findWordById(e.wordId) : null;
        wrongItems.push({
          word: w || {
            id: 'wrong-' + e.headword, display: e.display, meaning: e.meaning,
            page: e.page, scenarioId: e.scenarioId, scenario: e.scenario,
            headwords: [e.headword]
          },
          target: e.headword
        });
      });
    }

    var items = words.map(function (w) {
      var hws = (w.headwords && w.headwords.length) ? w.headwords : [w.display];
      return { word: w, target: hws[Math.floor(Math.random() * hws.length)] };
    }).concat(wrongItems);

    if (state.dSetup.order === 'random') items = shuffle(items);

    state.dSession = {
      queue: items, index: 0, correct: 0, exact: 0,
      answered: 0, wrongNew: 0, result: null, finished: false,
      rangeText: rangeLabel()
    };
  }

  function rangeLabel() {
    switch (state.dSetup.range) {
      case 'scenario': return scenarioById(state.scenarioId).name + '（p' +
        scenarioById(state.scenarioId).startPage + '–' + scenarioById(state.scenarioId).endPage + '）';
      case 'page': return '第 ' + state.dSetup.singlePage + ' 页';
      case 'all': return '全部词库（' + VOCAB.words.length + ' 条）';
      case 'wrong': return '错词本（' + activeWrongEntries().length + ' 条）';
      default: return '';
    }
  }

  function renderDictation(replay) {
    clearQuizTimer();
    var s = state.dSession;

    // ---- 一轮结束：成绩页 ----
    if (s && s.finished) {
      stopQuizAudio();
      var total = s.answered;
      var remaining = s.queue.length - total;
      var accPct = total ? Math.round(s.correct / total * 100) : 0;
      appEl.innerHTML =
        '<div class="panel">' +
          '<h2 style="margin:0 0 4px">' + (remaining ? '本轮已结束' : '本轮完成') + '</h2>' +
          '<p style="margin:0 0 8px;color:var(--muted)">范围：' + esc(s.rangeText) + '</p>' +
          '<p class="result-meta">已作答 ' + total + ' 题，未作答 ' + remaining + ' 题；正确率仅按已作答题计算。</p>' +
          '<div class="summary-stats">' +
            '<div class="stat"><div class="stat-num good">' + s.correct + '</div><div class="stat-label">答对 / 已答 ' + total + ' 题（' + (total ? accPct + '%' : '暂无成绩') + '）</div></div>' +
            '<div class="stat"><div class="stat-num">' + s.exact + '</div><div class="stat-label">完全拼写正确</div></div>' +
            '<div class="stat"><div class="stat-num bad">' + s.wrongNew + '</div><div class="stat-label">本轮新增错词</div></div>' +
          '</div>' +
          '<div class="next-row">' +
            '<button class="btn btn-primary" type="button" data-dagain>再来一轮</button>' +
            '<a class="btn" href="#/learn">返回学习</a>' +
            '<a class="btn" href="#/wrong">查看错词本</a>' +
          '</div>' +
        '</div>';
      refreshSpeakButtons();
      return;
    }

    // ---- 设置页 ----
    if (!s) {
      var range = state.dSetup.range;
      var drOpts = [
        ['scenario', '当前场景'], ['page', '指定页'],
        ['all', '全部词库'], ['wrong', '错词本']
      ].map(function (o) {
        return '<button type="button" data-drange="' + o[0] + '" class="' +
          (range === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
      }).join('');

      var pageOpts = '';
      for (var p = 2; p <= 30; p++) {
        pageOpts += '<option value="' + p + '"' + (p === state.dSetup.singlePage ? ' selected' : '') + '>第 ' + p + ' 页</option>';
      }

      appEl.innerHTML =
        '<div class="panel">' +
          '<h2 style="margin:0 0 12px">听写设置</h2>' +
          '<div class="setup-grid">' +
            '<div><p class="field-label">范围（当前：' + esc(rangeLabel()) + '）</p>' +
              '<div class="seg">' + drOpts + '</div></div>' +
            (range === 'page'
              ? '<div><p class="field-label">选择页码</p>' +
                '<select class="select" id="singlePageSelect">' + pageOpts + '</select></div>'
              : '') +
            '<div><p class="field-label">顺序</p>' +
              '<div class="seg">' +
                '<button type="button" data-dorder="sequence" class="' + (state.dSetup.order === 'sequence' ? 'on' : '') + '">顺序</button>' +
                '<button type="button" data-dorder="random" class="' + (state.dSetup.order === 'random' ? 'on' : '') + '">随机</button>' +
              '</div></div>' +
            '<div><p class="field-label">口音（答题中可随时切换）</p>' +
              '<div class="seg">' +
                '<button type="button" data-daccent="uk" class="' + (state.dSetup.accent === 'uk' ? 'on' : '') + '">英音</button>' +
                '<button type="button" data-daccent="us" class="' + (state.dSetup.accent === 'us' ? 'on' : '') + '">美音</button>' +
              '</div></div>' +
          '</div>' +
          '<button class="btn btn-primary" type="button" data-dstart style="width:100%">开始听写</button>' +
        '</div>';

      var sp = document.getElementById('singlePageSelect');
      if (sp) {
        sp.addEventListener('change', function () {
          state.dSetup.singlePage = parseInt(sp.value, 10) || 2;
          persistViewSettings();
        });
      }
      refreshSpeakButtons();
      return;
    }

    // ---- 答题页 ----
    var item = s.queue[s.index];
    var accentSeg =
      '<div class="seg">' +
        '<button type="button" data-daccent="uk" class="' + (state.dSetup.accent === 'uk' ? 'on' : '') + '">英音</button>' +
        '<button type="button" data-daccent="us" class="' + (state.dSetup.accent === 'us' ? 'on' : '') + '">美音</button>' +
      '</div>';

    var bodyHtml = '';
    if (s.result) {
      var res = s.result;
      var boxClass = res.accepted ? 'ok' : 'bad';
      var reasonText = res.accepted
        ? (res.exact ? '拼写正确' : res.reasonCn)
        : res.reasonCn || '拼写有误';
      bodyHtml =
        '<div class="result-box ' + boxClass + '">' +
          '<div class="result-reason">' + esc(reasonText) + '</div>' +
          '<div class="highlight-line">' + res.highlightHtml + '</div>' +
          '<div class="answer-line">正确答案：<b>' + esc(item.target) + '</b>' +
            '　释义：' + esc(item.word.meaning || '—') +
            (item.word.display ? '　词形：' + esc(item.word.display) : '') +
          '</div>' +
          '<div class="hw-line">' +
            '<button class="speak-btn" type="button" data-speak="' + esc(item.target) + '" data-accent="uk">英</button>' +
            '<button class="speak-btn" type="button" data-speak="' + esc(item.target) + '" data-accent="us">美</button>' +
          '</div>' +
        '</div>' +
        '<div class="next-row">' +
          (s.index + 1 < s.queue.length
            ? '<button class="btn btn-primary" type="button" data-dnext>下一题</button>'
            : '<button class="btn btn-primary" type="button" data-dfinish>查看成绩</button>') +
        '</div>';
    } else {
      bodyHtml =
        '<input class="input quiz-input" type="text" id="quizInput" ' +
          'placeholder="听到单词后拼写，Enter 提交" autocomplete="off" autocapitalize="off">' +
        '<div class="next-row">' +
          '<button class="btn btn-primary" type="button" data-dsubmit style="flex:1">提交</button>' +
        '</div>';
    }

    appEl.innerHTML =
      '<div class="panel">' +
        '<div class="quiz-top">' +
          '<span class="quiz-progress">第 ' + (s.index + 1) + ' / ' + s.queue.length + ' 题</span>' +
          accentSeg +
          '<button class="btn btn-ghost btn-sm" type="button" data-dend>结束本轮</button>' +
        '</div>' +
        '<button class="btn replay-btn" type="button" data-dreplay>重听当前词</button>' +
        bodyHtml +
      '</div>';

    var qi = document.getElementById('quizInput');
    if (qi) qi.focus();
    // 自动播放当前题（开始/下一题时触发）
    if (!s.result || replay) {
      state.quizTimer = setTimeout(playCurrentTarget, 250);
    }
    refreshSpeakButtons();
  }

  function submitAnswer() {
    var s = state.dSession;
    if (!s || s.result || s.finished) return;
    var item = s.queue[s.index];
    var input = document.getElementById('quizInput');
    var raw = input ? input.value : '';
    if (!raw.trim()) {
      if (input) input.focus();
      return;
    }
    var res = Dictation.check(raw, item.target);
    stopQuizAudio();
    s.result = res;
    s.answered++;
    if (res.accepted) {
      s.correct++;
      if (res.exact) s.exact++;
    } else {
      var isNew = !store.wrong[item.target];
      addWrong(item.target, item.word, res.reasonCn);
      if (isNew) s.wrongNew++;
    }
    renderDictation();
  }

  function nextQuestion() {
    var s = state.dSession;
    if (!s || !s.result) return;
    stopQuizAudio();
    s.index++;
    if (s.index >= s.queue.length) {
      s.finished = true;
    } else {
      s.result = null;
    }
    renderDictation();
  }

  /* ---------------- 渲染：错词本 ---------------- */

  state.wrongFilter = 'all';

  // 渲染一组错因 chip（active=true 时可点切换）
  function reasonChipHtml(e, clickable) {
    var cur = reasonTagsOf(e);
    return REASON_ORDER.map(function (t) {
      var on = cur.indexOf(t) >= 0;
      if (clickable) {
        return '<button type="button" class="chip-tag t-' + t + (on ? ' on' : '') +
          '" data-entry-tag="' + esc(e.headword) + '" data-tag="' + t + '">' + REASON_LABELS[t] + '</button>';
      }
      return '<span class="chip-tag t-' + t + (on ? ' on readonly' : '') + '">' + REASON_LABELS[t] + '</span>';
    }).join('');
  }

  function renderWrong() {
    var entries = activeWrongEntries();
    var masterKeys = Object.keys(store.mastered);

    var filterOpts = '<option value="all">全部场景</option>';
    VOCAB.scenarios.forEach(function (sc) {
      filterOpts += '<option value="' + esc(sc.id) + '"' + (state.wrongFilter === sc.id ? ' selected' : '') + '>' +
        esc(sc.name) + '</option>';
    });

    // 错因筛选计数（基于活跃条目，不受场景筛选影响）
    var tagCounts = { meaning: 0, spelling: 0, listening: 0 };
    entries.forEach(function (e) {
      reasonTagsOf(e).forEach(function (t) {
        if (tagCounts[t] !== undefined) tagCounts[t]++;
      });
    });
    var reasonFilters = [['all', '全部', entries.length]]
      .concat([['meaning', '意思', tagCounts.meaning], ['spelling', '拼写', tagCounts.spelling], ['listening', '听错', tagCounts.listening]])
      .map(function (o) {
        return '<button type="button" class="chip tag-filter' + (state.wrongReasonFilter === o[0] ? ' on' : '') +
          '" data-reason-filter="' + o[0] + '">' + o[1] + ' ' + o[2] + '</button>';
      }).join('');

    // 场景筛选 × 错因筛选叠加
    var list = entries.filter(function (e) {
      var okSc = state.wrongFilter === 'all' || e.scenarioId === state.wrongFilter;
      var okReason = state.wrongReasonFilter === 'all' ||
        reasonTagsOf(e).indexOf(state.wrongReasonFilter) >= 0;
      return okSc && okReason;
    });

    var html =
      '<div class="wrong-head">' +
        '<h2 style="margin:0;flex:1;min-width:0">错词本</h2>' +
        '<button class="btn btn-primary btn-sm" type="button" data-wrong-quiz' + (entries.length ? '' : ' disabled') + '>错词本组卷重练</button>' +
      '</div>' +
      '<div class="wrong-head">' +
        '<select class="select" id="wrongFilterSelect">' + filterOpts + '</select>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-toggle-mastered>' +
          (state.showMastered ? '隐藏已掌握（' : '显示已掌握（') + masterKeys.length + '）</button>' +
      '</div>' +
      '<div class="reason-filters">' + reasonFilters + '</div>';

    if (!entries.length) {
      html += '<div class="empty-state"><div class="big">错词本是空的</div>' +
        '<p>学习页点「已错」标记难点词，或听写中拼错的词会自动收集到这里。</p>' +
        '<p><a href="#/dictation">去听写 →</a></p></div>';
    } else {
      html += '<div class="result-meta">共 ' + entries.length + ' 条活跃错词' +
        (list.length !== entries.length ? '（当前筛选 ' + list.length + ' 条）' : '') + '</div>';
      html += list.map(function (e) {
        var countLabel = (e.count && e.count > 0) ? '错 ' + e.count + ' 次' : '手动标记';
        return '<div class="wrong-item">' +
          '<div class="wrong-item-top">' +
            '<span class="wrong-headword">' + esc(e.headword) + '</span>' +
            '<span class="wrong-count">' + countLabel + '</span>' +
            '<span class="wrong-tags">p' + (e.page || '?') + ' · ' + esc(e.scenario || e.scenarioId || '') + '</span>' +
          '</div>' +
          '<div class="word-meaning">' + esc(e.display === e.headword ? e.meaning : (e.display + ' — ' + e.meaning)) + '</div>' +
          (e.lastReason ? '<div class="wrong-reason">最近原因：' + esc(e.lastReason) + '</div>' : '') +
          '<div class="wrong-tags-row">' + reasonChipHtml(e, true) + '</div>' +
          '<div class="wrong-actions">' +
            '<button class="speak-btn" type="button" data-speak="' + esc(e.headword) + '" data-accent="uk">英</button>' +
            '<button class="speak-btn" type="button" data-speak="' + esc(e.headword) + '" data-accent="us">美</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-master="' + esc(e.headword) + '">标记已掌握</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-single-quiz="' + esc(e.headword) + '">单词重练</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    if (state.showMastered && masterKeys.length) {
      html += '<h3 style="margin:18px 0 8px;font-size:14px;color:var(--muted)">已掌握</h3>';
      masterKeys.forEach(function (k) {
        var e = store.wrong[k] || { headword: k };
        html += '<div class="wrong-item mastered-dim">' +
          '<div class="wrong-item-top"><span class="wrong-headword">' + esc(k) + '</span>' +
          '<span class="wrong-tags">' + esc(e.meaning || '') + '</span></div>' +
          '<div class="wrong-tags-row">' + reasonChipHtml(e, false) + '</div>' +
          '<div class="wrong-actions">' +
            '<button class="speak-btn" type="button" data-speak="' + esc(k) + '" data-accent="uk">英</button>' +
            '<button class="speak-btn" type="button" data-speak="' + esc(k) + '" data-accent="us">美</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-unmaster="' + esc(k) + '">移回错词本</button>' +
          '</div></div>';
      });
    }

    appEl.innerHTML = html;
    var fs = document.getElementById('wrongFilterSelect');
    if (fs) {
      fs.addEventListener('change', function () {
        state.wrongFilter = fs.value;
        renderWrong();
      });
    }
    refreshSpeakButtons();
  }

  /* ---------------- 路由 ---------------- */

  function setActiveTab() {
    var jijing = state.route.indexOf('jijing/') === 0;
    var view = jijing ? state.route.slice('jijing/'.length) : state.route;
    var tabs = document.querySelectorAll('#mainTabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      var name = tabs[i].getAttribute('data-route');
      tabs[i].setAttribute('href', '#/' + (jijing ? 'jijing/' : '') + name);
      tabs[i].classList.toggle('active', name === view);
    }
    document.getElementById('sceneLibrary').classList.toggle('active', !jijing);
    document.getElementById('jijingLibrary').classList.toggle('active', jijing);
  }

  function router() {
    stopQuizAudio();
    var h = (location.hash || '#/learn').replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var route = qi >= 0 ? h.slice(0, qi) : h;
    var query = qi >= 0 ? h.slice(qi + 1) : '';
    if (['learn', 'dictation', 'wrong', 'jijing/learn', 'jijing/dictation', 'jijing/wrong'].indexOf(route) < 0) route = 'learn';
    state.route = route;
    setActiveTab();

    if (route.indexOf('jijing/') === 0) {
      if (window.JijingApp) JijingApp.render(route.slice('jijing/'.length));
      else fatal('机经词数据暂未加载，请刷新页面，或点击顶部「场景词」返回。');
      window.scrollTo(0, 0);
      return;
    }
    appEl.dataset.library = 'scene';
    updateBadge();

    if (route === 'dictation') {
      var params = {};
      query.split('&').forEach(function (kv) {
        var parts = kv.split('=');
        if (parts.length === 2) params[parts[0]] = parts[1];
      });
      if (['scenario', 'page', 'all', 'wrong'].indexOf(params.range) >= 0) state.dSetup.range = params.range;
      if (params.from === 'wrong') state.dSetup.range = 'wrong';
      if (params.start === '1' || params.from === 'wrong') {
        persistViewSettings();
        buildQueue();
        if (!state.dSession.queue.length) state.dSession = null; // 范围为空 → 回设置页
      }
    }

    if (route === 'learn') renderLearn();
    else if (route === 'dictation') renderDictation();
    else renderWrong();
    window.scrollTo(0, 0);
  }

  /* ---------------- 全局事件委托 ---------------- */

  appEl.addEventListener('click', function (e) {
    var t;

    t = e.target.closest('[data-speak]');
    if (t) { speak(t.getAttribute('data-speak'), t.getAttribute('data-accent')); return; }

    t = e.target.closest('[data-scenario]');
    if (t) {
      state.scenarioId = t.getAttribute('data-scenario');
      var sc = scenarioById(state.scenarioId);
      state.page = Math.min(Math.max(state.page, sc.startPage), sc.endPage);
      state.query = '';
      persistViewSettings();
      renderLearn();
      return;
    }

    t = e.target.closest('[data-page-prev]');
    if (t) {
      var sc1 = scenarioById(state.scenarioId);
      if (state.page > sc1.startPage) { state.page--; persistViewSettings(); renderLearn(); }
      return;
    }

    t = e.target.closest('[data-page-next]');
    if (t) {
      var sc2 = scenarioById(state.scenarioId);
      if (state.page < sc2.endPage) { state.page++; persistViewSettings(); renderLearn(); }
      return;
    }

    t = e.target.closest('[data-goto-word]');
    if (t) {
      var w = findWordById(t.getAttribute('data-goto-word'));
      if (w) {
        state.scenarioId = w.scenarioId;
        state.page = w.page;
        state.query = '';
        persistViewSettings();
        renderLearn();
      }
      return;
    }

    // 听写设置
    t = e.target.closest('[data-drange]');
    if (t) { state.dSetup.range = t.getAttribute('data-drange'); persistViewSettings(); renderDictation(); return; }

    t = e.target.closest('[data-dorder]');
    if (t) { state.dSetup.order = t.getAttribute('data-dorder'); persistViewSettings(); renderDictation(); return; }

    t = e.target.closest('[data-dstart]');
    if (t) {
      buildQueue();
      if (!state.dSession.queue.length) {
        state.dSession = null;
        renderDictation();
        return;
      }
      renderDictation();
      return;
    }

    // 答题中
    t = e.target.closest('[data-daccent]');
    if (t) {
      state.dSetup.accent = t.getAttribute('data-daccent');
      persistViewSettings();
      if (state.dSession && !state.dSession.finished) {
        // 切换口音后立即重放当前题（若已提交则重播答案）
        renderDictation(true);
      } else {
        renderDictation();
      }
      return;
    }

    t = e.target.closest('[data-dreplay]');
    if (t) { playCurrentTarget(); return; }

    t = e.target.closest('[data-dsubmit]');
    if (t) { submitAnswer(); return; }

    t = e.target.closest('[data-dnext]');
    if (t) { nextQuestion(); return; }

    t = e.target.closest('[data-dfinish]');
    if (t) { if (state.dSession) state.dSession.finished = true; renderDictation(); return; }

    t = e.target.closest('[data-dend]');
    if (t) { if (state.dSession) state.dSession.finished = true; renderDictation(); return; }

    t = e.target.closest('[data-dagain]');
    if (t) { buildQueue(); renderDictation(); return; }

    // 学习页：已错标记 popover
    t = e.target.closest('[data-wmark]');
    if (t) {
      var wid = t.getAttribute('data-wmark');
      if (state.wPop && state.wPop.wordId === wid) {
        state.wPop = null;
      } else {
        var w0 = findWordById(wid);
        var ent0 = w0 ? findWrongEntryForWord(w0) : null;
        state.wPop = { wordId: wid, draft: ent0 ? reasonTagsOf(ent0) : [] };
      }
      renderLearn();
      return;
    }

    t = e.target.closest('[data-wtag]');
    if (t) {
      if (!state.wPop) return;
      var tg = t.getAttribute('data-wtag');
      var ix = state.wPop.draft.indexOf(tg);
      if (ix >= 0) state.wPop.draft.splice(ix, 1);
      else state.wPop.draft.push(tg);
      renderLearn();
      return;
    }

    t = e.target.closest('[data-wconfirm]');
    if (t) {
      if (!state.wPop || !state.wPop.draft.length) return;
      var w1 = findWordById(state.wPop.wordId);
      if (w1) manualMarkWrong(w1, state.wPop.draft);
      state.wPop = null;
      renderLearn();
      return;
    }

    t = e.target.closest('[data-wcancel]');
    if (t) {
      state.wPop = null;
      renderLearn();
      return;
    }

    t = e.target.closest('[data-wremove]');
    if (t) {
      var w2 = findWordById(state.wPop.wordId);
      if (w2) removeWrongForWord(w2);
      state.wPop = null;
      renderLearn();
      return;
    }

    // 错词本：直接切换条目错因标签
    t = e.target.closest('[data-entry-tag]');
    if (t) {
      var key = t.getAttribute('data-entry-tag');
      var tag = t.getAttribute('data-tag');
      var ent = store.wrong[key];
      if (!ent) return;
      var cur = reasonTagsOf(ent).slice();
      var p = cur.indexOf(tag);
      if (p >= 0) {
        if (cur.length === 1) {
          // 不允许取消最后一个错因：轻抖动提示
          t.classList.add('denied');
          setTimeout(function () { t.classList.remove('denied'); }, 450);
          return;
        }
        cur.splice(p, 1);
      } else {
        cur.push(tag);
      }
      setEntryTags(key, cur);
      renderWrong();
      return;
    }

    t = e.target.closest('[data-reason-filter]');
    if (t) {
      state.wrongReasonFilter = t.getAttribute('data-reason-filter');
      renderWrong();
      return;
    }

    // 错词本
    t = e.target.closest('[data-master]');
    if (t) {
      store.mastered[t.getAttribute('data-master')] = 1;
      persistMastered();
      updateBadge();
      renderWrong();
      return;
    }

    t = e.target.closest('[data-unmaster]');
    if (t) {
      delete store.mastered[t.getAttribute('data-unmaster')];
      persistMastered();
      updateBadge();
      renderWrong();
      return;
    }

    t = e.target.closest('[data-wrong-quiz]');
    if (t) {
      location.hash = '#/dictation?from=wrong';
      return;
    }

    t = e.target.closest('[data-single-quiz]');
    if (t) {
      state.dSetup.range = 'wrong';
      buildQueue();
      var headword = t.getAttribute('data-single-quiz');
      state.dSession.queue = state.dSession.queue.filter(function (item) { return item.target === headword; });
      state.dSession.rangeText = '单词重练';
      location.hash = '#/dictation';
      return;
    }

    t = e.target.closest('[data-toggle-mastered]');
    if (t) { state.showMastered = !state.showMastered; renderWrong(); return; }
  });

  appEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('quiz-input')) {
      e.preventDefault();
      submitAnswer();
    }
  });

  /* ---------------- 启动 ---------------- */

  updateBadge();
  window.addEventListener('hashchange', router);
  router();

})();
