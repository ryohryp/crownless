(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionRiskyIdentification = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const UNKNOWN_RELIC = Object.freeze({
    id: "unknown-wolf-fang-knife",
    name: "素性不明の牙刃",
    hiddenTrait: "beast-edge",
    revealedName: "獣裂きの牙刃",
    revealedText: "獣への一撃だけ、刃が深く食い込む。",
  });

  function createUnknownLoot() {
    return { id: UNKNOWN_RELIC.id, name: UNKNOWN_RELIC.name, identified: false, fieldTested: false };
  }

  function describeChoice(item) {
    if (!item || item.id !== UNKNOWN_RELIC.id || item.identified) return null;
    return {
      title: "この場で試す？",
      description: "装備して次の戦闘で特性を確かめるか、使わず持ち帰って安全に鑑定する。",
      choices: [
        { id: "field-test", label: "今ここで装備する", consequence: "次の戦闘で特性が判明する" },
        { id: "carry-home", label: "使わず持ち帰る", consequence: "帰還できれば安全に鑑定できる" },
      ],
    };
  }

  function choose(itemInput, choice) {
    if (!itemInput || itemInput.id !== UNKNOWN_RELIC.id || itemInput.identified) return itemInput;
    const item = { ...itemInput };
    if (choice === "field-test") item.fieldTested = true;
    if (choice === "carry-home") item.fieldTested = false;
    return item;
  }

  function revealAfterCombat(itemInput) {
    if (!itemInput || itemInput.id !== UNKNOWN_RELIC.id || !itemInput.fieldTested || itemInput.identified) return itemInput;
    return { ...itemInput, identified: true, name: UNKNOWN_RELIC.revealedName, trait: UNKNOWN_RELIC.hiddenTrait, traitText: UNKNOWN_RELIC.revealedText };
  }

  function appraiseOnSafeReturn(itemInput) {
    if (!itemInput || itemInput.id !== UNKNOWN_RELIC.id || itemInput.identified) return itemInput;
    return { ...itemInput, identified: true, name: UNKNOWN_RELIC.revealedName, trait: UNKNOWN_RELIC.hiddenTrait, traitText: UNKNOWN_RELIC.revealedText };
  }

  function traitBonus(item, enemyTags) {
    if (!item || !item.identified || item.trait !== "beast-edge") return 0;
    return Array.isArray(enemyTags) && enemyTags.includes("beast") ? 2 : 0;
  }

  return { UNKNOWN_RELIC, createUnknownLoot, describeChoice, choose, revealAfterCombat, appraiseOnSafeReturn, traitBonus };
});
