'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const name of ['js/dictation.js', 'js/jijing-speech.js', 'data/jijing.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), sandbox, { timeout: 1000 });
}
const speech = sandbox.JijingSpeech;
const cases = [
  ['33', 'digits', 'double three'], ['333', 'digits', 'triple three'],
  ['3333', 'digits', 'double three double three'], ['33333', 'digits', 'triple three double three'],
  ['033', 'digits', 'zero double three'], ['0033', 'digits', 'double zero double three'],
  ['330033', 'digits', 'double three double zero double three'],
  ['3438873', 'digits', 'three four three double eight seven three'],
  ['3-3', 'digits', 'three three'], ['33 33', 'digits', 'double three double three'],
  ['33', 'cardinal', 'thirty-three'], ['0', 'cardinal', 'zero'],
  ['11', 'digits', 'double one'], ['11', 'cardinal', 'eleven'],
  ['100', 'cardinal', 'one hundred'], ['101', 'cardinal', 'one hundred and one'],
  ['1936', 'cardinal', 'one thousand nine hundred and thirty-six'],
  ['12000', 'cardinal', 'twelve thousand'],
  ['35.70', 'digits', 'thirty-five point seven zero'],
  ['3.20', 'digits', 'three point two zero'], ['0.03', 'digits', 'zero point zero three'],
  ['1 August', 'digits', 'the first of August'], ['27 April', 'digits', 'the twenty-seventh of April'],
  ['August 1st', 'digits', 'the first of August'], ['31st January', 'digits', 'the thirty-first of January'],
  ['5 pm', 'digits', 'five p m'], ['8:05 am', 'digits', 'eight oh five a m'],
  ['$37.50', 'digits', 'thirty-seven dollars and fifty cents'],
  ['37.50$', 'digits', 'thirty-seven dollars and fifty cents'],
  ['£1.01', 'digits', 'one pound and one penny'],
  ['33 dollars', 'digits', 'thirty-three dollars'], ['10 weeks', 'digits', 'ten weeks'],
  ['42A', 'digits', '42A'], // context-free alphanumeric codes are not silently guessed
  ['back door', 'digits', 'back door'], ['North', 'digits', 'North']
];
let count = 0;
for (const [value, mode, expected] of cases) {
  assert.equal(speech.forAnswer(value, mode).text, expected, value + ' / ' + mode);
  count++;
}
for (const [input, item, expected] of [
  ['33', { answer: '33', answers: ['33'] }, true],
  ['double three', { answer: '33', answers: ['33'] }, false],
  ['033', { answer: '33', answers: ['33'] }, false],
  ['3.3', { answer: '33', answers: ['33'] }, false],
  ['4.00', { answer: '4/4.00', answers: ['4', '4.00'] }, true],
  ['1st August', { answer: '1 August', answers: ['1 August'] }, true],
  ['August 1', { answer: '1 August', answers: ['1 August'] }, true],
  ['August 2', { answer: '1 August', answers: ['1 August'] }, false],
  ['color', { answer: 'colour', answers: ['colour'] }, true],
  ['flowre', { answer: 'flower', answers: ['flower'] }, false]
]) {
  assert.equal(speech.check(input, item).accepted, expected, input);
  count++;
}
const data = sandbox.JIJING;
assert.deepEqual(Array.from(data.days, day => [day.day, day.items.length]), [[28, 40], [29, 38], [30, 32]]);
const ids = data.days.flatMap(day => day.items.map(item => item.id));
assert.equal(new Set(ids).size, 110);
assert.equal(data.days[1].items.filter(item => item.answer === 'passport').length, 2);
assert.equal(data.days[1].items.some(item => item.answer === 'feedback'), true);
assert.equal(data.days[2].items.some(item => item.answer === '10 weeks'), true);
assert.equal(data.days[0].items.some(item => item.answer === '33'), false, 'Demo must not invent a source answer');
console.log('PASS ' + count + ' reading/grading cases and 6 source-data assertions');
