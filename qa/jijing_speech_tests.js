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
  ['33', null, 'thirty-three'], ['333', null, 'three hundred and thirty-three'],
  ['1234', null, 'one thousand two hundred and thirty-four'],
  ['12345', null, 'one two three four five'],
  ['33333', null, 'triple three double three'],
  ['0033', null, 'double zero double three'],
  ['330033', null, 'double three double zero double three'],
  ['3438873', null, 'three four three double eight seven three'],
  ['3-3', null, 'three three'], ['33 33', null, 'double three double three'],
  ['33', {type:'identifier'}, 'double three'], ['333', {label:'phone number'}, 'triple three'],
  ['3333', {type:'identifier'}, 'double three double three'],
  ['33', 'digits', 'thirty-three'], ['12345', 'cardinal', 'one two three four five'],
  ['0', null, 'zero'], ['11', null, 'eleven'], ['100', null, 'one hundred'],
  ['101', null, 'one hundred and one'], ['1936', null, 'one thousand nine hundred and thirty-six'],
  ['12000', {part:'S3'}, 'twelve thousand'], ['21000', {part:'P3'}, 'twenty-one thousand'],
  ['450000', {part:'P4'}, 'four hundred and fifty thousand'],
  ['10000', {part:'P4',type:'identifier'}, 'one double zero double zero'],
  ['35.70', null, 'thirty-five point seven zero'],
  ['3.20', null, 'three point two zero'], ['0.03', null, 'zero point zero three'],
  ['1 August', null, 'the first of August'], ['27 April', null, 'the twenty-seventh of April'],
  ['August 1st', null, 'the first of August'], ['31st January', null, 'the thirty-first of January'],
  ['5 pm', null, 'five p m'], ['8:05 am', null, 'eight oh five a m'],
  ['$37.50', null, 'thirty-seven dollars and fifty cents'],
  ['37.50$', null, 'thirty-seven dollars and fifty cents'],
  ['£1.01', null, 'one pound and one penny'],
  ['33 dollars', null, 'thirty-three dollars'], ['8.50 pounds', null, 'eight pounds and fifty pence'],
  ['$25000', null, 'twenty-five thousand dollars'], ['USD 25,000', null, 'twenty-five thousand dollars'],
  ['25,000 dollars', null, 'twenty-five thousand dollars'],
  ['EUR 33.50', null, 'thirty-three euros and fifty cents'],
  ['RMB 33.50', null, 'thirty-three yuan and fifty fen'],
  ['￥33', null, 'thirty-three yuan'], ['$1,000,000,000', null, 'one billion dollars'],
  ['$33', {type:'identifier'}, 'thirty-three dollars'],
  ['Price: 25000', null, 'twenty-five thousand'],
  ['25000', {type:'amount'}, 'twenty-five thousand'],
  ['100,000', null, 'one hundred thousand'],
  ['10 weeks', null, 'ten weeks'], ['18%', null, 'eighteen percent'],
  ['0.1cm', null, 'zero point one centimetres'],
  ['168 cm', null, 'one hundred and sixty-eight centimetres'],
  ['1.5 million', null, 'one point five million'], ['2 adults', null, 'two adults'],
  ['9:50', null, 'nine fifty'], ['2.30 pm', null, 'two thirty p m'],
  ['11.15am', null, 'eleven fifteen a m'], ['7.15-12.40', null, 'seven fifteen to twelve forty'],
  ['18th century', null, 'eighteenth century'],
  ['AC832T', null, 'A C eight three two T'],
  ['ac832t', null, 'A C eight three two T'],
  ['AC833T', null, 'A C eight double three T'],
  ['42A', null, 'four two A'], ['PG149BU', null, 'P G one four nine B U'],
  ['HE25 4EU', null, 'H E two five four E U'],
  ['33 Hillcrest', null, 'thirty-three Hillcrest'], ['Flat 6A', null, 'Flat six A'],
  ['VISA卡号: 0033', null, 'double zero double three'],
  ['PIN: 833', null, 'eight double three'],
  ['33 HILLCREST', null, 'thirty-three HILLCREST'],
  ['Phone: 33', null, 'double three'], ['电话：33', null, 'double three'],
  ['Boarding pass: AC832T', null, 'A C eight three two T'],
  ['Visa 1234 0033 8332 0000', null, 'one two three four double zero double three eight double three two double zero double zero'],
  ['+44 0033', null, 'plus double four double zero double three'],
  ['(020) 8333 0033', null, 'zero two zero eight triple three double zero double three'],
  ['back door', null, 'back door'], ['North', null, 'North']
];
let count = 0;
for (const [value, context, expected] of cases) {
  assert.equal(speech.forAnswer(value, context).text, expected, value + ' / ' + JSON.stringify(context));
  count++;
}
for (const [input, item, expected] of [
  ['AC832T', {answer:'AC832T', answers:['AC832T']}, true],
  ['ac832t', {answer:'AC832T', answers:['AC832T']}, true],
  ['AC823T', {answer:'AC832T', answers:['AC832T']}, false],
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
assert.deepEqual(Array.from(data.days.slice(0, 3), day => [day.day, day.items.length]), [[28, 40], [29, 38], [30, 32]]);
const ids = data.days.flatMap(day => day.items.map(item => item.id));
assert.equal(new Set(ids).size, 3018);
assert.equal(data.days[1].items.filter(item => item.answer === 'passport').length, 2);
assert.equal(data.days[1].items.some(item => item.answer === 'feedback'), true);
assert.equal(data.days[2].items.some(item => item.answer === '10 weeks'), true);
assert.equal(data.days[0].items.some(item => item.answer === '33'), false, 'Demo must not invent a source answer');
assert.deepEqual(Array.from(data.days, day => day.day), Array.from({length: 74}, (_, i) => 28 + i));
assert.equal(data.collections.length, 161);
assert.equal(data.collections.reduce((n, group) => n + group.items.length, 0), 3553);
assert.equal(data.days.filter(day => day.status === 'practice').length, 27);
assert.equal(data.days.filter(day => day.status === 'video').length, 27);
assert.deepEqual(Array.from(data.days.find(day => day.day === 91).groups), ['11.6', '11.11', '11.20', '11.27']);
assert.deepEqual(Array.from(data.days.find(day => day.day === 101).groups), ['4.23', '4.30']);
const all = data.days.concat(data.collections).flatMap(day => day.items);
assert.equal(new Set(all.map(item => item.id)).size, all.length);
assert.ok(all.every(item => item.answer && item.answers.every(answer => answer.trim()) && !/[\u4e00-\u9fff]/.test(item.answer)));
const find = (year, key) => data.collections.find(group => group.year === year && group.key === key);
assert.ok(find(2019, '16').items.some(item => item.answer === 'flamingo'));
assert.ok(find(2020, '1').items.some(item => item.answer === 'design'));
assert.ok(find(2021, '3.20').items.some(item => item.answer === 'packaging'));
assert.ok(find(2021, '7.1').items.some(item => item.answer === '10000'));
assert.ok(find(2022, '12.3').items.some(item => item.answer === '16 October,1980'));
assert.ok(find(2022, '1.8').items.some(item => item.answer === '$37.50'));
assert.equal(find(2022, '1.15').items.length, 22);
assert.equal(find(2022, '12.10').items.length, 10);
assert.ok(find(2022, '7.16').items.some(item => item.answer === 'Grateley'));
const address = find(2022, '2.12').items.find(item => item.answer === '463 Beacon Street/Avenue');
assert.equal(speech.check('463 Beacon Avenue', address).accepted, true);
assert.equal(speech.check('Avenue', address).accepted, false);
console.log('PASS ' + count + ' reading/grading cases and 26 source-data assertions');
