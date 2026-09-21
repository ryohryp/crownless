/* #613 Treasure Map Fragment: a rare returned-loot clue that points at the next expedition. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessTreasureMapFragment = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const CLUES = {
    '囁きの森': { direction: '北東', hint: '鐘のない高みへ続く、細い石段が描かれている。' },
    '鐘なき塔': { direction: '南東', hint: '水辺へ落ちる古道と、青い火の印が残っている。' },
    '星沈みの湿原': { direction: '南西', hint: '灰色の石室へ向かう道だけが、途中で破れている。' },
    '灰冠の廟': { direction: '北西', hint: '森の根元に戻る印。以前とは違う細道が書き足されている。' },
  };

  function fragmentFor(report) {
    if (!report || report.died) return null;
    const scrap = Number(report.scrap) || 0;
    const gearCount = Array.isArray(report.gear) ? report.gear.length : 0;
    const place = String(report.place || '');
    const clue = CLUES[place];
    if (!clue) return null;
    // Rare but deterministic: no opaque RNG and no new save state. Deeper/richer returns see it more often.
    if ((scrap + gearCount * 5 + place.length) % 3 !== 0) return null;
    return { ...clue, title: '煤けた地図の断片', source: place };
  }

  return { CLUES, fragmentFor };
});
