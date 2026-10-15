// 成绩页驱动：错一题 → 结束本轮
location.hash = '#/dictation';
await new Promise(function (r) { setTimeout(r, 500); });
document.querySelector('[data-dstart]').click();
await new Promise(function (r) { setTimeout(r, 900); });
var input = document.getElementById('quizInput');
input.value = 'adluts';
document.querySelector('[data-dsubmit]').click();
await new Promise(function (r) { setTimeout(r, 500); });
var endBtn = document.querySelector('[data-dend]');
if (endBtn) endBtn.click();
await new Promise(function (r) { setTimeout(r, 500); });
return {
  stats: Array.prototype.map.call(document.querySelectorAll('.stat-num'), function (n) { return n.textContent; }),
  buttons: Array.prototype.map.call(document.querySelectorAll('.next-row .btn, .next-row a'), function (b) { return b.textContent.trim(); })
};
