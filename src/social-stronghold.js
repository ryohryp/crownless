(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessStronghold = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const RIVAL = '灰鴉';

  const fresh = () => ({
    version: 1,
    stronghold: null,
    owner: null,
    history: [],
    rivalArmed: false,
    rivalUsed: false,
  });

  const valid = s => Boolean(
    s &&
    s.version === 1 &&
    (s.stronghold === null || typeof s.stronghold === 'string') &&
    (s.owner === null || s.owner === 'player' || s.owner === 'rival') &&
    Array.isArray(s.history) &&
    s.history.length <= 8 &&
    s.history.every(v => v && typeof v.text === 'string' && v.text.length <= 80) &&
    typeof s.rivalArmed === 'boolean' &&
    typeof s.rivalUsed === 'boolean'
  );

  function parse(raw) {
    try {
      const s = JSON.parse(raw);
      return valid(s) ? s : fresh();
    } catch {
      return fresh();
    }
  }

  const push = (s, text) => ({
    ...s,
    history: [...s.history, { text: String(text).slice(0, 80) }].slice(-8),
  });

  function claim(s, id, title = 'この砦') {
    if (!id) return s;

    // Territory MVP deliberately follows one stronghold only.
    // Later district claims stay neighborhood progress and must not move it.
    if (s.stronghold && s.stronghold !== id) return s;
    if (s.stronghold === id && s.owner === 'player') return s;

    const retake = s.stronghold === id && s.owner === 'rival';
    const next = {
      ...s,
      stronghold: id,
      owner: 'player',
      rivalArmed: !s.rivalUsed && !retake,
      rivalUsed: s.rivalUsed || retake,
    };
    return push(next, retake
      ? `${title}を${RIVAL}から奪い返した。`
      : `${title}にあなたの旗が立った。`
    );
  }

  function simulateRival(s, title = 'この砦') {
    if (!s.stronghold || s.owner !== 'player' || !s.rivalArmed || s.rivalUsed) return s;
    return push({
      ...s,
      owner: 'rival',
      rivalArmed: false,
      rivalUsed: true,
    }, `${RIVAL}が${title}を奪った。`);
  }

  function ownerLabel(s) {
    if (s.owner === 'player') return 'あなたの旗';
    if (s.owner === 'rival') return `${RIVAL}の旗`;
    return '主なき砦';
  }

  return { RIVAL, fresh, valid, parse, claim, simulateRival, ownerLabel };
});
