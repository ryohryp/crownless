(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CrownlessCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LOCATIONS = [
    {
      id: "ruined-chapel",
      name: "崩れた礼拝堂",
      kicker: "鐘はない。それでも、風のたびに何かが鳴る。",
      description: "黒い蔦に覆われた礼拝堂。半開きの扉の奥で、金属が石を擦る音がした。",
      omen: "祭壇の下に古い納骨室があるらしい",
      risk: 2,
      reward: 3,
      palette: "chapel"
    },
    {
      id: "blackthorn-copse",
      name: "黒棘の雑木林",
      kicker: "枝に結ばれた赤い布は、風がないのに揺れている。",
      description: "獣道の先に人の足跡が混じる。何者かがここを見張っている。",
      omen: "狩人が隠した荷が残っているかもしれない",
      risk: 2,
      reward: 2,
      palette: "woods"
    },
    {
      id: "dead-kings-road",
      name: "死王の旧街道",
      kicker: "泥の下から、王国が滅びる前の石畳が覗く。",
      description: "道端には新しい焚き火跡。遠くで荷車の車輪が一度だけ軋んだ。",
      omen: "隊商か、隊商を襲った連中がいる",
      risk: 3,
      reward: 3,
      palette: "road"
    },
    {
      id: "drowned-mill",
      name: "水没した粉挽き小屋",
      kicker: "水車は止まっている。だが、水面だけが周期的に揺れる。",
      description: "浅い沼に沈んだ小屋。屋根裏の窓から弱い灯りが漏れている。",
      omen: "誰かが今も物資を運び込んでいる",
      risk: 1,
      reward: 2,
      palette: "marsh"
    },
    {
      id: "watchfire-hill",
      name: "消えかけた烽火台",
      kicker: "丘の上に煙。火を焚いた者の姿はない。",
      description: "古い見張り台の周囲に盾の破片と血の跡。足跡は三方向へ散っている。",
      omen: "兵士の装備が残されている可能性が高い",
      risk: 3,
      reward: 4,
      palette: "hill"
    },
    {
      id: "pilgrims-cut",
      name: "巡礼者の切通し",
      kicker: "崖壁に刻まれた祈りの文字が、途中から別の言葉に変わる。",
      description: "狭い岩道には避けようのない死角が多い。奥から低い歌声が聞こえる。",
      omen: "危険だが、古い奉納品が眠っている",
      risk: 4,
      reward: 4,
      palette: "cut"
    }
  ];

  const ITEM_BASES = [
    { type: "handwraps", name: "墓布の拳帯", style: "unarmed", damage: 2, description: "拳を守るだけの粗布。素手の速さを殺さない。" },
    { type: "dagger", name: "密猟者の短刀", style: "blade", damage: 3, description: "短いが速い。相手の懐へ潜るための刃。" },
    { type: "sword", name: "刃欠けの武装剣", style: "blade", damage: 5, description: "重い一振り。拳では届かない距離を支配する。" }
  ];

  const MODIFIERS = [
    { id: "breaker", name: "〈砕き手〉", description: "重攻撃の吹き飛ばしと怯みが大きく増す。", effect: { heavyStagger: 1.8 } },
    { id: "afterstep", name: "〈残歩〉", description: "寸前で回避すると、次の一撃が強化される。", effect: { evadeEmpower: true } },
    { id: "knuckle-saint", name: "〈拳聖〉", description: "素手の連撃テンポが速くなり、3段目の威力が上がる。", effect: { unarmedTempo: 1.35, comboFinisher: 1.25 }, styles: ["unarmed"] },
    { id: "last-blood", name: "〈末血〉", description: "瀕死時は攻撃が鋭くなるが、受ける傷も深くなる。", effect: { lowHealthRisk: true } }
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function generateExplorationChoices(state) {
    if (!state.expedition || state.phase !== "explore") throw new Error("No active exploration step");
    const exp = state.expedition;
    const rng = createRng(exp.seed + exp.depth * 997 + exp.discoveries.length * 131);
    const remaining = LOCATIONS.slice();
    const choices = [];
    while (choices.length < 3 && remaining.length) {
      const index = Math.floor(rng() * remaining.length);
      const base = remaining.splice(index, 1)[0];
      const riskShift = exp.depth >= 2 ? 1 : 0;
      choices.push({
        ...clone(base),
        choiceId: `${base.id}:${exp.depth}:${choices.length}`,
        risk: Math.min(5, base.risk + riskShift),
        reward: Math.min(5, base.reward + Math.floor(exp.depth / 2))
      });
    }
    return choices;
  }

  function buildEnemies(depth, rng, location) {
    const risk = location ? location.risk : 2;
    const count = Math.min(3, 1 + (risk >= 3 ? 1 : 0) + (depth >= 2 && rng() > 0.45 ? 1 : 0));
    const enemies = [];
    for (let i = 0; i < count; i += 1) {
      const kind = i === 0 || rng() < 0.58 ? "rusher" : "guard";
      enemies.push({
        id: `${kind}-${depth}-${i}`,
        kind,
        name: kind === "rusher" ? "街道荒らし" : "欠け盾の兵",
        maxHealth: kind === "rusher" ? 42 + depth * 6 : 58 + depth * 7,
        damage: kind === "rusher" ? 10 + depth : 12 + depth
      });
    }
    return enemies;
  }

  function discoverLocation(state, choiceId) {
    if (!state.expedition || state.phase !== "explore") throw new Error("No active exploration step");
    const choices = generateExplorationChoices(state);
    const choice = choices.find((candidate) => candidate.choiceId === choiceId) || choices[0];
    const next = clone(state);
    const rng = createRng(next.expedition.seed + next.expedition.depth * 733 + choice.risk * 41 + choice.reward * 17);
    const discovery = {
      id: `${choice.id}-${next.expedition.depth}-${next.expedition.discoveries.length}`,
      locationId: choice.id,
      name: choice.name,
      kicker: choice.kicker,
      flavor: choice.description,
      omen: choice.omen,
      risk: choice.risk,
      reward: choice.reward,
      palette: choice.palette,
      depth: next.expedition.depth + 1
    };
    next.expedition.discoveries.push(discovery);
    next.expedition.encounter = {
      discovery,
      enemies: buildEnemies(next.expedition.depth, rng, choice)
    };
    next.phase = "combat";
    return next;
  }

  function discoverNextCell(state) {
    return discoverLocation(state, generateExplorationChoices(state)[0].choiceId);
  }

  function rollLoot(seed, depth, index, rewardBias = 0) {
    const rng = createRng(Number(seed) + depth * 211 + index * 43 + rewardBias * 29 + 7);
    const base = clone(pick(ITEM_BASES, rng));
    const compatibleModifiers = MODIFIERS.filter((modifier) => !modifier.styles || modifier.styles.includes(base.style));
    const modifier = clone(pick(compatibleModifiers, rng));
    const rarityRoll = Math.min(0.999, rng() + rewardBias * 0.035);
    const rarity = rarityRoll > 0.93 ? "relic" : rarityRoll > 0.68 ? "rare" : "uncommon";
    const power = base.damage + depth + rewardBias * 0.35 + (rarity === "relic" ? 4 : rarity === "rare" ? 2 : 1);
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
    const encounter = next.expedition.encounter;
    const enemyCount = encounter.enemies.length;
    const rewardBias = encounter.discovery.reward || 0;
    const lootCount = enemyCount >= 3 || rewardBias >= 4 ? 2 : 1;
    const startIndex = next.expedition.unsecuredLoot.length;
    const newLoot = [];
    for (let i = 0; i < lootCount; i += 1) {
      const item = rollLoot(next.expedition.seed, next.expedition.depth, startIndex + i, rewardBias);
      next.expedition.unsecuredLoot.push(item);
      newLoot.push(item.id);
    }
    next.expedition.health = Math.max(1, Math.round(remainingHealth));
    next.expedition.lastLootIds = newLoot;
    next.expedition.lastDiscovery = encounter.discovery;
    next.expedition.encounter = null;
    next.stats.enemiesDefeated += enemyCount;
    next.phase = "decision";
    return next;
  }

  function continueExpedition(state) {
    if (!state.expedition || state.phase !== "decision") throw new Error("Cannot continue now");
    const next = clone(state);
    next.expedition.depth += 1;
    next.expedition.lastLootIds = [];
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
      weaponType: item ? item.type : "fists",
      lightDamage: item ? 10 + item.power : 11,
      heavyDamage: item ? 19 + item.power * 1.45 : 21,
      reach: item && item.type === "sword" ? 82 : item && item.type === "dagger" ? 62 : 53,
      moveSpeed: item && item.type === "sword" ? 190 : 218,
      heavyStagger: effect.heavyStagger || 1,
      evadeEmpower: Boolean(effect.evadeEmpower),
      unarmedTempo: effect.unarmedTempo || 1,
      comboFinisher: effect.comboFinisher || 1,
      lowHealthRisk: Boolean(effect.lowHealthRisk)
    };
  }

  return {
    LOCATIONS,
    ITEM_BASES,
    MODIFIERS,
    createRng,
    createInitialState,
    beginExpedition,
    generateExplorationChoices,
    discoverLocation,
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
