(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasNpcSignals = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasNpcSignals() {
  "use strict";

  const SIGNAL_POSITIONS = Object.freeze([
    Object.freeze({ x: 74, y: 24, direction: "北東寄り" }),
    Object.freeze({ x: 24, y: 32, direction: "北西寄り" }),
    Object.freeze({ x: 78, y: 70, direction: "南東寄り" })
  ]);
  const NORTH_ROUTE_POSITIONS = Object.freeze([
    Object.freeze({ x: 44, y: 28, direction: "北寄り", phase: "街道へ出たばかり" }),
    Object.freeze({ x: 50, y: 19, direction: "北寄り", phase: "街道を進んでいる" }),
    Object.freeze({ x: 56, y: 13, direction: "北寄り", phase: "さらに北へ進んだ気配" })
  ]);
  const NORTH_ROUTE_POSITION = NORTH_ROUTE_POSITIONS[1];
  const ROADSIDE_EVENT_POSITION = Object.freeze({ x: 72, y: 36, direction: "北東寄り" });
  const BANDIT_EVENT_POSITION = Object.freeze({ x: 26, y: 38, direction: "北西寄り" });
  const CAMPFIRE_EVENT_POSITION = Object.freeze({ x: 70, y: 72, direction: "南東寄り" });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function normalizedHour(input = new Date()) {
    if (input instanceof Date) return input.getHours();
    const numeric = Number(input);
    return Number.isFinite(numeric) ? ((Math.floor(numeric) % 24) + 24) % 24 : new Date().getHours();
  }

  function safeState(root) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function") return null;
    try { return Core.loadSafeState(); } catch (_) { return null; }
  }

  function distanceForCoordinates(x, y) {
    const dx = Number(x) - 50;
    const dy = Number(y) - 50;
    return Math.round((Math.hypot(dx, dy) / 34) * 650);
  }

  function resolveSignalStage(distance, hasRumor = false, options = {}) {
    if (options && options.stage) return options.stage;
    const metres = Number(distance);
    if (Number.isFinite(metres)) {
      if (metres < 180) return "contact";
      if (metres < 430) return "discovered";
    }
    if (hasRumor) return "discovered";
    return "sensed";
  }

  function resolveDistanceBand(distance) {
    const metres = Number(distance);
    if (!Number.isFinite(metres)) return "少し先の気配";
    if (metres < 180) return "近い気配";
    if (metres < 430) return "少し先の気配";
    return "探索域の外縁";
  }

  function isEventResolved(root, signalSource) {
    const safe = safeState(root);
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return false;
    const key = `geo:signal:${cleanText(signalSource)}`;
    return Boolean(discoveries[key] && discoveries[key].resolved);
  }

  function northRoutePositionForHour(hour) {
    const normalized = normalizedHour(hour);
    if (normalized <= 10) return NORTH_ROUTE_POSITIONS[0];
    if (normalized >= 13) return NORTH_ROUTE_POSITIONS[2];
    return NORTH_ROUTE_POSITIONS[1];
  }

  function positionForLead(npcLife, lead, index, resident) {
    const northRoad = npcLife && npcLife.LOCATIONS ? npcLife.LOCATIONS.ROAD : "north-road";
    const routeLocation = cleanText(lead && lead.location, cleanText(resident && resident.location));
    if (routeLocation === northRoad) return northRoutePositionForHour(resident && resident.hour);
    return SIGNAL_POSITIONS[index % SIGNAL_POSITIONS.length];
  }

  function travelingSignals(npcLife, input = new Date(), options = {}) {
    if (!npcLife || typeof npcLife.snapshotAt !== "function") return [];
    const snapshot = npcLife.snapshotAt(input);
    const travelingState = npcLife.STATES && npcLife.STATES.TRAVELING ? npcLife.STATES.TRAVELING : "traveling";
    const leads = typeof npcLife.explorationLeads === "function" ? npcLife.explorationLeads(snapshot) : [];
    const leadByTarget = new Map(leads.map((lead) => [cleanText(lead && lead.targetId), lead]).filter(([targetId]) => targetId));

    return snapshot
      .filter((resident) => resident && resident.state === travelingState)
      .map((resident, index) => {
        const residentId = cleanText(resident.id);
        const lead = leadByTarget.get(residentId) || null;
        const hasRumor = Boolean(lead);
        const slot = positionForLead(npcLife, lead, index, resident);
        const distance = Number.isFinite(Number(options && options.distance))
          ? Number(options.distance)
          : distanceForCoordinates(slot.x, slot.y);
        const stage = resolveSignalStage(distance, hasRumor, options);
        const distanceBand = hasRumor ? "街道筋の気配" : (stage === "sensed" ? "遠くの人影らしき気配" : resolveDistanceBand(distance));

        let name = "旅人らしき気配";
        let shortName = "旅人";
        let stateLabel = "未確認 / 人の気配";
        let movementHint = "移動しているらしい";

        if (stage === "contact") {
          name = `${cleanText(resident.name, "行商人マルコ")}`;
          shortName = cleanText(resident.role, "マルコ");
          stateLabel = "接触可能 / 足を止めている";
          movementHint = "荷車を止めて休憩中";
        } else if (stage === "discovered" || hasRumor) {
          name = `${cleanText(resident.name, "旅人")}の気配`;
          shortName = cleanText(resident.role, "旅人");
          stateLabel = "未確認 / 噂の足取り";
          movementHint = cleanText(slot.phase, "街道を進んでいる");
        }

        return Object.freeze({
          id: `npc-signal:${residentId || String(index + 1)}`,
          residentId,
          hasRumor,
          stage,
          distance,
          signalSource: hasRumor ? "npc-rumor" : "npc-travel",
          name,
          shortName,
          x: slot.x,
          y: slot.y,
          direction: slot.direction,
          distanceBand,
          movementHint,
          stateLabel
        });
      });
  }

  function roadsideEventSignals(input = new Date(), options = {}) {
    const hour = normalizedHour(input);
    if (hour < 12 || hour >= 15) return [];
    const distance = Number.isFinite(Number(options && options.distance))
      ? Number(options.distance)
      : distanceForCoordinates(ROADSIDE_EVENT_POSITION.x, ROADSIDE_EVENT_POSITION.y);
    const stage = resolveSignalStage(distance, false, options);

    let name = "街道の方から騒がしい気配";
    let shortName = "異変";
    let stateLabel = "未確認 / 異変の気配";
    let movementHint = "断続的な物音が続いている";

    if (stage === "contact") {
      name = "街道脇の負傷した旅人";
      shortName = "負傷者";
      stateLabel = "接触可能 / 救助を求めている";
      movementHint = "目の前で行き倒れている";
    } else if (stage === "discovered") {
      name = "街道脇で行き倒れた旅人";
      shortName = "負傷者";
      stateLabel = "確認済み / 負傷者の気配";
      movementHint = "身動きが取れず助けを求めている";
    }

    return [Object.freeze({
      id: "event-signal:roadside-disturbance",
      signalSource: "roadside-disturbance",
      stage,
      distance,
      name,
      shortName,
      x: ROADSIDE_EVENT_POSITION.x,
      y: ROADSIDE_EVENT_POSITION.y,
      direction: ROADSIDE_EVENT_POSITION.direction,
      distanceBand: resolveDistanceBand(distance),
      movementHint,
      stateLabel
    })];
  }

  function banditAmbushSignals(input = new Date(), options = {}) {
    const hour = normalizedHour(input);
    if (hour < 15 || hour >= 19) return [];
    const distance = Number.isFinite(Number(options && options.distance))
      ? Number(options.distance)
      : distanceForCoordinates(BANDIT_EVENT_POSITION.x, BANDIT_EVENT_POSITION.y);
    const stage = resolveSignalStage(distance, false, options);

    let name = "街道の茂みから不穏な物音";
    let shortName = "物陰";
    let stateLabel = "未確認 / 不穏な気配";
    let movementHint = "茂みの奥で微かな金属音がする";

    if (stage === "contact") {
      name = "街道の盗賊団";
      shortName = "盗賊";
      stateLabel = "接触可能 / 盗賊と対峙";
      movementHint = "刃を向けてこちらを威嚇している";
    } else if (stage === "discovered") {
      name = "街道を狙う盗賊の待ち伏せ";
      shortName = "盗賊";
      stateLabel = "確認済み / 盗賊の潜伏";
      movementHint = "獲物を狙って息を潜めている";
    }

    return [Object.freeze({
      id: "event-signal:bandit-ambush",
      signalSource: "bandit-ambush",
      stage,
      distance,
      name,
      shortName,
      x: BANDIT_EVENT_POSITION.x,
      y: BANDIT_EVENT_POSITION.y,
      direction: BANDIT_EVENT_POSITION.direction,
      distanceBand: resolveDistanceBand(distance),
      movementHint,
      stateLabel
    })];
  }

  function suspiciousCampfireSignals(input = new Date(), options = {}) {
    const hour = normalizedHour(input);
    if (hour >= 4 && hour < 19) return [];
    const distance = Number.isFinite(Number(options && options.distance))
      ? Number(options.distance)
      : distanceForCoordinates(CAMPFIRE_EVENT_POSITION.x, CAMPFIRE_EVENT_POSITION.y);
    const stage = resolveSignalStage(distance, false, options);

    let name = "暗がりに揺れる火影";
    let shortName = "火影";
    let stateLabel = "未確認 / 遠くの火影";
    let movementHint = "夜闇の中に小さな炎が揺れている";

    if (stage === "contact") {
      name = "遺構の焚き火跡";
      shortName = "焚き火";
      stateLabel = "接触可能 / 痕跡を調査可能";
      movementHint = "燻る灰の周りに足跡が残る";
    } else if (stage === "discovered") {
      name = "遺構跡の怪しい焚き火";
      shortName = "焚き火";
      stateLabel = "確認済み / 遺構の野営";
      movementHint = "古い石組みの影に人が立ち去った跡がある";
    }

    return [Object.freeze({
      id: "event-signal:suspicious-campfire",
      signalSource: "suspicious-campfire",
      stage,
      distance,
      name,
      shortName,
      x: CAMPFIRE_EVENT_POSITION.x,
      y: CAMPFIRE_EVENT_POSITION.y,
      direction: CAMPFIRE_EVENT_POSITION.direction,
      distanceBand: resolveDistanceBand(distance),
      movementHint,
      stateLabel
    })];
  }

  function dynamicEventSignals(input = new Date(), options = {}, root = null) {
    if (options && (options.all || options.includeAll)) {
      return [
        ...roadsideEventSignals(12, options),
        ...banditAmbushSignals(16, options),
        ...suspiciousCampfireSignals(21, options)
      ];
    }
    const list = [
      ...roadsideEventSignals(input, options),
      ...banditAmbushSignals(input, options),
      ...suspiciousCampfireSignals(input, options)
    ];
    if (!root) return list;
    return list.filter((signal) => !isEventResolved(root, signal && signal.signalSource));
  }

  function knownDestinationForSignal(root, npcLife, signal, input = new Date()) {
    if (!signal || !signal.hasRumor || !npcLife || typeof npcLife.snapshotAt !== "function" || typeof npcLife.reunionCandidates !== "function") return null;
    const safe = safeState(root);
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return null;
    const residentId = cleanText(signal.residentId);
    if (!residentId) return null;
    const candidate = npcLife.reunionCandidates(npcLife.snapshotAt(input), discoveries)
      .find((entry) => cleanText(entry && entry.targetId) === residentId);
    const discoveryKey = cleanText(candidate && candidate.discoveryKey);
    const entry = discoveryKey ? discoveries[discoveryKey] : null;
    if (!candidate || !entry || typeof entry !== "object") return null;
    return Object.freeze({ candidate, entry });
  }

  function openKnownDestination(document, root, match, input = new Date()) {
    if (!match || !match.entry) return false;
    let changed = false;
    const Preview = root && root.CrownlessWorldAtlasPreview;
    const Actions = root && root.CrownlessWorldAtlasActionsPresentation;
    const Reunion = root && root.CrownlessWorldAtlasReunionPresentation;
    if (Preview && typeof Preview.syncSelection === "function") changed = Preview.syncSelection(document, root, match.entry) || changed;
    if (Actions && typeof Actions.syncActions === "function") changed = Actions.syncActions(document, root, match.entry) || changed;
    if (Reunion && typeof Reunion.syncReunion === "function") changed = Reunion.syncReunion(document, root, match.entry, input) || changed;
    return changed;
  }

  function openSignalExpedition(document, root, signal, match) {
    if (!signal || !signal.hasRumor || !match || !match.entry) return false;
    const Actions = root && root.CrownlessWorldAtlasActionsPresentation;
    if (!Actions || typeof Actions.openExpedition !== "function") return false;
    return Actions.openExpedition(document, root, match.entry, null) === true;
  }

  function openDynamicEventExpedition(document, root, signal) {
    const Encounters = root && root.CrownlessExpeditionSignalEncounters;
    if (Encounters && typeof Encounters.openSignalExpedition === "function") {
      return Encounters.openSignalExpedition(document, root, signal && signal.signalSource);
    }
    if (Encounters && typeof Encounters.openRoadsideExpedition === "function") {
      return Encounters.openRoadsideExpedition(document, root);
    }
    return false;
  }

  function triggerDirectContact(document, root, signal, match = null, input = new Date()) {
    if (!signal) return false;
    const kind = signal.signalSource === "npc-rumor" || signal.signalSource === "npc-travel" ? "npc" : "event";
    if (kind === "npc") {
      const Reunion = root && root.CrownlessWorldAtlasReunionPresentation;
      if (Reunion && typeof Reunion.createInteractionPanel === "function") {
        const viewer = document && document.getElementById("world-atlas-viewer");
        const detail = viewer && viewer.querySelector(".world-atlas-detail");
        if (detail) {
          const fakeReunion = {
            encounter: {
              npcId: cleanText(signal.residentId, "marco"),
              npcName: cleanText(signal.name, "マルコ"),
              location: "north-road",
              locationLabel: "北の街道",
              destinationName: "北の街道",
              discoveryKey: match && match.entry ? match.entry.key : ""
            }
          };
          const panel = Reunion.createInteractionPanel(document, root, fakeReunion, null);
          detail.appendChild(panel);
          return true;
        }
      }
      return false;
    }

    const Encounters = root && root.CrownlessExpeditionSignalEncounters;
    if (Encounters && typeof Encounters.resolveDirectEncounter === "function") {
      const result = Encounters.resolveDirectEncounter(root, signal.signalSource);
      const viewer = document && document.getElementById("world-atlas-viewer");
      const detail = viewer && viewer.querySelector(".world-atlas-detail");
      if (detail && result) {
        const feedback = document.createElement("p");
        feedback.className = "world-atlas-npc-signal-contact__feedback";
        feedback.textContent = result.message || (result.success ? "解決した。" : "対処できなかった。");
        detail.appendChild(feedback);
        if (result.success) {
          inject(document, root, input);
        }
      }
      return Boolean(result && result.success);
    }
    return false;
  }

  async function rescanNearbyForSignal(document, root) {
    const Atlas = root && root.CrownlessWorldAtlas;
    const Core = root && root.CrownlessCore;
    if (!Atlas || !Core || typeof Atlas.scanNearby !== "function" || typeof Atlas.openAtlas !== "function") {
      return { state: "unavailable", foundCount: 0, newCount: 0, rememberedCount: 0, currentCell: null, cached: false };
    }
    const result = await Atlas.scanNearby(Core, root, { force: true });
    Atlas.openAtlas(document, Core, root, { autoScan: false, scanResult: result, view: "nearby" });
    return result;
  }

  function selectedSignalDetail(document, signal, match = null, onOpenKnown = null, onRescanNearby = null, onDispatchSignal = null, onDirectAction = null) {
    const fragment = document.createDocumentFragment();
    const hasRumor = Boolean(signal && signal.hasRumor);
    const isRoadsideEvent = signal && signal.signalSource === "roadside-disturbance";
    const isBanditEvent = signal && signal.signalSource === "bandit-ambush";
    const isCampfireEvent = signal && signal.signalSource === "suspicious-campfire";
    const isDynamicEvent = isRoadsideEvent || isBanditEvent || isCampfireEvent;
    const stage = signal && signal.stage ? signal.stage : "sensed";

    const kicker = document.createElement("small");
    if (stage === "contact") {
      kicker.textContent = isDynamicEvent ? "NEARBY INCIDENT / 接触可能" : "NEARBY REUNION / 接触可能";
    } else if (stage === "discovered") {
      kicker.textContent = isDynamicEvent ? "CONFIRMED TRACE / 発見" : "ROUTE RUMOR / マルコの気配";
    } else {
      kicker.textContent = isRoadsideEvent
        ? "UNCONFIRMED TRACE / 異変の気配"
        : isBanditEvent
          ? "UNCONFIRMED TRACE / 不穏な気配"
          : isCampfireEvent
            ? "UNCONFIRMED TRACE / 遠くの火影"
            : hasRumor
              ? "ROUTE RUMOR / 人の気配"
              : "TRAVEL TRACE / 人の気配";
    }

    const title = document.createElement("strong");
    title.textContent = signal.name;

    const state = document.createElement("span");
    state.textContent = stage === "contact"
      ? `${signal.direction}・${signal.distanceBand}。${signal.movementHint}。現地で接触できる。`
      : `${signal.direction}・${signal.distanceBand}。${signal.movementHint}。まだ確認済み地点ではない。`;

    const note = document.createElement("em");
    if (stage === "contact") {
      note.textContent = isRoadsideEvent
        ? "負傷した旅人が街道脇で手当を待っている。"
        : isBanditEvent
          ? "盗賊たちが街道を狙って身構えている。"
          : isCampfireEvent
            ? "燻る焚き火の周りに古い石組みの痕跡がある。"
            : "以前Grey Hearthで会ったマルコが荷車を止めている。";
    } else if (stage === "discovered") {
      note.textContent = isRoadsideEvent
        ? "街道脇で旅人が倒れている。怪我をして動けないようだ。"
        : isBanditEvent
          ? "街道の旅人を狙う盗賊の小集団だ。何者かが潜んでいる。"
          : isCampfireEvent
            ? "古い遺構の陰に焚き火の跡がある。誰かの野営跡らしい。"
            : "炉端で聞いた足取りを時間帯ごとに粗く重ねたもの。正確な位置や経路を示す印ではない。";
    } else {
      note.textContent = isRoadsideEvent
        ? "周辺で何か起きているらしい。正体はまだ分からない。正確な位置や経路を示す印ではない。"
        : isBanditEvent
          ? "街道の茂みから金属音がする。正体はまだ分からない。正確な位置や経路を示す印ではない。"
          : isCampfireEvent
            ? "夜陰に紛れて小さな火が揺れている。正体はまだ分からない。正確な位置や経路を示す印ではない。"
            : hasRumor
              ? "炉端で聞いた足取りを時間帯ごとに粗く重ねたもの。正確な位置や経路を示す印ではない。"
              : "誰かが移動しているらしい。人物や行き先はまだ分からない。正確な位置や経路を示す印ではない。";
    }
    fragment.append(kicker, title, state, note);

    if (isDynamicEvent && stage !== "contact" && typeof onRescanNearby === "function") {
      const prompt = document.createElement("p");
      prompt.className = "world-atlas-npc-signal-match";
      prompt.textContent = "少し歩いてから周辺を調べ直せば、この気配の正体につながる痕跡が見つかるかもしれない。";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-atlas-npc-signal-match__open";
      button.textContent = "現在地周辺を調べる";
      button.addEventListener("click", onRescanNearby);
      fragment.append(prompt, button);
    }

    if (stage === "contact" && typeof onDirectAction === "function") {
      const contactBlock = document.createElement("p");
      contactBlock.className = "world-atlas-npc-signal-match world-atlas-npc-signal-contact";
      const contactButton = document.createElement("button");
      contactButton.type = "button";
      contactButton.className = "world-atlas-npc-signal-match__open world-atlas-npc-signal-contact__btn";
      if (isRoadsideEvent) {
        contactBlock.textContent = "現地に到着した。負傷者を直接手当できる。";
        contactButton.textContent = "その場で応急手当する";
      } else if (isBanditEvent) {
        contactBlock.textContent = "盗賊の潜伏場所へ接近した。直接撃退できる。";
        contactButton.textContent = "その場で盗賊を撃退する";
      } else if (isCampfireEvent) {
        contactBlock.textContent = "怪しい焚き火の跡へ到着した。遺構の痕跡を調査できる。";
        contactButton.textContent = "その場で焚き火跡を調べる";
      } else {
        contactBlock.textContent = "マルコの近くに追いついた。直接会話できる。";
        contactButton.textContent = "声をかけて話す";
      }
      contactButton.addEventListener("click", onDirectAction);
      contactBlock.appendChild(contactButton);
      fragment.append(contactBlock);
    }

    if (!isDynamicEvent && hasRumor && match && match.candidate && match.entry) {
      const known = document.createElement("p");
      known.className = "world-atlas-npc-signal-match";
      known.textContent = `探索録の「${cleanText(match.candidate.destinationName, cleanText(match.entry.name, "既知の地点"))}」と足取りが重なる。`;
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "world-atlas-npc-signal-match__open";
      openButton.textContent = "既知の探索地点を開く";
      if (typeof onOpenKnown === "function") openButton.addEventListener("click", onOpenKnown);
      fragment.append(known, openButton);

      if (typeof onDispatchSignal === "function") {
        const dispatchButton = document.createElement("button");
        dispatchButton.type = "button";
        dispatchButton.className = "world-atlas-npc-signal-match__open world-atlas-npc-signal-match__dispatch";
        dispatchButton.textContent = "この気配を追って遠征する";
        dispatchButton.addEventListener("click", onDispatchSignal);
        fragment.appendChild(dispatchButton);
      }
    }
    return fragment;
  }

  function preferredStableAction(entry, actionsApi) {
    if (!entry || !actionsApi || typeof actionsApi.buildDiscoveryActions !== "function") return null;
    const actions = actionsApi.buildDiscoveryActions(entry);
    if (!Array.isArray(actions) || !actions.length) return null;
    const contentKind = cleanText(entry.contentKind, "unknown");
    const priority = contentKind === "event" || contentKind === "encounter"
      ? ["event", "expedition", "facility"]
      : contentKind === "facility"
        ? ["facility", "event", "expedition"]
        : ["expedition", "event", "facility"];
    return priority.map((kind) => actions.find((action) => action && action.kind === kind)).find(Boolean) || actions[0];
  }

  function stableOpportunity(entry, actionsApi) {
    const action = preferredStableAction(entry, actionsApi);
    if (!action) return null;
    const name = cleanText(entry && entry.name, "発見地点");
    const key = cleanText(entry && entry.key, name);
    return Object.freeze({
      id: `place:${key}:${cleanText(action.kind, "action")}`,
      source: "place",
      actionKind: cleanText(action.kind, "action"),
      title: `${cleanText(action.label, "地点を調べる")} · ${name}`,
      note: cleanText(action.note, "探索録に残した地点を開く。"),
      discoveryKey: cleanText(entry && entry.key)
    });
  }

  function signalOpportunity(signal, kind = "event") {
    if (!signal) return null;
    const signalKind = kind === "npc" ? "npc" : "event";
    const stage = cleanText(signal.stage, "sensed");
    let verb = "気配を追う";
    if (stage === "contact") verb = signalKind === "npc" ? "声をかける" : "現地で対処する";
    else if (signalKind === "npc") verb = signal.hasRumor ? "足取りを追う" : "人影を確かめる";
    else if (stage === "discovered") verb = "異変を確かめる";
    const target = cleanText(signal.shortName, cleanText(signal.name, "気配"));
    return Object.freeze({
      id: cleanText(signal.id, `signal:${cleanText(signal.signalSource, target)}`),
      source: "signal",
      signalKind,
      signalSource: cleanText(signal.signalSource),
      title: `${verb} · ${target}`,
      note: `${cleanText(signal.direction, "方角不明")} · ${cleanText(signal.distanceBand, "少し先の気配")}`
    });
  }

  function chooseNextActionOpportunities(signalOptions, stableOptions, limit = 2) {
    const cap = Math.max(1, Number(limit) || 2);
    const signals = (Array.isArray(signalOptions) ? signalOptions : []).filter(Boolean);
    const stable = (Array.isArray(stableOptions) ? stableOptions : []).filter(Boolean);
    const chosen = [];
    if (signals.length && stable.length) {
      chosen.push(signals[0], stable[0]);
    } else {
      chosen.push(...signals.slice(0, cap), ...stable.slice(0, cap));
    }
    if (chosen.length < cap) {
      [...signals.slice(1), ...stable.slice(1)].forEach((option) => {
        if (chosen.length < cap && !chosen.includes(option)) chosen.push(option);
      });
    }
    return chosen.slice(0, cap);
  }

  function entryForStableMarker(root, marker) {
    const preview = root && root.CrownlessWorldAtlasPreview;
    if (preview && typeof preview.entryForTarget === "function") {
      const entry = preview.entryForTarget(root, marker);
      if (entry) return entry;
    }
    const safe = safeState(root);
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return null;
    const aria = cleanText(marker && marker.getAttribute && marker.getAttribute("aria-label"));
    const name = cleanText(aria.split("。")[0]);
    return Object.values(discoveries).find((entry) => cleanText(entry && entry.name) === name) || null;
  }

  function signalRecordPriority(record) {
    if (!record || !record.signal) return 0;
    if (record.signal.stage === "contact") return 4;
    if (record.kind === "event") return 3;
    if (record.signal.hasRumor) return 2;
    return 1;
  }

  function renderNextActions(document, root, map, signalRecords = []) {
    if (!document || !map) return 0;
    map.querySelector(".world-atlas-next-actions")?.remove();
    const actionsApi = root && root.CrownlessDiscoveryActions;
    const stableRecords = Array.from(map.querySelectorAll(".world-atlas-nearby-marker:not(.world-atlas-nearby-marker--npc-signal):not(.world-atlas-nearby-marker--event-signal)"))
      .map((marker) => {
        const entry = entryForStableMarker(root, marker);
        const opportunity = stableOpportunity(entry, actionsApi);
        return opportunity ? { ...opportunity, marker } : null;
      })
      .filter(Boolean);
    const transientRecords = (Array.isArray(signalRecords) ? signalRecords : [])
      .slice()
      .sort((a, b) => signalRecordPriority(b) - signalRecordPriority(a))
      .map((record) => {
        const opportunity = signalOpportunity(record.signal, record.kind);
        return opportunity ? { ...opportunity, marker: record.marker } : null;
      })
      .filter(Boolean);
    const choices = chooseNextActionOpportunities(transientRecords, stableRecords, 2);
    if (!choices.length) return 0;

    const panel = document.createElement("section");
    panel.className = "world-atlas-next-actions";
    panel.setAttribute("aria-label", "次にやること");
    const kicker = document.createElement("small");
    kicker.textContent = "NEXT MOVES / 次にやること";
    const list = document.createElement("div");
    list.className = "world-atlas-next-actions__list";
    choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-atlas-next-action";
      button.dataset.nextActionSource = choice.source;
      if (choice.actionKind) button.dataset.nextActionKind = choice.actionKind;
      if (choice.signalSource) button.dataset.atlasSignalSource = choice.signalSource;
      button.setAttribute("aria-label", `${choice.title}。${choice.note}`);
      const title = document.createElement("strong");
      title.textContent = choice.title;
      const note = document.createElement("span");
      note.textContent = choice.note;
      button.append(title, note);
      button.addEventListener("click", () => {
        if (choice.marker && typeof choice.marker.click === "function") choice.marker.click();
      });
      list.appendChild(button);
    });
    panel.append(kicker, list);
    map.appendChild(panel);
    return choices.length;
  }

  function inject(document, root, input = new Date(), options = {}) {
    const map = document && document.querySelector(".world-atlas-map--nearby");
    if (!map) return 0;

    Array.from(map.querySelectorAll(".world-atlas-nearby-marker--npc-signal, .world-atlas-nearby-marker--event-signal")).forEach((node) => node.remove());
    const npcLife = root && root.CrownlessNpcLife;
    const signals = [
      ...travelingSignals(npcLife, input, options).map((signal) => ({ signal, kind: "npc" })),
      ...dynamicEventSignals(input, options, root).map((signal) => ({ signal, kind: "event" }))
    ];
    const signalRecords = [];

    signals.forEach(({ signal, kind }, index) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = `world-atlas-nearby-marker world-atlas-nearby-marker--${kind === "event" ? "event" : "npc"}-signal`;
      marker.style.left = `${signal.x}%`;
      marker.style.top = `${signal.y}%`;
      marker.dataset.labelHorizontal = signal.x >= 72 ? "inset-right" : signal.x <= 28 ? "inset-left" : "center";
      marker.dataset.labelVertical = signal.y >= 66 ? "above" : "below";
      marker.dataset.atlasSignalSource = signal.signalSource;
      marker.dataset.signalStage = signal.stage || "sensed";
      marker.setAttribute("aria-label", `${signal.name}。${signal.direction}、${signal.distanceBand}。${signal.movementHint}。${signal.stateLabel}。`);

      const glyph = document.createElement("i");
      glyph.textContent = kind === "event" ? "※" : "◌";
      const number = document.createElement("small");
      number.textContent = `${kind === "event" ? "E" : "N"}${index + 1}`;
      const label = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = signal.name;
      const em = document.createElement("em");
      em.textContent = `${signal.direction} · ${signal.movementHint}`;
      label.append(strong, em);
      marker.append(glyph, number, label);

      marker.addEventListener("click", () => {
        const viewer = document.getElementById("world-atlas-viewer");
        const detail = viewer && viewer.querySelector(".world-atlas-detail");
        const match = kind === "npc" ? knownDestinationForSignal(root, npcLife, signal, input) : null;
        if (detail) {
          detail.replaceChildren(selectedSignalDetail(
            document,
            signal,
            match,
            () => {
              openKnownDestination(document, root, match, input);
            },
            kind === "event" ? () => {
              rescanNearbyForSignal(document, root);
            } : null,
            kind === "npc" && match ? () => {
              openSignalExpedition(document, root, signal, match);
            } : () => {
              openDynamicEventExpedition(document, root, signal);
            },
            () => {
              triggerDirectContact(document, root, signal, match, input);
            }
          ));
        }
        Array.from(map.querySelectorAll(".world-atlas-nearby-marker")).forEach((node) => node.classList.toggle("active", node === marker));
      });
      map.appendChild(marker);
      signalRecords.push({ signal, kind, marker });
    });
    renderNextActions(document, root, map, signalRecords);
    return signals.length;
  }

  function addedNearbyMap(record) {
    return Array.from(record && record.addedNodes || []).some((node) => node && node.nodeType === 1 && (
      node.matches?.(".world-atlas-map--nearby, #world-atlas-viewer")
      || node.querySelector?.(".world-atlas-map--nearby")
    ));
  }

  function install(document, root) {
    if (!document || !root || root.__worldAtlasNpcSignalsInstalled) return false;
    const refresh = () => inject(document, root);
    const observer = typeof root.MutationObserver === "function"
      ? new root.MutationObserver((records) => {
        if (records.some(addedNearbyMap)) refresh();
      })
      : null;
    if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true });
    if (typeof root.addEventListener === "function") root.addEventListener("crownless:world-knowledge-updated", refresh);
    root.__worldAtlasNpcSignalsInstalled = true;
    refresh();
    return true;
  }

  return Object.freeze({
    SIGNAL_POSITIONS,
    NORTH_ROUTE_POSITIONS,
    NORTH_ROUTE_POSITION,
    ROADSIDE_EVENT_POSITION,
    BANDIT_EVENT_POSITION,
    CAMPFIRE_EVENT_POSITION,
    distanceForCoordinates,
    resolveSignalStage,
    resolveDistanceBand,
    isEventResolved,
    normalizedHour,
    northRoutePositionForHour,
    positionForLead,
    travelingSignals,
    roadsideEventSignals,
    banditAmbushSignals,
    suspiciousCampfireSignals,
    dynamicEventSignals,
    knownDestinationForSignal,
    openKnownDestination,
    openSignalExpedition,
    openDynamicEventExpedition,
    triggerDirectContact,
    rescanNearbyForSignal,
    selectedSignalDetail,
    preferredStableAction,
    stableOpportunity,
    signalOpportunity,
    chooseNextActionOpportunities,
    entryForStableMarker,
    renderNextActions,
    inject,
    addedNearbyMap,
    install
  });
});

