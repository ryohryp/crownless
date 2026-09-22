(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }
  if (root.CrownlessSlice) root.CrownlessSlice = factory(root.CrownlessSlice);
})(typeof globalThis !== "undefined" ? globalThis : this, function installSafeHaven(Core) {
  "use strict";
  if (!Core || Core.__safeHavenInstalled) return Core;

  const HAVEN = Object.freeze({
    place: "wood",
    name: "根洞の火床",
    discovery: "倒木の根元に、雨を避けられる古い火床を見つけた。生還すれば次の遠征で使える。",
    benefit: "根洞の火床で旅支度を整えた。薬草 +1。"
  });
  const baseStart = Core.start;
  const baseAct = Core.act;

  Core.start = function startWithSafeHaven(state, id) {
    const next = baseStart(state, id);
    if (next === state || !next.expedition || id !== HAVEN.place || !state.cleared.includes(HAVEN.place)) return next;
    next.expedition.potions = Math.min(3, next.expedition.potions + 1);
    if (next.expedition.potions > 2) next.expedition.log.unshift(HAVEN.benefit);
    return next;
  };

  Core.act = function actWithSafeHaven(state, action) {
    const wasEligible = state?.expedition?.place === HAVEN.place && !state.cleared.includes(HAVEN.place);
    const next = baseAct(state, action);
    const discovered = wasEligible && next?.expedition?.place === HAVEN.place && next.expedition.stage === "cleared" && next.expedition.seals.includes(HAVEN.place);
    if (discovered && !next.expedition.log.includes(HAVEN.discovery)) next.expedition.log.push(HAVEN.discovery);
    return next;
  };

  Core.SAFE_HAVEN = HAVEN;
  Core.__safeHavenInstalled = true;
  return Core;
});
