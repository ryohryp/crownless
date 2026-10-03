/* Live bridge for fair, telegraphed enemy adaptation. Keeps the core save shape backward compatible. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.CrownlessSlice, root.CrownlessEnemyAdaptation);
})(typeof globalThis === 'object' ? globalThis : this, function install(E, A) {
  'use strict';
  if (!E || !A || E.__enemyAdaptationInstalled) return E;

  const baseIntent = E.intent;
  const baseAct = E.act;
  const baseParse = E.parse;
  const history = e => Array.isArray(e?.history) ? e.history : [];

  // #740: the winning shallow-wolf routine alternates guard -> dodge -> attack,
  // so consecutive-action detection never sees the habit. Read one specific
  // response habit instead: if the wolf has already seen this player answer a
  // heavy with dodge, the next heavy may be a clearly telegraphed feint.
  // This stays deterministic, local to the fight, and never changes after input.
  const responseAdaptation = e => {
    if (e?.kind !== 'wolf') return null;
    const current = baseIntent(e);
    if (current.id !== 'heavy') return null;
    const prior = history(e);
    if (!prior.length) return null;
    const firstTurn = e.turn - prior.length;
    for (let i = prior.length - 1; i >= 0; i--) {
      const turn = firstTurn + i;
      if (turn < 0) continue;
      const previousIntent = baseIntent({ ...e, turn });
      if (previousIntent.id !== current.id) continue;
      const counter = A.counterForAction(prior[i], E.enemyProfile(e).archetype);
      if (!counter) return null;
      return {
        ...counter,
        reason: `前の「${current.name}」への対応を覚えている。`,
        responseAdaptive: true,
      };
    }
    return null;
  };

  const adaptation = e =>
    A.counterIntent(history(e), E.enemyProfile(e).archetype) || responseAdaptation(e);

  E.intent = e => {
    const counter = adaptation(e);
    if (!counter) return baseIntent(e);
    return { ...counter, help: `${counter.reason} ${counter.help}`, adaptive: true };
  };

  E.act = (s, action) => {
    const before = s?.expedition?.stage === 'fight' ? JSON.parse(JSON.stringify(s.expedition.enemy)) : null;
    const n = baseAct(s, action);
    if (n === s || !before || !n?.expedition || n.expedition.stage !== 'fight') return n;
    const e = n.expedition.enemy;
    const prior = history(before);
    e.history = [...prior, action].slice(-3);
    return n;
  };

  E.parse = raw => {
    if (!raw) return baseParse(raw);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return baseParse(raw); }
    const e = parsed?.expedition?.enemy;
    if (e && Array.isArray(e.history)) {
      const saved = e.history;
      delete e.history;
      const validated = baseParse(JSON.stringify(parsed));
      if (!validated) return null;
      validated.expedition.enemy.history = saved.filter(v => ['strike','heavy','guard','dodge','flee'].includes(v)).slice(-3);
      return validated;
    }
    return baseParse(raw);
  };

  E.__enemyAdaptationInstalled = true;
  return E;
});
