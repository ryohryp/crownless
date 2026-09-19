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
    return { id: UNKNOWN_RELIC.id, name: UNKNOWN_RELIC.name, identified: false, fieldTested: false, decision: null };
  }

  function describeChoice(item) {
    if (!item || item.id !== UNKNOWN_RELIC.id || item.identified) return null;
    const selected = item.decision || (item.fieldTested ? "field-test" : null);
    return {
      title: selected === "field-test"
        ? "次の戦闘で試すことにした。"
        : selected === "carry-home"
          ? "持ち帰って鑑定することにした。"
          : "この場で試す？",
      description: selected === "field-test"
        ? "素性不明の牙刃を次の戦闘で試す。ひとつ行動すれば特性が判明する。"
        : selected === "carry-home"
          ? "未知の刃は背嚢にしまった。生還できれば安全に特性を確かめられる。"
          : "次の戦闘で試して特性を確かめるか、使わず持ち帰って安全に鑑定する。",
      selected,
      choices: [
        { id: "field-test", label: "次の戦闘で試す", consequence: "戦闘で一度行動すると特性が判明する" },
        { id: "carry-home", label: "使わず持ち帰る", consequence: "帰還できれば安全に鑑定できる" },
      ],
    };
  }

  function choose(itemInput, choice) {
    if (!itemInput || itemInput.id !== UNKNOWN_RELIC.id || itemInput.identified) return itemInput;
    if (!["field-test", "carry-home"].includes(choice)) return itemInput;
    return { ...itemInput, decision: choice, fieldTested: choice === "field-test" };
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
