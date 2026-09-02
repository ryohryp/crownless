((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessNpcLife = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  "use strict";

  const LOCATIONS = Object.freeze({
    HEARTH: "grey-hearth",
    FORGE: "forge",
    MARKET: "market",
    ROAD: "north-road",
    TAVERN: "tavern",
    HOME: "home",
    INN: "inn",
    HERB_GARDEN: "herb-garden",
    RIVERBANK: "riverbank"
  });

  const LOCATION_LABELS = Object.freeze({
    [LOCATIONS.HEARTH]: "灰炉",
    [LOCATIONS.FORGE]: "工房",
    [LOCATIONS.MARKET]: "市場",
    [LOCATIONS.ROAD]: "北の街道",
    [LOCATIONS.TAVERN]: "酒場",
    [LOCATIONS.HOME]: "自宅",
    [LOCATIONS.INN]: "宿",
    [LOCATIONS.HERB_GARDEN]: "薬草畑",
    [LOCATIONS.RIVERBANK]: "川辺"
  });

  const STATES = Object.freeze({
    NORMAL: "normal",
    TRAVELING: "traveling"
  });

  const STATE_LABELS = Object.freeze({
    [STATES.NORMAL]: "普段どおり",
    [STATES.TRAVELING]: "旅の途中"
  });

  const RELATIONSHIPS = Object.freeze([
    Object.freeze({
      id: "mira-tracks-marco-route",
      sourceId: "mira",
      targetId: "marco",
      kind: "trade-contact",
      line: "マルコなら北の街道へ向かったよ。帰りに薬瓶を運んでくれるって。",
      explorationLead: Object.freeze({
        location: LOCATIONS.ROAD,
        locationLabel: LOCATION_LABELS[LOCATIONS.ROAD],
        reason: "旅の途中のマルコを追えば、街道で何か見つかるかもしれない。"
      })
    })
  ]);

  const RESIDENTS = Object.freeze([
    Object.freeze({
      id: "edgar",
      name: "エドガー",
      role: "鍛冶屋",
      schedule: Object.freeze([
        Object.freeze({ from: 0, location: LOCATIONS.HOME }),
        Object.freeze({ from: 6, location: LOCATIONS.FORGE }),
        Object.freeze({ from: 10, location: LOCATIONS.MARKET }),
        Object.freeze({ from: 13, location: LOCATIONS.FORGE }),
        Object.freeze({ from: 19, location: LOCATIONS.TAVERN }),
        Object.freeze({ from: 23, location: LOCATIONS.HOME })
      ])
    }),
    Object.freeze({
      id: "marco",
      name: "マルコ",
      role: "行商人",
      schedule: Object.freeze([
        Object.freeze({ from: 0, location: LOCATIONS.INN }),
        Object.freeze({ from: 6, location: LOCATIONS.HEARTH, activity: "荷支度中" }),
        Object.freeze({ from: 9, location: LOCATIONS.ROAD }),
        Object.freeze({ from: 14, location: LOCATIONS.MARKET }),
        Object.freeze({ from: 19, location: LOCATIONS.TAVERN }),
        Object.freeze({ from: 23, location: LOCATIONS.INN })
      ])
    }),
    Object.freeze({
      id: "mira",
      name: "ミラ",
      role: "薬師",
      schedule: Object.freeze([
        Object.freeze({ from: 0, location: LOCATIONS.HEARTH, activity: "火の番" }),
        Object.freeze({ from: 6, location: LOCATIONS.HERB_GARDEN }),
        Object.freeze({ from: 10, location: LOCATIONS.HEARTH, activity: "薬瓶を整理中" }),
        Object.freeze({ from: 14, location: LOCATIONS.RIVERBANK }),
        Object.freeze({ from: 18, location: LOCATIONS.HEARTH, activity: "薬草を選り分け中" })
      ])
    })
  ]);

  function normalizeHour(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return ((Math.floor(numeric) % 24) + 24) % 24;
  }

  function timeOfDayLabel(value) {
    const hour = normalizeHour(value);
    if (hour < 6) return "深夜";
    if (hour < 10) return "朝";
    if (hour < 17) return "昼";
    if (hour < 21) return "夕暮れ";
    return "夜";
  }

  function scheduleSlotAtHour(resident, hour) {
    const normalized = normalizeHour(hour);
    let slot = resident.schedule[0];
    for (const candidate of resident.schedule) {
      if (normalized < candidate.from) break;
      slot = candidate;
    }
    return slot;
  }

  function locationAtHour(resident, hour) {
    return scheduleSlotAtHour(resident, hour).location;
  }

  function stateAtHour(resident, hour) {
    const location = locationAtHour(resident, hour);
    if (resident.id === "marco" && location === LOCATIONS.ROAD) return STATES.TRAVELING;
    return STATES.NORMAL;
  }

  function snapshotAt(input = new Date()) {
    const hour = input instanceof Date ? input.getHours() : normalizeHour(input);
    return RESIDENTS.map((resident) => {
      const slot = scheduleSlotAtHour(resident, hour);
      const location = slot.location;
      const state = stateAtHour(resident, hour);
      return Object.freeze({
        id: resident.id,
        name: resident.name,
        role: resident.role,
        hour,
        location,
        locationLabel: LOCATION_LABELS[location] || location,
        state,
        stateLabel: STATE_LABELS[state] || state,
        atHearth: location === LOCATIONS.HEARTH,
        activity: location === LOCATIONS.HEARTH ? String(slot.activity || "") : ""
      });
    });
  }

  function hearthMovementChanges(previousSnapshot, currentSnapshot) {
    const previous = Array.isArray(previousSnapshot) ? previousSnapshot : [];
    const current = Array.isArray(currentSnapshot) ? currentSnapshot : [];
    const previousById = new Map(previous.map((resident) => [resident.id, resident]));
    return current.flatMap((resident) => {
      const before = previousById.get(resident.id);
      if (!before || Boolean(before.atHearth) === Boolean(resident.atHearth)) return [];
      return [Object.freeze({
        residentId: resident.id,
        residentName: resident.name,
        direction: resident.atHearth ? "arrived" : "left",
        text: resident.atHearth
          ? `${resident.name}が炉端へ戻ってきた。`
          : `${resident.name}は炉端を離れて出かけた。`
      })];
    });
  }

  function relationshipLines(snapshot) {
    const residents = Array.isArray(snapshot) ? snapshot : [];
    const byId = new Map(residents.map((resident) => [resident.id, resident]));
    return RELATIONSHIPS.flatMap((relationship) => {
      const source = byId.get(relationship.sourceId);
      const target = byId.get(relationship.targetId);
      if (!source || !target || !source.atHearth) return [];
      if (target.state !== STATES.TRAVELING || target.location !== LOCATIONS.ROAD) return [];
      return [Object.freeze({
        relationshipId: relationship.id,
        speakerId: source.id,
        speakerName: source.name,
        targetId: target.id,
        text: relationship.line
      })];
    });
  }

  function explorationLeads(snapshot) {
    const activeLines = relationshipLines(snapshot);
    return activeLines.flatMap((line) => {
      const relationship = RELATIONSHIPS.find((entry) => entry.id === line.relationshipId);
      if (!relationship || !relationship.explorationLead) return [];
      const lead = relationship.explorationLead;
      return [Object.freeze({
        relationshipId: relationship.id,
        sourceId: line.speakerId,
        targetId: line.targetId,
        location: lead.location,
        locationLabel: lead.locationLabel,
        reason: lead.reason
      })];
    });
  }

  function knownDestinationEntries(knownDestinations) {
    if (Array.isArray(knownDestinations)) return knownDestinations;
    if (knownDestinations && typeof knownDestinations === "object") return Object.values(knownDestinations);
    return [];
  }

  function destinationMatchesLead(destination, lead) {
    if (!destination || typeof destination !== "object") return false;
    const stableLocation = destination.location || destination.locationId || destination.regionId;
    if (stableLocation && stableLocation === lead.location) return true;
    const label = String(destination.title || destination.name || destination.baseTitle || "");
    return Boolean(lead.locationLabel && label.includes(lead.locationLabel));
  }

  function reunionCandidates(snapshot, knownDestinations) {
    const residents = Array.isArray(snapshot) ? snapshot : [];
    const byId = new Map(residents.map((resident) => [resident.id, resident]));
    const destinations = knownDestinationEntries(knownDestinations);
    return explorationLeads(residents).flatMap((lead) => {
      const target = byId.get(lead.targetId);
      if (!target || target.state !== STATES.TRAVELING || target.location !== lead.location) return [];
      return destinations
        .filter((destination) => destinationMatchesLead(destination, lead))
        .map((destination) => Object.freeze({
          targetId: target.id,
          targetName: target.name,
          location: lead.location,
          locationLabel: lead.locationLabel,
          discoveryKey: String(destination.key || destination.id || ""),
          destinationName: String(destination.title || destination.name || destination.baseTitle || lead.locationLabel),
          reason: `${target.name}が${lead.locationLabel}を旅している。既知の場所なら再会できるかもしれない。`
        }));
    });
  }

  function formatAwayResident(resident) {
    const state = resident.state && resident.state !== STATES.NORMAL ? `・${resident.stateLabel || resident.state}` : "";
    const role = resident.role ? `${resident.role}・` : "";
    return `${resident.name}（${role}不在${state}）`;
  }

  function formatPresentResident(resident) {
    const activity = resident.activity ? `・${resident.activity}` : "";
    return `${resident.name}（${resident.role}）${activity}`;
  }

  function formatHearthStatus(snapshot) {
    const residents = Array.isArray(snapshot) ? snapshot : [];
    const lines = relationshipLines(residents);
    const leads = explorationLeads(residents);
    const dialogue = lines.length
      ? ` / ${lines.map((line) => `${line.speakerName}「${line.text}」`).join(" / ")}`
      : "";
    const exploration = leads.length
      ? ` / 探索の手がかり: ${leads.map((lead) => `${lead.locationLabel} — ${lead.reason}`).join(" / ")}`
      : "";
    const period = residents.length ? `${timeOfDayLabel(residents[0].hour)}の炉端 — ` : "";
    const present = residents.filter((resident) => resident.atHearth);
    if (present.length) {
      const names = present.map(formatPresentResident).join("、");
      const away = residents.filter((resident) => !resident.atHearth);
      const absence = away.length
        ? ` / 不在: ${away.map(formatAwayResident).join("、")}`
        : "";
      return `${period}炉端にいる: ${names}${absence}${dialogue}${exploration}`;
    }
    if (!residents.length) return "住人の気配はまだない。";
    return `${period}炉端は空席 / 不在: ${residents.map(formatAwayResident).join("、")}${dialogue}${exploration}`;
  }

  return Object.freeze({
    LOCATIONS,
    STATES,
    RELATIONSHIPS,
    RESIDENTS,
    normalizeHour,
    timeOfDayLabel,
    locationAtHour,
    stateAtHour,
    snapshotAt,
    hearthMovementChanges,
    relationshipLines,
    explorationLeads,
    reunionCandidates,
    formatHearthStatus
  });
});