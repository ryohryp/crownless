(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrownlessUnknownEnemy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TARGET = 'wolf';
  function initial(known = []) { return { known: [...new Set(known)] }; }
  function describe(memory, enemyId, intent) {
    if (enemyId !== TARGET || memory.known.includes(enemyId)) return { hidden: false, label: intent };
    return { hidden: true, label: '低く身構えている。飛び込む瞬間までは読めない。' };
  }
  function learn(memory, enemyId) {
    if (enemyId !== TARGET || memory.known.includes(enemyId)) return initial(memory.known);
    return initial([...memory.known, enemyId]);
  }
  return { TARGET, initial, describe, learn };
});
