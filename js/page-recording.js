/* Original whole-page recordings. Native controls keep seeking/volume accessible. */
(function (global) {
  'use strict';
  var audio = null, page = null, generation = 0, host = null, metadata = null, notice = null, retry = null;
  var phase = 'ready';

  function durationText(seconds) {
    var total = Math.floor(seconds || 0);
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }
  function entryFor(number) {
    return ((global.PAGE_RECORDINGS || {}).pages || []).filter(function (entry) {
      return entry.page === number;
    })[0];
  }
  function update(next) {
    phase = next;
    if (!host) return;
    host.dataset.recordingState = phase;
    var entry = entryFor(page);
    if (metadata && entry) metadata.textContent = 'p' + page + ' · ' + durationText(entry.duration) +
      (phase === 'playing' ? ' · 播放中' : phase === 'loading' ? ' · 加载中' :
        phase === 'paused' ? ' · 已暂停' : phase === 'ended' ? ' · 已结束' : '');
    if (notice) {
      notice.hidden = phase !== 'error';
      notice.textContent = phase === 'error' ? '整页录音暂时无法播放，请检查网络后重新加载。' : '';
    }
    if (retry) retry.hidden = phase !== 'error';
  }
  function pause() {
    if (audio && !audio.paused) audio.pause();
  }
  function unmount() {
    generation++;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audio = null; page = null; host = null; metadata = null; notice = null; retry = null;
    phase = 'ready';
  }
  function mount(container, number) {
    if (!container) { unmount(); return; }
    var entry = entryFor(number);
    if (!entry) {
      unmount();
      container.textContent = '本页暂无整页录音';
      return;
    }
    if (page !== number || !audio) {
      unmount();
      page = number;
      var version = generation;
      audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = entry.src;
      audio.dataset.pageRecording = String(number);
      audio.setAttribute('aria-label', '第 ' + number + ' 页完整录音');
      function active() { return version === generation; }
      audio.addEventListener('play', function () {
        if (!active()) return;
        if (global.VocabAudio) global.VocabAudio.stop();
        update('loading');
      });
      audio.addEventListener('playing', function () { if (active()) update('playing'); });
      audio.addEventListener('waiting', function () { if (active()) update('loading'); });
      audio.addEventListener('pause', function () { if (active() && phase !== 'error') update('paused'); });
      audio.addEventListener('ended', function () { if (active()) update('ended'); });
      audio.addEventListener('error', function () { if (active()) update('error'); });
    }
    // Reuse the element across same-page card updates, preserving playback and seek position.
    host = container;
    host.className = 'page-recording';
    var caption = document.createElement('div');
    caption.className = 'page-recording-caption';
    var label = document.createElement('strong');
    label.textContent = '整页录音';
    metadata = document.createElement('span');
    caption.append(label, metadata);
    notice = document.createElement('span');
    notice.className = 'page-recording-error';
    notice.setAttribute('role', 'status');
    retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'btn btn-ghost btn-sm'; retry.textContent = '重新加载';
    var current = audio, retryVersion = generation;
    retry.addEventListener('click', function () {
      if (retryVersion !== generation || current !== audio) return;
      update('loading');
      current.load();
      current.play().catch(function () { if (retryVersion === generation) update('error'); });
    });
    host.replaceChildren(caption, audio, notice, retry);
    update(phase);
  }
  document.addEventListener('vocab-audio-state', function (event) {
    if (event.detail && event.detail.playing) pause();
  });
  global.addEventListener('pagehide', pause);
  global.PageRecording = { mount: mount, unmount: unmount, pause: pause };
})(window);
