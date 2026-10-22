'use strict';

// Deterministic public-API regressions. No network, speakers, or browser storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8');

function createEnvironment(options = {}) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const audios = [];
  const spoken = [];
  const events = [];
  const voiceListeners = new Set();
  const synth = {
    onvoiceschanged: null,
    getVoices: () => options.voices || [],
    cancel() {},
    speak(utterance) { spoken.push(utterance); if (!options.noSpeechStart && utterance.onstart) utterance.onstart(); },
    addEventListener(type, fn) { if (type === 'voiceschanged') voiceListeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'voiceschanged') voiceListeners.delete(fn); }
  };
  class MockAudio {
    constructor(url) {
      this.src = url;
      this.handlers = {};
      this.playCalls = 0;
      this.pauseCalls = 0;
      this.loadCalls = 0;
      audios.push(this);
    }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    emit(type) { for (const fn of this.handlers[type] || []) fn(); }
    play() {
      this.playCalls++;
      if (options.playThrows) throw new Error('Playback failed synchronously');
      return options.playRejects ? Promise.reject(new Error('Playback rejected')) : Promise.resolve();
    }
    pause() { this.pauseCalls++; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() { this.loadCalls++; }
  }
  const sandbox = {
    Audio: MockAudio,
    SpeechSynthesisUtterance: function (text) { this.text = text; },
    speechSynthesis: synth,
    document: { dispatchEvent(event) { events.push(event); } },
    CustomEvent: function (type, options) { this.type = type; this.detail = options.detail; },
    setTimeout(fn, delay) {
      const id = ++nextId;
      timers.set(id, { at: now + delay, fn });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  sandbox.window = sandbox;
  if (options.speechUnavailable) { delete sandbox.speechSynthesis; delete sandbox.SpeechSynthesisUtterance; }
  vm.runInNewContext(source, sandbox, { filename: 'audio.js' });
  return {
    api: sandbox.VocabAudio, audios, spoken, events, synth,
    tick(ms) {
      const end = now + ms;
      let loops = 0;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        assert.ok(++loops < 100, 'Timer execution must remain bounded');
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
    voicesChanged() {
      if (synth.onvoiceschanged) synth.onvoiceschanged();
      for (const fn of [...voiceListeners]) fn();
    }
  };
}

const tests = [
  ['a hosted complete recording plays once and reports its actual recording channel', async () => {
    const env = createEnvironment();
    const pending = env.api.play('the first of August', 'us', { url: 'audio/jijing/date-us.mp3', channel: 'recording' });
    assert.equal(env.audios.length, 1);
    assert.equal(env.audios[0].src, 'audio/jijing/date-us.mp3');
    env.audios[0].emit('playing');
    assert.equal(env.events.find(e => e.type === 'vocab-audio-started').detail.channel, 'recording');
    assert.equal(env.spoken.length, 0);
    env.audios[0].emit('ended'); await pending;
  }],
  ['speech ending without a start is reported as failure instead of successful playback', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-US' }], noSpeechStart: true });
    const pending = env.api.play('the first of August', 'us', { speechOnly: true }).catch(error => error);
    env.spoken[0].onend();
    assert.match((await pending).message, /ended before playback started/);
    assert.equal(env.events.filter(e => e.type === 'vocab-audio-started').length, 0);
    assert.equal(env.events.filter(e => e.type === 'vocab-audio-error').length, 1);
  }],
  ['a date is one complete English utterance without dictionary clips or a fallback warning', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-US', name: 'US English' }] });
    const pending = env.api.play('the first of August', 'us', { speechOnly: true });
    assert.equal(env.audios.length, 0);
    assert.equal(env.spoken.length, 1);
    assert.equal(env.spoken[0].text, 'the first of August');
    assert.equal(env.spoken[0].lang, 'en-US');
    assert.equal(env.spoken[0].voice.name, 'US English');
    assert.equal(env.events.filter(e => e.type === 'vocab-audio-fallback').length, 0);
    assert.equal(env.events.filter(e => e.type === 'vocab-audio-started').length, 1);
    env.spoken[0].onend(); await pending;
    assert.equal(env.api.current, null);
  }],
  ['code and double/triple readouts stay together in one utterance', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-GB' }] });
    const pending = env.api.play('A C eight double three T', 'uk', { speechOnly: true });
    assert.equal(env.audios.length, 0);
    assert.equal(env.spoken[0].text, 'A C eight double three T');
    assert.equal(env.spoken[0].lang, 'en-GB');
    env.spoken[0].onend(); await pending;
  }],
  ['stop before phrase voices are ready prevents delayed speech', async () => {
    const env = createEnvironment();
    const pending = env.api.play('back door', 'uk', { speechOnly: true });
    assert.equal(env.audios.length, 0);
    env.api.stop(); env.tick(10000); env.voicesChanged(); await pending;
    assert.equal(env.spoken.length, 0);
    assert.equal(env.api.current, null);
  }],
  ['continuous speech with no start event fails within five seconds', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-GB' }], noSpeechStart: true });
    const pending = env.api.play('twenty-five thousand dollars', 'uk', { speechOnly: true }).catch(error => error);
    assert.equal(env.audios.length, 0);
    env.tick(5000);
    assert.match((await pending).message, /did not start/);
    assert.equal(env.api.current, null);
  }],
  ['unavailable continuous speech reports failure without silently spelling words separately', async () => {
    const env = createEnvironment({ speechUnavailable: true });
    const pending = env.api.play('the first of August', 'uk', { speechOnly: true }).catch(error => error);
    assert.equal(env.audios.length, 0);
    const error = await pending;
    assert.match(error.message, /speechSynthesis unavailable/);
    assert.equal(env.api.current, null);
  }],
  ['missing browser speech start fails within a bounded time', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-GB' }], noSpeechStart: true });
    const pending = env.api.play('unknown name', 'uk').catch(error => error);
    env.audios[0].emit('error');
    env.tick(5000);
    const error = await pending;
    assert.match(error.message, /did not start/);
    assert.equal(env.api.current, null);
  }],
  ['browser speech without an end event also times out', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-GB' }] });
    const pending = env.api.play('unknown name', 'uk').catch(error => error);
    env.audios[0].emit('error');
    env.tick(30000);
    const error = await pending;
    assert.match(error.message, /timed out/);
    assert.equal(env.api.current, null);
  }],
  ['a sequence plays double then three in order', async () => {
    const env = createEnvironment();
    const pending = env.api.playSequence(['double', 'three'], 'uk');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(env.audios.length, 1);
    assert.equal(new URL(env.audios[0].src).searchParams.get('audio'), 'double');
    env.audios[0].emit('ended');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(env.audios.length, 2);
    assert.equal(new URL(env.audios[1].src).searchParams.get('audio'), 'three');
    env.audios[1].emit('ended');
    await pending;
  }],
  ['stop before a sequence starts prevents every word', async () => {
    const env = createEnvironment();
    const pending = env.api.playSequence(['double', 'three'], 'uk');
    env.api.stop();
    await pending;
    assert.equal(env.audios.length, 0);
  }],
  ['stop between words prevents the following word', async () => {
    const env = createEnvironment();
    const pending = env.api.playSequence(['double', 'three'], 'uk');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    env.audios[0].emit('ended');
    env.api.stop();
    await pending;
    assert.equal(env.audios.length, 1);
  }],
  ['new single playback cancels the old sequence without a completion callback', async () => {
    const env = createEnvironment();
    let ended = 0;
    const old = env.api.playSequence(['double', 'three'], 'uk', { onEnd() { ended++; } });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const newer = env.api.play('blue', 'us');
    env.audios[1].emit('ended');
    await Promise.all([old, newer]);
    assert.equal(env.audios.length, 2);
    assert.equal(ended, 0);
  }],
  ['official Youdao UK/US mapping and encoded phrases', () => {
    const { api } = createEnvironment();
    // Primary evidence: https://dict.youdao.com/w/eng/tomato/
    // ec.uk.voice uses data-rel="tomato&type=1"; ec.us.voice uses type=2.
    assert.equal(new URL(api.urlFor('tomato', 'uk')).searchParams.get('type'), '1');
    assert.equal(new URL(api.urlFor('tomato', 'us')).searchParams.get('type'), '2');
    assert.equal(new URL(api.urlFor("driver's license & permit", 'uk')).searchParams.get('audio'), "driver's license & permit");
  }],
  ['preload fetches both accents without starting playback', () => {
    const env = createEnvironment();
    env.api.preload('tomato');
    assert.equal(env.audios.length, 2);
    assert.equal(env.audios.reduce((n, audio) => n + audio.playCalls, 0), 0);
    assert.ok(env.audios.every(audio => audio.loadCalls === 1));
    assert.equal(env.api.current, null);
  }],
  ['stop cancels a delayed TTS start and resolves the pending play', async () => {
    const env = createEnvironment();
    let ended = 0;
    const pending = env.api.play('first', 'uk', { onEnd() { ended++; } });
    env.audios[0].emit('error');
    env.api.stop();
    env.tick(1000);
    env.voicesChanged();
    await pending;
    assert.equal(env.spoken.length, 0);
    assert.equal(ended, 0, 'Stopping must not report natural completion');
    assert.equal(env.api.current, null);
  }],
  ['a new play invalidates the older fallback timer and voice listener', async () => {
    const env = createEnvironment();
    const oldPlay = env.api.play('first', 'uk');
    env.audios[0].emit('error');
    const newPlay = env.api.play('second', 'us');
    env.tick(1000);
    env.voicesChanged();
    assert.equal(env.spoken.length, 0);
    assert.equal(env.api.current.text, 'second');
    env.api.stop();
    await Promise.all([oldPlay, newPlay]);
  }],
  ['timeout fallback releases the original audio before speaking', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-GB' }] });
    const pending = env.api.play('tomato', 'uk');
    const main = env.audios[0];
    env.tick(10000);
    assert.ok(main.pauseCalls >= 1);
    assert.equal(main.src, '');
    assert.equal(env.spoken.length, 1);
    assert.equal(env.spoken[0].lang, 'en-GB');
    const fallback = env.events.filter(event => event.type === 'vocab-audio-fallback');
    assert.equal(fallback.length, 1);
    assert.equal(fallback[0].detail.reason, 'timeout');
    env.spoken[0].onend();
    await pending;
  }],
  ['a stale audio canplay event cannot cancel the next playback watchdog', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-US' }] });
    const first = env.api.play('first', 'uk');
    const stale = env.audios[0];
    const second = env.api.play('second', 'us');
    stale.emit('canplay');
    env.tick(10000);
    assert.equal(env.spoken.length, 1);
    assert.equal(env.spoken[0].text, 'second');
    env.spoken[0].onend();
    await Promise.all([first, second]);
  }],
  ['canplay without actual playback keeps a startup timeout', async () => {
    const env = createEnvironment({ voices: [{ lang: 'en-GB' }] });
    const pending = env.api.play('tomato', 'uk');
    env.audios[0].emit('canplay');
    env.tick(10000);
    assert.equal(env.spoken.length, 1);
    env.spoken[0].onend();
    await pending;
  }],
  ['actual playback clears the startup timeout and ends once', async () => {
    const env = createEnvironment();
    let ended = 0;
    const pending = env.api.play('long phrase', 'uk', { onEnd() { ended++; } });
    env.audios[0].emit('playing');
    env.tick(15000);
    assert.equal(env.spoken.length, 0);
    env.audios[0].emit('ended');
    env.audios[0].emit('ended');
    await pending;
    assert.equal(ended, 1);
    assert.equal(env.api.current, null);
  }],
  ['synchronous play failure falls back immediately', async () => {
    const env = createEnvironment({ playThrows: true, voices: [{ lang: 'en-US' }] });
    const pending = env.api.play('tomato', 'us');
    assert.equal(env.spoken.length, 1);
    env.spoken[0].onend();
    await pending;
  }],
  ['competing media failures start only one fallback', async () => {
    const env = createEnvironment({ playRejects: true, voices: [{ lang: 'en-GB' }] });
    let fallbacks = 0;
    const pending = env.api.play('tomato', 'uk', { onFallback() { fallbacks++; } });
    env.audios[0].emit('error');
    await Promise.resolve();
    env.tick(15000);
    assert.equal(env.spoken.length, 1);
    assert.equal(fallbacks, 1);
    env.spoken[0].onend();
    await pending;
  }],
  ['voice readiness preserves existing listeners and selects the loaded voice', async () => {
    const voices = [];
    const env = createEnvironment({ voices });
    let externalCalls = 0;
    const externalListener = () => externalCalls++;
    env.synth.onvoiceschanged = externalListener;
    const pending = env.api.play('tomato', 'us');
    env.audios[0].emit('error');
    const voice = { lang: 'en-US' };
    voices.push(voice);
    env.voicesChanged();
    env.tick(1000);
    assert.equal(externalCalls, 1);
    assert.equal(env.spoken.length, 1);
    assert.equal(env.spoken[0].voice, voice);
    assert.equal(env.synth.onvoiceschanged, externalListener);
    env.spoken[0].onend();
    await pending;
  }]
];

(async () => {
  let failed = 0;
  for (const [name, test] of tests) {
    let deadline;
    try {
      await Promise.race([test(), new Promise((_, reject) => {
        deadline = setTimeout(() => reject(new Error('Regression did not settle within five seconds')), 5000);
      })]);
      console.log('PASS ' + name);
    } catch (error) {
      failed++;
      console.error('FAIL ' + name + '\n  ' + error.message);
    } finally { clearTimeout(deadline); }
  }
  console.log(`${tests.length - failed}/${tests.length} audio regressions passed`);
  process.exitCode = failed ? 1 : 0;
})();
