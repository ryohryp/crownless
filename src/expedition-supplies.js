/* Small pre-expedition loadout choice. No crafting, weight, or inventory system. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessSupplies = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SUPPLIES = {
    bandage: { name: '包帯', help: '遠征開始時、薬草を1つ追加。戦闘後の立て直し向け。' },
    torch: { name: '松明', help: '深層の戦利品の気配を少し詳しく読む。探索向け。' },
    ration: { name: '保存食', help: '最初の休息で回復量 +4。もう一段進みたい時向け。' },
  };
  const valid = id => Object.prototype.hasOwnProperty.call(SUPPLIES, id);
  function applyStart(expedition, id) {
    if (!expedition || !valid(id)) return expedition;
    expedition.supply = id;
    expedition.supplyUsed = false;
    if (id === 'bandage') expedition.potions = Math.min(3, expedition.potions + 1);
    return expedition;
  }
  function restBonus(expedition) {
    if (!expedition || expedition.supply !== 'ration' || expedition.supplyUsed) return 0;
    expedition.supplyUsed = true;
    return 4;
  }
  function cueSuffix(expedition) {
    return expedition?.supply === 'torch' ? ' 松明の光で、武具らしい輪郭まで見える。' : '';
  }
  return { SUPPLIES, valid, applyStart, restBonus, cueSuffix };
});
