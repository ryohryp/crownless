(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasActionsPresentation = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasActionsPresentation() {
  "use strict";

  const EXPEDITION_STORAGE_KEY = "crownless.expedition-poc.v1";
  const MARKET_STORAGE_KEY = "crownless.atlas-market.v1";

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function storageOf(root) {
    try { return root && root.localStorage ? root.localStorage : null; } catch (_) { return null; }
  }

  function loadMarketState(root) {
    const storage = storageOf(root);
    const raw = storage ? safeJsonParse(storage.getItem(MARKET_STORAGE_KEY) || "null", null) : null;
    return {
      ownedIds: Array.isArray(raw && raw.ownedIds) ? [...new Set(raw.ownedIds.map((id) => cleanText(id)).filter(Boolean))] : [],
      spentLootCounts: raw && raw.spentLootCounts && typeof raw.spentLootCounts === "object" && !Array.isArray(raw.spentLootCounts)
        ? Object.fromEntries(Object.entries(raw.spentLootCounts).map(([id, count]) => [cleanText(id), Math.max(0, Number(count) || 0)]).filter(([id]) => id))
        : {}
    };
  }

  function saveMarketState(root, market) {
    const storage = storageOf(root);
    if (!storage) return false;
    try {
      storage.setItem(MARKET_STORAGE_KEY, JSON.stringify(market));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadExpeditionState(root) {
    const system = root && root.CrownlessExpeditionSystem;
    const storage = storageOf(root);
    if (!system || typeof system.normalizeState !== "function") return null;
    const raw = storage ? safeJsonParse(storage.getItem(EXPEDITION_STORAGE_KEY) || "null", null) : null;
    return system.normalizeState(raw);
  }

  function consumeSpentLoot(loot, spentLootCounts) {
    const remaining = { ...(spentLootCounts || {}) };
    return (Array.isArray(loot) ? loot : []).filter((item) => {
      const id = cleanText(item && item.id, cleanText(item && item.name, "loot"));
      if (!id || !(remaining[id] > 0)) return true;
      remaining[id] -= 1;
      return false;
    });
  }

  function availableTradeLoot(root) {
    const state = loadExpeditionState(root);
    if (!state) return [];
    const market = loadMarketState(root);
    return consumeSpentLoot(state.securedLoot, market.spentLootCounts);
  }

  function purchasedEquipment(root) {
    const actions = root && root.CrownlessDiscoveryActions;
    if (!actions || !Array.isArray(actions.MERCHANT_CATALOG)) return [];
    const market = loadMarketState(root);
    const owned = new Set(market.ownedIds);
    return actions.MERCHANT_CATALOG.filter((item) => owned.has(item.id)).map((item) => ({ id: item.id, name: item.name, tags: Array.from(item.tags || []) }));
  }

  function augmentStateWithMarket(root, stateInput) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || typeof system.normalizeState !== "function") return stateInput;
    const state = system.normalizeState(stateInput);
    const market = loadMarketState(root);
    const purchased = purchasedEquipment(root);
    const known = new Set(state.equipment.map((item) => item && item.id));
    purchased.forEach((item) => { if (!known.has(item.id)) state.equipment.push(item); });
    state.securedLoot = consumeSpentLoot(state.securedLoot, market.spentLootCounts);
    return state;
  }

  function patchExpeditionSystem(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__atlasMarketPatched || typeof system.dispatchExpedition !== "function") return false;
    const originalDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithAtlasMarket(stateInput, input, nowMs) {
      return originalDispatch(augmentStateWithMarket(root, stateInput), input, nowMs);
    };
    system.__atlasMarketPatched = true;
    return true;
  }

  function injectPurchasedEquipmentChoices(document, root) {
    patchExpeditionSystem(root);
    const form = document && document.querySelector("#expedition-folio-content form.expedition-prepare");
    if (!form) return 0;
    const first = form.querySelector('input[name="equipment"]');
    const group = first && first.closest("fieldset");
    if (!group) return 0;
    const existing = new Set(Array.from(group.querySelectorAll('input[name="equipment"]')).map((input) => input.value));
    let added = 0;
    purchasedEquipment(root).forEach((item) => {
      if (existing.has(item.id)) return;
      const label = document.createElement("label");
      label.className = "expedition-choice__item expedition-choice__item--merchant";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "equipment";
      input.value = item.id;
      const body = document.createElement("span");
      body.textContent = `${item.name} — ${item.tags.join("・")}`;
      label.append(input, body);
      group.appendChild(label);
      existing.add(item.id);
      added += 1;
    });
    return added;
  }

  function buyMerchantItem(root, item) {
    const market = loadMarketState(root);
    if (market.ownedIds.includes(item.id)) return { ok: false, reason: "owned", message: "すでに旅支度へ加わっている。" };
    const available = availableTradeLoot(root);
    const price = Math.max(1, Number(item.priceLoot) || 1);
    if (available.length < price) return { ok: false, reason: "insufficient", message: `交換には持ち帰った戦利品が ${price} 個必要だ。` };
    const payments = available.slice(0, price);
    payments.forEach((payment) => {
      const id = cleanText(payment && payment.id, cleanText(payment && payment.name, "loot"));
      market.spentLootCounts[id] = (Number(market.spentLootCounts[id]) || 0) + 1;
    });
    market.ownedIds.push(item.id);
    market.ownedIds = [...new Set(market.ownedIds)];
    saveMarketState(root, market);
    patchExpeditionSystem(root);
    return { ok: true, reason: "purchased", message: `${payments.map((payment) => cleanText(payment && payment.name, "戦利品")).join("、")}と交換した。${item.name}を次の遠征へ持たせられる。` };
  }

  function entryForSelection(document, root, target) {
    const preview = root && root.CrownlessWorldAtlasPreview;
    if (target && preview && typeof preview.entryForTarget === "function") {
      const direct = preview.entryForTarget(root, target);
      if (direct) return direct;
    }
    const viewer = document && document.getElementById("world-atlas-viewer");
    if (viewer && preview && typeof preview.defaultEntry === "function") return preview.defaultEntry(root, viewer);
    return null;
  }

  function entryByKey(root, key) {
    const wanted = cleanText(key);
    const Core = root && root.CrownlessCore;
    if (!wanted || !Core || typeof Core.loadSafeState !== "function") return null;
    try {
      const safe = Core.loadSafeState();
      const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
      return discoveries && typeof discoveries === "object" && !Array.isArray(discoveries) ? discoveries[wanted] || null : null;
    } catch (_) {
      return null;
    }
  }

  function createActionButton(document, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `world-atlas-action world-atlas-action--${action.kind}`;
    button.dataset.atlasActionKind = action.kind;
    const title = document.createElement("strong");
    title.textContent = action.label;
    const note = document.createElement("small");
    note.textContent = action.note;
    button.append(title, note);
    return button;
  }

  function createActionsPanel(document, root, entry) {
    const actionsApi = root && root.CrownlessDiscoveryActions;
    const panel = document.createElement("section");
    panel.className = "world-atlas-actions";
    panel.dataset.discoveryKey = cleanText(entry && entry.key);
    panel.setAttribute("aria-label", "この地点でできること");
    const kicker = document.createElement("small");
    kicker.className = "world-atlas-actions__kicker";
    kicker.textContent = "WHAT CAN BE DONE HERE / できること";
    panel.appendChild(kicker);

    const actions = actionsApi && typeof actionsApi.buildDiscoveryActions === "function" ? actionsApi.buildDiscoveryActions(entry) : [];
    if (!actions.length) {
      const empty = document.createElement("p");
      empty.className = "world-atlas-actions__empty";
      empty.textContent = "今は地図に記すだけの場所だ。調査が進めば、できることが増えるかもしれない。";
      panel.appendChild(empty);
      return panel;
    }

    const list = document.createElement("div");
    list.className = "world-atlas-actions__list";
    actions.forEach((action) => {
      const button = createActionButton(document, action);
      if (action.kind === "expedition") {
        const state = loadExpeditionState(root);
        if (state && state.activeExpedition) {
          button.disabled = true;
          button.querySelector("small").textContent = "別の遠征隊が派遣中。帰還後に選べる。";
        }
      }
      list.appendChild(button);
    });
    const status = document.createElement("p");
    status.className = "world-atlas-actions__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    panel.append(list, status);
    return panel;
  }

  function syncActions(document, root, entry) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    if (!detail || !entry) return false;
    const next = createActionsPanel(document, root, entry);
    const existing = detail.querySelector(".world-atlas-actions");
    if (existing) existing.replaceWith(next);
    else detail.appendChild(next);
    return true;
  }

  function closeActionSheet(document) {
    const sheet = document && document.querySelector(".world-atlas-action-sheet");
    if (sheet) {
      sheet.remove();
      const folio = document.querySelector(".world-atlas-folio");
      if (folio) folio.inert = false;
      if (sheet.atlasReturnTarget?.isConnected) sheet.atlasReturnTarget.focus({ preventScroll: true });
    }
  }

  function actionSheet(document, title, kicker) {
    closeActionSheet(document);
    const viewer = document.getElementById("world-atlas-viewer");
    if (!viewer) return null;
    const shell = document.createElement("div");
    shell.className = "world-atlas-action-sheet";
    shell.atlasReturnTarget = document.activeElement;
    const veil = document.createElement("button");
    veil.type = "button";
    veil.className = "world-atlas-action-sheet__veil";
    veil.setAttribute("aria-label", "閉じる");
    veil.addEventListener("click", () => closeActionSheet(document));
    const page = document.createElement("section");
    page.className = "world-atlas-action-sheet__page";
    page.setAttribute("role", "dialog");
    page.setAttribute("aria-modal", "true");
    page.setAttribute("aria-label", title);
    const head = document.createElement("header");
    const small = document.createElement("small");
    small.textContent = kicker;
    const heading = document.createElement("h3");
    heading.textContent = title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "world-atlas-action-sheet__close";
    close.textContent = "閉じる ×";
    close.addEventListener("click", () => closeActionSheet(document));
    head.append(small, heading, close);
    page.appendChild(head);
    shell.append(veil, page);
    const folio = viewer.querySelector(".world-atlas-folio");
    if (folio) folio.inert = true;
    viewer.appendChild(shell);
    close.focus();
    return page;
  }

  function relatedRegionMission(root, entry) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function" || typeof Core.getRegionMissionBoard !== "function") return null;
    try {
      const board = Core.getRegionMissionBoard(Core.loadSafeState());
      if (!Array.isArray(board)) return null;
      const areaId = cleanText(entry && entry.areaId);
      return board.find((mission) => areaId && cleanText(mission && mission.areaId) === areaId && !mission.completed)
        || board.find((mission) => mission && !mission.completed)
        || null;
    } catch (_) {
      return null;
    }
  }

  function localRumorKey(eventModel, effect) {
    return `local-rumor:${cleanText(eventModel && eventModel.id, "event")}:${cleanText(effect && effect.id, "lead")}`;
  }

  function recordLocalEventRumor(root, entry, eventModel, effect) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function" || typeof Core.saveWorldKnowledge !== "function") {
      return { ok: false, changed: false, key: "", message: "噂を聞き取ったが、探索録へ記す準備が整っていない。" };
    }
    try {
      const state = Core.loadSafeState();
      if (!state || typeof state !== "object") {
        return { ok: false, changed: false, key: "", message: "噂を聞き取ったが、探索録へ記す準備が整っていない。" };
      }
      if (typeof Core.sanitizeWorldKnowledge === "function") state.worldKnowledge = Core.sanitizeWorldKnowledge(state.worldKnowledge);
      else if (!state.worldKnowledge || typeof state.worldKnowledge !== "object") state.worldKnowledge = { discoveries: {} };
      if (!state.worldKnowledge.discoveries || typeof state.worldKnowledge.discoveries !== "object" || Array.isArray(state.worldKnowledge.discoveries)) {
        state.worldKnowledge.discoveries = {};
      }

      const key = localRumorKey(eventModel, effect);
      if (state.worldKnowledge.discoveries[key]) {
        return { ok: true, changed: false, key, message: "この噂はすでに探索録へ記してある。" };
      }

      const rumor = {
        key,
        name: cleanText(effect && effect.name, "土地の噂"),
        baseTitle: cleanText(effect && effect.baseTitle, "この土地に、まだ確かめていない話が残っている。"),
        terrain: [],
        contentKind: "rumor",
        state: "discovered",
        firstDiscoveredAt: Date.now(),
        visits: 1
      };
      const areaId = cleanText(entry && entry.areaId);
      if (/^area:\d{1,2}:\d+:\d+$/.test(areaId)) rumor.areaId = areaId;
      state.worldKnowledge.discoveries[key] = rumor;
      if (!Core.saveWorldKnowledge(state)) {
        return { ok: false, changed: false, key, message: "噂を聞き取ったが、探索録への記録に失敗した。" };
      }
      return { ok: true, changed: true, key, message: "噂を探索録へ記した。" };
    } catch (_) {
      return { ok: false, changed: false, key: "", message: "噂を聞き取ったが、探索録への記録に失敗した。" };
    }
  }

  function openEvent(document, root, entry) {
    const actionsApi = root && root.CrownlessDiscoveryActions;
    if (!actionsApi || typeof actionsApi.buildLocalEvent !== "function") return false;
    const eventModel = actionsApi.buildLocalEvent(entry);
    const page = actionSheet(document, eventModel.title, "LOCAL EVENT / 地点事件");
    if (!page) return false;
    const hook = document.createElement("p");
    hook.className = "world-atlas-action-sheet__lead";
    hook.textContent = eventModel.hook;
    const choices = document.createElement("div");
    choices.className = "world-atlas-event-choices";
    const result = document.createElement("p");
    result.className = "world-atlas-event-result";
    result.setAttribute("role", "status");

    function renderChoices(items) {
      choices.replaceChildren();
      (Array.isArray(items) ? items : []).forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = choice.label;
        button.addEventListener("click", () => {
          result.textContent = cleanText(choice.result);
          if (Array.isArray(choice.followUps) && choice.followUps.length) {
            renderChoices(choice.followUps);
            choices.querySelector("button")?.focus({ preventScroll: true });
            return;
          }
          const effect = choice.effect && typeof choice.effect === "object" ? choice.effect : null;
          if (effect && effect.kind === "rumor") {
            const outcome = recordLocalEventRumor(root, entry, eventModel, effect);
            result.textContent = `${cleanText(choice.result)} ${outcome.message}`.trim();
          }
          Array.from(choices.querySelectorAll("button")).forEach((candidate) => { candidate.disabled = true; });
          if (effect && effect.kind === "merchant") openMerchant(document, root, entry);
        });
        choices.appendChild(button);
      });
    }

    renderChoices(eventModel.choices);
    page.append(hook, choices, result);

    const mission = relatedRegionMission(root, entry);
    if (mission) {
      const related = document.createElement("aside");
      related.className = "world-atlas-event-related";
      related.innerHTML = `<small>REGION THREAD / 地域依頼</small><strong>${mission.title}</strong><span>痕跡 ${mission.clues} / ${mission.clueGoal}${mission.finalPoiDiscovered ? " · 追跡地点を特定済み" : ""}</span>`;
      page.appendChild(related);
    }
    return true;
  }

  function openMerchant(document, root, entry) {
    const actionsApi = root && root.CrownlessDiscoveryActions;
    if (!actionsApi || typeof actionsApi.merchantStock !== "function") return false;
    const page = actionSheet(document, "旅商人の荷車", "FACILITY / 行商人");
    if (!page) return false;
    const intro = document.createElement("p");
    intro.className = "world-atlas-action-sheet__lead";
    intro.textContent = "銭の代わりに、遠征で持ち帰った品を欲しがっている。交換した道具は次の遠征へ持たせられる。";
    const balance = document.createElement("p");
    balance.className = "world-atlas-merchant-balance";
    const stock = document.createElement("div");
    stock.className = "world-atlas-merchant-stock";
    const feedback = document.createElement("p");
    feedback.className = "world-atlas-merchant-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    page.append(intro, balance, stock, feedback);

    function renderStock() {
      balance.textContent = `交換に使える戦利品 ${availableTradeLoot(root).length} 個`;
      stock.replaceChildren();
      const owned = new Set(loadMarketState(root).ownedIds);
      actionsApi.merchantStock(entry).forEach((item) => {
        const card = document.createElement("article");
        const copy = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;
        const note = document.createElement("span");
        note.textContent = `${item.note} / ${item.tags.join("・")}`;
        copy.append(name, note);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = owned.has(item.id) ? "交換済み" : `戦利品${item.priceLoot}個と交換`;
        button.disabled = owned.has(item.id);
        button.addEventListener("click", () => {
          const outcome = buyMerchantItem(root, item);
          feedback.textContent = outcome.message;
          renderStock();
        });
        card.append(copy, button);
        stock.appendChild(card);
      });
    }
    renderStock();
    return true;
  }

  function closeDiscoverySurfaces(document, root) {
    if (root.CrownlessDiscoveryJournal && typeof root.CrownlessDiscoveryJournal.close === "function") {
      root.CrownlessDiscoveryJournal.close();
    } else {
      document.getElementById("discovery-journal-browser")?.remove();
      document.body?.classList?.remove("discovery-journal-open");
    }
    if (root.CrownlessWorldAtlas && typeof root.CrownlessWorldAtlas.closeAtlas === "function") {
      root.CrownlessWorldAtlas.closeAtlas(document);
    }
  }

  function openExpedition(document, root, entry, status) {
    patchExpeditionSystem(root);
    const state = loadExpeditionState(root);
    if (state && state.activeExpedition) {
      if (status) status.textContent = "別の遠征隊が派遣中。帰還後にこの地点を選べる。";
      return false;
    }
    const presentation = root && root.CrownlessExpeditionPresentation;
    const bridge = root && root.CrownlessGeographicExpeditionBridge;
    const presentationReady = presentation
      && typeof presentation.open === "function"
      && (typeof presentation.isReady !== "function" || presentation.isReady());
    if (!presentationReady) root.CrownlessExpeditionRuntime?.retry();
    if (!presentationReady || !bridge || typeof bridge.expeditionDestinationId !== "function") {
      if (status) status.textContent = "遠征台帳の準備がまだ整っていない。もう一度「遠征隊を送る」を押すと再試行できる。";
      return false;
    }
    try {
      if (presentation.open({ view: "prepare", destinationId: bridge.expeditionDestinationId(entry) }) === false) throw new Error("destination unavailable");
    } catch (_) {
      if (status) status.textContent = "遠征台帳を開けなかった。もう一度「遠征隊を送る」を押して再試行できる。";
      return false;
    }
    closeDiscoverySurfaces(document, root);
    return true;
  }

  function ensureStylesheet(document) {
    if (!document || document.querySelector('link[href="world-atlas-actions.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "world-atlas-actions.css";
    document.head.appendChild(link);
  }

  function install(document, root) {
    if (!document || !root || document.documentElement.dataset.worldAtlasActionsInstalled === "true") return false;
    document.documentElement.dataset.worldAtlasActionsInstalled = "true";
    ensureStylesheet(document);
    patchExpeditionSystem(root);

    let scheduled = false;
    let pendingTarget = null;
    function scheduleSync(target) {
      if (target) pendingTarget = target;
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(() => {
        scheduled = false;
        const targetNode = pendingTarget;
        pendingTarget = null;
        syncActions(document, root, entryForSelection(document, root, targetNode));
        injectPurchasedEquipmentChoices(document, root);
      });
    }

    document.addEventListener("click", (event) => {
      const target = event && event.target;
      if (!target || typeof target.closest !== "function") return;
      const actionButton = target.closest("[data-atlas-action-kind]");
      if (actionButton) {
        const viewer = document.getElementById("world-atlas-viewer");
        const panel = actionButton.closest(".world-atlas-actions");
        const entry = entryByKey(root, panel && panel.dataset.discoveryKey) || entryForSelection(document, root, viewer);
        const status = panel && panel.querySelector(".world-atlas-actions__status");
        const kind = actionButton.dataset.atlasActionKind;
        if (kind === "expedition") openExpedition(document, root, entry, status);
        else if (kind === "event") openEvent(document, root, entry);
        else if (kind === "facility") openMerchant(document, root, entry);
        return;
      }
      if (target.closest(".world-atlas-nearby-marker, .world-atlas-marker, .world-atlas-unplaced button")) scheduleSync(target);
    });

    document.addEventListener("pointerup", (event) => {
      const target = event && event.target;
      if (target && typeof target.closest === "function" && target.closest(".world-atlas-map")) scheduleSync(target);
    });

    if (typeof MutationObserver === "function" && document.body) {
      const observer = new MutationObserver((records) => {
        const changed = records.some((record) => Array.from(record.addedNodes || []).some((node) => node.nodeType === 1 && (
          node.id === "world-atlas-viewer" || node.matches?.(".world-atlas-detail, form.expedition-prepare") || node.querySelector?.(".world-atlas-detail, form.expedition-prepare")
        )));
        if (changed) scheduleSync();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    if (root && typeof root.addEventListener === "function") root.addEventListener("crownless:world-knowledge-updated", () => scheduleSync());
    scheduleSync();
    return true;
  }

  return {
    EXPEDITION_STORAGE_KEY,
    MARKET_STORAGE_KEY,
    loadMarketState,
    loadExpeditionState,
    consumeSpentLoot,
    availableTradeLoot,
    purchasedEquipment,
    augmentStateWithMarket,
    patchExpeditionSystem,
    injectPurchasedEquipmentChoices,
    buyMerchantItem,
    entryForSelection,
    entryByKey,
    createActionsPanel,
    syncActions,
    closeActionSheet,
    recordLocalEventRumor,
    openEvent,
    openMerchant,
    closeDiscoverySurfaces,
    openExpedition,
    install
  };
});
