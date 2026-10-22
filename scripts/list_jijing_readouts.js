'use strict';
// Use the same automatic rules as the browser; never replace written answers.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sandbox = {}; sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/jijing-speech.js'), 'utf8'), sandbox);
const speech = sandbox.JijingSpeech;
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/jijing.json'), 'utf8'));
const texts = new Set(data.days.concat(data.collections || []).flatMap(group => group.items)
  .map(item => speech.forAnswer(item.answers[0], { part: item.part }).text)
  .filter(text => speech.audioParts(text).length > 1));
const sourceCount = texts.size;
// The documented trial examples also get complete audio independent of device voices.
['A C eight three two T', 'A C eight double three T', 'double three', 'thirty-three',
  'twenty-five thousand dollars', 'eight pounds and fifty pence'].forEach(text => texts.add(text));
process.stdout.write(JSON.stringify({ sourceCount, texts: [...texts].sort() }) + '\n');
