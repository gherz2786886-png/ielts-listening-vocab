// 预置三条带不同错因标签的错词条，刷新进入错词本
localStorage.setItem('ieltsVocab.wrong', JSON.stringify({
  'adults': {headword: 'adults', count: 1, manual: true, wordId: 'p02-001', display: 'adults', meaning: '成人', page: 2, scenarioId: 'renting', scenario: '租房场景', lastReason: '', reasonTags: ['meaning', 'spelling'], updatedAt: 3},
  'hotel': {headword: 'hotel', count: 3, wordId: 'p02-014', display: 'hotel', meaning: '酒店', page: 2, scenarioId: 'renting', scenario: '租房场景', lastReason: '把 h 写成了 g；漏写了字母 e', reasonTags: ['spelling'], updatedAt: 2},
  'dormitory': {headword: 'dormitory', count: 0, manual: true, display: 'dormitory (dorm)/ residential college', meaning: '宿舍', page: 2, scenarioId: 'renting', scenario: '租房场景', reasonTags: ['listening'], updatedAt: 1}
}));
localStorage.setItem('ieltsVocab.mastered', JSON.stringify({}));
location.hash = '#/wrong';
location.reload();
