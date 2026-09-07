(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessTerritoryFrontierFork = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTerritoryFrontierFork() {
  "use strict";

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function modelByRole(modelsInput, role) {
    return (Array.isArray(modelsInput) ? modelsInput : []).find((item) => item && item.role === role) || null;
  }

  function frontierState(modelsInput) {
    const models = Array.isArray(modelsInput) ? modelsInput : [];
    const foothold = modelByRole(models, "foothold");
    const route = modelByRole(models, "route");
    const resource = modelByRole(models, "resource");
    const footholdHeld = Boolean(foothold && foothold.owner === "player");
    const routeHeld = Boolean(route && route.owner === "player");

    const candidates = [];
    if (footholdHeld && route && route.owner !== "player") {
      candidates.push({
        key: route.key,
        role: "route",
        name: cleanText(route.entry && route.entry.name, "街道"),
        headline: "街道を固める",
        approach: "足場から進軍",
        support: route.supported ? "足場支援で攻略時間 -35%" : "支援なし",
        payoff: cleanText(route.meta && route.meta.effect, "次の資源地攻略を有利にする"),
        risk: route.scouted ? "偵察済み" : "危険は未確認"
      });
    }
    if (footholdHeld && resource && resource.owner !== "player") {
      candidates.push({
        key: resource.key,
        role: "resource",
        name: cleanText(resource.entry && resource.entry.name, "資源地"),
        headline: routeHeld ? "補給路から資源地へ" : "街道を飛ばして急襲",
        approach: routeHeld ? "補給路から進軍" : "急襲 / 迂回",
        support: resource.supported ? "街道支援で攻略時間 -25%" : "街道支援なし・通常時間",
        payoff: cleanText(resource.meta && resource.meta.value, "価値ある地点を先に押さえる"),
        risk: resource.scouted ? "偵察済み" : "危険は未確認"
      });
    }

    return {
      unlocked: footholdHeld,
      foothold,
      route,
      resource,
      candidates,
      lockedRoles: footholdHeld ? [] : ["route", "resource"]
    };
  }

  function ensureStyles(document) {
    if (!document || document.getElementById("territory-frontier-fork-styles")) return false;
    const style = document.createElement("style");
    style.id = "territory-frontier-fork-styles";
    style.textContent = `
      #world-atlas-viewer [data-territory-fork-candidate="true"] > i,
      #world-atlas-viewer .world-atlas-marker[data-territory-fork-candidate="true"] i {
        outline:1px solid rgba(205,173,99,.8);
        outline-offset:7px;
      }
      .territory-frontier-fork {
        margin-top:10px;
        padding:10px;
        border:1px solid rgba(205,173,99,.32);
        border-left:3px double rgba(205,173,99,.62);
        background:repeating-linear-gradient(135deg,rgba(205,173,99,.035) 0 2px,transparent 2px 8px),rgba(18,15,11,.76);
      }
      .territory-frontier-fork small,.territory-frontier-fork strong,.territory-frontier-fork span { display:block; }
      .territory-frontier-fork small { color:#a9976c; font:700 8px/1.2 ui-monospace,monospace; letter-spacing:.12em; }
      .territory-frontier-fork > strong { margin-top:4px; color:#e2d09a; font:500 15px/1.3 Georgia,serif; }
      .territory-frontier-fork__choices { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin-top:8px; }
      .territory-frontier-fork__choice { min-height:92px; padding:8px 9px; border:1px solid rgba(205,173,99,.38); background:rgba(205,173,99,.055); color:#ddd0aa; text-align:left; cursor:pointer; }
      .territory-frontier-fork__choice b,.territory-frontier-fork__choice em,.territory-frontier-fork__choice span { display:block; pointer-events:none; }
      .territory-frontier-fork__choice b { font:600 11px/1.3 Georgia,serif; }
      .territory-frontier-fork__choice em { margin-top:3px; color:#c5b47f; font:normal 8px/1.35 ui-monospace,monospace; }
      .territory-frontier-fork__choice span { margin-top:2px; color:#9f967f; font-size:8px; line-height:1.35; }
      .territory-frontier-lock { margin-top:7px !important; color:#a78e77 !important; }
      .territory-panel button[data-territory-fork-locked="true"] { opacity:.48; cursor:not-allowed; }
      .territory-fork-failure { display:block; margin-top:5px; color:#c0ab7c; }
      @media (max-width:700px) { .territory-frontier-fork__choices { grid-template-columns:1fr; } .territory-frontier-fork__choice { min-height:76px; } }
    `;
    document.head.appendChild(style);
    return true;
  }

  function territoryModels(root) {
    const Territory = root && root.CrownlessTerritoryPhase1;
    if (!Territory || typeof Territory.territories !== "function") return [];
    try {
      const models = Territory.territories(root);
      return Array.isArray(models) ? models : [];
    } catch (_) {
      return [];
    }
  }

  function focusTerritoryMarker(document, keyInput) {
    const key = cleanText(keyInput);
    const marker = Array.from(document && document.querySelectorAll ? document.querySelectorAll("[data-territory-key]") : [])
      .find((node) => cleanText(node.dataset && node.dataset.territoryKey) === key);
    if (!marker || typeof marker.click !== "function") return false;
    marker.click();
    marker.focus?.({ preventScroll: true });
    return true;
  }

  function syncCandidateMarkers(document, state) {
    const keys = new Set(state.candidates.map((candidate) => candidate.key));
    document.querySelectorAll("[data-territory-key]").forEach((marker) => {
      if (keys.has(cleanText(marker.dataset.territoryKey))) marker.dataset.territoryForkCandidate = "true";
      else delete marker.dataset.territoryForkCandidate;
    });
  }

  function selectedTerritory(document, modelsInput) {
    const panel = document && document.querySelector("#world-atlas-viewer .territory-panel[data-territory-key]");
    const key = cleanText(panel && panel.dataset && panel.dataset.territoryKey);
    return key ? (Array.isArray(modelsInput) ? modelsInput : []).find((item) => item && item.key === key) || null : null;
  }

  function syncLock(document, state, selected) {
    const panel = document && document.querySelector("#world-atlas-viewer .territory-panel[data-territory-key]");
    if (!panel || !selected) return false;
    panel.querySelector(".territory-frontier-lock")?.remove();
    const contest = panel.querySelector(".territory-panel__actions button.primary");
    if (!contest) return false;
    const locked = state.lockedRoles.includes(selected.role) && selected.owner !== "player";
    contest.disabled = locked;
    if (locked) {
      contest.dataset.territoryForkLocked = "true";
      contest.dataset.territoryForkOriginalLabel = contest.dataset.territoryForkOriginalLabel || contest.textContent;
      contest.textContent = "先に足場を確保すると攻略できる";
      const note = document.createElement("p");
      note.className = "territory-frontier-lock";
      note.textContent = "この地点へ直接手を伸ばすには、まず小砦を落として前線を作る必要がある。";
      panel.appendChild(note);
    } else {
      delete contest.dataset.territoryForkLocked;
      if (contest.dataset.territoryForkOriginalLabel) {
        contest.textContent = contest.dataset.territoryForkOriginalLabel;
        delete contest.dataset.territoryForkOriginalLabel;
      }
    }
    return locked;
  }

  function createChoice(document, candidate) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "territory-frontier-fork__choice";
    button.dataset.territoryTargetKey = candidate.key;
    const title = document.createElement("b");
    title.textContent = `${candidate.headline} — ${candidate.name}`;
    const approach = document.createElement("em");
    approach.textContent = `${candidate.approach} / ${candidate.risk}`;
    const support = document.createElement("span");
    support.textContent = candidate.support;
    const payoff = document.createElement("span");
    payoff.textContent = `取る理由: ${candidate.payoff.replace(/[。.]+$/, "")}`;
    button.append(title, approach, support, payoff);
    return button;
  }

  function syncWarCouncil(document, state, selected) {
    const panel = document && document.querySelector("#world-atlas-viewer .territory-panel[data-territory-key]");
    if (!panel) return false;
    panel.querySelector(".territory-frontier-fork")?.remove();
    if (!selected || selected.role !== "foothold" || selected.owner !== "player" || state.candidates.length < 2) return false;

    const section = document.createElement("section");
    section.className = "territory-frontier-fork";
    section.setAttribute("aria-label", "次の攻略候補");
    const kicker = document.createElement("small");
    kicker.textContent = "WAR COUNCIL / 次の一手";
    const title = document.createElement("strong");
    title.textContent = "一本道ではない。次にどちらを取る？";
    const choices = document.createElement("div");
    choices.className = "territory-frontier-fork__choices";
    state.candidates.forEach((candidate) => {
      const choice = createChoice(document, candidate);
      choice.addEventListener("click", () => focusTerritoryMarker(document, candidate.key));
      choices.appendChild(choice);
    });
    section.append(kicker, title, choices);
    panel.appendChild(section);
    return true;
  }

  function syncFailureHint(document, root) {
    const note = document && document.querySelector("#expedition-folio-content .territory-report-note");
    if (!note || note.querySelector(".territory-fork-failure")) return false;
    const Presentation = root && root.CrownlessExpeditionPresentation;
    const expeditionState = Presentation && typeof Presentation.getState === "function" ? Presentation.getState() : null;
    const report = expeditionState && Array.isArray(expeditionState.completedReports) ? expeditionState.completedReports[0] : null;
    if (!report || !report.territoryOutcome || report.territoryOutcome.controlled) return false;
    const hint = document.createElement("span");
    hint.className = "territory-fork-failure";
    hint.textContent = "次の手: 同じ攻略を周回せず、偵察・仲間・装備・方針のどれを変えるか決める。";
    note.appendChild(hint);
    return true;
  }

  function apply(document, root) {
    if (!document || !root) return false;
    const models = territoryModels(root);
    if (!models.length) return false;
    const state = frontierState(models);
    const selected = selectedTerritory(document, models);
    syncCandidateMarkers(document, state);
    syncLock(document, state, selected);
    syncWarCouncil(document, state, selected);
    syncFailureHint(document, root);
    return true;
  }

  function schedule(document, root) {
    if (!document || !root || root.__territoryFrontierForkScheduled) return false;
    root.__territoryFrontierForkScheduled = true;
    Promise.resolve().then(() => {
      root.__territoryFrontierForkScheduled = false;
      apply(document, root);
    });
    return true;
  }

  function install(root) {
    const document = root && root.document;
    if (!document) return false;
    ensureStyles(document);
    if (root.__territoryFrontierForkInstalled) {
      schedule(document, root);
      return true;
    }
    root.__territoryFrontierForkInstalled = true;
    root.addEventListener?.("crownless:territory-updated", () => schedule(document, root));
    root.addEventListener?.("crownless:territory-reward-updated", () => schedule(document, root));
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-territory-key], .world-atlas-home-entry, .world-atlas-details-toggle")) schedule(document, root);
    });
    if (typeof root.MutationObserver === "function" && document.body) {
      const observer = new root.MutationObserver((records) => {
        const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) => node?.nodeType === 1 && (
          node.matches?.(".territory-panel, .territory-report-note, [data-territory-key]") || node.querySelector?.(".territory-panel, .territory-report-note, [data-territory-key]")
        )));
        if (relevant) schedule(document, root);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    schedule(document, root);
    return true;
  }

  return Object.freeze({
    cleanText,
    frontierState,
    focusTerritoryMarker,
    apply,
    schedule,
    install
  });
});