/* One-session, isolated visual-stage pilot. No GPS and no production save writes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessTacticalStageCore = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  const ROUTE = Object.freeze([
    Object.freeze({x: 145, y: 656, clue: '森の入口。遠くに崩れた石壁が見える。'}),
    Object.freeze({x: 338, y: 602, clue: '苔むした旧街道。橋の向こうに何かがある。'}),
    Object.freeze({x: 500, y: 520, clue: '冷たい川音。石橋の先に階段が続いている。'}),
    Object.freeze({x: 682, y: 461, clue: '風に混じって、鳴らない鐘の気配がする。'}),
    Object.freeze({x: 866, y: 367, clue: '霧が薄れ、丘の上の古城が姿を現した。'}),
    Object.freeze({x: 1043, y: 254, clue: '古城の門にたどり着いた。戻ることもできる。'}),
  ]);
  const MAX_HP = 100;
  const ENEMY_HP = 78;
  const PHASES = Object.freeze(['explore', 'gate', 'combat', 'vault', 'returned', 'fallen']);

  function initial() {
    return {
      phase: 'explore', step: 0, visited: [0], hp: MAX_HP,
      guardianHp: ENEMY_HP, combatTurn: 0, opening: false,
      discovered: false, collected: false, carried: 0, banked: 0,
      result: '', message: ROUTE[0].clue,
    };
  }

  function valid(s) {
    return !!s && PHASES.includes(s.phase) && Number.isInteger(s.step) && s.step >= 0 && s.step < ROUTE.length &&
      Array.isArray(s.visited) && s.visited.length === s.step + 1 && s.visited.every((v, i) => v === i) &&
      Number.isInteger(s.hp) && s.hp >= 0 && s.hp <= MAX_HP && Number.isInteger(s.guardianHp) &&
      s.guardianHp >= 0 && s.guardianHp <= ENEMY_HP && Number.isInteger(s.combatTurn) && s.combatTurn >= 0 &&
      typeof s.opening === 'boolean' && typeof s.discovered === 'boolean' && typeof s.collected === 'boolean' &&
      [0, 1].includes(s.carried) && [0, 1].includes(s.banked) && typeof s.message === 'string' &&
      (s.discovered === (s.step >= 4)) && (!s.collected || s.guardianHp === 0) &&
      (!['returned', 'fallen'].includes(s.phase) || s.carried === 0);
  }

  function act(state, action) {
    if (!valid(state)) throw Error('invalid tactical stage state');
    if (action === 'restart') return initial();
    const s = {...state, visited: [...state.visited]};

    if (s.phase === 'explore' && action === 'advance') {
      s.step += 1;
      s.visited.push(s.step);
      s.discovered = s.step >= 4;
      s.message = ROUTE[s.step].clue;
      if (s.step === ROUTE.length - 1) s.phase = 'gate';
    } else if (['explore', 'gate'].includes(s.phase) && action === 'retreat') {
      s.phase = 'returned';
      s.carried = 0;
      s.result = 'retreated';
      s.message = '探索を切り上げ、安全に野営地へ戻った。';
    } else if (s.phase === 'gate' && action === 'enter') {
      s.phase = 'combat';
      s.message = '石の守護者が動き出した。初手は重い一撃の予兆。';
    } else if (s.phase === 'combat' && (action === 'strike' || action === 'guard')) {
      if (action === 'strike') {
        s.guardianHp = Math.max(0, s.guardianHp - (s.opening ? 38 : 22));
        s.opening = false;
        if (s.guardianHp === 0) {
          s.phase = 'vault';
          s.message = '守護者は崩れ落ちた。奥の宝物庫へ進める。';
          return s;
        }
      } else {
        s.opening = true;
      }

      const heavy = s.combatTurn % 2 === 0;
      const damage = action === 'guard' ? (heavy ? 5 : 3) : (heavy ? 27 : 12);
      s.hp = Math.max(0, s.hp - damage);
      s.combatTurn += 1;
      if (s.hp === 0) {
        s.phase = 'fallen';
        s.carried = 0;
        s.result = 'defeated';
        s.message = '倒れてしまった。持ち帰る前の戦利品は失われた。';
      } else if (action === 'guard') {
        s.message = `防御で被害を${damage}に抑えた。反撃の隙ができた！`;
      } else {
        s.message = `斬撃が命中。守護者の反撃で${damage}ダメージ。`;
      }
    } else if (s.phase === 'vault' && action === 'collect' && !s.collected) {
      s.collected = true;
      s.carried = 1;
      s.message = '古い鐘鉄を発見。生還すれば鍛冶素材として持ち帰れる。';
    } else if (s.phase === 'vault' && action === 'return') {
      s.phase = 'returned';
      s.banked += s.carried;
      s.carried = 0;
      s.result = 'cleared';
      s.message = s.banked ? '生還！ 鐘鉄 ×1 を野営地に持ち帰った。' : '生還した。戦利品はなかった。';
    }
    return s;
  }

  return {ROUTE, MAX_HP, ENEMY_HP, initial, valid, act};
});
