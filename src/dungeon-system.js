(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }

  if (root.CrownlessCore) {
    root.CrownlessCore = factory(root.CrownlessCore);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function installDungeons(Core) {
  "use strict";

  if (!Core || Core.__dungeonsInstalled) return Core;

  const DUNGEONS = [
    {
      id: "ash-eater-mine",
      name: "灰喰い坑道",
      epithet: "灰牙の荷が消えていた穴",
      description: "灰牙の野営地から奪われた荷は、街道脇の古い採掘坑へ運ばれていた。入口から冷たい鉄の匂いが上がってくる。",
      palette: "road",
      unlockHuntId: "ash-hound",
      roomCount: 3,
      relic: {
        type: "dagger",
        style: "blade",
        styleLabel: "鎖刃",
        playstyle: "技 / 追撃",
        name: "坑道守の鎖刃",
        rarity: "relic",
        power: 17,
        description: "坑道の番人が腰に巻いていた短い鎖刃。重い一撃のあと、身体が次の間合いへ引かれる。",
        modifier: {
          id: "mine-warden-chain",
          name: "〈坑道守〉",
          tag: "DUNGEON RELIC / TECHNIQUE",
          description: "技の怯みが強くなり、移動速度もわずかに上がる。",
          effect: { heavyStagger: 1.7, moveSpeedMult: 1.06 }
        }
      }
    }
  ];

  const base = {
    createInitialState: Core.createInitialState,
    beginExpedition: Core.beginExpedition,
    generateExplorationChoices: Core.generateExplorationChoices,
    discoverLocation: Core.discoverLocation,
    resolveEventChoice: Core.resolveEventChoice,
    resolveVictory: Core.resolveVictory,
    continueExpedition: Core.continueExpedition,
    returnHome: Core.returnHome,
    resolveDefeat: Core.resolveDefeat,
    equipItem: Core.equipItem,
    getCombatTuning: Core.getCombatTuning
  };

  let lastKnownState = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function dungeonDefinition(id) {
    return DUNGEONS.find((dungeon) => dungeon.id === id) || null;
  }

  function makeDungeonState() {
    return {
      entries: DUNGEONS.map((dungeon) => ({ id: dungeon.id, unlocked: false, completed: false, clears: 0 }))
    };
  }

  function unlockSatisfied(state, dungeon) {
    const huntEntry = state && state.hunts && Array.isArray(state.hunts.entries)
      ? state.hunts.entries.find((entry) => entry.id === dungeon.unlockHuntId)
      : null;
    return Boolean(huntEntry && huntEntry.completed);
  }

  function ensureDungeons(state) {
    if (!state.dungeons) state.dungeons = makeDungeonState();
    if (!state.stats) state.stats = {};
    if (typeof state.stats.dungeonsCleared !== "number") state.stats.dungeonsCleared = 0;

    DUNGEONS.forEach((dungeon) => {
      let entry = state.dungeons.entries.find((candidate) => candidate.id === dungeon.id);
      if (!entry) {
        entry = { id: dungeon.id, unlocked: false, completed: false, clears: 0 };
        state.dungeons.entries.push(entry);
      }
      if (unlockSatisfied(state, dungeon)) entry.unlocked = true;
    });
    return state;
  }

  function getDungeonEntry(state, id) {
    ensureDungeons(state);
    return state.dungeons.entries.find((entry) => entry.id === id) || null;
  }

  function activeDungeon(state) {
    if (!state || !state.expedition || !state.expedition.dungeon || !state.expedition.dungeon.active) return null;
    const run = state.expedition.dungeon;
    const definition = dungeonDefinition(run.id);
    return definition ? { definition, run } : null;
  }

  function entranceChoice(dungeon, entry, depth) {
    return {
      id: dungeon.id,
      locationId: dungeon.id,
      choiceId: `dungeon:${dungeon.id}:entrance`,
      name: dungeon.name,
      kicker: entry.completed ? "奥は知っている。それでも、坑道はまだ戦利品を吐く。" : "灰牙の荷はここへ消えていた。地面の下から鉄を打つ音がする。",
      description: dungeon.description,
      omen: entry.completed ? "踏破済み。最奥の固有レリックは一度きり" : "三つの区画。途中で帰れるが、最奥ほど危険で報酬も重い",
      palette: dungeon.palette,
      risk: entry.completed ? 4 : 5,
      reward: 5,
      signal: entry.completed ? "踏破済坑道 / 再潜入" : "ダンジョン入口 / 3区画",
      eventKind: "dungeon",
      dungeonId: dungeon.id,
      depth: depth + 1
    };
  }

  function roomChoice(dungeon, room, variant, data) {
    return {
      id: `${dungeon.id}-room-${room}-${variant}`,
      locationId: `${dungeon.id}-room-${room}`,
      choiceId: `dungeon:${dungeon.id}:room:${room}:${variant}`,
      name: data.name,
      kicker: data.kicker,
      description: data.description,
      omen: data.omen,
      palette: data.palette || dungeon.palette,
      risk: data.risk,
      reward: data.reward,
      signal: data.signal,
      eventKind: data.eventKind,
      dungeonId: dungeon.id,
      dungeonRoom: room,
      dungeonVariant: variant,
      depth: room + 1
    };
  }

  function roomChoices(state, dungeon, room) {
    if (room === 0) {
      return [
        roomChoice(dungeon, 0, "trap", {
          name: "折れ梁の荷溜まり",
          kicker: "袋は残っている。天井の梁だけが、不自然に新しい。",
          description: "足元には荷車の轍。梁には細い鉄線。荷を取るなら、罠の中へ手を伸ばすことになる。",
          omen: "傷を受け入れれば、戦わずに荷へ届く",
          risk: 2,
          reward: 4,
          signal: "罠 / 戦利品",
          eventKind: "dungeon-trap"
        }),
        roomChoice(dungeon, 0, "skirmish", {
          name: "鉱夫の休憩所",
          kicker: "灯りが二つ動いた。鉱夫ではない。",
          description: "狭い休憩所を二人の略奪者が塞いでいる。正面から抜けば、罠を触らず先へ行ける。",
          omen: "短い戦闘。逃げ場は狭い",
          risk: 3,
          reward: 3,
          signal: "戦闘 / 坑道荒らし",
          eventKind: "dungeon-combat"
        })
      ];
    }

    if (room === 1) {
      return [
        roomChoice(dungeon, 1, "foreman", {
          name: "監督官の詰所",
          kicker: "盾の縁で床を二度叩く。奥へ行かせる気はないらしい。",
          description: "鉄板を継ぎ合わせた盾を持つ大男が、狭い通路を一人で塞いでいる。",
          omen: "盾を技で崩せ。勝てば良い荷が出る",
          risk: 4,
          reward: 5,
          signal: "エリート / 盾",
          eventKind: "dungeon-elite"
        }),
        roomChoice(dungeon, 1, "chain-gang", {
          name: "鎖の昇降路",
          kicker: "上から鎖が落ちる。その音に合わせて二つの影が走る。",
          description: "足場は広いが敵は二人。素早い敵を追っている間に、もう一人が間合いを作る。",
          omen: "二体。報酬は少し軽いが、盾兵より崩しやすい",
          risk: 4,
          reward: 4,
          signal: "エリート / 二体",
          eventKind: "dungeon-elite"
        })
      ];
    }

    return [
      roomChoice(dungeon, 2, "warden", {
        name: "鉄杭の最奥",
        kicker: "ここより先に道はない。だから、番人も退かない。",
        description: "採掘跡の中央に鉄杭が一本打たれ、鎖が幾重にも巻かれている。その前で番人が剣を抜く。",
        omen: "最奥。倒せば坑道の正体と固有レリックを持ち帰れる",
        risk: 5,
        reward: 5,
        signal: "最奥 / 番人",
        eventKind: "dungeon-boss"
      })
    ];
  }

  function makeDiscovery(exp, choice) {
    return {
      id: `${choice.id}-${exp.depth}-${exp.discoveries.length}`,
      locationId: choice.locationId || choice.id,
      name: choice.name,
      kicker: choice.kicker,
      flavor: choice.description,
      omen: choice.omen,
      risk: choice.risk,
      reward: choice.reward,
      palette: choice.palette,
      depth: exp.depth + 1,
      signal: choice.signal,
      eventKind: choice.eventKind,
      dungeonId: choice.dungeonId,
      dungeonRoom: choice.dungeonRoom
    };
  }

  function enemy(kind, room, index, options) {
    const data = options || {};
    const templates = {
      rusher: { name: "坑道荒らし", maxHealth: 58, damage: 10, moveSpeed: 146, attackRange: 56 },
      guard: { name: "鉄板の監督官", maxHealth: 92, damage: 13, moveSpeed: 82, attackRange: 78 },
      skirmisher: { name: "坑道射手", maxHealth: 52, damage: 9, moveSpeed: 112, attackRange: 280 }
    };
    const baseEnemy = templates[kind];
    const scale = room * 8 + (data.elite ? 24 : 0) + (data.boss ? 58 : 0);
    return {
      id: `dungeon-${room}-${kind}-${index}`,
      kind,
      name: data.name || baseEnemy.name,
      maxHealth: baseEnemy.maxHealth + scale,
      damage: baseEnemy.damage + room * 2 + (data.elite ? 2 : 0) + (data.boss ? 4 : 0),
      moveSpeed: data.moveSpeed || baseEnemy.moveSpeed,
      attackRange: data.attackRange || baseEnemy.attackRange,
      elite: Boolean(data.elite),
      boss: Boolean(data.boss),
      dungeonEnemy: true
    };
  }

  function startEntrance(state, dungeon) {
    const next = clone(state);
    ensureDungeons(next);
    const entry = getDungeonEntry(next, dungeon.id);
    if (!entry || !entry.unlocked) throw new Error("Dungeon is still locked");

    const choice = entranceChoice(dungeon, entry, next.expedition.depth);
    const discovery = makeDiscovery(next.expedition, choice);
    next.expedition.discoveries.push(discovery);
    next.expedition.lastDiscovery = discovery;
    next.expedition.lastLootIds = [];
    next.expedition.encounter = null;
    next.expedition.pendingEvent = null;
    next.expedition.dungeon = {
      id: dungeon.id,
      active: true,
      room: 0,
      roomCleared: false,
      enteredAtDepth: next.expedition.depth,
      completedThisRun: false
    };
    next.expedition.lastEventSummary = `${dungeon.name}の入口を見つけた。中は三つの区画に分かれている。一区画ごとに帰るか、さらに潜るかを選べる。`;
    next.phase = "decision";
    return remember(next);
  }

  function startDungeonRoom(state, choiceId) {
    const current = activeDungeon(state);
    if (!current) throw new Error("No active dungeon");
    if (state.phase !== "explore") throw new Error("Dungeon room requires exploration phase");
    if (current.run.roomCleared) throw new Error("Current dungeon room is already cleared");

    const choices = roomChoices(state, current.definition, current.run.room);
    const choice = choices.find((candidate) => candidate.choiceId === choiceId) || choices[0];
    const next = clone(state);
    ensureDungeons(next);
    const discovery = makeDiscovery(next.expedition, choice);
    next.expedition.discoveries.push(discovery);
    next.expedition.lastDiscovery = discovery;
    next.expedition.lastLootIds = [];

    if (choice.eventKind === "dungeon-trap") {
      next.expedition.pendingEvent = {
        kind: "dungeon-trap",
        title: "折れ梁の罠",
        text: "鉄線を切れば梁が落ちる。荷袋はその真下だ。傷を抑えて抜けるか、痛みごと荷を奪うか。",
        options: [
          { id: "dungeon-edge-through", label: "壁際を抜ける", detail: "少し傷つくが、戦利品は諦める" },
          { id: "dungeon-take-cache", label: "梁を落として荷を奪う", detail: "大きく傷つく代わりに、良い戦利品を得る" }
        ],
        discovery,
        dungeonId: current.definition.id,
        dungeonRoom: current.run.room
      };
      next.phase = "event";
      return remember(next);
    }

    let enemies;
    let rewardBonus = 1;
    if (current.run.room === 0) {
      enemies = [enemy("rusher", 0, 0), enemy("skirmisher", 0, 1)];
      rewardBonus = 1;
    } else if (current.run.room === 1 && choice.dungeonVariant === "foreman") {
      enemies = [enemy("guard", 1, 0, { elite: true, name: "鉄板の監督官" })];
      rewardBonus = 3;
    } else if (current.run.room === 1) {
      enemies = [enemy("rusher", 1, 0, { elite: true }), enemy("skirmisher", 1, 1, { elite: true })];
      rewardBonus = 2;
    } else {
      enemies = [enemy("guard", 2, 0, { boss: true, name: "鉄杭の番人", moveSpeed: 88, attackRange: 88 })];
      rewardBonus = 5;
    }

    next.expedition.encounter = {
      kind: "dungeon",
      dungeonId: current.definition.id,
      dungeonRoom: current.run.room,
      dungeonBoss: current.run.room === current.definition.roomCount - 1,
      discovery,
      enemies,
      rewardBonus
    };
    next.expedition.pendingEvent = null;
    next.expedition.lastEventSummary = current.run.room === 2
      ? "最奥の番人が道を塞いだ。ここで倒れれば、坑道で拾った未確定品も危うい。"
      : `${current.definition.name}の第${current.run.room + 1}区画へ踏み込んだ。`;
    next.phase = "combat";
    return remember(next);
  }

  function pushDungeonLoot(state, rewardBias, salt) {
    const index = state.expedition.unsecuredLoot.length;
    const item = Core.rollLoot(state.expedition.seed + salt, state.expedition.depth, index, rewardBias);
    item.origin = "灰喰い坑道";
    state.expedition.unsecuredLoot.push(item);
    state.expedition.lastLootIds = [item.id];
    return item;
  }

  function markRoomCleared(state, room) {
    if (!state.expedition || !state.expedition.dungeon) return;
    state.expedition.dungeon.room = room;
    state.expedition.dungeon.roomCleared = true;
  }

  function signatureRelic(dungeon, state) {
    const relic = clone(dungeon.relic);
    relic.id = `dungeon-relic-${dungeon.id}-${state.expedition.id}`;
    relic.signature = true;
    relic.dungeonId = dungeon.id;
    relic.origin = dungeon.name;
    return relic;
  }

  function completeDungeon(state, dungeon) {
    ensureDungeons(state);
    const entry = getDungeonEntry(state, dungeon.id);
    const firstClear = !entry.completed;
    entry.unlocked = true;
    entry.completed = true;
    entry.clears += 1;
    state.stats.dungeonsCleared += 1;

    if (firstClear) {
      const relic = signatureRelic(dungeon, state);
      state.expedition.unsecuredLoot.push(relic);
      state.expedition.lastLootIds = [...(state.expedition.lastLootIds || []), relic.id];
    }

    state.expedition.dungeon.active = false;
    state.expedition.dungeon.completedThisRun = true;
    state.expedition.lastEventSummary = firstClear
      ? `${dungeon.name}の最奥を制圧した。坑道守の固有レリックを奪った。まだ未確定だ。生還して初めて自分の物になる。`
      : `${dungeon.name}を再び踏破した。最奥の荷を奪った。固有レリックはもう残っていない。`;
  }

  function remember(state) {
    if (state) {
      ensureDungeons(state);
      lastKnownState = state;
      if (typeof document !== "undefined") queueMicrotask(function () { syncDungeonUi(state); });
    }
    return state;
  }

  Core.createInitialState = function createInitialStateWithDungeons() {
    return remember(ensureDungeons(base.createInitialState()));
  };

  Core.beginExpedition = function beginExpeditionWithDungeons(state, seed) {
    return remember(base.beginExpedition(ensureDungeons(clone(state)), seed));
  };

  Core.generateExplorationChoices = function generateExplorationChoicesWithDungeons(state) {
    ensureDungeons(state);
    const current = activeDungeon(state);
    if (current) return roomChoices(state, current.definition, current.run.room).map(clone);

    const choices = base.generateExplorationChoices(state).map((choice) => ({ ...choice }));
    const dungeon = DUNGEONS[0];
    const entry = getDungeonEntry(state, dungeon.id);
    if (!state.expedition || !entry || !entry.unlocked) return choices;

    const entrance = entranceChoice(dungeon, entry, state.expedition.depth);
    if (choices.length >= 3) choices[choices.length - 1] = entrance;
    else choices.push(entrance);
    return choices;
  };

  Core.discoverLocation = function discoverLocationWithDungeons(state, choiceId) {
    ensureDungeons(state);
    const entranceMatch = /^dungeon:([^:]+):entrance$/.exec(choiceId || "");
    if (entranceMatch) {
      const dungeon = dungeonDefinition(entranceMatch[1]);
      if (dungeon) return startEntrance(state, dungeon);
    }

    if ((choiceId || "").startsWith("dungeon:") && activeDungeon(state)) {
      return startDungeonRoom(state, choiceId);
    }

    return remember(base.discoverLocation(state, choiceId));
  };

  Core.resolveEventChoice = function resolveEventChoiceWithDungeons(state, optionId) {
    if (state.expedition && state.expedition.pendingEvent && state.expedition.pendingEvent.kind === "dungeon-trap") {
      const next = clone(state);
      ensureDungeons(next);
      const event = next.expedition.pendingEvent;
      next.expedition.pendingEvent = null;
      next.stats.eventsResolved = (next.stats.eventsResolved || 0) + 1;

      if (optionId === "dungeon-take-cache") {
        const cost = Math.min(next.expedition.health - 1, 14);
        next.expedition.health = Math.max(1, next.expedition.health - cost);
        pushDungeonLoot(next, 7, 17001 + event.dungeonRoom * 97);
        next.expedition.lastEventSummary = `梁を落として荷を奪った。${cost}HP失ったが、坑道の上等な戦利品を手にした。`;
      } else {
        const cost = Math.min(next.expedition.health - 1, 4);
        next.expedition.health = Math.max(1, next.expedition.health - cost);
        next.expedition.lastLootIds = [];
        next.expedition.lastEventSummary = cost > 0
          ? `壁際を抜け、${cost}HP分だけ傷ついた。荷は諦めた。`
          : "壁際を抜けた。荷には触れなかった。";
      }

      markRoomCleared(next, event.dungeonRoom);
      next.phase = "decision";
      return remember(next);
    }

    return remember(base.resolveEventChoice(state, optionId));
  };

  Core.resolveVictory = function resolveVictoryWithDungeons(state, remainingHealth) {
    const encounter = state.expedition && state.expedition.encounter ? clone(state.expedition.encounter) : null;
    const next = base.resolveVictory(state, remainingHealth);
    if (!encounter || encounter.kind !== "dungeon" || !encounter.dungeonId) return remember(next);

    const dungeon = dungeonDefinition(encounter.dungeonId);
    if (!dungeon) return remember(next);
    markRoomCleared(next, encounter.dungeonRoom);

    if (encounter.dungeonBoss) {
      completeDungeon(next, dungeon);
    } else {
      next.expedition.lastEventSummary = `${dungeon.name}の第${encounter.dungeonRoom + 1}区画を抜けた。今なら帰れる。さらに潜れば、次の区画はもっと危険だ。`;
    }
    return remember(next);
  };

  Core.continueExpedition = function continueExpeditionWithDungeons(state) {
    const current = activeDungeon(state);
    if (!current) return remember(base.continueExpedition(state));

    const wasCleared = Boolean(current.run.roomCleared);
    const next = base.continueExpedition(state);
    ensureDungeons(next);
    if (next.expedition && next.expedition.dungeon && next.expedition.dungeon.active) {
      if (wasCleared) next.expedition.dungeon.room += 1;
      next.expedition.dungeon.roomCleared = false;
      next.expedition.lastEventSummary = "";
    }
    return remember(next);
  };

  Core.returnHome = function returnHomeWithDungeons(state) {
    return remember(base.returnHome(state));
  };

  Core.resolveDefeat = function resolveDefeatWithDungeons(state) {
    return remember(base.resolveDefeat(state));
  };

  Core.equipItem = function equipItemWithDungeons(state, itemId) {
    return remember(base.equipItem(state, itemId));
  };

  Core.getCombatTuning = function getCombatTuningWithDungeons(state) {
    const tuning = base.getCombatTuning(state);
    const equipped = Core.getEquippedItem(state);
    const effect = equipped && equipped.modifier ? equipped.modifier.effect || {} : {};
    if (effect.moveSpeedMult && !(Core.HUNTS && equipped && equipped.huntId)) tuning.moveSpeed *= effect.moveSpeedMult;
    return tuning;
  };

  Core.DUNGEONS = DUNGEONS;
  Core.getDungeonLedger = function getDungeonLedger(state) {
    ensureDungeons(state);
    return DUNGEONS.map((dungeon) => {
      const entry = getDungeonEntry(state, dungeon.id);
      return { ...clone(dungeon), progress: clone(entry) };
    });
  };
  Core.getActiveDungeon = function getActiveDungeon(state) {
    const current = activeDungeon(state);
    return current ? { definition: clone(current.definition), run: clone(current.run) } : null;
  };
  Core.__dungeonsInstalled = true;

  function injectStyles() {
    if (document.getElementById("dungeon-system-styles")) return;
    const style = document.createElement("style");
    style.id = "dungeon-system-styles";
    style.textContent = `
      .dungeon-ledger { margin:16px 0 0; }
      .dungeon-ledger-head { display:flex; justify-content:space-between; align-items:end; gap:14px; margin-bottom:12px; }
      .dungeon-ledger-head h2 { margin:0; }
      .dungeon-ledger-head span { color:var(--dim); font-size:10px; letter-spacing:.08em; }
      .dungeon-entry { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; padding:14px; border:1px solid var(--line); background:rgba(255,255,255,.018); }
      .dungeon-entry.open { border-color:rgba(211,79,62,.28); background:linear-gradient(110deg,rgba(150,63,48,.1),rgba(255,255,255,.018)); }
      .dungeon-entry.cleared { border-color:rgba(240,199,114,.28); }
      .dungeon-glyph { width:46px; height:46px; display:grid; place-items:center; border:1px solid var(--line); color:var(--gold); font:26px/1 Georgia,serif; }
      .dungeon-entry small { color:var(--gold); font-size:9px; letter-spacing:.1em; }
      .dungeon-entry strong { display:block; margin:2px 0; font-family:Georgia,serif; font-size:21px; font-weight:500; }
      .dungeon-entry p { margin:0; font-size:10px; line-height:1.45; }
      .dungeon-status { color:#d6b06a; font-size:10px; font-weight:800; letter-spacing:.08em; text-align:right; }
      .dungeon-depth-strip { display:none; margin-bottom:12px; padding:10px 12px; border:1px solid rgba(240,199,114,.22); background:rgba(113,79,38,.08); }
      .dungeon-depth-strip.active { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .dungeon-depth-strip span { color:var(--muted); font-size:10px; }
      .dungeon-depth-strip strong { color:var(--gold-2); font-size:11px; letter-spacing:.08em; }
      .lead-card [data-dungeon-room] { color:var(--gold); }
      @media (max-width:700px) {
        .dungeon-ledger-head { align-items:start; flex-direction:column; }
        .dungeon-entry { grid-template-columns:42px 1fr; }
        .dungeon-status { grid-column:1 / -1; text-align:left; }
        .dungeon-depth-strip.active { position:sticky; top:0; z-index:12; backdrop-filter:blur(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLedger() {
    injectStyles();
    let ledger = document.getElementById("dungeon-ledger");
    if (ledger) return ledger;
    const hub = document.getElementById("hub-screen");
    const grid = hub && hub.querySelector(".hub-grid");
    if (!hub || !grid) return null;
    ledger = document.createElement("section");
    ledger.id = "dungeon-ledger";
    ledger.className = "panel dungeon-ledger";
    ledger.innerHTML = `
      <div class="dungeon-ledger-head">
        <div><p class="eyebrow">DELVE LEDGER</p><h2>見つけた地下</h2></div>
        <span>一部屋ごとに、生還か深部かを選ぶ</span>
      </div>
      <div id="dungeon-ledger-list"></div>
    `;
    hub.insertBefore(ledger, grid);
    return ledger;
  }

  function ensureDepthStrip() {
    injectStyles();
    let strip = document.getElementById("dungeon-depth-strip");
    if (strip) return strip;
    const explore = document.getElementById("explore-screen");
    const warning = document.getElementById("carried-warning");
    if (!explore || !warning) return null;
    strip = document.createElement("div");
    strip.id = "dungeon-depth-strip";
    strip.className = "dungeon-depth-strip";
    warning.parentNode.insertBefore(strip, warning);
    return strip;
  }

  function renderLedger(state) {
    const ledger = ensureLedger();
    if (!ledger) return;
    const list = ledger.querySelector("#dungeon-ledger-list");
    if (!list) return;
    list.innerHTML = "";
    Core.getDungeonLedger(state).forEach((dungeon) => {
      const entry = dungeon.progress;
      const card = document.createElement("article");
      card.className = `dungeon-entry${entry.unlocked ? " open" : ""}${entry.completed ? " cleared" : ""}`;
      const status = entry.completed
        ? `踏破 ${entry.clears}回 / 再潜入可能`
        : entry.unlocked
          ? "入口判明 / 遠征に出現"
          : "灰牙を討てば手掛かりが開く";
      card.innerHTML = `
        <div class="dungeon-glyph">⌄</div>
        <div><small>${entry.unlocked ? "DISCOVERED" : "UNKNOWN"}</small><strong>${entry.unlocked ? dungeon.name : "？？？？"}</strong><p>${entry.unlocked ? dungeon.epithet : "まだ地下へ続く道を知らない。"}</p></div>
        <div class="dungeon-status">${status}</div>
      `;
      list.appendChild(card);
    });
  }

  function setDefaultExploreCopy() {
    const explore = document.getElementById("explore-screen");
    if (!explore) return;
    const title = explore.querySelector(".expedition-title h1");
    const eyebrow = explore.querySelector(".expedition-title .eyebrow");
    const copy = explore.querySelector(".expedition-title > div > p:last-child");
    if (title) title.textContent = "どこへ踏み込む？";
    if (eyebrow) eyebrow.textContent = "THE ROAD BEYOND THE HEARTH";
    if (copy) copy.innerHTML = "方向ではなく、<em>気になる場所</em>を選べ。見えている情報は本物だが、全部ではない。";
  }

  function syncDungeonUi(state) {
    if (!state || typeof document === "undefined") return;
    renderLedger(state);
    const current = activeDungeon(state);
    const strip = ensureDepthStrip();
    const continueButton = document.getElementById("continue-expedition");

    if (!current) {
      if (strip) strip.classList.remove("active");
      setDefaultExploreCopy();
      if (continueButton) continueButton.innerHTML = "<small>RISK MORE</small>もう一ヶ所だけ見る";
      return;
    }

    if (strip) {
      strip.classList.add("active");
      strip.innerHTML = `<span>${current.definition.name}</span><strong>区画 ${current.run.room + 1} / ${current.definition.roomCount}</strong>`;
    }

    const explore = document.getElementById("explore-screen");
    if (explore) {
      const title = explore.querySelector(".expedition-title h1");
      const eyebrow = explore.querySelector(".expedition-title .eyebrow");
      const copy = explore.querySelector(".expedition-title > div > p:last-child");
      if (title) title.textContent = "坑道の奥へ。";
      if (eyebrow) eyebrow.textContent = `${current.definition.name} / DELVE ${current.run.room + 1} OF ${current.definition.roomCount}`;
      if (copy) copy.textContent = "ここでは一部屋が一つの賭けだ。抜けるたびに帰れる。奥へ行くほど、失いたくない物が増える。";
    }

    if (continueButton) {
      const label = current.run.roomCleared ? "DESCEND" : "ENTER";
      const text = current.run.roomCleared ? `第${Math.min(current.definition.roomCount, current.run.room + 2)}区画へ降りる` : "坑道へ降りる";
      continueButton.innerHTML = `<small>${label}</small>${text}`;
    }
  }

  if (typeof document !== "undefined") {
    ensureLedger();
    ensureDepthStrip();
    if (lastKnownState) syncDungeonUi(lastKnownState);
  }

  return Core;
});
