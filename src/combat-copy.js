/* Player-facing combat guidance: describe trade-offs without naming a single correct button. */
(() => {
  'use strict';
  const E = window.CrownlessSlice;
  if (!E?.INTENTS?.heavy) return;
  E.INTENTS.heavy.help = '回避なら無傷と追撃、防御なら気力を整えつつ被害を抑える。装備と今の余力で選ぶ。';
})();
