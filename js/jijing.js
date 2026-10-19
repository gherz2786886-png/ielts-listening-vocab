/* Item-based Jijing practice. Source answers and spoken forms remain separate. */
(function (global) {
  'use strict';
  var data = global.JIJING;
  if (!data || !data.days || !data.days.length) return;
  var collections = data.days.concat(data.collections || []);
  var app = document.getElementById('app');
  var KEY = 'ieltsJijing.v1';
  var unreadable = false;
  var saved = { settings: {}, records: {} };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.settings || !parsed.records || Array.isArray(parsed.records)) throw new Error('Invalid Jijing records');
      saved = parsed;
    }
  } catch (error) { unreadable = true; }
  var state = {
    day: saved.settings.day || 28,
    accent: saved.settings.accent === 'us' ? 'us' : 'uk',
    order: saved.settings.order === 'random' ? 'random' : 'sequence',
    scope: 'selected', selection: {}, view: 'learn', session: null, pendingPlay: null
  };
  var items = {}, dayOf = {};
  collections.forEach(function (day) {
    day.items.forEach(function (item) { items[item.id] = item; dayOf[item.id] = day; });
  });
  if (!collections.some(function (day) { return String(day.day) === String(state.day); })) state.day = data.days[0].day;

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function message(text) {
    var notice = document.getElementById('appNotice');
    if (!notice) return;
    notice.textContent = text; notice.hidden = false;
  }
  function persist() {
    if (unreadable) { message('原有机经记录无法读取，本次未覆盖原数据。'); return; }
    saved.settings = { day: state.day, accent: state.accent, order: state.order };
    try { localStorage.setItem(KEY, JSON.stringify(saved)); }
    catch (error) { message('机经学习记录未能保存，刷新或关闭页面可能丢失。'); }
  }
  function currentDay() { return collections.filter(function (day) { return String(day.day) === String(state.day); })[0]; }
  function label(day) { return day.label || 'Day' + day.day; }
  function wrongIds() {
    return Object.keys(saved.records).filter(function (id) {
      var record = saved.records[id];
      return items[id] && record && record.wrong && !record.mastered;
    });
  }
  function updateBadge() {
    var badge = document.getElementById('wrongBadge');
    if (!badge || app.dataset.library !== 'jijing') return;
    badge.textContent = String(wrongIds().length); badge.hidden = !wrongIds().length;
  }
  function selectedIds() {
    return currentDay().items.filter(function (item) { return state.selection[item.id] !== false; })
      .map(function (item) { return item.id; });
  }
  function spoken(item) { return global.JijingSpeech.forAnswer(item.answers[0], { part: item.part }); }
  function playText(text) {
    var parts = global.JijingSpeech.audioParts(text);
    if (parts.length > 1) global.VocabAudio.playSequence(parts, state.accent).catch(function () {});
    else global.VocabAudio.play(text, state.accent).catch(function () {});
  }
  function play(item) { playText(spoken(item).text); }
  function settingsHtml() {
    function option(day) {
      return '<option value="' + day.day + '"' + (String(day.day) === String(state.day) ? ' selected' : '') +
        '>' + esc(label(day)) + (day.sourceDay ? ' · ' + day.year + ' 年 Day' + day.sourceDay : '') +
        (day.status === 'practice' ? ' · 练习编排' : '') + '</option>';
    }
    var options = '<optgroup label="每日练习 · Day28–Day101">' + data.days.map(option).join('') + '</optgroup>';
    [2019, 2020, 2021, 2022].forEach(function (year) {
      var groups = (data.collections || []).filter(function (group) { return group.year === year; });
      if (groups.length) options += '<optgroup label="PDF 题组 · ' + year + '">' + groups.map(option).join('') + '</optgroup>';
    });
    return '<div class="j-controls">' +
      '<label>打卡日 / PDF 题组<select class="select" id="jDay">' + options + '</select></label>' +
      '<label>口音<select class="select" id="jAccent"><option value="uk"' +
        (state.accent === 'uk' ? ' selected' : '') + '>英音</option><option value="us"' +
        (state.accent === 'us' ? ' selected' : '') + '>美音</option></select></label></div>';
  }
  function markWrong(id, result, input) {
    var record = saved.records[id] || { attempts: 0, errors: 0 };
    record.wrong = true; record.mastered = false;
    if (result) { record.errors++; record.lastReason = result.reasonCn; record.lastInput = input; }
    else record.manual = true;
    saved.records[id] = record;
    persist(); updateBadge();
  }
  function renderLearn() {
    var day = currentDay();
    var selected = selectedIds();
    var source = data.sources ? data.sources[String(day.year)] : data.source;
    var html = '<h1 class="j-heading">机经词 · ' + esc(label(day)) + '</h1>' + settingsHtml() +
      '<p class="result-meta">Day28–Day101 · 74 个练习日；也可从下拉框直接选择 PDF 题组。</p>' +
      '<div class="panel j-alignment"' + (day.status === 'practice' ? ' role="note"' : '') + '><b>' +
      (day.status === 'practice' ? '练习编排，未核对原录音' : day.status === 'video' ? '已核对视频题组范围' :
        day.status === 'source' ? 'PDF 原题组' : '按 PDF 题组顺序编排') + '</b><p>' + esc(day.alignment) +
      '</p><p>' + esc(source.file) + ' · 第 ' + day.pages.join('、') + ' 页' +
      (day.groups ? ' · 题组 ' + esc(day.groups.join('、')) : '') + ' · ' + day.items.length + ' 项</p></div>' +
      '<p class="result-meta">自动识别金额、数量和号码；编码逐位读字母与数字，号码重复数字用 double / triple。语音可能回退到浏览器合成。</p>' +
      '<div class="j-toolbar"><button class="btn btn-ghost" data-jselect-all>全选</button>' +
      '<button class="btn btn-ghost" data-jselect-none>清空选择</button>' +
      '<button class="btn btn-primary" data-jstart-selected' + (selected.length ? '' : ' disabled') +
      '>听写所选（' + selected.length + '）</button></div>' +
      '<details class="panel j-number-demo"><summary>自动读法试播</summary>' +
      '<label for="jDemo">输入号码、编码或金额（不加入词库）</label><div class="j-toolbar">' +
      '<input class="input" id="jDemo" value="AC832T" maxlength="128">' +
      '<button class="btn" data-jdemo>试播读法</button></div><output id="jDemoText" aria-live="polite"></output></details>';
    html += '<div class="word-list">' + day.items.map(function (item) {
      var reading = spoken(item);
      var record = saved.records[item.id];
      return '<article class="word-card"><div class="word-head">' +
        '<label class="j-pick"><input type="checkbox" data-jpick="' + item.id + '"' +
          (state.selection[item.id] !== false ? ' checked' : '') + '><span class="word-display">' + esc(item.answer) + '</span></label>' +
        '<span class="wrong-tags">' + esc(item.group || '') + ' · ' + item.part + '</span></div>' +
        '<p class="j-reading">' + esc(reading.kind) + ' · ' + esc(reading.text) + '</p>' +
        '<div class="wrong-actions"><button class="speak-btn" data-jplay="' + item.id + '">播放</button>' +
        '<button class="btn btn-ghost btn-sm" data-jsingle="' + item.id + '">单项听写</button>' +
        '<button class="btn btn-ghost btn-sm" data-jmark="' + item.id + '">' +
          (record && record.wrong && !record.mastered ? '已在机经错词本' : '加入错词本') + '</button></div></article>';
    }).join('') + '</div>';
    html += '<details class="panel"><summary>来源与编排说明</summary><p>' + esc(source.file) +
      '，PDF 第 ' + day.pages.join('、') + ' 页。' + esc(day.alignment) +
      '</p><p>保留重复词、专有名词和来源拼写；专有名词及含数字混合短语的读音仍需结合原资料核对。PDF 题组入口也包含每日范围以外的内容。</p>' +
      '<pre class="j-source">' + esc(day.sourceText) + '</pre></details>';
    app.innerHTML = html;
  }
  function queueIds() {
    if (state.scope === 'wrong') return wrongIds();
    if (state.scope === 'day') return currentDay().items.map(function (item) { return item.id; });
    return selectedIds();
  }
  function start(ids) {
    ids = ids.slice();
    if (!ids.length) { message('请先选择至少一项。'); return; }
    if (state.order === 'random') {
      for (var i = ids.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)); var temp = ids[i]; ids[i] = ids[j]; ids[j] = temp;
      }
    }
    global.VocabAudio.stop();
    state.session = { ids: ids, index: 0, answered: 0, correct: 0, input: '', result: null, finished: false };
    state.pendingPlay = ids[0];
    if (location.hash !== '#/jijing/dictation') location.hash = '#/jijing/dictation';
    else render('dictation');
  }
  function submit() {
    var session = state.session;
    if (!session || session.finished || session.result) return;
    var input = document.getElementById('jAnswer');
    var value = input ? input.value : session.input;
    if (!value.trim()) { if (input) input.focus(); return; }
    if (value.length > 128) { message('每项答案最多输入 128 个字符。'); return; }
    global.VocabAudio.stop();
    var item = items[session.ids[session.index]];
    var result = global.JijingSpeech.check(value, item);
    session.input = value; session.result = result; session.answered++;
    var record = saved.records[item.id] || { attempts: 0, errors: 0 };
    record.attempts++; saved.records[item.id] = record;
    if (result.accepted) { session.correct++; persist(); }
    else markWrong(item.id, result, value);
    render('dictation');
  }
  function renderDictation() {
    var session = state.session;
    if (!session) {
      app.innerHTML = '<h1 class="j-heading">机经听写设置</h1>' + settingsHtml() +
        '<div class="panel j-setup"><label>范围<select class="select" id="jScope">' +
        [['selected', '学习页所选（' + selectedIds().length + '）'], ['day', '当前练习全部'],
          ['wrong', '机经错词本（' + wrongIds().length + '）']].map(function (option) {
          return '<option value="' + option[0] + '"' + (state.scope === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
        }).join('') + '</select></label><label>顺序<select class="select" id="jOrder">' +
        '<option value="sequence"' + (state.order === 'sequence' ? ' selected' : '') + '>原文顺序</option>' +
        '<option value="random"' + (state.order === 'random' ? ' selected' : '') + '>随机</option></select></label>' +
        '<button class="btn btn-primary" data-jstart>开始机经听写</button></div>';
      return;
    }
    if (session.finished) {
      global.VocabAudio.stop();
      app.innerHTML = '<div class="panel"><h1 class="j-heading">机经本轮已结束</h1><p>已答 ' + session.answered +
        ' 题，答对 ' + session.correct + ' 题，未答 ' + (session.ids.length - session.answered) + ' 题。</p>' +
        '<p class="j-score">' + (session.answered ? Math.round(session.correct / session.answered * 100) + '%' : '暂无成绩') +
        '</p><div class="j-toolbar"><button class="btn btn-primary" data-jagain>再练本轮</button>' +
        '<button class="btn" data-jreset>重新设置</button><a class="btn" href="#/jijing/wrong">机经错词本</a></div></div>';
      return;
    }
    var item = items[session.ids[session.index]];
    var day = dayOf[item.id];
    var result = session.result;
    app.innerHTML = '<div class="panel"><div class="quiz-top"><span>第 ' + (session.index + 1) + ' / ' + session.ids.length +
      ' 题 · ' + esc(label(day)) + ' · ' + item.part + '</span><button class="btn btn-ghost btn-sm" data-jend>结束本轮</button></div>' +
      '<p class="result-meta">' + (state.accent === 'uk' ? '英音' : '美音') + ' · ' +
      '自动识别金额、数量和号码；数字答案填写数字，编码按原文填写。</p>' +
      '<button class="btn replay-btn" data-jreplay>重听当前项</button>' +
      (result ? '<div class="result-box ' + (result.accepted ? 'ok' : 'bad') + '"><p>' + esc(result.reasonCn) +
        '</p><div class="highlight-line">' + result.highlightHtml + '</div><p>原文答案：<b>' + esc(item.answer) +
        '</b></p><p>实际读法：' + esc(spoken(item).text) + '</p></div><button class="btn btn-primary" data-jnext>' +
        (session.index + 1 < session.ids.length ? '下一项' : '查看成绩') + '</button>' :
        '<label class="j-answer-label" for="jAnswer">写下听到的词、短语或数字</label>' +
        '<input class="input j-answer" id="jAnswer" maxlength="128" value="' + esc(session.input) +
        '" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<button class="btn btn-primary j-submit" data-jsubmit>提交答案</button>') + '</div>';
    var input = document.getElementById('jAnswer');
    if (input) input.focus();
  }
  function renderWrong() {
    var ids = wrongIds();
    var mastered = Object.keys(saved.records).filter(function (id) { return items[id] && saved.records[id].mastered; });
    app.innerHTML = '<div class="wrong-head"><h1 class="j-heading">机经错词本</h1>' +
      '<button class="btn btn-primary" data-jwrong-start' + (ids.length ? '' : ' disabled') + '>重练全部（' + ids.length + '）</button></div>' +
      (ids.length ? ids.map(function (id) {
        var item = items[id], record = saved.records[id];
        return '<article class="wrong-item"><div class="wrong-item-top"><b>' + esc(item.answer) + '</b><span class="wrong-tags">' +
          esc(label(dayOf[id])) + ' · ' + item.part + ' · ' + (record.errors ? '错 ' + record.errors + ' 次' : '手动标记') + '</span></div>' +
          (record.lastReason ? '<p class="wrong-reason">' + esc(record.lastInput) + ' → ' + esc(item.answer) + '：' + esc(record.lastReason) + '</p>' : '') +
          '<div class="wrong-actions"><button class="speak-btn" data-jplay="' + id + '">播放</button>' +
          '<button class="btn btn-sm" data-jsingle="' + id + '">单项重练</button>' +
          '<button class="btn btn-sm" data-jmaster="' + id + '">已掌握</button></div></article>';
      }).join('') : '<p class="empty-state">还没有机经错词。听写出错会自动收录，也可在学习页手动添加。</p>') +
      (mastered.length ? '<details class="panel"><summary>已掌握（' + mastered.length + '）</summary>' + mastered.map(function (id) {
        return '<div class="j-toolbar"><span>' + esc(items[id].answer) + ' · ' + esc(label(dayOf[id])) +
          '</span><button class="btn btn-sm" data-junmaster="' + id + '">移回错词本</button></div>';
      }).join('') + '</details>' : '');
  }
  function render(view) {
    state.view = ['learn', 'dictation', 'wrong'].indexOf(view) >= 0 ? view : 'learn';
    app.dataset.library = 'jijing';
    if (state.view === 'learn') renderLearn();
    else if (state.view === 'dictation') renderDictation();
    else renderWrong();
    app.insertAdjacentHTML('afterbegin', '<div class="j-playback"><span id="jPlayback" role="status" aria-live="polite">发音就绪</span>' +
      '<button class="btn btn-ghost btn-sm" data-jstop>停止发音</button></div>');
    updateBadge();
    if (unreadable) message('原有机经记录无法读取，本次未覆盖原数据。');
    if (state.view === 'dictation' && state.pendingPlay) {
      var pending = state.pendingPlay;
      state.pendingPlay = null;
      play(items[pending]);
    }
  }

  app.addEventListener('click', function (event) {
    if (app.dataset.library !== 'jijing') return;
    if (event.target.closest('[data-jstop]')) { global.VocabAudio.stop(); return; }
    var target = event.target.closest('[data-jplay]');
    if (target) { play(items[target.dataset.jplay]); return; }
    target = event.target.closest('[data-jsingle]');
    if (target) { start([target.dataset.jsingle]); return; }
    target = event.target.closest('[data-jmark]');
    if (target) { markWrong(target.dataset.jmark); render('learn'); return; }
    target = event.target.closest('[data-jselect-all], [data-jselect-none]');
    if (target) {
      var select = target.hasAttribute('data-jselect-all');
      currentDay().items.forEach(function (item) { state.selection[item.id] = select; });
      render('learn'); return;
    }
    if (event.target.closest('[data-jstart-selected]')) { start(selectedIds()); return; }
    if (event.target.closest('[data-jstart]')) { start(queueIds()); return; }
    if (event.target.closest('[data-jwrong-start]')) { start(wrongIds()); return; }
    if (event.target.closest('[data-jsubmit]')) { submit(); return; }
    if (event.target.closest('[data-jreplay]')) {
      if (state.session && !state.session.finished) play(items[state.session.ids[state.session.index]]);
      return;
    }
    if (event.target.closest('[data-jnext]')) {
      var session = state.session;
      if (!session || !session.result) return;
      global.VocabAudio.stop(); session.index++; session.input = ''; session.result = null;
      session.finished = session.index >= session.ids.length;
      render('dictation');
      if (!session.finished) play(items[session.ids[session.index]]);
      return;
    }
    if (event.target.closest('[data-jend]')) {
      if (state.session) state.session.finished = true;
      render('dictation'); return;
    }
    if (event.target.closest('[data-jagain]')) { start(state.session.ids); return; }
    if (event.target.closest('[data-jreset]')) { state.session = null; render('dictation'); return; }
    target = event.target.closest('[data-jmaster], [data-junmaster]');
    if (target) {
      var id = target.dataset.jmaster || target.dataset.junmaster;
      saved.records[id].mastered = !!target.dataset.jmaster;
      persist(); render('wrong'); return;
    }
    if (event.target.closest('[data-jdemo]')) {
      var value = document.getElementById('jDemo').value.trim();
      if (!/\d/.test(value) || value.length > 128 || /[<>]/.test(value)) { message('请输入含数字的号码、编码或金额，最多 128 个字符。'); return; }
      var reading = global.JijingSpeech.forAnswer(value);
      document.getElementById('jDemoText').textContent = value + ' → ' + reading.text + '（自动识别：' + reading.kind + '）';
      playText(reading.text);
    }
  });
  app.addEventListener('change', function (event) {
    if (app.dataset.library !== 'jijing') return;
    var target = event.target;
    if (target.matches('[data-jpick]')) {
      state.selection[target.dataset.jpick] = target.checked;
      var startButton = app.querySelector('[data-jstart-selected]');
      var count = selectedIds().length;
      startButton.disabled = !count; startButton.textContent = '听写所选（' + count + '）';
      return;
    }
    if (target.id === 'jDay') state.day = /^\d+$/.test(target.value) ? Number(target.value) : target.value;
    else if (target.id === 'jAccent') state.accent = target.value;
    else if (target.id === 'jScope') state.scope = target.value;
    else if (target.id === 'jOrder') state.order = target.value;
    else return;
    persist(); render(state.view);
  });
  app.addEventListener('input', function (event) {
    if (event.target.id === 'jAnswer' && state.session) state.session.input = event.target.value;
  });
  app.addEventListener('keydown', function (event) {
    if (event.target.id === 'jAnswer' && event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(); }
  });
  document.addEventListener('vocab-audio-state', function (event) {
    if (app.dataset.library !== 'jijing') return;
    var status = document.getElementById('jPlayback');
    if (status) status.textContent = event.detail.playing ? '正在加载发音…' : '发音已结束或停止';
  });
  document.addEventListener('vocab-audio-started', function (event) {
    if (app.dataset.library !== 'jijing') return;
    var status = document.getElementById('jPlayback');
    if (status) {
      status.textContent = event.detail.channel === 'online' ? '正在播放词典发音…' : '正在播放浏览器语音…';
      status.dataset.starts = String(Number(status.dataset.starts || 0) + 1);
    }
  });
  global.JijingApp = { render: render };
})(window);
