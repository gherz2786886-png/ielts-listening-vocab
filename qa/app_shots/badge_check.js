// 断言：0 条错词时 badge 不可见
var badge = document.getElementById('wrongBadge');
return {
  hiddenAttr: badge.hidden,
  displayNone: getComputedStyle(badge).display === 'none',
  offsetNull: badge.offsetParent === null
};
