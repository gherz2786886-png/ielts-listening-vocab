// 切到听写设置页
location.hash = '#/dictation';
await new Promise(function (r) { setTimeout(r, 500); });
return {
  hasSetup: !!document.querySelector('[data-dstart]'),
  rangeBtns: document.querySelectorAll('[data-drange]').length
};
