/* Explicit spoken forms are separate from written answers. No paid service/key. */
(function (global) {
  'use strict';
  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  var ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
    'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth',
    'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first',
    'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth',
    'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'];
  var MONTHS = 'January February March April May June July August September October November December'.split(' ');

  function digits(value) {
    return String(value).replace(/\d+/g, function (run) {
      var words = [], index = 0;
      while (index < run.length) {
        var end = index + 1;
        while (end < run.length && run[end] === run[index]) end++;
        var count = end - index;
        while (count > 0) {
          var take = count === 4 ? 2 : Math.min(3, count);
          words.push((take === 3 ? 'triple ' : take === 2 ? 'double ' : '') + ONES[Number(run[index])]);
          count -= take;
        }
        index = end;
      }
      return words.join(' ');
    }).replace(/[()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cardinal(number) {
    var n = Number(number);
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1000000000) return digits(number);
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + cardinal(n % 100) : '');
    var unit = n >= 1000000 ? 1000000 : 1000;
    var rest = n % unit;
    return cardinal(Math.floor(n / unit)) + (unit === 1000000 ? ' million' : ' thousand') +
      (rest ? (rest < 100 ? ' and ' : ' ') + cardinal(rest) : '');
  }

  function dateParts(value) {
    var months = '(' + MONTHS.join('|') + ')';
    var match = new RegExp('^(\\d{1,2})(?:st|nd|rd|th)?\\s+' + months + '$', 'i').exec(value);
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= 31) return { day: Number(match[1]), month: match[2] };
    match = new RegExp('^' + months + '\\s+(\\d{1,2})(?:st|nd|rd|th)?$', 'i').exec(value);
    if (match && Number(match[2]) >= 1 && Number(match[2]) <= 31) return { day: Number(match[2]), month: match[1] };
    return null;
  }

  function forAnswer(value, mode) {
    value = String(value).trim();
    var date = dateParts(value);
    if (date) return { kind: '日期', text: 'the ' + ORDINALS[date.day] + ' of ' + date.month };
    var time = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)$/i.exec(value);
    if (time && Number(time[1]) >= 1 && Number(time[1]) <= 12 && (!time[2] || Number(time[2]) < 60)) {
      var minute = time[2] && Number(time[2]);
      return { kind: '时间', text: cardinal(time[1]) +
        (minute ? ' ' + (minute < 10 ? 'oh ' + ONES[minute] : cardinal(minute)) : '') +
        ' ' + time[3].toLowerCase().split('').join(' ') };
    }
    var clock = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (clock && Number(clock[1]) < 24 && Number(clock[2]) < 60) {
      return { kind: '时间', text: cardinal(clock[1]) + (Number(clock[2]) ? ' ' +
        (Number(clock[2]) < 10 ? 'oh ' + ONES[Number(clock[2])] : cardinal(clock[2])) : " o'clock") };
    }
    var money = /^(\$|£)(\d+)(?:\.(\d{1,2}))?$/.exec(value) || /^(\d+)(?:\.(\d{1,2}))?(\$|£)$/.exec(value);
    if (money) {
      var symbol = money[1] === '$' || money[1] === '£' ? money[1] : money[3];
      var whole = money[1] === symbol ? money[2] : money[1];
      var fraction = money[1] === symbol ? money[3] : money[2];
      var cents = fraction ? Number((fraction + '0').slice(0, 2)) : 0;
      var major = symbol === '$' ? 'dollar' : 'pound';
      var minor = symbol === '$' ? (cents === 1 ? 'cent' : 'cents') : (cents === 1 ? 'penny' : 'pence');
      return { kind: '金额', text: cardinal(whole) + ' ' + major + (Number(whole) === 1 ? '' : 's') +
        (cents ? ' and ' + cardinal(cents) + ' ' + minor : '') };
    }
    var percentage = /^(\d+(?:\.\d+)?)\s*%$/.exec(value);
    if (percentage) return { kind: '百分比', text: forAnswer(percentage[1], 'cardinal').text + ' percent' };
    var decimal = /^(\d+)\.(\d+)$/.exec(value);
    if (decimal) return { kind: '小数', text: cardinal(decimal[1]) + ' point ' +
      decimal[2].split('').map(function (digit) { return ONES[Number(digit)]; }).join(' ') };
    if (/^\d[\d ()-]*$/.test(value)) {
      return { kind: mode === 'cardinal' && /^\d+$/.test(value) ? '数值' : '数字串',
        text: mode === 'cardinal' && /^\d+$/.test(value) ? cardinal(value) : digits(value) };
    }
    var quantity = /^(\d+(?:\.\d+)?)\s*(cm|weeks?|days?|months?|years?|dollars?|pounds?|minutes?|hours?|percent|million|millions|adults?)$/i.exec(value);
    if (quantity) return { kind: '数量短语', text: forAnswer(quantity[1], 'cardinal').text + ' ' +
      (quantity[2].toLowerCase() === 'cm' ? 'centimetres' : quantity[2]) };
    if (/\d/.test(value)) return { kind: '含数字短语（按原文）', text: value };
    return { kind: '单词 / 短语', text: value };
  }

  function answersFor(item) {
    var values = (item.answers || [item.answer]).slice();
    var date = dateParts(values[0]);
    if (date) {
      var suffix = date.day % 100 >= 11 && date.day % 100 <= 13 ? 'th' :
        ({ 1: 'st', 2: 'nd', 3: 'rd' }[date.day % 10] || 'th');
      values.push(date.day + suffix + ' ' + date.month, date.month + ' ' + date.day,
        date.month + ' ' + date.day + suffix);
    }
    return values;
  }

  function check(input, item) {
    var values = answersFor(item), best = null;
    for (var i = 0; i < values.length; i++) {
      var result = global.Dictation.check(input, values[i]);
      if (!best) best = result;
      if (result.accepted) return result;
    }
    return best;
  }

  function audioParts(text) {
    return String(text).replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  }
  global.JijingSpeech = { digits: digits, cardinal: cardinal, forAnswer: forAnswer,
    audioParts: audioParts, answersFor: answersFor, check: check };
})(typeof window !== 'undefined' ? window : globalThis);
