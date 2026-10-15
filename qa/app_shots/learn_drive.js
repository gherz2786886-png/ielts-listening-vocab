// 学习模式核心路径：切场景 → 下一页 → 勾已学 → 搜索
location.hash = '#/learn';
await new Promise(function (r) { setTimeout(r, 400); });

// 1) 切到旅游场景
var travelChip = document.querySelector('[data-scenario="travel"]');
if (travelChip) travelChip.click();
await new Promise(function (r) { setTimeout(r, 300); });
var p1 = (document.querySelector('.pagenum') || {}).textContent;

// 2) 下一页
var nextBtn = document.querySelector('[data-page-next]');
if (nextBtn) nextBtn.click();
await new Promise(function (r) { setTimeout(r, 300); });
var p2 = (document.querySelector('.pagenum') || {}).textContent;

// 3) 勾第一个词的已学
var firstLearn = document.querySelector('[data-learn]');
var learnBefore = (document.querySelector('.progress-meta span') || {}).textContent;
if (firstLearn) {
  firstLearn.checked = true;
  firstLearn.dispatchEvent(new Event('change', { bubbles: true }));
}
var learnAfter = (document.querySelector('.progress-meta span') || {}).textContent;

// 4) 搜索 "hotel"
var si = document.getElementById('searchInput');
si.value = 'hotel';
si.dispatchEvent(new Event('input', { bubbles: true }));
await new Promise(function (r) { setTimeout(r, 300); });
var resultCount = document.querySelectorAll('.search-item').length;

return {
  afterScenario: p1,
  afterNextPage: p2,
  learnBefore: learnBefore,
  learnAfter: learnAfter,
  learnChecked: firstLearn ? firstLearn.checked : null,
  hotelResults: resultCount
};
