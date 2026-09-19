/* Pure, deterministic enemy adaptation rules. No persistent player profiling. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessEnemyAdaptation = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const COUNTERS = {
    dodge: {
      id: 'feint',
      name: 'フェイント',
      damage: 4,
      reason: 'こちらの足運びを読んでいる。',
      help: '回避を誘う牽制。防御で受けるか、通常攻撃で先に崩せる。',
    },
    guard: {
      id: 'break',
      name: '崩し',
      damage: 7,
      reason: '盾の構えを狙っている。',
      help: '守りを崩す一撃。回避するか、通常攻撃で先に削れる。',
    },
    heavy: {
      id: 'intercept',
      name: '迎撃',
      damage: 6,
      reason: '大振りの癖を待っている。',
      help: '強撃を待ち構える。通常攻撃へ切り替えるか、防御で整えられる。',
    },
  };

  function repeatedAction(history) {
    if (!Array.isArray(history) || history.length < 2) return null;
    const a = history[history.length - 1];
    const b = history[history.length - 2];
    return a === b && COUNTERS[a] ? a : null;
  }

  const READS = {
    '速攻型': ['dodge'],
    '防御型': ['heavy'],
    '狩人型': ['dodge', 'guard'],
    '重装型': ['heavy'],
  };

  function counterForAction(action, archetype) {
    if (!COUNTERS[action] || !(READS[archetype] || []).includes(action)) return null;
    return { ...COUNTERS[action], counters: action };
  }

  function counterIntent(history, archetype) {
    const repeated = repeatedAction(history);
    return repeated ? counterForAction(repeated, archetype) : null;
  }

  return { COUNTERS, READS, repeatedAction, counterForAction, counterIntent };
});
