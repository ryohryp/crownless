"use strict";

(function expeditionScenesModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionScenes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function expeditionScenesFactory() {
  const SCENE_VERSION = "expedition-scenes-v2";
  const MAX_SCENES = 5;
  const MAX_COMBAT_SCENES = 3;

  const VISUALS = Object.freeze({
    // Kept for compatibility with already-materialized scene keys. The v2
    // selector no longer spends representative-scene slots on departure or arrival.
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
      alt: "獣との戦闘",
    }),
    "combat.bandit": Object.freeze({
      motif: "combat-bandit",
      assetPath: "assets/combat/minimal-v0.1/actors/enemy-guard.png",
      assetRole: "figure",
      alt: "山賊との戦闘",
    }),
    "combat.other": Object.freeze({ motif: "combat", glyph: "⚔", alt: "敵との戦闘" }),
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

  function combatEncounters(report) {
    return Array.isArray(report && report.combat && report.combat.encounters) ? report.combat.encounters : [];
  }

  function visualForCombat(report, battle) {
    const encounter = combatEncounters(report)
      .find((item) => item && (!battle || item.encounterId === battle.encounterId));
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
      copySource: data.copySource || "report-log",
      actorIds: Array.from(new Set((data.actorIds || []).filter(Boolean).map(String))),
      locationId: report.destinationId || null,
      visualKey: data.visualKey,
      priority: data.priority,
      sourceEventIds,
    };
  }

  function isCombatScene(scene) {
    return Boolean(scene && (scene.kind === "combat" || scene.kind.startsWith("combat-")));
  }

  function combatPriority(combat, outcome, battleIndex) {
    let priority = 90 + Math.min(2, battleIndex);
    if (outcome === "defeat") return 100;
    if (outcome === "retreat") return 98;
    const maxHp = Number(combat && combat.maxHp) || Number(combat && combat.hpBefore) || 0;
    const damage = Number(combat && combat.damage) || Math.max(0, (Number(combat && combat.hpBefore) || 0) - (Number(combat && combat.hpAfter) || 0));
    const damageRatio = maxHp > 0 ? damage / maxHp : 0;
    const enemyCount = Number(combat && (combat.initialEnemyCount || combat.enemyCount)) || 0;
    if (damageRatio >= 0.3) priority += 6;
    else if (damageRatio >= 0.15) priority += 3;
    if (enemyCount >= 4) priority += 2;
    return Math.min(99, priority);
  }

  function battleBounds(entries, battleIndex) {
    const encounters = entries.filter(({ entry }) => entry && entry.type === "combat-encounter");
    const encounter = encounters[battleIndex] || null;
    if (!encounter) return { encounter: null, terminal: null };
    const next = encounters[battleIndex + 1];
    const terminalTypes = new Set(["combat-victory", "combat-retreat", "combat-defeat"]);
    const terminal = entries.find(({ entry, index }) => (
      index > encounter.index
      && (!next || index < next.index)
      && entry
      && terminalTypes.has(entry.type)
    )) || null;
    return { encounter, terminal };
  }

  function outcomeHeadline(outcome) {
    if (outcome === "defeat") return "隊列が崩れる";
    if (outcome === "retreat") return "退路を開く";
    return "戦況を押し切る";
  }

  function narrativeBattles(expeditionNarrative) {
    return expeditionNarrative && Array.isArray(expeditionNarrative.battles) ? expeditionNarrative.battles : [];
  }

  function narrativeLine(battle, phases) {
    const lines = battle && Array.isArray(battle.lines) ? battle.lines : [];
    for (const phase of phases) {
      const found = lines.find((line) => line && line.phase === phase && normalizeText(line.text));
      if (found) return found;
    }
    return null;
  }

  function narrativeOutcomeLine(expeditionNarrative, outcome, phases) {
    const matching = narrativeBattles(expeditionNarrative).filter((battle) => battle && battle.outcome === outcome);
    return narrativeLine(matching.at(-1), phases);
  }

  function narrativeInjuryLine(expeditionNarrative) {
    const candidates = narrativeBattles(expeditionNarrative).flatMap((battle) => (
      Array.isArray(battle && battle.lines) ? battle.lines : []
    )).map((line, index) => {
      const hpBefore = Number(line && line.hpBefore);
      const hpAfter = Number(line && line.hpAfter);
      return {
        line,
        index,
        damage: Number.isFinite(hpBefore) && Number.isFinite(hpAfter) ? Math.max(0, hpBefore - hpAfter) : 0,
      };
    }).filter(({ line, damage }) => (
      line
      && ["pressure", "turning-point"].includes(line.phase)
      && damage > 0
      && normalizeText(line.text)
    )).sort((a, b) => b.damage - a.damage || a.index - b.index);
    return candidates.length ? candidates[0].line : null;
  }

  function narrativeEndingLine(expeditionNarrative, outcome) {
    const battles = narrativeBattles(expeditionNarrative);
    const last = battles.at(-1);
    if (!last) return null;
    if (outcome === "early-return" || outcome === "failed") return narrativeLine(last, ["aftermath", "finish"]);
    return narrativeLine(last, ["aftermath"]);
  }

  function rawBattleCandidates(report, entries) {
    const encounters = entries.filter(({ entry }) => entry && entry.type === "combat-encounter");
    return encounters.flatMap((encounter, battleIndex) => {
      const bounds = battleBounds(entries, battleIndex);
      const combat = combatEncounters(report)[battleIndex] || null;
      const outcome = combat && combat.result
        ? combat.result
        : bounds.terminal && bounds.terminal.entry.type === "combat-defeat"
          ? "defeat"
          : bounds.terminal && bounds.terminal.entry.type === "combat-retreat"
            ? "retreat"
            : "victory";
      const visualKey = visualForCombat(report, combat || null);
      const basePriority = combatPriority(combat, outcome, battleIndex);
      const candidates = [makeScene(report, {
        kind: "combat-opening",
        phase: "battle",
        headline: combat && combat.encounterName ? `${combat.encounterName}と接敵` : "接敵",
        caption: encounter.entry.text,
        actorIds: report.companionIds,
        visualKey,
        priority: Math.max(80, basePriority - 4),
        sourceEventIds: [encounter.id],
      })];
      if (bounds.terminal) {
        candidates.push(makeScene(report, {
          kind: "combat-climax",
          phase: "battle",
          headline: outcomeHeadline(outcome),
          caption: bounds.terminal.entry.text,
          actorIds: report.companionIds,
          visualKey,
          priority: basePriority,
          sourceEventIds: [bounds.terminal.id],
        }));
      }
      return candidates;
    });
  }

  function battleCandidates(report, entries, expeditionNarrative) {
    const battles = narrativeBattles(expeditionNarrative);
    if (!battles.length) return rawBattleCandidates(report, entries);

    const candidates = [];
    battles.forEach((battle, battleIndex) => {
      const bounds = battleBounds(entries, battleIndex);
      const combat = combatEncounters(report).find((item) => item && item.encounterId === battle.encounterId)
        || combatEncounters(report)[battleIndex]
        || null;
      const visualKey = visualForCombat(report, battle);
      const basePriority = combatPriority(combat, battle.outcome, battleIndex);
      const opening = narrativeLine(battle, ["opening"]) || (battle.lines || [])[0];
      if (opening) {
        candidates.push(makeScene(report, {
          kind: "combat-opening",
          phase: "battle",
          headline: `${battle.encounterName || "敵"}と接敵`,
          caption: opening.text,
          copySource: "narrative",
          actorIds: battle.actorIds || [opening.actorId],
          visualKey,
          priority: Math.max(80, basePriority - 4),
          sourceEventIds: bounds.encounter ? [bounds.encounter.id] : [`battle-${battleIndex}-opening`],
        }));
      }

      const climax = narrativeLine(battle, ["turning-point", "pressure", "finish"]);
      if (climax && climax !== opening) {
        candidates.push(makeScene(report, {
          kind: "combat-climax",
          phase: "battle",
          headline: outcomeHeadline(battle.outcome),
          caption: climax.text,
          copySource: "narrative",
          actorIds: [climax.actorId].filter(Boolean),
          visualKey,
          priority: basePriority,
          sourceEventIds: bounds.terminal ? [bounds.terminal.id] : [`battle-${battleIndex}-${climax.phase}`],
        }));
      }
    });
    return candidates.length ? candidates : rawBattleCandidates(report, entries);
  }

  function consequenceCandidates(report, entries, expeditionNarrative) {
    const candidates = [];
    const injury = firstByType(entries, ["injury"]);
    const injuryNarrative = narrativeInjuryLine(expeditionNarrative);
    if (injury || (Array.isArray(report.injuries) && report.injuries.length)) {
      candidates.push(makeScene(report, {
        kind: "injury",
        phase: "middle",
        headline: "傷を負う",
        caption: injuryNarrative ? injuryNarrative.text : injury ? injury.entry.text : "遠征の途中で仲間が傷を負った。",
        copySource: injuryNarrative ? "narrative" : "report-log",
        actorIds: report.injuries || [],
        visualKey: "injury.wound",
        priority: 98,
        sourceEventIds: injury ? [injury.id] : ["report-injury"],
      }));
    }

    const defeat = firstByType(entries, ["combat-defeat"]);
    const retreat = firstByType(entries, ["combat-retreat", "retreat"]);
    const defeatNarrative = narrativeOutcomeLine(expeditionNarrative, "defeat", ["finish", "aftermath"]);
    const retreatNarrative = narrativeOutcomeLine(expeditionNarrative, "retreat", ["finish", "aftermath"]);
    if (defeat) {
      candidates.push(makeScene(report, {
        kind: "defeat",
        phase: "middle",
        headline: "生還だけを求める",
        caption: defeatNarrative ? defeatNarrative.text : defeat.entry.text,
        copySource: defeatNarrative ? "narrative" : "report-log",
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
        caption: retreatNarrative ? retreatNarrative.text : retreat ? retreat.entry.text : "これ以上は追わず、灰炉へ戻ることを選んだ。",
        copySource: retreatNarrative ? "narrative" : "report-log",
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

  function endingScene(report, entries, expeditionNarrative) {
    const returned = firstByType(entries, ["return"]);
    const outcome = report.outcome || "success";
    const headline = outcome === "missing" ? "空いたままの席" : outcome === "failed" ? "それでも灰炉へ" : outcome === "early-return" ? "早い帰還" : "灰炉の灯り";
    const fallback = outcome === "failed" ? "傷ついた隊が、どうにか灰炉へ運び戻された。" : "遠征隊は灰炉へ帰還した。";
    const endingNarrative = outcome === "missing" ? null : narrativeEndingLine(expeditionNarrative, outcome);
    return makeScene(report, {
      kind: "return",
      phase: "ending",
      headline,
      caption: endingNarrative ? endingNarrative.text : returned ? returned.entry.text : fallback,
      copySource: endingNarrative ? "narrative" : "report-log",
      actorIds: report.companionIds,
      visualKey: "hearth.return",
      priority: 100,
      sourceEventIds: returned ? [returned.id] : ["report-return"],
    });
  }

  function dedupeCandidates(candidates) {
    const seenIds = new Set();
    const seenCaptions = new Set();
    return candidates.filter((scene) => {
      const captionKey = scene.caption.toLowerCase();
      if (seenIds.has(scene.sceneId) || seenCaptions.has(captionKey)) return false;
      seenIds.add(scene.sceneId);
      seenCaptions.add(captionKey);
      return true;
    });
  }

  function sourceOrder(scene, entries) {
    const indexById = new Map(entries.map(({ id, index }) => [String(id), index]));
    const indexes = scene.sourceEventIds.map((id) => indexById.get(String(id))).filter(Number.isFinite);
    return indexes.length ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
  }

  function selectMiddleScenes(battleScenes, consequenceScenes, entries, openingCount = 0) {
    const battles = dedupeCandidates(battleScenes)
      .sort((a, b) => b.priority - a.priority || a.sceneId.localeCompare(b.sceneId));
    const pool = dedupeCandidates([...consequenceScenes, ...battles])
      .sort((a, b) => b.priority - a.priority || a.sceneId.localeCompare(b.sceneId));
    const selected = [];
    const middleLimit = MAX_SCENES - 1 - openingCount;

    // Combat is the reason to spend paper-theatre frames: if a battle happened,
    // guarantee at least one battle beat before considering other highlights.
    if (battles.length) selected.push(battles[0]);

    for (const candidate of pool) {
      if (selected.some((scene) => scene.sceneId === candidate.sceneId)) continue;
      const combatCount = selected.filter(isCombatScene).length;
      if (isCombatScene(candidate) && combatCount >= MAX_COMBAT_SCENES) continue;
      selected.push(candidate);
      if (selected.length >= middleLimit) break;
    }

    // A normal expedition report should read as at least two incidents plus the
    // return frame. Prefer another battle beat before inventing filler scenes.
    if (selected.length < 2) {
      const fallback = battles.find((scene) => !selected.some((chosen) => chosen.sceneId === scene.sceneId))
        || pool.find((scene) => !selected.some((chosen) => chosen.sceneId === scene.sceneId));
      if (fallback) selected.push(fallback);
    }

    return selected.sort((a, b) => {
      const orderDelta = sourceOrder(a, entries) - sourceOrder(b, entries);
      if (orderDelta !== 0) return orderDelta;
      return b.priority - a.priority || a.sceneId.localeCompare(b.sceneId);
    });
  }

  function buildExpeditionScenes(input) {
    const report = input && input.report ? input.report : null;
    if (!report) return { version: SCENE_VERSION, expeditionId: null, scenes: [] };
    const entries = indexedLog(report);
    const battles = battleCandidates(report, entries, input.narrative);
    const consequences = consequenceCandidates(report, entries, input.narrative);
    const choiceTypes = /^(policy|forest-approach|mine-approach|village-bell|night-watch|field-camp|.*opportunity|.*affinity|.*signal.*|followup-unlocked|lost-loot-recovery)$/;
    entries.filter(({ entry }) => choiceTypes.test(entry.type) && entry.text).forEach(({ entry, id }) => {
      consequences.push(makeScene(report, {
        kind: "decision", phase: "middle", headline: "あの判断の先で", caption: entry.text,
        actorIds: report.companionIds, visualKey: "discovery.knowledge", priority: 106,
        sourceEventIds: [id],
      }));
    });
    const departure = firstByType(entries, ["departure"]);
    const opening = departure && report.dispatchSummary ? makeScene(report, {
      kind: "departure", phase: "opening", headline: `${report.destinationName}へ託した支度`,
      caption: `${departure.entry.text} ${report.dispatchSummary.policy}方針。道具：${report.dispatchSummary.equipment.join("、") || "なし"}。`,
      actorIds: report.companionIds, visualKey: "hearth.departure", priority: 100,
      sourceEventIds: [departure.id],
    }) : null;
    const ending = endingScene(report, entries, input.narrative);
    const scenes = selectMiddleScenes(battles, consequences, entries, opening ? 1 : 0);
    if (opening) scenes.unshift(opening);
    scenes.push(ending);

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

  return { SCENE_VERSION, MAX_SCENES, MAX_COMBAT_SCENES, VISUALS, buildExpeditionScenes, resolveVisual };
});
