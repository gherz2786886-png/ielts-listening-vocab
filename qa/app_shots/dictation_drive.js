// 驱动听写流程：#/dictation → 开始 → 错拼提交 → 展示批改结果
location.hash = '#/dictation';
await new Promise(function (r) { setTimeout(r, 500); });
var start = document.querySelector('[data-dstart]');
if (!start) return { error: 'no start button' };
start.click();
await new Promise(function (r) { setTimeout(r, 900); });
var input = document.getElementById('quizInput');
if (!input) return { error: 'no quiz input', html: document.getElementById('app').innerHTML.slice(0, 300) };
// 第一题目标是随机 headword；先从页面 DOM 无法直接看到答案，
// 用 session 内部状态不可达——改为直接取词库第一个词的常见拼写故意拼错：
// 直接读全局队列（app.js 闭包内不可达），退而求其次：播发音后盲答一个错拼。
input.value = 'adluts';
input.dispatchEvent(new Event('input', { bubbles: true }));
document.querySelector('[data-dsubmit]').click();
await new Promise(function (r) { setTimeout(r, 500); });
var box = document.querySelector('.result-box');
return {
  submitted: true,
  hasResult: !!box,
  reason: box ? box.querySelector('.result-reason').textContent : null,
  progress: (document.querySelector('.quiz-progress') || {}).textContent || null
};
