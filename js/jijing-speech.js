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
    if (!Number.isSafeInteger(n) || n < 0) return digits(number);
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + cardinal(n % 100) : '');
    var unit = n >= 1e15 ? 1e15 : n >= 1e12 ? 1e12 : n >= 1e9 ? 1e9 : n >= 1e6 ? 1e6 : 1000;
    var name = unit === 1e15 ? 'quadrillion' : unit === 1e12 ? 'trillion' : unit === 1e9 ? 'billion' :
      unit === 1e6 ? 'million' : 'thousand';
    var rest = n % unit;
    return cardinal(Math.floor(n / unit)) + ' ' + name +
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

  function numberText(value) {
    var decimal = /^(\d+)\.(\d+)$/.exec(value);
    return decimal ? cardinal(decimal[1]) + ' point ' + decimal[2].split('').map(function (digit) {
      return ONES[Number(digit)];
    }).join(' ') : cardinal(value);
  }

  function codeText(value) {
    return value.toUpperCase().match(/[A-Z]+|\d+/g).map(function (part) {
      return /^\d/.test(part) ? digits(part) : part.split('').join(' ');
    }).join(' ');
  }

  function moneyReading(value) {
    // Currency markers/units take precedence over identifier length or context.
    var currencies = '(US\\$|USD|GBP|EUR|CNY|RMB|\\$|£|€|¥|￥|dollars?|pounds?|euros?|yuan)';
    var amount = '(\\d+(?:\\.\\d{1,2})?)';
    var match = new RegExp('^' + currencies + '\\s*' + amount + '$', 'i').exec(value);
    var unit, valueText;
    if (match) { unit = match[1]; valueText = match[2]; }
    else {
      match = new RegExp('^' + amount + '\\s*' + currencies + '$', 'i').exec(value);
      if (!match) return null;
      valueText = match[1]; unit = match[2];
    }
    var parts = valueText.split('.');
    var whole = parts[0], cents = parts[1] ? Number((parts[1] + '0').slice(0, 2)) : 0;
    var major = /^(?:£|GBP|pounds?)$/i.test(unit) ? 'pound' : /^(?:€|EUR|euros?)$/i.test(unit) ? 'euro' :
      /^(?:¥|￥|CNY|RMB|yuan)$/i.test(unit) ? 'yuan' : 'dollar';
    var minor = major === 'pound' ? (cents === 1 ? 'penny' : 'pence') :
      major === 'yuan' ? 'fen' : (cents === 1 ? 'cent' : 'cents');
    return { kind: '金额', text: cardinal(whole) + ' ' + major +
      (Number(whole) !== 1 && major !== 'yuan' ? 's' : '') +
      (cents ? ' and ' + cardinal(cents) + ' ' + minor : '') };
  }

  function forAnswer(value, context) {
    // Old saved digits/cardinal preferences are deliberately ignored.
    context = context && typeof context === 'object' ? context : {};
    value = String(value).normalize('NFKC').replace(/[–—]/g, '-').trim();
    var identifierLabel = /^(?:(?:visa(?:\s*(?:card|卡))?(?:\s*(?:号码|号))?|credit\s+card|debit\s+card|card|account|phone|telephone|mobile|tel|booking|reservation|reference|flight|boarding\s+pass|passport|postcode|postal\s+code|pin|cvv|cvc|code)(?:\s+(?:number|no\.?|reference|code))?|电话(?:号码)?|手机(?:号码)?|信用卡(?:号)?|卡号|账号|航班(?:号)?|登机牌|护照(?:号码)?|预订号|邮编|编号)\s*[:：#]?\s*(?=[A-Z0-9+])/i;
    var amountLabel = /^(?:price|cost|fee|fare|rent|amount|balance|金额|价格|费用|租金)\s*[:：]?\s*(?=[$£€¥￥\d])/i;
    var isIdentifier = identifierLabel.test(value) || context.type === 'identifier' ||
      identifierLabel.test(String(context.label || '') + ' 0');
    var isAmount = amountLabel.test(value) || context.type === 'amount' ||
      amountLabel.test(String(context.label || '') + ' 0');
    value = value.replace(identifierLabel, '').replace(amountLabel, '');
    // A thousands separator is numerical punctuation, not telephone grouping.
    var thousands = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/.test(value);
    value = value.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, function (part) { return part.replace(/,/g, ''); });
    var money = moneyReading(value);
    if (money) return money;
    var date = dateParts(value);
    if (date) return { kind: '日期', text: 'the ' + ORDINALS[date.day] + ' of ' + date.month };
    var range = /^(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})$/.exec(value);
    if (range && Number(range[1]) < 24 && Number(range[3]) < 24 && Number(range[2]) < 60 && Number(range[4]) < 60) {
      return { kind: '时间范围', text: forAnswer(range[1] + ':' + range[2]).text + ' to ' +
        forAnswer(range[3] + ':' + range[4]).text };
    }
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
    var percentage = /^(\d+(?:\.\d+)?)\s*%$/.exec(value);
    if (percentage) return { kind: '百分比', text: numberText(percentage[1]) + ' percent' };
    var decimal = /^(\d+)\.(\d+)$/.exec(value);
    if (decimal) return { kind: isAmount ? '金额（未标币种）' : '小数', text: numberText(value) };
    var quantity = /^(\d+(?:\.\d+)?)\s*(cm|weeks?|days?|months?|years?|minutes?|hours?|percent|million|millions|adults?)$/i.exec(value);
    if (quantity) return { kind: '数量短语', text: numberText(quantity[1]) + ' ' +
      (quantity[2].toLowerCase() === 'cm' ? 'centimetres' : quantity[2]) };
    var century = /^(\d{1,2})(?:st|nd|rd|th)\s+century$/i.exec(value);
    if (century && ORDINALS[Number(century[1])]) return { kind: '世纪', text: ORDINALS[Number(century[1])] + ' century' };
    var compactCode = value.replace(/[ -]/g, '');
    var codeFormat = isIdentifier || !/[ -]/.test(value) ||
      (/^[A-Z0-9 -]+$/.test(value) && !/[A-Z]{4,}/.test(value)) ||
      /^[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}$/i.test(value);
    if (codeFormat && /^[A-Za-z0-9]+$/.test(compactCode) && /[A-Za-z]/.test(compactCode) && /\d/.test(compactCode)) {
      return { kind: '字母数字编码', text: codeText(value) };
    }
    if (/^(?:\d|\(\d)[\d ()-]*$/.test(value)) {
      var run = value.replace(/\D/g, '');
      var formatted = /[ ()-]/.test(value);
      var lectureQuantity = /^[SP][234]$/.test(context.part || '');
      var identifier = !isAmount && (isIdentifier || /^0\d/.test(run) || formatted ||
        (run.length > 4 && !lectureQuantity && !thousands));
      return { kind: identifier ? '号码' : isAmount ? '金额（未标币种）' : '数值',
        text: identifier ? digits(value) : cardinal(run) };
    }
    if (/^\+\d[\d ()-]+$/.test(value)) return { kind: '号码', text: 'plus ' + digits(value.slice(1)) };
    // Addresses and other ordinary phrases keep their words; only embedded tokens are expanded.
    if (/\d/.test(value)) return { kind: '含数字短语', text: value.replace(/[A-Za-z]*\d+[A-Za-z0-9]*/g, function (part) {
      return /[A-Za-z]/.test(part) ? codeText(part) : cardinal(part);
    }) };
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
