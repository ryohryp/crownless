(function (root, factory) {
  "use strict";

  const proposalGetter = () => {
    if (typeof module === "object" && module.exports) return require("./expedition-companion-proposals.js");
    return root && root.CrownlessExpeditionCompanionProposals;
  };
  const api = factory(proposalGetter);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionCompanionInsights = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createCompanionInsights(getProposalApi) {
  "use strict";

  const COPY = Object.freeze({
    mira: "ミラの見立てを信じて慎重に痕跡を追った。無理に踏み込まなかった判断が、帰還までの道筋に残った。",
    ed: "エドの見立てを信じて狩りへ踏み込んだ。正面から確かめるという判断が、遠征の流れを決めた。",
    sella: "セラの見立てを信じて価値ある物を探し切った。もう一歩漁るという判断が、帰還報告に残った。",
  });

  function cleanPolicy(inputs) {
    return inputs && (inputs.policyId || inputs.policy) || "standard";
  }

  function companionIds(expedition) {
    const inputs = expedition && expedition.inputs;
    if (!inputs) return [];
    const ids = Array.isArray(inputs.companionIds) ? inputs.companionIds : [inputs.companionId];
    return [...new Set(ids.filter(Boolean))];
  }

  function alignedCompanions(expedition, state) {
    const proposalApi = typeof getProposalApi === "function" ? getProposalApi() : null;
    if (!proposalApi || typeof proposalApi.proposalFor !== "function") return [];
    const inputs = expedition && expedition.inputs;
    if (!inputs || !state || !Array.isArray(state.companions)) return [];
    const objective = inputs.objective || "explore";
    const policy = cleanPolicy(inputs);
    return companionIds(expedition)
      .map((id) => state.companions.find((item) => item && item.id === id))
      .filter(Boolean)
      .filter((companion) => {
        const proposal = proposalApi.proposalFor(companion);
        return Boolean(proposal && proposal.objective === objective && proposal.policy === policy);
      });
  }

  function applyCompanionInsights(report, expedition, state) {
    if (!report || !["success", "early-return"].includes(report.outcome)) return report;
    const companions = alignedCompanions(expedition, state);
    if (!companions.length) return report;
    if (!Array.isArray(report.log)) report.log = [];
    if (!Array.isArray(report.companionInsights)) report.companionInsights = [];

    for (const companion of companions) {
      const cause = `companion-insight:${companion.id}`;
      if (report.companionInsights.some((item) => item && item.companionId === companion.id)) continue;
      const text = COPY[companion.id] || `${companion.name || "仲間"}の見立てに沿った準備が、帰還までの判断に現れた。`;
      const nearby = report.log.at(-1);
      const entry = {
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 106,
        time: nearby && nearby.time || "",
        type: "companion-insight",
        text,
        causes: [cause, "proposal-aligned", expedition.inputs.objective || "explore", cleanPolicy(expedition.inputs)],
      };
      report.companionInsights.push({ companionId: companion.id, companionName: companion.name, text });
      if (!report.log.some((item) => item && item.type === "companion-insight" && item.causes && item.causes.includes(cause))) {
        report.log.push(entry);
      }
      if (!report.notableEvent) report.notableEvent = entry;
    }
    report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    return report;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    const proposalApi = typeof getProposalApi === "function" ? getProposalApi() : null;
    if (!system || !proposalApi || system.__companionInsightsInstalled) return Boolean(system && proposalApi);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithCompanionInsights(expedition, state) {
      return applyCompanionInsights(baseResolve(expedition, state), expedition, state);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithCompanionInsights(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) applyCompanionInsights(advanced.report, expedition, state);
      return advanced;
    };

    system.__companionInsightsInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      if (!installSystemHooks(root) && root.setTimeout && attempts < 40) root.setTimeout(sync, 50);
    };
    sync();
    return true;
  }

  return { companionIds, alignedCompanions, applyCompanionInsights, installSystemHooks, install };
});
