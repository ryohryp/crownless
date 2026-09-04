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
  const LOCAL_HAULER_COMPANION_ID = "ed";
  const LOCAL_HAULER_ROUTE_PREFIX = "local-hauler-route";

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

  function destinationFor(expedition, state) {
    const destinationId = expedition && expedition.inputs && expedition.inputs.destinationId;
    if (!destinationId || !state || !Array.isArray(state.destinations)) return null;
    return state.destinations.find((item) => item && item.id === destinationId) || null;
  }

  function destinationTags(destination) {
    if (!destination) return [];
    const values = [];
    for (const key of ["features", "dangerTags", "opportunityTags"]) {
      if (Array.isArray(destination[key])) values.push(...destination[key]);
    }
    if (destination.palette) values.push(destination.palette);
    return [...new Set(values.map((value) => String(value || "").toLowerCase()))];
  }

  function localHaulerKnowledge(expedition, state) {
    if (!companionIds(expedition).includes(LOCAL_HAULER_COMPANION_ID)) return null;
    if (!state || !Array.isArray(state.companions)) return null;
    const companion = state.companions.find((item) => item && item.id === LOCAL_HAULER_COMPANION_ID);
    if (!companion || !String(companion.origin || "").includes("灰炉近く")) return null;
    const destination = destinationFor(expedition, state);
    if (!destination || destination.geographic !== true || !destinationTags(destination).includes("water")) return null;
    return { companion, destination };
  }

  function applyGeographicCompanionKnowledge(report, expedition, state) {
    if (!report || !["success", "early-return"].includes(report.outcome)) return report;
    const context = localHaulerKnowledge(expedition, state);
    if (!context) return report;

    const { companion, destination } = context;
    const discoveryId = `${LOCAL_HAULER_ROUTE_PREFIX}:${destination.id}`;
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    if (!report.discoveries.some((item) => item && item.id === discoveryId)) {
      report.discoveries.push({
        id: discoveryId,
        name: "荷運びの脇渡り",
        kind: "route",
        sourceDestinationId: destination.id,
        detail: "エドが灰炉近くで荷を運んでいた頃の勘から、水位の癖と荷車跡を読み、重い荷でも抜けられる脇渡りを見つけた。次の遠征で追える。",
      });
    }

    report.geographicCompanionKnowledge = {
      companionId: companion.id,
      companionName: companion.name,
      destinationId: destination.id,
      scope: "nearby-water-hauling",
      effect: "reveal-local-hauler-route",
      discoveryId,
    };

    if (!Array.isArray(report.log)) report.log = [];
    const cause = `geographic-companion:${companion.id}`;
    if (!report.log.some((item) => item && item.type === "geographic-companion" && Array.isArray(item.causes) && item.causes.includes(discoveryId))) {
      const arrival = report.log.find((item) => item && item.type === "arrival");
      report.log.push({
        minute: 41,
        time: arrival && arrival.time || "",
        type: "geographic-companion",
        text: `${companion.name}が水際の荷車跡を見て足を止めた。灰炉近くで荷を運んだ経験から、普通の旅人なら見落とす「荷運びの脇渡り」を読み取った。`,
        causes: [cause, "local-knowledge", "water", discoveryId],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    return report;
  }

  function applyCompanionInsights(report, expedition, state) {
    if (!report || !["success", "early-return"].includes(report.outcome)) return report;
    applyGeographicCompanionKnowledge(report, expedition, state);
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

  return {
    LOCAL_HAULER_COMPANION_ID,
    LOCAL_HAULER_ROUTE_PREFIX,
    companionIds,
    alignedCompanions,
    destinationFor,
    destinationTags,
    localHaulerKnowledge,
    applyGeographicCompanionKnowledge,
    applyCompanionInsights,
    installSystemHooks,
    install,
  };
});
