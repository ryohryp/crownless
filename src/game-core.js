(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CrownlessCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const POIS = [
    { id: "ruined-shrine", name: "Ruined Shrine", flavor: "A roofless shrine leans into the rain. Something moves behind the altar." },
    { id: "old-watch", name: "Abandoned Watch", flavor: "A broken watchtower overlooks a road no map remembers." },
    { id: "wolf-copse", name: "Blackthorn Copse", flavor: "The thorns are tied with old red cloth. Fresh tracks disappear inside." },
    { id: "sunken-road", name: "Sunken King's Road", flavor: "Ancient stones descend below the mud, still pointing toward a dead kingdom." }
  ];

  const ITEM_BASES = [
    { type: "handwraps", name: "Gravecloth Wraps", style: "unarmed", damage: 2, description: "Keep your hands free and your reach short." },
    { type: "dagger", name: "Poacher's Knife", style: "blade", damage: 3, description: "Fast, close, and made for slipping around a guard." },
    { type: "sword", name: "Notched Arming Sword", style: "blade", damage: 5, description: "Slower than fists, but gives attacks real reach." },
    { type: "buckler", name: "Ashwood Buckler", style: "guard", damage: 1, description: "Turns defense into an opening for violence." }
  ];

  const MODIFIERS = [
    { id: "breaker", name: "of the Breaker", description: "Heavy attacks stagger guards much harder.", effect: { heavyStagger: 1.8 } },
    { id: "afterstep", name: "of the Afterstep", description: "A successful evade empowers your next light attack.", effect: { evadeEmpower: true } },
    { id: "knuckle-saint", name: "of the Knuckle Saint", description: "Unarmed light attacks accelerate your combo and heavy charge.", effect: { unarmedTempo: 1.35 } },
    { id: "last-blood", name: "of Last Blood", description: "Below 35% health, attacks hit harder but incoming damage also rises.", effect: { lowHealthRisk: true } },
    { id: "stored-wrath", name: "of Stored Wrath", description: "Guarding a hit stores power for your next heavy attack.", effect: { guardCounter: true } }
  ];

  function createRng(seed) {
    let value = (Number(seed) || 1) >>> 0;
    return function rng() {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length) % list.length];
  }

  function createInitialState() {
    return {
      phase: "hub",
      securedLoot: [],
      equippedItemId: null,
      expedition: null,
      stats: {
        expeditionsStarted: 0,
        expeditionsSurvived: 0,
        defeats: 0,
        enemiesDefeated: 0
      }
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function beginExpedition(state, seed) {
    const next = clone(state);
    next.phase = "explore";
    next.stats.expeditionsStarted += 1;
    next.expedition = {
      id: next.stats.expeditionsStarted,
      seed: Number(seed) || Date.now(),
      depth: 0,
      health: 100,
      unsecuredLoot: [],
      discoveries: [],
      encounter: null
    };
    return next;
  }

  function buildEnemies(depth, rng) {
    const count = Math.min(3, 1 + Math.floor(rng() * 2) + (depth >= 2 ? 1 : 0));
    const enemies = [];
    for (let i = 0; i < count; i += 1) {
      const kind = i === 0 || rng() < 0.58 ? "rusher" : "guard";
      enemies.push({
        id: `${kind}-${depth}-${i}`,
        kind,
        name: kind === "rusher" ? "Road Reaver" : "Broken Shield",
        maxHealth: kind === "rusher" ? 34 + depth * 5 : 48 + depth * 6,
        damage: kind === "rusher" ? 8 + depth : 10 + depth
      });
    }
    return enemies;
  }

  function discoverNextCell(state) {
    if (!state.expedition || state.phase !== "explore") throw new Error("No active exploration step");
    const next = clone(state);
    const rng = createRng(next.expedition.seed + next.expedition.depth * 97 + next.expedition.discoveries.length * 17);
    const poi = pick(POIS, rng);
    const discovery = {
      id: `${poi.id}-${next.expedition.depth}-${next.expedition.discoveries.length}`,
      name: poi.name,
      flavor: poi.flavor,
      depth: next.expedition.depth + 1
    };
    next.expedition.discoveries.push(discovery);
    next.expedition.encounter = {
      discovery,
      enemies: buildEnemies(next.expedition.depth, rng)
    };
    next.phase = "combat";
    return next;
  }

  function rollLoot(seed, depth, index) {
    const rng = createRng(Number(seed) + depth * 211 + index * 43 + 7);
    const base = clone(pick(ITEM_BASES, rng));
    const modifier = clone(pick(MODIFIERS, rng));
    const rarityRoll = rng();
    const rarity = rarityRoll > 0.92 ? "relic" : rarityRoll > 0.68 ? "rare" : "uncommon";
    const power = base.damage + depth + (rarity === "relic" ? 3 : rarity === "rare" ? 2 : 1);
    return {
      id: `loot-${seed}-${depth}-${index}`,
      type: base.type,
      style: base.style,
      name: `${base.name} ${modifier.name}`,
      rarity,
      power,
      description: base.description,
      modifier
    };
  }

  function resolveVictory(state, remainingHealth) {
    if (!state.expedition || state.phase !== "combat") throw new Error("No active combat");
    const next = clone(state);
    const enemyCount = next.expedition.encounter.enemies.length;
    const lootCount = enemyCount >= 3 ? 2 : 1;
    const startIndex = next.expedition.unsecuredLoot.length;
    for (let i = 0; i < lootCount; i += 1) {
      next.expedition.unsecuredLoot.push(rollLoot(next.expedition.seed, next.expedition.depth, startIndex + i));
    }
    next.expedition.health = Math.max(1, Math.round(remainingHealth));
    next.expedition.encounter = null;
    next.stats.enemiesDefeated += enemyCount;
    next.phase = "decision";
    return next;
  }

  function continueExpedition(state) {
    if (!state.expedition || state.phase !== "decision") throw new Error("Cannot continue now");
    const next = clone(state);
    next.expedition.depth += 1;
    next.phase = "explore";
    return next;
  }

  function returnHome(state) {
    if (!state.expedition || (state.phase !== "decision" && state.phase !== "explore")) throw new Error("Cannot return now");
    const next = clone(state);
    const secured = next.expedition.unsecuredLoot.map((item) => ({ ...item, secured: true }));
    next.securedLoot.push(...secured);
    next.stats.expeditionsSurvived += 1;
    next.expedition = null;
    next.phase = "hub";
    return next;
  }

  function resolveDefeat(state) {
    if (!state.expedition) throw new Error("No expedition to lose");
    const next = clone(state);
    const carried = next.expedition.unsecuredLoot;
    const keepCount = Math.floor(carried.length / 2);
    const recovered = carried.slice(0, keepCount).map((item) => ({ ...item, secured: true, recovered: true }));
    next.securedLoot.push(...recovered);
    next.stats.defeats += 1;
    next.expedition = null;
    next.phase = "hub";
    return next;
  }

  function equipItem(state, itemId) {
    const next = clone(state);
    const item = next.securedLoot.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error("Only secured loot can be equipped");
    next.equippedItemId = item.id;
    return next;
  }

  function getEquippedItem(state) {
    return state.securedLoot.find((item) => item.id === state.equippedItemId) || null;
  }

  function getCombatTuning(state) {
    const item = getEquippedItem(state);
    const effect = item ? item.modifier.effect : {};
    return {
      style: item ? item.style : "unarmed",
      lightDamage: item ? 11 + item.power : 12,
      heavyDamage: item ? 20 + item.power * 1.4 : 22,
      reach: item && item.type === "sword" ? 72 : item && item.type === "dagger" ? 55 : 46,
      moveSpeed: item && item.type === "sword" ? 175 : 205,
      heavyStagger: effect.heavyStagger || 1,
      evadeEmpower: Boolean(effect.evadeEmpower),
      unarmedTempo: effect.unarmedTempo || 1,
      lowHealthRisk: Boolean(effect.lowHealthRisk),
      guardCounter: Boolean(effect.guardCounter)
    };
  }

  return {
    POIS,
    ITEM_BASES,
    MODIFIERS,
    createRng,
    createInitialState,
    beginExpedition,
    discoverNextCell,
    rollLoot,
    resolveVictory,
    continueExpedition,
    returnHome,
    resolveDefeat,
    equipItem,
    getEquippedItem,
    getCombatTuning
  };
});
