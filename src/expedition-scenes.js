"use strict";

(function expeditionScenesModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionScenes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function expeditionScenesFactory() {
  const SCENE_VERSION = "expedition-scenes-v1";
  const MAX_SCENES = 5;

  const VISUALS = Object.freeze({
    "hearth.departure": Object.freeze({
      motif: "hearth",
      assetPath: "assets/hearth/concepts/grey-hearth-empty-room-v0.2.png",
      assetRole: "backdrop",
      alt: "灰炉から遠征へ出る場面",
    }),
    "hearth.return": Object.freeze({
      motif: "hearth-return",
      assetPath: "assets/hearth/concepts/grey-hearth-empty-room-v0.2.png",
      assetRole: "backdrop",
      alt: "灰炉へ帰還する場面",
    }),
    "forest.arrival": Object.freeze({ motif: "forest", glyph: "♧", alt: "森へ踏み入る場面" }),
    "village.arrival": Object.freeze({ motif: "village", glyph: "⌂", alt: "廃村へ踏み入る場面" }),
    "cave.arrival": Object.freeze({ motif: "cave", glyph: "◆", alt: "洞窟へ踏み入る場面" }),
    "unknown.arrival": Object.freeze({ motif: "road", glyph: "✦", alt: "遠征先へ到着する場面" }),
    "combat.beast": Object.freeze({
      motif: "combat-beast",
      assetPath: "assets/combat/minimal-v0.1/actors/enemy-rusher.png",
      assetRole: "figure",
      alt: "獣との遭遇",
    }),
    "combat.bandit": Object.freeze({
      motif: "combat-bandit",
      assetPath: "assets/combat/minimal-v0.1/actors/enemy-guard.png",
      assetRole: "figure",
      alt: "山賊との遭遇",
    }),
    "combat.other": Object.freeze({ motif: "combat", glyph: "⚔", alt: "敵との遭遇" }),
    "combat.turning": Object.freeze({ motif: "turning", glyph: "／", alt: "戦況が動いた場面" }),
    "injury.wound": Object.freeze({ motif: "injury", glyph: "✚", alt: "仲間が負傷した場面" }),
    "loot.weapon": Object.freeze({
      motif: "loot",
      assetPath: "assets/combat/minimal-v0.1/weapons/dropped-sword.png",
      assetRole: "relic",
      alt: "持ち帰る武器を見つけた場面",
    }),
    "loot.find": Object.freeze({ motif: "loot", glyph: "✦", alt: "戦利品を見つけた場面" }),
    "discovery.knowledge": Object.freeze({ motif: "discovery", glyph: "⌖", alt: "新しい手がかりを記録した場面" }),
    "retreat.return": Object.freeze({ motif: "retreat", glyph: "↩", alt: "撤退を決めた場面" }),
    "defeat.return": Object.freeze({ motif: "defeat", glyph: "×", alt: "敗走した場面" }),
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function shorten(value, max = 170) {
    const text = normalizeText(value);
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
  }

  function eventId(entry, index) {
    return String(entry && (entry.eventId || entry.id) || `log-${index}`);
  }

  function logEntries(report) {
    return Array.isArray(report && report.log) ? report.log : [];
  }

  function indexedLog(report) {
    return logEntries(report).map((entry, index) => ({ entry, index, id: eventId(entry, index) }));
  }

  function firstByType(entries, types) {
    const wanted = new Set(types);
    return entries.find(({ entry }) => wanted.has(entry && entry.type)) || null;
  }

  function familyFor(report, destinations) {
    const destination = Array.isArray(destinations)
      ? destinations.find((item) => item && item.id === report.destinationId)
      : null;
    if (destination && destination.family) return destination.family;
    const id = String(report.destinationId || "").toLowerCase();
    const name = String(report.destinationName || "");
    if (id.includes("forest") || /森|林/.test(name)) return "forest";
    if (id.includes("village") || /村|集落/.test(name)) return "village";
    if (id.includes("cave") || id.includes("mine") || /洞窟|洞穴|坑|鉱/.test(name)) return "cave";
    return "unknown";
  }

  function visualForCombat(report, battle) {
    const encounter = Array.isArray(report && report.combat && report.combat.encounters)
      ? report.combat.encounters.find((item) => item && (!battle || item.encounterId === battle.encounterId))
      : null;
    const tags = new Set(encounter && encounter.enemyTags || []);
    if (tags.has("beast")) return "combat.beast";
    if (tags.has("bandit")) return "combat.bandit";
    return "combat.other";
  }

  function makeScene(report, data) {
    const sourceEventIds = Array.from(new Set((data.sourceEventIds || []).map(String)));
    const suffix = sourceEventIds.join("-") || data.kind;
    return {
      sceneId: `${report.expeditionId || report.seed || "expedition"}:${data.kind}:${suffix}`,
      kind: data.kind,
      phase: data.phase,
      headline: normalizeText(data.headline),
      caption: shorten(data.caption),
      actorIds: Array.from(new Set((data.actorIds || []).filter(Boolean).map(String))),
      locationId: report.destinationId || null,
      visualKey: data.visualKey,
      priority: data.priority,
      sourceEventIds,
    };
  }

  function openingScenes(report, entries, destinations) {
    const scenes = [];
    const departure = firstByType(entries, ["departure"]);
    const arrival = firstByType(entries, ["arrival"]);
    if (departure) {
      scenes.push(makeScene(report, {
        kind: "departure",
        phase: "opening",
        headline: "灰炉を出る",
        caption: departure.entry.text,
        actorIds: report.companionIds,
        visualKey: "hearth.departure",
        priority: 100,
        sourceEventIds: [departure.id],
      }));
    }
    if (arrival) {
      const family = familyFor(report, destinations);
      scenes.push(makeScene(report, {
        kind: "arrival",
        phase: "opening",
        headline: report.destinationName || "遠征先",
        caption: arrival.entry.text,
        actorIds: report.companionIds,
        visualKey: `${family}.arrival`,
        priority: 96,
        sourceEventIds: [arrival.id],
      }));
    }
    return scenes;
  }

  function battleCandidates(report, entries, expeditionNarrative) {
    const battles = expeditionNarrative && Array.isArray(expeditionNarrative.battles) ? expeditionNarrative.battles : [];
    if (!battles.length) {
      const encounter = firstByType(entries, ["combat-encounter"]);
      if (!encounter) return [];
      return [makeScene(report, {
        kind: "combat",
        phase: "middle",
        headline: "接敵",
        caption: encounter.entry.text,
        actorIds: report.companionIds,
        visualKey: visualForCombat(report, null),
        priority: 77,
        sourceEventIds: [encounter.id],
      })];
    }

    const candidates = [];
    battles.forEach((battle, battleIndex) => {
      const encounter = entries.find(({ entry }) => entry && entry.type === "combat-encounter" && normalizeText(entry.text).includes(battle.encounterName))
        || entries.filter(({ entry }) => entry && entry.type === "combat-encounter")[battleIndex]
        || null;
      const opening = (battle.lines || []).find((line) => line.phase === "opening") || (battle.lines || [])[0];
      if (opening) {
        candidates.push(makeScene(report, {
          kind: "combat",
          phase: "middle",
          headline: battle.encounterName || "接敵",
          caption: opening.text,
          actorIds: battle.actorIds || [opening.actorId],
          visualKey: visualForCombat(report, battle),
          priority: 78 + Math.min(2, battleIndex),
          sourceEventIds: encounter ? [encounter.id] : [`battle-${battleIndex}`],
        }));
      }

      const turning = (battle.lines || []).find((line) => line.phase === "turning-point")
        || (battle.lines || []).find((line) => line.phase === "pressure")
        || (battle.lines || []).find((line) => line.phase === "finish");
      if (turning && turning !== opening) {
        candidates.push(makeScene(report, {
          kind: "turning-point",
          phase: "middle",
          headline: battle.outcome === "victory" ? "戦況が傾く" : "退き際",
          caption: turning.text,
          actorIds: [turning.actorId].filter(Boolean),
          visualKey: "combat.turning",
          priority: battle.outcome === "victory" ? 84 : 89,
          sourceEventIds: encounter ? [encounter.id, `battle-${battleIndex}-${turning.phase}`] : [`battle-${battleIndex}-${turning.phase}`],
        }));
      }
    });
    return candidates;
  }

  function consequenceCandidates(report, entries) {
    const candidates = [];
    const injury = firstByType(entries, ["injury"]);
    if (injury || (Array.isArray(report.injuries) && report.injuries.length)) {
      candidates.push(makeScene(report, {
        kind: "injury",
        phase: "middle",
        headline: "傷を負う",
        caption: injury ? injury.entry.text : "遠征の途中で仲間が傷を負った。",
        actorIds: report.injuries || [],
        visualKey: "injury.wound",
        priority: 98,
        sourceEventIds: injury ? [injury.id] : ["report-injury"],
      }));
    }

    const defeat = firstByType(entries, ["combat-defeat"]);
    const retreat = firstByType(entries, ["combat-retreat", "retreat"]);
    if (defeat) {
      candidates.push(makeScene(report, {
        kind: "defeat",
        phase: "middle",
        headline: "隊列が崩れる",
        caption: defeat.entry.text,
        actorIds: report.companionIds,
        visualKey: "defeat.return",
        priority: 100,
        sourceEventIds: [defeat.id],
      }));
    } else if (retreat || report.outcome === "early-return") {
      candidates.push(makeScene(report, {
        kind: "retreat",
        phase: "middle",
        headline: "帰路を選ぶ",
        caption: retreat ? retreat.entry.text : "これ以上は追わず、灰炉へ戻ることを選んだ。",
        actorIds: report.companionIds,
        visualKey: "retreat.return",
        priority: 97,
        sourceEventIds: retreat ? [retreat.id] : ["report-retreat"],
      }));
    }

    const discovery = firstByType(entries, ["discovery"]);
    if (discovery || (Array.isArray(report.discoveries) && report.discoveries.length)) {
      const name = report.discoveries && report.discoveries[0] && report.discoveries[0].name;
      candidates.push(makeScene(report, {
        kind: "discovery",
        phase: "middle",
        headline: "霧の先を知る",
        caption: discovery ? discovery.entry.text : `${name || "新しい手がかり"}を記録した。`,
        actorIds: report.companionIds,
        visualKey: "discovery.knowledge",
        priority: 92,
        sourceEventIds: discovery ? [discovery.id] : ["report-discovery"],
      }));
    }

    const lootEvents = entries.filter(({ entry }) => entry && ["combat-loot", "loot"].includes(entry.type));
    const lootEvent = lootEvents[lootEvents.length - 1] || null;
    if (lootEvent || (Array.isArray(report.loot) && report.loot.length)) {
      const items = Array.isArray(report.loot) ? report.loot : [];
      const important = items.find((item) => (item.tags || []).some((tag) => ["valuable", "authority", "cut", "ore"].includes(tag))) || items[0];
      const isWeapon = Boolean(important && (important.tags || []).some((tag) => ["cut", "authority"].includes(tag)));
      candidates.push(makeScene(report, {
        kind: "loot",
        phase: "middle",
        headline: important ? important.name : "戦利品",
        caption: lootEvent ? lootEvent.entry.text : `${important ? important.name : "戦利品"}を持ち帰ることにした。`,
        actorIds: report.companionIds,
        visualKey: isWeapon ? "loot.weapon" : "loot.find",
        priority: important && (important.tags || []).includes("valuable") ? 94 : 88,
        sourceEventIds: lootEvent ? [lootEvent.id] : ["report-loot"],
      }));
    }

    return candidates;
  }

  function endingScene(report, entries) {
    const returned = firstByType(entries, ["return"]);
    const outcome = report.outcome || "success";
    const headline = outcome === "failed" ? "それでも灰炉へ" : outcome === "early-return" ? "早い帰還" : "灰炉の灯り";
    const fallback = outcome === "failed" ? "傷ついた隊が、どうにか灰炉へ運び戻された。" : "遠征隊は灰炉へ帰還した。";
    return makeScene(report, {
      kind: "return",
      phase: "ending",
      headline,
      caption: returned ? returned.entry.text : fallback,
      actorIds: report.companionIds,
      visualKey: "hearth.return",
      priority: 100,
      sourceEventIds: returned ? [returned.id] : ["report-return"],
    });
  }

  function dedupeCandidates(candidates) {
    const seenKinds = new Set();
    const seenCaptions = new Set();
    return candidates.filter((scene) => {
      const captionKey = scene.caption.toLowerCase();
      if (seenKinds.has(scene.kind) || seenCaptions.has(captionKey)) return false;
      seenKinds.add(scene.kind);
      seenCaptions.add(captionKey);
      return true;
    });
  }

  function buildExpeditionScenes(input) {
    const report = input && input.report ? input.report : null;
    if (!report) return { version: SCENE_VERSION, expeditionId: null, scenes: [] };
    const entries = indexedLog(report);
    const openings = openingScenes(report, entries, input.destinations);
    const middles = dedupeCandidates([
      ...consequenceCandidates(report, entries),
      ...battleCandidates(report, entries, input.narrative),
    ]).sort((a, b) => b.priority - a.priority || a.sceneId.localeCompare(b.sceneId));
    const ending = endingScene(report, entries);

    const scenes = [];
    openings.slice(0, 2).forEach((scene) => scenes.push(scene));
    const middleSlots = Math.max(0, MAX_SCENES - scenes.length - 1);
    middles.slice(0, middleSlots).forEach((scene) => scenes.push(scene));
    scenes.push(ending);

    if (scenes.length < 3 && middles.length) {
      const missing = middles.find((scene) => !scenes.some((chosen) => chosen.sceneId === scene.sceneId));
      if (missing) scenes.splice(Math.max(1, scenes.length - 1), 0, missing);
    }

    return {
      version: SCENE_VERSION,
      expeditionId: report.expeditionId || null,
      seed: report.seed,
      scenes: scenes.slice(0, MAX_SCENES),
    };
  }

  function resolveVisual(visualKey) {
    const key = VISUALS[visualKey] ? visualKey : "unknown.arrival";
    return { key, ...clone(VISUALS[key]) };
  }

  return { SCENE_VERSION, MAX_SCENES, VISUALS, buildExpeditionScenes, resolveVisual };
});
