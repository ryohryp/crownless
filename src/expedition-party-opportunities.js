(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionPartyOpportunities = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionPartyOpportunities() {
  "use strict";

  const COORDINATED_HUNT = Object.freeze({
    id: "mira-ed-coordinated-hunt",
    destinationId: "ashen-wood",
    objectiveId: "hunt",
    companionIds: Object.freeze(["ed", "mira"]),
    loot: Object.freeze({
      id: "coordinated-hunt-alpha-hide",
      name: "追い込み猟で仕留めた先導狼の毛皮",
      tags: Object.freeze(["hide", "valuable", "party-opportunity"]),
    }),
  });

  const GEOGRAPHIC_CONTEXTS = Object.freeze({
    "ashen-wood": Object.freeze({ region: "灰炉北辺", localArea: "灰の森" }),
    "hollow-village": Object.freeze({ region: "灰炉北辺", localArea: "空鐘谷" }),
    "black-mine": Object.freeze({ region: "黒爪山地", localArea: "黒爪鉱区" }),
  });
  const GEOGRAPHIC_ORIGINS = Object.freeze({
    mira: Object.freeze({ region: "灰炉北辺", localArea: "灰の森", label: "灰炉北辺 / 灰の森" }),
  });
  const MIRA_LOCAL_ROUTE = Object.freeze({
    id: "local-guide:mira:deer-path",
    name: "ミラが知る鹿道の抜け道",
    family: "forest",
    dangerTags: Object.freeze(["beast", "thicket"]),
    opportunityTags: Object.freeze(["tracks", "herbs", "shortcut"]),
    durationMs: 150000,
  });

  function sortedCompanionIds(expedition) {
    const ids = expedition && expedition.inputs && Array.isArray(expedition.inputs.companionIds)
      ? expedition.inputs.companionIds.filter(Boolean)
      : [];
    return Array.from(new Set(ids)).sort();
  }

  function hasCombatVictory(report) {
    return Boolean(report && Array.isArray(report.log) && report.log.some((entry) => entry && entry.type === "combat-victory"));
  }

  function qualifiesForCoordinatedHunt(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    const ids = sortedCompanionIds(expedition);
    return report.outcome === "success"
      && report.destinationId === COORDINATED_HUNT.destinationId
      && expedition.inputs.objective === COORDINATED_HUNT.objectiveId
      && ids.length === COORDINATED_HUNT.companionIds.length
      && ids.every((id, index) => id === COORDINATED_HUNT.companionIds[index])
      && hasCombatVictory(report);
  }

  function applyCoordinatedHunt(report, expedition) {
    if (!qualifiesForCoordinatedHunt(report, expedition)) return report;

    report.partyOpportunity = {
      id: COORDINATED_HUNT.id,
      companionIds: Array.from(COORDINATED_HUNT.companionIds),
      destinationId: COORDINATED_HUNT.destinationId,
      objectiveId: COORDINATED_HUNT.objectiveId,
    };

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === COORDINATED_HUNT.loot.id)) {
      report.loot.push({
        id: COORDINATED_HUNT.loot.id,
        name: COORDINATED_HUNT.loot.name,
        tags: Array.from(COORDINATED_HUNT.loot.tags),
      });
    }

    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "party-opportunity" && entry.causes && entry.causes.includes(COORDINATED_HUNT.id))) {
      const nearby = report.log.find((entry) => entry && entry.type === "combat-victory") || report.log.at(-1);
      report.log.push({
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 96,
        time: nearby && nearby.time || "",
        type: "party-opportunity",
        text: "ミラが逃げ道の足跡を読み、エドが正面から群れを追い込んだ。二人だから仕留められた先導狼の毛皮を持ち帰る。",
        causes: [COORDINATED_HUNT.id, "tracker", "strong", "hunt"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function persistPartyOpportunityReward(state, report) {
    if (!state || !report || !report.partyOpportunity || !Array.isArray(report.loot)) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    const rewards = report.loot.filter((item) => item && Array.isArray(item.tags) && item.tags.includes("party-opportunity"));
    for (const item of rewards) {
      if (!state.securedLoot.some((existing) => existing && existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
        state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
      }
    }
    return state;
  }

  function ensureGeographicOrigins(state) {
    if (!state || !Array.isArray(state.companions)) return state;
    state.companions.forEach((companion) => {
      const origin = companion && GEOGRAPHIC_ORIGINS[companion.id];
      if (!origin) return;
      companion.geographicOrigin = companion.geographicOrigin || { region: origin.region, localArea: origin.localArea };
      companion.geographicFamiliarity = companion.geographicFamiliarity && typeof companion.geographicFamiliarity === "object"
        ? companion.geographicFamiliarity
        : {};
    });
    return state;
  }

  function geographicAffinity(companionId, destinationId) {
    const origin = GEOGRAPHIC_ORIGINS[companionId];
    const context = GEOGRAPHIC_CONTEXTS[destinationId];
    if (!origin || !context) return "none";
    if (origin.region === context.region && origin.localArea === context.localArea) return "local";
    if (origin.region === context.region) return "region";
    return "none";
  }

  function geographicPartyHint(companionId, destinationId) {
    const affinity = geographicAffinity(companionId, destinationId);
    if (affinity === "local") return "土地勘: ミラは灰の森を育った頃から知っている。成功すれば、普通なら見落とす鹿道の抜け道を次の遠征先として残せる。";
    if (affinity === "region") return "地縁: ミラは灰炉北辺の道と気配を知っている。この土地固有の抜け道までは知らないが、帰還報告に広域の土地勘が加わる。";
    return "";
  }

  function applyGeographicCompanion(report, expedition) {
    if (!report || !expedition || !expedition.inputs || report.outcome !== "success") return report;
    const companionIds = sortedCompanionIds(expedition);
    if (!companionIds.includes("mira")) return report;
    const affinity = geographicAffinity("mira", expedition.inputs.destinationId);
    if (affinity === "none") return report;

    report.geographicCompanionEffect = {
      companionId: "mira",
      affinity,
      region: GEOGRAPHIC_ORIGINS.mira.region,
      localArea: affinity === "local" ? GEOGRAPHIC_ORIGINS.mira.localArea : null,
    };
    if (!Array.isArray(report.log)) report.log = [];
    const marker = `geographic-companion:${affinity}:mira`;
    if (!report.log.some((entry) => entry && entry.type === "geographic-companion" && Array.isArray(entry.causes) && entry.causes.includes(marker))) {
      report.log.push({
        minute: 73,
        time: "",
        type: "geographic-companion",
        text: affinity === "local"
          ? "ミラは灰の森の古い鹿道を見分けた。地図にない抜け道は、彼女にとっては子どもの頃から知る帰り道だった。"
          : "ミラは灰炉北辺の風向きと古い荷車跡から、街道が普段より荒れていることを先に読み取った。",
        causes: [marker, GEOGRAPHIC_ORIGINS.mira.region, ...(affinity === "local" ? [GEOGRAPHIC_ORIGINS.mira.localArea] : [])],
      });
    }
    if (affinity === "local") {
      if (!Array.isArray(report.discoveries)) report.discoveries = [];
      if (!report.discoveries.some((item) => item && item.id === MIRA_LOCAL_ROUTE.id)) {
        report.discoveries.push({ id: MIRA_LOCAL_ROUTE.id, name: MIRA_LOCAL_ROUTE.name, kind: "geographic-companion-route", companionId: "mira" });
      }
    }
    report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    return report;
  }

  function unlockGeographicCompanionRoute(state, report) {
    if (!state || !report || !report.geographicCompanionEffect || report.geographicCompanionEffect.affinity !== "local") return null;
    ensureGeographicOrigins(state);
    if (!Array.isArray(state.destinations)) state.destinations = [];
    let destination = state.destinations.find((item) => item && item.id === MIRA_LOCAL_ROUTE.id);
    if (!destination) {
      destination = {
        id: MIRA_LOCAL_ROUTE.id,
        name: MIRA_LOCAL_ROUTE.name,
        family: MIRA_LOCAL_ROUTE.family,
        dangerTags: Array.from(MIRA_LOCAL_ROUTE.dangerTags),
        opportunityTags: Array.from(MIRA_LOCAL_ROUTE.opportunityTags),
        durationMs: MIRA_LOCAL_ROUTE.durationMs,
        geographicCompanionRoute: { companionId: "mira", origin: { ...GEOGRAPHIC_ORIGINS.mira } },
      };
      state.destinations.push(destination);
    }
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(destination.id)) state.discoveredDestinationIds.push(destination.id);
    return destination;
  }

  function selectedValue(form, name) {
    const input = form && form.querySelector ? form.querySelector(`input[name="${name}"]:checked`) : null;
    return input && input.value || "";
  }

  function syncGeographicHint(root) {
    const document = root && root.document;
    const form = document && document.querySelector ? document.querySelector("form.expedition-prepare") : null;
    if (!form) return false;
    const destinationId = selectedValue(form, "destination");
    const companionId = selectedValue(form, "companion");
    const copy = geographicPartyHint(companionId, destinationId);
    let hint = form.querySelector("[data-geographic-companion-hint]");
    if (!copy) {
      if (hint) hint.remove();
      return false;
    }
    if (!hint) {
      hint = document.createElement("p");
      hint.className = "expedition-form-feedback";
      hint.dataset.geographicCompanionHint = "true";
      const companionInput = form.querySelector('input[name="companion"]:checked');
      const companionGroup = companionInput && companionInput.closest ? companionInput.closest("fieldset") : null;
      if (companionGroup && typeof companionGroup.insertAdjacentElement === "function") companionGroup.insertAdjacentElement("afterend", hint);
      else form.prepend(hint);
    }
    hint.textContent = copy;
    return true;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__partyOpportunitiesInstalled) return Boolean(system);

    const baseNormalize = system.normalizeState.bind(system);
    system.normalizeState = function normalizeWithGeographicOrigins(input) {
      return ensureGeographicOrigins(baseNormalize(input));
    };

    const baseInitial = system.initialState.bind(system);
    system.initialState = function initialStateWithGeographicOrigins() {
      return ensureGeographicOrigins(baseInitial());
    };

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithGeographicOrigins(state, input, nowMs) {
      ensureGeographicOrigins(state);
      return ensureGeographicOrigins(baseDispatch(state, input, nowMs));
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithPartyOpportunities(expedition, state) {
      const report = applyCoordinatedHunt(baseResolve(expedition, state), expedition);
      return applyGeographicCompanion(report, expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithPartyOpportunities(state, report) {
      const applied = baseApplyReport(state, report);
      persistPartyOpportunityReward(applied, report);
      unlockGeographicCompanionRoute(applied, report);
      return ensureGeographicOrigins(applied);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithPartyOpportunities(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        applyCoordinatedHunt(advanced.report, expedition);
        applyGeographicCompanion(advanced.report, expedition);
        persistPartyOpportunityReward(advanced.state, advanced.report);
        unlockGeographicCompanionRoute(advanced.state, advanced.report);
        ensureGeographicOrigins(advanced.state);
      }
      return advanced;
    };

    system.__partyOpportunitiesInstalled = true;
    return true;
  }

  function installUi(root) {
    if (!root || !root.document) return false;
    const sync = () => syncGeographicHint(root);
    sync();
    if (root.__geographicCompanionUiInstalled) return true;
    if (typeof root.MutationObserver === "function" && root.document.body) {
      const observer = new root.MutationObserver(sync);
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    if (typeof root.document.addEventListener === "function") {
      root.document.addEventListener("change", (event) => {
        if (event && event.target && ["destination", "companion"].includes(event.target.name)) sync();
      });
    }
    root.__geographicCompanionUiInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const systemReady = installSystemHooks(root);
      const uiReady = installUi(root);
      if ((!systemReady || !uiReady) && root.setTimeout && attempts < 40) root.setTimeout(sync, 50);
    };
    sync();
    return true;
  }

  return {
    COORDINATED_HUNT,
    GEOGRAPHIC_CONTEXTS,
    GEOGRAPHIC_ORIGINS,
    MIRA_LOCAL_ROUTE,
    sortedCompanionIds,
    qualifiesForCoordinatedHunt,
    applyCoordinatedHunt,
    persistPartyOpportunityReward,
    ensureGeographicOrigins,
    geographicAffinity,
    geographicPartyHint,
    applyGeographicCompanion,
    unlockGeographicCompanionRoute,
    syncGeographicHint,
    installSystemHooks,
    installUi,
    install,
  };
});
