'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({}); context.window = context;
for (const file of ['js/dictation.js', 'data/feedback-lexicon.js', 'js/dictation-feedback.js', 'js/jijing-speech.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
let count = 0;
function test(name, run) { run(); count++; console.log('PASS ' + name); }
function feedback(input, answer, options) { return context.DictationFeedback.build(input, answer, null, options); }
test('date versus an unrelated word is a complete mismatch, not letter substitutions', () => {
  const result = feedback('although', '1 August', { kind: '日期' });
  assert.equal(result.level, 'answer'); assert.match(result.summary, /日期/); assert.doesNotMatch(result.summary, /把|字母/);
  assert.match(result.inputHtml, />although<\/span>/);
});
test('a one-letter spelling mistake keeps fine-grained red correction and original case', () => {
  const result = feedback('27 Apeil', '27 April', { kind: '日期' });
  assert.equal(result.level, 'letters'); assert.match(result.inputHtml, /27 Ap<span[^>]*>e<\/span>il/);
  assert.match(result.details.join(''), /r.*e/);
});
test('double and omitted letters use markers instead of inserting answer letters into input', () => {
  const result = feedback('Accomodation', 'accommodation');
  assert.equal(result.level, 'letters'); assert.match(result.inputHtml, /^Acco/); assert.match(result.inputHtml, /feedback-missing/);
  assert.equal(result.inputHtml.replace(/<span[^>]*>⌃<\/span>/g, ''), 'Accomodation');
  assert.doesNotMatch(result.inputHtml, /<u>m<\/u>/);
});
test('near-word transposition retains letter-level correction', () => {
  assert.equal(feedback('form', 'from').level, 'letters');
});
test('phrase alignment marks only the substituted word and preserves the common word', () => {
  const result = feedback('hot drinks', 'cold drinks');
  assert.equal(result.level, 'words'); assert.match(result.inputHtml, />hot<\/span> drinks$/);
  assert.doesNotMatch(result.summary, /近音/); assert.doesNotMatch(result.summary, /字母/);
});
test('loyal versus lawyer is a possible phonetic confusion and remains incorrect', () => {
  assert.equal(context.Dictation.check('loyal', 'lawyer').accepted, false);
  const result = feedback('loyal', 'lawyer');
  assert.equal(result.level, 'words'); assert.match(result.summary, /可能近音/);
  assert.equal(result.comparisons[0].nearSound, true);
});
test('unrelated words are not labelled as a proven hearing confusion', () => {
  const result = feedback('banana', 'lawyer'); assert.doesNotMatch(result.summary, /近音/);
});
test('a real-word confusion such as waste/west can offer a sound contrast', () => {
  const result = feedback('waste', 'west'); assert.equal(result.comparisons[0].nearSound, true);
});
test('missing words preserve submitted text and mark the insertion position', () => {
  const result = feedback('cold drinks', 'cold soft drinks');
  assert.match(result.inputHtml, /^cold .*feedback-missing/); assert.match(result.inputHtml, /<\/span>drinks$/);
});
test('extra words show the actual extra text', () => {
  const result = feedback('cold soft drinks', 'cold drinks'); assert.match(result.inputHtml, /feedback-extra[^>]*>soft/);
});
test('accepted variants and date alternatives never acquire a wrong-answer label', () => {
  assert.equal(feedback('color', 'colour').level, 'accepted');
  const result = context.JijingSpeech.check('August 1st', { answer: '1 August', answers: ['1 August'] });
  assert.equal(context.DictationFeedback.build('August 1st', '1 August', result, { kind: '日期' }).level, 'accepted');
});
test('HTML and attribute injection are escaped in input and answer', () => {
  const html = context.DictationFeedback.render('<img src=x onerror=alert(1)>', '<script>');
  assert.doesNotMatch(html, /<img|<script>/); assert.match(html, /&lt;/);
});
test('unknown words matching object properties do not crash pronunciation hints', () => {
  assert.doesNotThrow(() => feedback('constructor', 'lawyer'));
});
test('original whitespace, uppercase, and punctuation remain in the learner line', () => {
  const result = feedback('  HOT   drinks!  ', 'cold drinks');
  assert.match(result.inputHtml, /^  <span[^>]*>HOT<\/span>   drinks!  $/);
});
console.log(count + '/' + count + ' feedback regressions passed');
