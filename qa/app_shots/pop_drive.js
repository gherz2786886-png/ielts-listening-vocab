// 学习页：标记 adults 为「拼写+听错」并打开其 popover
location.hash = '#/learn';
await new Promise(function (r) { setTimeout(r, 400); });
document.querySelector('[data-wmark="p02-001"]').click();
await new Promise(function (r) { setTimeout(r, 200); });
document.querySelector('[data-wtag="spelling"]').click();
await new Promise(function (r) { setTimeout(r, 150); });
document.querySelector('[data-wtag="listening"]').click();
await new Promise(function (r) { setTimeout(r, 150); });
document.querySelector('[data-wconfirm]').click();
await new Promise(function (r) { setTimeout(r, 300); });
// 重新打开 popover 展示面板（含移除标记）
document.querySelector('[data-wmark="p02-001"]').click();
await new Promise(function (r) { setTimeout(r, 300); });
return {
  pop: !!document.querySelector('.pop'),
  label: document.querySelector('[data-wmark="p02-001"]').textContent.trim(),
  badge: document.getElementById('wrongBadge').textContent
};
