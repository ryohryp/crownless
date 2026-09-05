"use strict";

// Read-only projections. No second save, clock, random source or location data.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionJourney = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const WORDS = {
    beast: "獣", thicket: "茂み", bandit: "街道荒らし", collapse: "崩落", dark: "暗闇", fall: "足場",
    "wet-ground": "ぬかるみ", unknown: "未調査", herbs: "薬草", tracks: "足跡", ruin: "遺構",
    salvage: "使える残品", rumor: "噂", cellar: "地下室", ore: "鉱石", relic: "遺物", passage: "抜け道",
    climb: "登攀", cut: "刃物", heal: "手当て", ranged: "弓", conceal: "身を隠す", light: "軽装",
    woodsman: "森の心得", tracker: "追跡", strong: "力持ち", brave: "勇敢", loyal: "忠実",
    "keen-eye": "目ざとい", stubborn: "粘り強い", cautious: "慎重", standard: "通常", greedy: "強欲",
    "cautious trait": "慎重な気質", pack: "獣の群れ", lair: "巣穴", trophy: "狩猟の証",
  };
  const words = (values) => (values || []).map(value => WORDS[value] || value).join("・");
  function briefing(destination, state) {
    if (!destination) return null;
    const previous = (state.completedReports || []).find(r => r.destinationId === destination.id);
    const firstVisitKnown = destination.geographic
      ? `現実を歩いて見つけ、地図に記した場所。${destination.name}の現地の奥は、まだ確かめていない。`
      : "地図に記した場所。現地の奥は、まだ確かめていない。";
    return {
      name: destination.name,
      known: previous ? `前回は${outcomeLabel(previous.outcome)}。${previous.notableEvent?.text || "記録をもとに、備え直せる。"}` : firstVisitKnown,
      danger: words(destination.dangerTags) || "未調査",
      opportunity: words(destination.opportunityTags) || "土地の手掛かり",
      question: previous && previous.outcome !== "success" ? "人選と道具を変えて再調査するか、別の場所を選ぶか。" : "手掛かりを持ち帰るか、危険を受け入れて奥まで調べるか。",
    };
  }
  function outcomeLabel(outcome) {
    return { success: "生還", "early-return": "早期撤退", failed: "失敗", missing: "未帰還" }[outcome] || outcome;
  }
  function aftermath(report, state) {
    if (!report) return { changes: [], destinations: [], injured: [] };
    const available = new Set(state.discoveredDestinationIds || []);
    const destinations = [...(report.followupDestinations || []), ...(report.discoveries || [])].map(d => (state.destinations || []).find(item => item.id === d.id))
      .filter(d => d && available.has(d.id));
    const injured = (state.companions || []).filter(c => (report.injuries || []).includes(c.id) && c.condition === "injured");
    const changes = [];
    if (report.missingCompanionIds?.length) changes.push(`まだ戻らない仲間：${report.missingCompanionIds.map(id => state.companions.find(c => c.id === id)?.name || id).join("、")}。最後の地点から救助を準備できる。`);
    if (report.loot?.length) changes.push(`棚へ届いた物：${report.loot.map(x => x.name).join("、")}`);
    if (report.injuries?.length) changes.push(`傷を負った仲間：${report.injuries.map(id => state.companions.find(c => c.id === id)?.name || id).join("、")}`);
    if (report.discoveries?.length) changes.push(`地図に残った手掛かり：${report.discoveries.map(x => x.name).join("、")}`);
    if (report.worldKnowledgeProgress?.summary) changes.push(report.worldKnowledgeProgress.summary);
    if (!changes.length) changes.push(report.outcome === "success" ? "帰還の記録が仲間の履歴に残った。" : "調査はまだ終わっていない。備え直して向かえる。");
    return { changes, destinations: [...new Map(destinations.map(d => [d.id, d])).values()].slice(0, 2), injured };
  }
  return { words, briefing, aftermath, outcomeLabel };
});
