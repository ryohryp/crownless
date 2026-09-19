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
  const baseAttackPreview = E.attackPreview;
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

  E.attackPreview = (s, action) => {
    const e = s?.expedition?.enemy;
    const counter = e && adaptation(e);
    if (!counter) return baseAttackPreview(s, action);
    const shadow = JSON.parse(JSON.stringify(s));
    shadow.expedition.enemy.history = [];
    return baseAttackPreview(shadow, action);
  };

  E.act = (s, action) => {
    const before = s?.expedition?.stage === 'fight' ? JSON.parse(JSON.stringify(s.expedition.enemy)) : null;
    const counter = before && adaptation(before);
    const oldHp = s?.expedition?.hp;
    const oldFocus = s?.expedition?.focus;
    let n = baseAct(s, action);
    if (!before || !n?.expedition || n.expedition.stage !== 'fight') return n;

    const e = n.expedition.enemy;
    const prior = history(before);
    e.history = [...prior, action].slice(-3);
    if (!counter) return n;

    const base = baseIntent(before);
    const block = E.combatProfile(s).block;
    let counterTaken = 0;
    if (counter.id === 'feint') counterTaken = action === 'dodge' ? counter.damage : Math.max(0, counter.damage - (action === 'guard' ? block : 0));
    if (counter.id === 'break') counterTaken = action === 'dodge' ? 0 : action === 'guard' ? Math.max(2, counter.damage - Math.floor(block / 2)) : counter.damage;
    if (counter.id === 'intercept') counterTaken = action === 'heavy' ? counter.damage + 4 : action === 'guard' ? Math.max(0, counter.damage - block) : action === 'dodge' ? 0 : counter.damage;
    n.expedition.hp = oldHp - counterTaken;
    if (counter.id === 'feint' && action === 'dodge') n.expedition.focus = oldFocus;
    n.expedition.log = n.expedition.log.filter(line => !line.includes(base.name) && !line.includes('身をかわした') && !line.includes('攻撃を受け止めた') && line !== '敵は攻撃してこない。');
    n.expedition.log.push(counterTaken ? `${counter.name}。体力 −${counterTaken}。` : `${counter.name}をしのいだ。`);
    if (n.expedition.hp <= 0) return baseAct({ ...n, expedition: { ...n.expedition, hp: 1 } }, 'flee');
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
