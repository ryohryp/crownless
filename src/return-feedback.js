(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CrownlessReturnFeedback = api;
    const game = document.querySelector('#game');
    if (!game || typeof MutationObserver !== 'function') return;

    const currentState = () => {
      try {
        const engine = root.CrownlessSlice;
        const mode = localStorage.getItem('crownless-expedition-mode');
        if (!engine || !mode) return null;
        return engine.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`));
      } catch {
        return null;
      }
    };

    const apply = () => {
      const panel = game.querySelector('.panel');
      const result = panel?.querySelector('.result-number');
      if (!panel || !result || panel.querySelector('[data-return-feedback]')) return;

      const mastery = api.fromReportPanel(panel.textContent || '');
      const power = api.nextPowerPreview(currentState(), root.CrownlessSlice);
      if (!mastery && !power) return;

      const block = document.createElement('div');
      block.dataset.returnFeedback = 'true';

      if (mastery) {
        const note = document.createElement('p');
        note.className = 'notice';
        note.textContent = mastery;
        block.appendChild(note);
      }

      if (power) {
        const note = document.createElement('p');
        note.className = 'notice';
        const label = document.createElement('strong');
        label.textContent = '次の旅：';
        note.append(label, document.createTextNode(power));
        block.appendChild(note);
      }

      result.insertAdjacentElement('afterend', block);
    };

    new MutationObserver(apply).observe(game, { childList: true, subtree: true });
    apply();
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function fromReportPanel(text) {
    const value = String(text || '');
    if (!value.includes('SAFE RETURN')) return '';
    const match = value.match(/\+(\d+)\s*鉄片を確保/);
    const scrap = match ? Number(match[1]) : 0;
    if (value.includes('新しい一本を、火へ。')) return '今回の手応え：新しい武具を生還確定した。次は装備を比べて、戦い方の違いを試せる。';
    if (scrap >= 15) return `今回の手応え：鉄片 ${scrap} 個を失わず持ち帰った。深く欲張った分を、帰る判断で確定できた。`;
    return `今回の手応え：鉄片 ${scrap} 個を生還確定した。引き際を選んだことも、この旅の成果。`;
  }

  function combatLine(state, id, Engine) {
    const gear = Engine?.GEAR?.[id];
    if (!gear) return '';
    const profile = Engine.combatProfile(state, id);

    if (gear.trait === 'bloodrush') return '体力半分以下で攻撃 +2。傷を負ってから押し返す戦い方を試せる。';
    if (gear.trait === 'moonstep') return '回避の気力消費 0。回避から反撃へつなぐ回数を増やせる。';
    if (gear.trait === 'thorn') return `防御 ${profile.block} 軽減・反撃 ${profile.counter}。受けながら削る戦い方を試せる。`;
    if (gear.trait === 'oath') return `防御 ${profile.block} 軽減。反撃を捨てて大振りを受け切る戦い方を試せる。`;
    if (gear.trait === 'hunter') return '敵が隙を見せた時、攻撃 +3。予兆を読んで一気に削る戦い方を試せる。';
    if (gear.trait === 'recurve') return `強撃 ${gear.attack + profile.heavyBonus} / 気力 ${profile.heavyCost}。軽い強撃を回す戦い方を試せる。`;

    if (profile.family === 'fang') return `回避後の追撃 +${profile.dodgeFocus}。かわして返す戦い方を試せる。`;
    if (profile.family === 'shield') return `防御 ${profile.block} 軽減${profile.counter ? `・反撃 ${profile.counter}` : ''}。受けて返す戦い方を試せる。`;
    if (profile.family === 'bow') return `強撃 ${gear.attack + profile.heavyBonus} / 気力 ${profile.heavyCost}${profile.pierce ? '・守りを貫通' : ''}。隙を狙う戦い方を試せる。`;
    return `強撃 ${gear.attack + profile.heavyBonus} / 気力 ${profile.heavyCost}。今の一撃をさらに伸ばせる。`;
  }

  function upgradeDelta(state, id, Engine) {
    const beforeGear = Engine?.GEAR?.[id];
    if (!beforeGear) return '';
    const before = Engine.combatProfile(state, id);
    const upgraded = Engine.upgrade(state, id);
    if (!upgraded || upgraded === state) return '';
    const after = Engine.combatProfile(upgraded, id);

    if (before.family === 'fang' && before.dodgeFocus !== after.dodgeFocus) {
      return `回避後の追撃 +${before.dodgeFocus} → +${after.dodgeFocus}`;
    }

    if (before.family === 'shield') {
      const changes = [];
      if (before.block !== after.block) changes.push(`防御 ${before.block} → ${after.block} 軽減`);
      if (before.counter !== after.counter) changes.push(`反撃 ${before.counter} → ${after.counter}`);
      if (changes.length) return changes.join(' / ');
    }

    const beforeHeavy = beforeGear.attack + before.heavyBonus;
    const afterHeavy = beforeGear.attack + after.heavyBonus;
    if (beforeHeavy !== afterHeavy) return `強撃 ${beforeHeavy} → ${afterHeavy}`;

    return '得意行動が一段強くなる';
  }

  function nextPowerPreview(state, Engine) {
    if (!state || !Engine || state.expedition || !state.report || state.report.died) return '';

    const newGear = Array.isArray(state.report.newGear)
      ? state.report.newGear.find((id) => id !== 'crown' && Engine.GEAR?.[id])
      : null;
    if (newGear) {
      return `${Engine.GEAR[newGear].name}なら、${combatLine(state, newGear, Engine)}`;
    }

    const id = state.equipped;
    if (!id || !Engine.GEAR?.[id]) return '';
    const level = Engine.weaponLevel(state, id);
    if (level >= 4) return `${Engine.GEAR[id].name}は最大補強。次は深層で別の武具を探すと戦い方を増やせる。`;

    const cost = Engine.upgradeCost(state, id);
    const gap = Math.max(0, cost - state.scrap);
    const delta = upgradeDelta(state, id, Engine);
    if (!delta) return '';

    if (gap === 0) {
      return `${Engine.GEAR[id].name}を鉄片 ${cost} で今すぐ補強できる。 ${delta}。`;
    }
    return `${Engine.GEAR[id].name}の補強まで鉄片あと ${gap}。次の補強で ${delta}。`;
  }

  return { fromReportPanel, nextPowerPreview };
});
