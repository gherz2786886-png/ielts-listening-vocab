// 错词本视图驱动：听写错一题 → 切到错词本
location.hash = '#/dictation';
await new Promise(function (r) { setTimeout(r, 500); });
document.querySelector('[data-dstart]').click();
await new Promise(function (r) { setTimeout(r, 900); });
var input = document.getElementById('quizInput');
input.value = 'adluts';
document.querySelector('[data-dsubmit]').click();
await new Promise(function (r) { setTimeout(r, 500); });
// 再错一题（点下一题后随便拼错）
document.querySelector('[data-dnext]').click();
await new Promise(function (r) { setTimeout(r, 600); });
var input2 = document.getElementById('quizInput');
if (input2) {
  input2.value = 'gggg';
  document.querySelector('[data-dsubmit]').click();
  await new Promise(function (r) { setTimeout(r, 500); });
}
location.hash = '#/wrong';
await new Promise(function (r) { setTimeout(r, 600); });
return {
  route: location.hash,
  items: document.querySelectorAll('.wrong-item').length,
  head: (document.querySelector('.wrong-headword') || {}).textContent || null
};
