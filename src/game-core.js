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
      palette: "chapel",
      enemyBias: "guard",
      events: ["combat", "shrine", "cache"]
    },
    {
      id: "blackthorn-copse",
      name: "黒棘の雑木林",
      kicker: "枝に結ばれた赤い布は、風がないのに揺れている。",
      description: "獣道の先に人の足跡が混じる。何者かがここを見張っている。",
      omen: "狩人が隠した荷か、待ち伏せがある",
      risk: 2,
      reward: 2,
      palette: "woods",
      enemyBias: "skirmisher",
      events: ["combat", "traveler", "ambush"]
    },
    {
      id: "dead-kings-road",
      name: "死王の旧街道",
      kicker: "泥の下から、王国が滅びる前の石畳が覗く。",
      description: "道端には新しい焚き火跡。遠くで荷車の車輪が一度だけ軋んだ。",
      omen: "隊商か、隊商を襲った連中がいる",
      risk: 3,
      reward: 3,
      palette: "road",
      enemyBias: "rusher",
      events: ["combat", "traveler", "ambush"]
    },
    {
      id: "drowned-mill",
      name: "水没した粉挽き小屋",
      kicker: "水車は止まっている。だが、水面だけが周期的に揺れる。",
      description: "浅い沼に沈んだ小屋。屋根裏の窓から弱い灯りが漏れている。",
      omen: "誰かが物資を隠している気配がある",
      risk: 1,
      reward: 2,
      palette: "marsh",
      enemyBias: "skirmisher",
      events: ["cache", "combat", "traveler"]
    },
    {
      id: "watchfire-hill",
      name: "消えかけた烽火台",
      kicker: "丘の上に煙。火を焚いた者の姿はない。",
      description: "古い見張り台の周囲に盾の破片と血の跡。足跡は三方向へ散っている。",
      omen: "兵士の装備が残されている可能性が高い",
      risk: 3,
      reward: 4,
      palette: "hill",
      enemyBias: "guard",
      events: ["ambush", "combat", "cache"]
    },
    {
      id: "pilgrims-cut",
      name: "巡礼者の切通し",
      kicker: "崖壁に刻まれた祈りの文字が、途中から別の言葉に変わる。",
      description: "狭い岩道には避けようのない死角が多い。奥から低い歌声が聞こえる。",
      omen: "危険だが、古い奉納品が眠っている",
      risk: 4,
      reward: 4,
      palette: "cut",
      enemyBias: "rusher",
      events: ["shrine", "combat", "ambush"]
    }
  ];

  const ITEM_BASES = [
    {
      type: "handwraps",
      name: "墓布の拳帯",
      style: "unarmed",
      styleLabel: "拳闘",
      playstyle: "連撃 / 密着",
      damage: 2,
      description: "拳を守るだけの粗布。素手の速さを殺さない。"
    },
    {
      type: "dagger",
      name: "密猟者の短刀",
      style: "blade",
      styleLabel: "短刀",
      playstyle: "差し込み / 回避",
      damage: 3,
      description: "短いが速い。相手の懐へ潜るための刃。"
    },
    {
      type: "sword",
      name: "刃欠けの武装剣",
      style: "blade",
      styleLabel: "長剣",
      playstyle: "間合い / 強打",
      damage: 5,
      description: "重い一振り。拳では届かない距離を支配する。"
    }
  ];

  const MODIFIERS = [
    {
      id: "breaker",
      name: "〈砕き手〉",
      tag: "GUARD BREAK",
      description: "重攻撃の吹き飛ばしと怯みが大きく増す。",
      effect: { heavyStagger: 1.8 }
    },
    {
      id: "afterstep",
      name: "〈残歩〉",
      tag: "PERFECT EVADE",
      description: "寸前で回避すると、次の一撃が強化される。",
      effect: { evadeEmpower: true }
    },
    {
      id: "knuckle-saint",
      name: "〈拳聖〉",
      tag: "COMBO",
      description: "素手の連撃テンポが速くなり、3段目の威力が上がる。",
      effect: { unarmedTempo: 1.35, comboFinisher: 1.25 },
      styles: ["unarmed"]
    },
    {
      id: "last-blood",
      name: "〈末血〉",
      tag: "LOW HP",
      description: "瀕死時は攻撃が鋭くなるが、受ける傷も深くなる。",
      effect: { lowHealthRisk: true }
    }
  ];

  const EVENT_SIGNAL = {
    combat: "敵影",
    ambush: "不穏な気配",
    cache: "物資の気配",
    shrine: "異様な気配",
    traveler: "人影"
  };

  const EDGE_MAX = 100;

  function nextEdge(current, gain) {
    const value = Number(current) || 0;
    const change = Number(gain) || 0;
    return Math.max(0, Math.min(EDGE_MAX, value + change));
  }

  function edgeTechnique(edge) {
    const ready = nextEdge(edge, 0) >= EDGE_MAX;
    return {
      ready,
      remaining: ready ? 0 : EDGE_MAX - nextEdge(edge, 0),
      damageMultiplier: ready ? 1.65 : 1,
      staggerMultiplier: ready ? 1.5 : 1,
      cooldown: ready ? 0.9 : null
    };
  }

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
        enemiesDefeated: 0,
        eventsResolved: 0
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
      encounter: null,
      pendingEvent: null,
      scouting: 0,
      lastLootIds: [],
      lastDiscovery: null,
      lastEventSummary: ""
    };
    return next;
  }

  function eventSeed(exp, location, slot = 0) {
    let hash = 0;
    for (let i = 0; i < location.id.length; i += 1) hash = (hash * 31 + location.id.charCodeAt(i)) >>> 0;
    return exp.seed + exp.depth * 733 + exp.discoveries.length * 191 + hash + slot * 53;
  }

  function previewEventKind(exp, location, slot = 0) {
    const rng = createRng(eventSeed(exp, location, slot));
    return pick(location.events, rng);
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
      const scoutingReduction = exp.scouting > 0 ? 1 : 0;
      const risk = Math.max(1, Math.min(5, base.risk + riskShift - scoutingReduction));
      const reward = Math.min(5, base.reward + Math.floor(exp.depth / 2));
      const eventKind = previewEventKind(exp, base, choices.length);

      choices.push({
        ...clone(base),
        choiceId: `${base.id}:${exp.depth}:${choices.length}`,
        risk,
        reward,
        signal: EVENT_SIGNAL[eventKind],
        eventKind
      });
    }

    return choices;
  }

  function enemyTemplate(kind, depth, index) {
    if (kind === "guard") {
      return {
        id: `${kind}-${depth}-${index}`,
        kind,
        name: "欠け盾の兵",
        maxHealth: 62 + depth * 8,
        damage: 13 + depth,
        moveSpeed: 72,
        attackRange: 76
      };
    }
    if (kind === "skirmisher") {
      return {
        id: `${kind}-${depth}-${index}`,
        kind,
        name: "藪射ち",
        maxHealth: 38 + depth * 5,
        damage: 9 + depth,
        moveSpeed: 104,
        attackRange: 250
      };
    }
    return {
      id: `${kind}-${depth}-${index}`,
      kind: "rusher",
      name: "街道荒らし",
      maxHealth: 44 + depth * 6,
      damage: 11 + depth,
      moveSpeed: 132,
      attackRange: 52
    };
  }

  function buildEnemies(depth, rng, location, bonusCount = 0) {
    const risk = location ? location.risk : 2;
    const count = Math.min(3, 1 + (risk >= 3 ? 1 : 0) + (depth >= 2 && rng() > 0.45 ? 1 : 0) + bonusCount);
    const kinds = ["rusher", "guard", "skirmisher"];
    const enemies = [];
    const firstKind = location && location.enemyBias ? location.enemyBias : pick(kinds, rng);

    for (let i = 0; i < count; i += 1) {
      let kind = i === 0 ? firstKind : pick(kinds, rng);
      if (i === 1 && count >= 2 && kind === firstKind) {
        kind = kinds[(kinds.indexOf(firstKind) + 1 + Math.floor(rng() * 2)) % kinds.length];
      }
      enemies.push(enemyTemplate(kind, depth, i));
    }

    return enemies;
  }

  function makeDiscovery(exp, choice) {
    return {
      id: `${choice.id}-${exp.depth}-${exp.discoveries.length}`,
      locationId: choice.id,
      name: choice.name,
      kicker: choice.kicker,
      flavor: choice.description,
      omen: choice.omen,
      risk: choice.risk,
      reward: choice.reward,
      palette: choice.palette,
      depth: exp.depth + 1,
      signal: choice.signal,
      eventKind: choice.eventKind
    };
  }

  function addLoot(next, count, rewardBias, salt = 0) {
    const startIndex = next.expedition.unsecuredLoot.length;
    const ids = [];
    for (let i = 0; i < count; i += 1) {
      const item = rollLoot(next.expedition.seed + salt, next.expedition.depth, startIndex + i, rewardBias);
      next.expedition.unsecuredLoot.push(item);
      ids.push(item.id);
    }
    next.expedition.lastLootIds = ids;
    return ids;
  }

  function discoverLocation(state, choiceId) {
    if (!state.expedition || state.phase !== "explore") throw new Error("No active exploration step");
    const choices = generateExplorationChoices(state);
    const choice = choices.find((candidate) => candidate.choiceId === choiceId) || choices[0];
    const next = clone(state);
    const discovery = makeDiscovery(next.expedition, choice);
    next.expedition.discoveries.push(discovery);
    next.expedition.lastDiscovery = discovery;
    if (next.expedition.scouting > 0) next.expedition.scouting -= 1;

    const rng = createRng(eventSeed(next.expedition, choice, choices.indexOf(choice)));
    const kind = choice.eventKind;

    if (kind === "cache") {
      addLoot(next, choice.reward >= 4 ? 2 : 1, choice.reward + 1, 401);
      next.expedition.lastEventSummary = "隠された荷を見つけた。戦わずに済んだことが、かえって不気味だ。";
      next.expedition.encounter = null;
      next.stats.eventsResolved += 1;
      next.phase = "decision";
      return next;
    }

    if (kind === "shrine") {
      next.expedition.pendingEvent = {
        kind: "shrine",
        title: "煤けた小祠",
        text: "石皿には新しい血が乾いている。祈れば何かを得られそうだが、代価を求められる気配がある。",
        options: [
          { id: "offer-blood", label: "血を捧げる", detail: "HPを失い、強い戦利品を得る" },
          { id: "rest-by-shrine", label: "火のそばで休む", detail: "戦利品を諦め、傷を少し癒す" }
        ],
        discovery
      };
      next.phase = "event";
      return next;
    }

    if (kind === "traveler") {
      next.expedition.pendingEvent = {
        kind: "traveler",
        title: "傷ついた伝令",
        text: "泥だらけの伝令が道端に座り込んでいる。追手の足音を聞いたと言い、破れた地図を握っている。",
        options: [
          { id: "take-rumor", label: "情報を聞く", detail: "次の探索の危険を読みやすくする" },
          { id: "follow-tracks", label: "追手を逆に追う", detail: "危険な戦闘になるが、戦利品の期待が高い" }
        ],
        discovery
      };
      next.phase = "event";
      return next;
    }

    const ambush = kind === "ambush";
    next.expedition.encounter = {
      kind: ambush ? "ambush" : "combat",
      discovery,
      enemies: buildEnemies(next.expedition.depth, rng, choice, ambush ? 1 : 0),
      rewardBonus: ambush ? 2 : 0
    };
    next.phase = "combat";
    return next;
  }

  function resolveEventChoice(state, optionId) {
    if (!state.expedition || state.phase !== "event" || !state.expedition.pendingEvent) {
      throw new Error("No pending expedition event");
    }

    const next = clone(state);
    const event = next.expedition.pendingEvent;
    const discovery = event.discovery;
    next.expedition.pendingEvent = null;
    next.stats.eventsResolved += 1;

    if (event.kind === "shrine") {
      if (optionId === "offer-blood") {
        const cost = Math.min(18, 12 + next.expedition.depth * 2);
        next.expedition.health = Math.max(1, next.expedition.health - cost);
        addLoot(next, 1, discovery.reward + 3, 811);
        next.expedition.lastEventSummary = `血を${cost}HP分捧げた。石皿の下から古い装備が現れた。`;
      } else {
        const healed = Math.min(100 - next.expedition.health, 14);
        next.expedition.health += healed;
        next.expedition.lastLootIds = [];
        next.expedition.lastEventSummary = healed > 0
          ? `火のそばで休み、${healed}HP回復した。`
          : "火のそばで休んだ。静けさだけを持ち帰る。";
      }
      next.phase = "decision";
      return next;
    }

    if (event.kind === "traveler") {
      if (optionId === "follow-tracks") {
        const rng = createRng(next.expedition.seed + next.expedition.depth * 911 + 77);
        next.expedition.encounter = {
          kind: "ambush",
          discovery: {
            ...discovery,
            kicker: "追う側だと思っていた。森が閉じた瞬間までは。",
            flavor: "伝令の追手を逆に追った先で、待ち伏せの輪が閉じる。"
          },
          enemies: buildEnemies(next.expedition.depth, rng, { ...discovery, enemyBias: "skirmisher" }, 1),
          rewardBonus: 3
        };
        next.expedition.lastEventSummary = "追手の痕跡を追った。";
        next.phase = "combat";
        return next;
      }

      next.expedition.scouting = Math.max(next.expedition.scouting, 2);
      const healed = Math.min(100 - next.expedition.health, 6);
      next.expedition.health += healed;
      next.expedition.lastLootIds = [];
      next.expedition.lastEventSummary = `地図と噂を得た。次の${next.expedition.scouting}回は危険を読みやすい。${healed ? ` ${healed}HP回復。` : ""}`;
      next.phase = "decision";
      return next;
    }

    throw new Error("Unknown expedition event");
  }

  function discoverNextCell(state) {
    if (!state.expedition || state.phase !== "explore") throw new Error("No active exploration step");
    const choice = generateExplorationChoices(state)[0];
    const next = clone(state);
    const discovery = makeDiscovery(next.expedition, { ...choice, eventKind: "combat", signal: EVENT_SIGNAL.combat });
    next.expedition.discoveries.push(discovery);
    next.expedition.lastDiscovery = discovery;
    const rng = createRng(eventSeed(next.expedition, choice, 0) + 17);
    next.expedition.encounter = {
      kind: "combat",
      discovery,
      enemies: buildEnemies(next.expedition.depth, rng, choice),
      rewardBonus: 0
    };
    next.phase = "combat";
    return next;
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
      styleLabel: base.styleLabel,
      playstyle: base.playstyle,
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
    const rewardBias = (encounter.discovery.reward || 0) + (encounter.rewardBonus || 0);
    const lootCount = enemyCount >= 3 || rewardBias >= 5 ? 2 : 1;

    addLoot(next, lootCount, rewardBias, encounter.kind === "ambush" ? 991 : 0);
    next.expedition.health = Math.max(1, Math.round(remainingHealth));
    next.expedition.lastDiscovery = encounter.discovery;
    next.expedition.lastEventSummary = encounter.kind === "ambush"
      ? "待ち伏せを破った。危険だったぶん、落ちた物も良い。"
      : "敵を倒し、辺りを漁った。";
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
    next.expedition.lastEventSummary = "";
    next.phase = "explore";
    return next;
  }

  function returnHome(state) {
    if (!state.expedition || !["decision", "explore"].includes(state.phase)) throw new Error("Cannot return now");
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

  function basePowerForState(state) {
    const equipped = getEquippedItem(state);
    return equipped ? equipped.power : 2;
  }

  function compareItem(state, item) {
    const equipped = getEquippedItem(state);
    const currentPower = basePowerForState(state);
    const delta = Number((item.power - currentPower).toFixed(1));
    const styleChange = !equipped ? item.type !== "handwraps" : item.type !== equipped.type;

    let verdict = "同等";
    if (delta >= 2) verdict = "大幅強化";
    else if (delta > 0.2) verdict = "強化";
    else if (delta <= -2) verdict = "大幅低下";
    else if (delta < -0.2) verdict = "低下";

    return {
      delta,
      verdict,
      styleChange,
      currentName: equipped ? equipped.name : "素手",
      summary: `${verdict}${styleChange ? " / 戦型変更" : ""}`
    };
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
    EVENT_SIGNAL,
    EDGE_MAX,
    nextEdge,
    edgeTechnique,
    createRng,
    createInitialState,
    beginExpedition,
    generateExplorationChoices,
    previewEventKind,
    buildEnemies,
    discoverLocation,
    resolveEventChoice,
    discoverNextCell,
    rollLoot,
    resolveVictory,
    continueExpedition,
    returnHome,
    resolveDefeat,
    equipItem,
    getEquippedItem,
    compareItem,
    getCombatTuning
  };
});
