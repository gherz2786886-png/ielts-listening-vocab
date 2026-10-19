/* VocabAudio: one interruptible pronunciation channel; classic script. */
(function (global) {
  'use strict';
  var CANPLAY_TIMEOUT_MS = 10000;
  var TTS_RACE_MS = 600;
  var state = {
    audio: null, utter: null, timer: null, voiceTimer: null,
    voiceCleanup: null, serial: 0, current: null, pending: null
  };

  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }
  function setCurrent(text, accent, playing) {
    state.current = playing ? { text: text, accent: accent, playing: true } : null;
    emit('vocab-audio-state', { text: text, accent: accent, playing: playing });
  }
  function clearTimer() {
    if (state.timer !== null) clearTimeout(state.timer);
    state.timer = null;
  }
  function clearVoiceWait() {
    if (state.voiceTimer !== null) clearTimeout(state.voiceTimer);
    state.voiceTimer = null;
    if (state.voiceCleanup) state.voiceCleanup();
    state.voiceCleanup = null;
  }
  function releaseAudio() {
    if (!state.audio) return;
    var audio = state.audio;
    state.audio = null;
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch (e) {}
  }
  function teardown() {
    // Invalidate callbacks before cancel() can dispatch old media/TTS events.
    state.serial++;
    clearTimer();
    clearVoiceWait();
    releaseAudio();
    if (global.speechSynthesis) {
      try { global.speechSynthesis.cancel(); } catch (e) {}
    }
    state.utter = null;
    if (state.pending) {
      var resolve = state.pending.resolve;
      state.pending = null;
      resolve();
    }
  }
  function pickVoice(lang) {
    var voices = [];
    try { voices = global.speechSynthesis.getVoices() || []; } catch (e) {}
    var exact = voices.filter(function (v) {
      return (v.lang || '').toLowerCase().indexOf(lang.toLowerCase()) === 0;
    });
    return exact[0] || voices.filter(function (v) {
      return /^en(?:-|$)/i.test(v.lang || '');
    })[0] || null;
  }
  function urlFor(text, accent) {
    // https://dict.youdao.com/w/eng/tomato/ : ec.uk.voice=1, ec.us.voice=2.
    return 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) +
      '&type=' + (accent === 'us' ? 2 : 1);
  }
  function supported() {
    return {
      onlineAudio: typeof global.Audio === 'function',
      tts: !!(global.speechSynthesis && typeof global.SpeechSynthesisUtterance === 'function')
    };
  }
  function preload(text) {
    try {
      ['uk', 'us'].forEach(function (accent) {
        var audio = new global.Audio(urlFor(text, accent));
        audio.preload = 'auto';
        audio.load();
      });
    } catch (e) {}
  }
  function stop() {
    var current = state.current;
    teardown();
    if (current) setCurrent(current.text, current.accent, false);
  }
  function play(text, accent, opts) {
    opts = opts || {};
    accent = accent === 'us' ? 'us' : 'uk';
    teardown();
    var serial = state.serial;
    setCurrent(text, accent, true);
    return new Promise(function (resolve, reject) {
      var settled = false;
      var mainSettled = false;
      function active() { return !settled && serial === state.serial; }
      state.pending = { resolve: function () { settled = true; resolve(); } };
      function finish(error) {
        if (!active()) return;
        settled = true;
        clearTimer();
        clearVoiceWait();
        state.pending = null;
        state.utter = null;
        releaseAudio();
        setCurrent(text, accent, false);
        var callback = error ? opts.onError : opts.onEnd;
        if (error) emit('vocab-audio-error', { text: text, accent: accent, message: error.message });
        try { if (typeof callback === 'function') callback(error); } catch (e) {}
        if (error) reject(error); else resolve();
      }
      function fallbackToTTS(reason) {
        if (!active() || mainSettled) return;
        mainSettled = true;
        clearTimer();
        releaseAudio();
        emit('vocab-audio-fallback', { text: text, accent: accent, reason: reason });
        try { if (typeof opts.onFallback === 'function') opts.onFallback(reason); } catch (e) {}
        if (!supported().tts) { finish(new Error('speechSynthesis unavailable')); return; }
        try {
          var synth = global.speechSynthesis;
          var utter = new global.SpeechSynthesisUtterance(text);
          utter.lang = accent === 'uk' ? 'en-GB' : 'en-US';
          utter.rate = 0.95;
          state.utter = utter;
          utter.onend = function () { finish(); };
          utter.onerror = function (event) {
            if (!active()) return;
            finish(new Error('tts error: ' + (event && event.error)));
          };
          var started = false;
          function start() {
            if (!active() || started) return;
            started = true;
            clearVoiceWait();
            var voice = pickVoice(utter.lang);
            if (voice) utter.voice = voice;
            try { synth.speak(utter); } catch (error) { finish(error); }
          }
          var voices = synth.getVoices() || [];
          if (!voices.length) {
            if (typeof synth.addEventListener === 'function') {
              synth.addEventListener('voiceschanged', start);
              state.voiceCleanup = function () { synth.removeEventListener('voiceschanged', start); };
            }
            state.voiceTimer = setTimeout(start, TTS_RACE_MS);
          } else start();
        } catch (error) { finish(error); }
      }
      var audio;
      try { audio = new global.Audio(urlFor(text, accent)); }
      catch (error) { fallbackToTTS('audio-ctor-failed'); return; }
      state.audio = audio;
      audio.preload = 'auto';
      audio.addEventListener('error', function () {
        fallbackToTTS('audio-error-' + (audio.error ? audio.error.code : 'unknown'));
      });
      audio.addEventListener('playing', function () {
        if (active() && !mainSettled) clearTimer();
      });
      audio.addEventListener('ended', function () {
        if (!active() || mainSettled) return;
        mainSettled = true;
        finish();
      });
      state.timer = setTimeout(function () { fallbackToTTS('timeout'); }, CANPLAY_TIMEOUT_MS);
      try {
        var pending = audio.play();
        if (pending && typeof pending.catch === 'function') {
          pending.catch(function () { fallbackToTTS('play-rejected'); });
        }
      } catch (error) { fallbackToTTS('play-threw'); }
    });
  }
  global.VocabAudio = {
    urlFor: urlFor, play: play, stop: stop, preload: preload, supported: supported,
    get current() { return state.current; }
  };
})(window);
