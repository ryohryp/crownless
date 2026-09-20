(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.CrownlessSlice, root.document);
})(typeof globalThis === 'object' ? globalThis : this, function installMysteryRelic(E, documentRef) {
  'use strict';
  if (!E || E.__mysteryRelic) return E;

  const SEALED = 'relic_moon_shard';
  const AWAKENED = 'relic_moon_shard_awakened';
  E.GEAR[SEALED] = { name: '煤けた月片', short: '月片', family: 'relic', trait: 'mystery', attack: 0 };
  E.GEAR[AWAKENED] = { name: '月鐘の欠片', short: '月鐘片', family: 'relic', trait: 'mystery', attack: 0 };

  const originalGearText = E.gearText;
  E.gearText = (state, id) => {
    if (id === SEALED) return '用途不明。煤の下に細い月紋があり、かすかに冷たい。';
    if (id === AWAKENED) return '鐘なき塔で月紋が鳴った。遠い鐘の一部だったらしい。';
    return originalGearText(state, id);
  };

  const originalAct = E.act;
  E.act = (state, action) => {
    const before = state?.expedition;
    const enemy = before?.enemy;
    const findsRelic = enemy?.kind === 'wolf'
      && enemy.elite
      && enemy.depth >= 2
      && !state.owned.includes(SEALED)
      && !state.owned.includes(AWAKENED)
      && !before.gear.includes(SEALED);
    const awakensRelic = action === 'search'
      && before?.place === 'tower'
      && before.stage === 'path'
      && before.room === 1
      && state.owned.includes(SEALED);

    const result = originalAct(state, action);
    if (result === state) return result;

    if (findsRelic) {
      const after = result.expedition;
      if (after?.stage === 'cleared' && !after.enemy) {
        after.gear.push(SEALED);
        after.log.push('主の巣から《煤けた月片》を拾った。用途は分からない。月紋だけが、妙に冷たい。');
      }
    }

    if (awakensRelic) {
      const after = result.expedition;
      if (after?.place === 'tower' && after.stage === 'path' && after.room === 2) {
        result.owned = result.owned.filter(id => id !== SEALED);
        if (!result.owned.includes(AWAKENED)) result.owned.push(AWAKENED);
        after.scrap += 6;
        after.log.push('煤けた月片が、鳴らない鐘に触れず震えた。煤が落ち、《月鐘の欠片》だと分かる。隠されていた鉄片 +6。');
      }
    }
    return result;
  };

  // Relics are remembered as lightweight state, not equippable inventory rows.
  if (documentRef?.head) {
    const style = documentRef.createElement('style');
    style.textContent = '[data-action="equip"][data-value="relic_moon_shard"],[data-action="equip"][data-value="relic_moon_shard_awakened"]{display:none!important}';
    documentRef.head.appendChild(style);
  }

  E.__mysteryRelic = true;
  return E;
});
