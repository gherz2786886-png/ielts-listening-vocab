/*!
 * VocabAudio — 雅思听力词汇发音模块
 * 经典脚本（无 ES module / 无外部库），加载后挂 window.VocabAudio。
 *
 * 主通道：有道真人发音 dictvoice（type=2 英音 / type=1 美音），用 <audio> 直放。
 * 回退通道：window.speechSynthesis（en-GB / en-US）。
 * 全局唯一音频通道：新 play() 必停上一次；快速连点不叠音。
 */
(function (global) {
  'use strict';

  // ---- 可调参数 ----
  var CANPLAY_TIMEOUT_MS = 10000; // 主通道：canplay/播放 超时
  var TTS_RACE_MS = 600;          // TTS 启动检测超时（找不到 voice 也照播）

  // ---- 内部状态 ----
  var state = {
    audio: null,        // 当前 Audio 实例
    utter: null,        // 当前 SpeechSynthesisUtterance
    timer: null,        // 主通道超时 timer
    stopped: false,     // 是否由 stop() 主动中止（不算错误）
    fallback: false,    // 当前播放是否走了回退通道
    current: null,      // {text, accent, playing}
    pending: null       // 当前在飞 Promise 的 {resolve, reject, settled}
  };

  // ---- 工具 ----
  function clearTimer() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function setCurrent(text, accent, playing) {
    state.current = playing ? { text: text, accent: accent, playing: true }
                            : null;
    try {
      document.dispatchEvent(new CustomEvent('vocab-audio-state', {
        detail: { text: text, accent: accent, playing: playing }
      }));
    } catch (e) { /* file:// / 老浏览器容错 */ }
  }

  /** 完全清理上一次播放（Audio + TTS），并把在飞 Promise 以"停止"语义收尾 */
  function teardown() {
    clearTimer();
    // 收尾在飞 Promise：被打断/被新播放顶替都算正常停止，不报错
    if (state.pending) {
      var r = state.pending.resolve;
      state.pending = null;
      try { r(); } catch (e) {}
    }
    if (state.audio) {
      try {
        state.audio.pause();
        state.audio.removeAttribute('src');
        state.audio.load();
      } catch (e) {}
      state.audio = null;
    }
    if (global.speechSynthesis) {
      try { global.speechSynthesis.cancel(); } catch (e) {}
    }
    state.utter = null;
  }

  /** 选 voice：按 lang 前缀匹配，找不到返回 null */
  function pickVoice(lang) {
    if (!global.speechSynthesis) return null;
    var voices = [];
    try { voices = global.speechSynthesis.getVoices() || []; } catch (e) {}
    if (!voices.length) return null;
    var prefix = lang.toLowerCase(); // 'en-gb' / 'en-us'
    var exact = voices.filter(function (v) {
      return (v.lang || '').toLowerCase().indexOf(prefix) === 0;
    });
    if (exact.length) return exact[0];
    // 退化：任意 en-*
    return voices.filter(function (v) {
      return (v.lang || '').toLowerCase().indexOf('en') === 0;
    })[0] || null;
  }

  // ---- 公开 API ----

  /**
   * 生成有道发音 URL。
   * @param {string} text 词/短语
   * @param {'uk'|'us'} accent uk→type=2（英音），us→type=1（美音）
   * @returns {string}
   */
  function urlFor(text, accent) {
    var type = (accent === 'us') ? 1 : 2;
    return 'https://dict.youdao.com/dictvoice?audio=' +
      encodeURIComponent(text) + '&type=' + type;
  }

  /**
   * 能力探测
   * @returns {{onlineAudio:boolean, tts:boolean}}
   */
  function supported() {
    return {
      onlineAudio: typeof global.Audio === 'function',
      tts: !!(global.speechSynthesis && typeof SpeechSynthesisUtterance === 'function')
    };
  }

  /**
   * 预取某词的英/美 URL（new Audio 预加载，失败静默）。
   * @param {string} text
   */
  function preload(text) {
    try {
      ['uk', 'us'].forEach(function (acc) {
        var a = new Audio(urlFor(text, acc));
        a.preload = 'auto';
        // 不播放，仅触发浏览器缓存
        var p = a.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () { /* 静默 */ });
        }
        setTimeout(function () { try { a.pause(); } catch (e) {} }, 0);
      });
    } catch (e) { /* 静默 */ }
  }

  /** 立即停止一切播放，复位状态。 */
  function stop() {
    state.stopped = true;
    teardown();
    if (state.current) {
      var cur = state.current;
      setCurrent(cur.text, cur.accent, false);
    }
  }

  /**
   * 播放某个词。返回 Promise：成功结束 resolve；主动 stop() 触发的中止也 resolve（不算错误）；
   * 主通道失败时自动回退 TTS；TTS 也失败才 reject。
   *
   * @param {string} text
   * @param {'uk'|'us'} accent
   * @param {{onEnd?:Function, onError?:Function, onFallback?:Function}} [opts]
   * @returns {Promise<void>}
   */
  function play(text, accent, opts) {
    opts = opts || {};
    accent = (accent === 'us') ? 'us' : 'uk';

    // 新播放：先停掉上一次（无论英音美音）
    state.stopped = false;
    state.fallback = false;
    teardown();

    setCurrent(text, accent, true);

    return new Promise(function (resolve, reject) {
      var settled = false;
      // 登记到 state.pending，供 teardown()/stop() 收尾在飞 Promise
      state.pending = {
        settled: false,
        resolve: function () {
          if (settled) return;
          settled = true;
          state.pending = null;
          resolve();
        },
        reject: function (err) {
          if (settled) return;
          settled = true;
          state.pending = null;
          reject(err);
        }
      };
      function done() {
        if (settled) return;
        settled = true;
        clearTimer();
        setCurrent(text, accent, false);
        if (typeof opts.onEnd === 'function') opts.onEnd();
        state.pending = null;
        resolve();
      }
      function fail(err) {
        if (settled) return;
        settled = true;
        clearTimer();
        setCurrent(text, accent, false);
        if (state.stopped) {
          // 主动停止不算错误
          state.pending = null;
          resolve();
          return;
        }
        if (typeof opts.onError === 'function') opts.onError(err);
        state.pending = null;
        reject(err);
      }

      // ---- 回退：TTS ----
      function fallbackToTTS(reason) {
        if (state.stopped || settled) return;
        state.fallback = true;
        if (typeof opts.onFallback === 'function') {
          try { opts.onFallback(reason || 'main-channel-failed'); } catch (e) {}
        }
        if (!global.speechSynthesis) {
          fail(new Error('speechSynthesis unavailable'));
          return;
        }
        try {
          global.speechSynthesis.cancel(); // 清掉残留
          var utter = new SpeechSynthesisUtterance(text);
          utter.lang = (accent === 'uk') ? 'en-GB' : 'en-US';
          var v = pickVoice(utter.lang);
          if (v) utter.voice = v;
          utter.rate = 0.95;
          state.utter = utter;

          var ttsDone = false;
          utter.onend = function () {
            if (ttsDone) return; ttsDone = true; done();
          };
          utter.onerror = function (ev) {
            if (ttsDone) return; ttsDone = true;
            // cancelled 视为正常停止
            if (ev && ev.error === 'canceled') { done(); return; }
            fail(new Error('tts error: ' + (ev && ev.error)));
          };
          // 部分浏览器 getVoices 异步，先触发 voiceschanged 再播
          var started = false;
          function start() {
            if (started) return; started = true;
            try { global.speechSynthesis.speak(utter); }
            catch (e) { fail(e); }
          }
          if (typeof global.speechSynthesis.onvoiceschanged !== 'undefined' &&
              !global.speechSynthesis.getVoices().length) {
            global.speechSynthesis.onvoiceschanged = start;
            setTimeout(start, TTS_RACE_MS); // 兜底
          } else {
            start();
          }
        } catch (e) {
          fail(e);
        }
      }

      // ---- 主通道：Audio ----
      var url;
      try {
        url = urlFor(text, accent);
      } catch (e) {
        fallbackToTTS('url-encode-failed');
        return;
      }

      var audio;
      try {
        audio = new Audio(url);
      } catch (e) {
        fallbackToTTS('audio-ctor-failed');
        return;
      }
      state.audio = audio;
      audio.preload = 'auto';

      var mainSettled = false;
      function mainFail(reason) {
        if (mainSettled) return;
        mainSettled = true;
        fallbackToTTS(reason);
      }

      audio.addEventListener('error', function () {
        // MEDIA_ERR_SRC_NOT_SUPPORTED / NETWORK / DECODED → 回退
        mainFail('audio-error-' + (audio.error ? audio.error.code : 'unknown'));
      });
      audio.addEventListener('ended', function () {
        if (mainSettled) return;
        mainSettled = true;
        done();
      });
      audio.addEventListener('canplay', function () {
        clearTimer();
      });

      // 启动播放 + 超时看门狗
      var p;
      try { p = audio.play(); } catch (e) { p = null; }
      if (p && typeof p.then === 'function') {
        p.catch(function (err) {
          // NotAllowedError / 网络 / 解码 → 回退
          mainFail('play-rejected');
        });
      }

      state.timer = setTimeout(function () {
        mainFail('timeout');
      }, CANPLAY_TIMEOUT_MS);
    });
  }

  // ---- 暴露 ----
  var VocabAudio = {
    urlFor: urlFor,
    play: play,
    stop: stop,
    preload: preload,
    supported: supported,
    /** 当前播放状态 {text, accent, playing} | null */
    get current() { return state.current; }
  };

  global.VocabAudio = VocabAudio;
})(window);
