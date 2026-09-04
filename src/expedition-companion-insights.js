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
  const SCAR_MEMORY_PREFIX = "scar-memory";
  const SCAR_ROUTE_PREFIX = "scar-route";

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

  function primaryDanger(destination) {
    if (!destination || !Array.isArray(destination.dangerTags)) return null;
    const value = destination.dangerTags.find(Boolean);
    return value ? String(value).toLowerCase() : null;
  }

  function scarTrait(dangerTag) {
    return dangerTag ? `${SCAR_MEMORY_PREFIX}:${String(dangerTag).toLowerCase()}` : null;
  }

  function applyInjuryScar(report, expedition, state) {
    if (!report || !Array.isArray(report.injuries) || !report.injuries.length) return report;
    const destination = destinationFor(expedition, state);
    const dangerTag = primaryDanger(destination);
    const trait = scarTrait(dangerTag);
    if (!destination || !trait) return report;
    if (!Array.isArray(report.scarMemories)) report.scarMemories = [];
    if (!Array.isArray(report.log)) report.log = [];

    for (const companionId of report.injuries) {
      const companion = state && Array.isArray(state.companions)
        ? state.companions.find((item) => item && item.id === companionId)
        : null;
      if (!companion || report.scarMemories.some((item) => item && item.companionId === companionId && item.trait === trait)) continue;
      report.scarMemories.push({
        companionId,
        companionName: companion.name,
        trait,
        dangerTag,
        sourceDestinationId: destination.id,
      });
      const cause = `scar-earned:${companionId}:${dangerTag}`;
      if (!report.log.some((item) => item && item.type === "scar-earned" && Array.isArray(item.causes) && item.causes.includes(cause))) {
        const nearby = report.log.findLast ? report.log.findLast((item) => item && item.type === "injury") : report.log.slice().reverse().find((item) => item && item.type === "injury");
        report.log.push({
          minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 99,
          time: nearby && nearby.time || "",
          type: "scar-earned",
          text: `${companion.name}はこの危地で負った傷とともに、${destination.name}の危険な兆しを身体で覚えた。`,
          causes: [cause, trait, destination.id],
        });
      }
    }
    report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    return report;
  }

  function persistScarMemories(state, report) {
    if (!state || !report || !Array.isArray(report.scarMemories) || !Array.isArray(state.companions)) return state;
    for (const memory of report.scarMemories) {
      const companion = state.companions.find((item) => item && item.id === memory.companionId);
      if (!companion || !memory.trait) continue;
      if (!Array.isArray(companion.traits)) companion.traits = [];
      if (!companion.traits.includes(memory.trait)) companion.traits.push(memory.trait);
      const historyEntry = `${memory.dangerTag}の危地で負った傷を覚えた`;
      const history = String(companion.history || "");
      if (!history.includes(historyEntry)) companion.history = history ? `${history} / ${historyEntry}` : historyEntry;
    }
    return state;
  }

  function scarredRouteContext(expedition, state) {
    if (!expedition || cleanPolicy(expedition.inputs) !== "cautious") return null;
    const destination = destinationFor(expedition, state);
    const dangerTag = primaryDanger(destination);
    const trait = scarTrait(dangerTag);
    if (!destination || !trait || !state || !Array.isArray(state.companions)) return null;
    const companion = companionIds(expedition)
      .map((id) => state.companions.find((item) => item && item.id === id))
      .find((item) => item && Array.isArray(item.traits) && item.traits.includes(trait));
    return companion ? { companion, destination, dangerTag, trait } : null;
  }

  function applyScarredRouteKnowledge(report, expedition, state) {
    if (!report || !["success", "early-return"].includes(report.outcome)) return report;
    const context = scarredRouteContext(expedition, state);
    if (!context) return report;
    const { companion, destination, dangerTag, trait } = context;
    const discoveryId = `${SCAR_ROUTE_PREFIX}:${destination.id}:${dangerTag}`;
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    if (!report.discoveries.some((item) => item && item.id === discoveryId)) {
      report.discoveries.push({
        id: discoveryId,
        name: "古傷が覚えた退避路",
        kind: "route",
        sourceDestinationId: destination.id,
        detail: `${companion.name}が以前ここで負った傷の記憶から、危険が高まる前に抜けられる退避路を見つけた。次の遠征で追える。`,
      });
    }
    report.scarRouteKnowledge = {
      companionId: companion.id,
      companionName: companion.name,
      dangerTag,
      trait,
      destinationId: destination.id,
      discoveryId,
      effect: "reveal-retreat-route",
    };
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((item) => item && item.type === "scar-route" && Array.isArray(item.causes) && item.causes.includes(discoveryId))) {
      const arrival = report.log.find((item) => item && item.type === "arrival");
      report.log.push({
        minute: 39,
        time: arrival && arrival.time || "",
        type: "scar-route",
        text: `${companion.name}が古傷に手を当てた。前に痛い目を見た地形を覚えており、慎重に進むための退避路を先に見つけた。`,
        causes: [trait, "cautious", discoveryId],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    return report;
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
    applyScarredRouteKnowledge(report, expedition, state);
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
      const report = applyInjuryScar(baseResolve(expedition, state), expedition, state);
      return applyCompanionInsights(report, expedition, state);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithCompanionGrowth(state, report) {
      return persistScarMemories(baseApplyReport(state, report), report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithCompanionInsights(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        applyInjuryScar(advanced.report, expedition, state);
        applyCompanionInsights(advanced.report, expedition, state);
        persistScarMemories(advanced.state, advanced.report);
      }
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
    SCAR_MEMORY_PREFIX,
    SCAR_ROUTE_PREFIX,
    companionIds,
    alignedCompanions,
    destinationFor,
    destinationTags,
    primaryDanger,
    scarTrait,
    applyInjuryScar,
    persistScarMemories,
    scarredRouteContext,
    applyScarredRouteKnowledge,
    localHaulerKnowledge,
    applyGeographicCompanionKnowledge,
    applyCompanionInsights,
    installSystemHooks,
    install,
  };
});
