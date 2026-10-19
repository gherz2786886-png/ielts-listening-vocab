/* Regression tests for incorrect grading and non-terminating format alignment.
 * Run: node qa/review_dictation_regressions.js [path/to/dictation.js]
 * Every check has a VM deadline so a regression reports failure instead of hanging.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var sourcePath = process.argv[2] || path.join(__dirname, '..', 'js', 'dictation.js');
var source = fs.readFileSync(sourcePath, 'utf8');
var cases = [
  { name: 'en dash', input: 'full\u2013time job', answer: 'full-time job', accepted: true, kind: 'punct' },
  { name: 'em dash', input: 'full\u2014time job', answer: 'full-time job', accepted: true, kind: 'punct' },
  { name: 'non-breaking space', input: 'full\u00a0time job', answer: 'full-time job', accepted: true, kind: 'punct' },
  { name: 'narrow non-breaking space', input: 'day\u202fshift', answer: 'day shift', accepted: true, kind: 'space' },
  { name: 'ideographic space', input: 'day\u3000shift', answer: 'day shift', accepted: true, kind: 'space' },
  { name: 'line break', input: 'day\nshift', answer: 'day shift', accepted: true, kind: 'space' },
  { name: 'tab', input: 'day\tshift', answer: 'day shift', accepted: true, kind: 'space' },
  { name: 'answer contains Unicode dash', input: 'full-time job', answer: 'full\u2013time job', accepted: true, kind: 'punct' },
  { name: 'case and Unicode separators', input: 'FULL\u2013TIME\u00a0JOB', answer: 'full-time job', accepted: true, kind: 'case' },
  { name: 'exact phrase retains its space', input: 'day shift', answer: 'day shift', accepted: true, exactText: 'day shift' },
  { name: 'exact hyphen retains its hyphen', input: 'full-time job', answer: 'full-time job', accepted: true, exactText: 'full-time job' },
  { name: 'reject flower misspelling', input: 'flowre', answer: 'flower', accepted: false },
  { name: 'reject singer misspelling', input: 'singre', answer: 'singer', accepted: false },
  { name: 'reject teacher misspelling', input: 'teachre', answer: 'teacher', accepted: false },
  { name: 'reject fence misspelling', input: 'fense', answer: 'fence', accepted: false },
  { name: 'reject exercise misspelling', input: 'exercize', answer: 'exercise', accepted: false },
  { name: 'reject France misspelling', input: 'Franse', answer: 'France', accepted: false },
  { name: 'reject painkiller misspelling', input: 'painkiler', answer: 'painkiller', accepted: false },
  { name: 'reject full suffix replacement', input: 'dance', answer: 'danse', accepted: false },
  { name: 'grey to gray', input: 'gray', answer: 'grey', accepted: true, kind: 'ukus' },
  { name: 'gray to grey', input: 'grey', answer: 'gray', accepted: true, kind: 'ukus' },
  { name: 'tyre to tire', input: 'tire', answer: 'tyre', accepted: true, kind: 'ukus' },
  { name: 'variant in middle of phrase', input: 'center of town', answer: 'centre of town', accepted: true, kind: 'ukus' },
  { name: 'multiple phrase variants', input: 'favorite color', answer: 'favourite colour', accepted: true, kind: 'ukus' },
  { name: 'variant plus unrelated typo', input: 'favorit color', answer: 'favourite colour', accepted: false },
  { name: 'corpus socialise', input: 'socialize', answer: 'socialise', accepted: true, kind: 'ukus' },
  { name: 'corpus summarise', input: 'summarize', answer: 'summarise', accepted: true, kind: 'ukus' },
  { name: 'known inflection', input: 'centers', answer: 'centres', accepted: true, kind: 'ukus' },
  { name: 'known verb inflection', input: 'organized', answer: 'organised', accepted: true, kind: 'ukus' },
  { name: 'known noun inflection', input: 'travelers', answer: 'travellers', accepted: true, kind: 'ukus' },
  { name: 'escape markup', input: '<b>day</b>', answer: 'day', accepted: false, noMarkup: true }
];
var failures = 0;
cases.forEach(function (test) {
  var context = vm.createContext({ test: test });
  vm.runInContext(source, context, { timeout: 500 });
  try {
    var result = vm.runInContext('Dictation.check(test.input, test.answer)', context, { timeout: 250 });
    if (result.accepted !== test.accepted) throw new Error('accepted=' + result.accepted);
    if (test.kind && !result.errorKinds.some(function (kind) { return kind.code === test.kind; })) {
      throw new Error('missing error kind ' + test.kind);
    }
    if (test.exactText && result.highlightHtml !== test.exactText) {
      throw new Error('highlight omitted original separators: ' + result.highlightHtml);
    }
    if (test.noMarkup && /<\/?b>/.test(result.highlightHtml)) throw new Error('unescaped input markup');
    console.log('PASS ' + test.name);
  } catch (error) {
    failures++;
    console.error('FAIL ' + test.name + ': ' + error.message);
  }
});
console.log('Passed ' + (cases.length - failures) + '/' + cases.length);
process.exitCode = failures ? 1 : 0;
