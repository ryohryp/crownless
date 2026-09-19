(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessLootComparison = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const familyStyle = {
    fang: '回避後の追撃で攻める',
    shield: '防御と反撃で安定する',
    bow: '強撃で隙を射抜く',
    rust: '癖が少なく扱いやすい',
  };

  function traitLine(engine, state, id) {
    const text = engine.gearText(state, id).split('。').map(v => v.trim()).filter(Boolean);
    return text.length > 1 ? text[text.length - 1] : null;
  }

  function compare(currentId, foundId, engine, state) {
    if (!engine?.GEAR?.[currentId] || !engine?.GEAR?.[foundId] || currentId === foundId) return null;
    const current = engine.GEAR[currentId], found = engine.GEAR[foundId];
    const currentFamily = engine.gearFamily(currentId), foundFamily = engine.gearFamily(foundId);
    const currentProfile = engine.combatProfile(state, currentId);
    const foundProfile = engine.combatProfile(state, foundId);
    const attackDelta = found.attack - current.attack;
    const rows = [];
    rows.push({ label: '攻め', value: attackDelta === 0 ? '基礎攻撃は同等' : `基礎攻撃 ${attackDelta > 0 ? '+' : ''}${attackDelta}` });
    if (foundFamily !== currentFamily) rows.push({ label: '戦い方', value: familyStyle[foundFamily] || '別の戦い方' });
    else if (found.trait !== current.trait && traitLine(engine, state, foundId)) rows.push({ label: '個性', value: traitLine(engine, state, foundId) });
    else if (foundProfile.dodgeFocus !== currentProfile.dodgeFocus) rows.push({ label: '得意', value: `回避後の追撃 ${foundProfile.dodgeFocus > currentProfile.dodgeFocus ? '+' : ''}${foundProfile.dodgeFocus-currentProfile.dodgeFocus}` });
    else if (foundProfile.block !== currentProfile.block) rows.push({ label: '得意', value: `防御軽減 ${foundProfile.block > currentProfile.block ? '+' : ''}${foundProfile.block-currentProfile.block}` });
    else if (foundProfile.heavyCost !== currentProfile.heavyCost || foundProfile.heavyBonus !== currentProfile.heavyBonus) rows.push({ label: '得意', value: `強撃 気力${foundProfile.heavyCost} / 追加${foundProfile.heavyBonus}` });
    else rows.push({ label: '個性', value: '同系統の別個体' });
    rows.push({ label: '今の判断', value: '生還すれば、この一本を確定できる' });
    return { current: current.name, found: found.name, rows: rows.slice(0, 3) };
  }

  return { compare };
});
