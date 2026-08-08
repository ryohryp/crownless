(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }

  if (root.CrownlessCore) {
    root.CrownlessCore = factory(root.CrownlessCore);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function installHunts(Core) {
  "use strict";

  if (!Core || Core.__huntsInstalled) return Core;

  const HUNTS = [
    {
      id: "ash-hound",
      name: "灰牙",
      epithet: "街道を喰う犬",
      rumor: "旧街道の焚き火跡には、灰を噛んだような歯形が残る。生き残りは一人も顔を見ていない。",
      territories: ["dead-kings-road", "blackthorn-copse"],
      clueGoal: 2,
      enemyKind: "rusher",
      lair: {
        id: "ash-hound-camp",
        name: "灰牙の野営地",
        kicker: "焚き火はまだ赤い。今度は、向こうもこちらを待っている。",
        description: "潰れた荷車を盾にした野営地。灰色の外套の男が、血のついた手斧を地面へ引きずっている。",
        omen: "灰牙本人。逃げ道は一つしかない",
        palette: "road",
        risk: 5,
        reward: 5
      },
      boss: {
        name: "灰牙",
        maxHealth: 122,
        damage: 15,
        moveSpeed: 158,
        attackRange: 58
      },
      relic: {
        type: "handwraps",
        style: "unarmed",
        styleLabel: "拳闘",
        playstyle: "連撃 / 密着",
        name: "灰牙の血布",
        rarity: "relic",
        power: 11,
        description: "灰と血が染み込んだ拳帯。殴るほど呼吸が短く、速くなる。",
        modifier: {
          id: "ash-hound-rush",
          name: "〈猟犬〉",
          tag: "HUNT RELIC / COMBO",
          description: "素手の連撃がさらに速くなり、3段目の威力が大きく上がる。",
          effect: { unarmedTempo: 1.45, comboFinisher: 1.5 }
        }
      }
    },
    {
      id: "bellless-knight",
      name: "鐘なき騎士",
      epithet: "祈りを終わらせる者",
      rumor: "礼拝堂の鐘はとうに失われた。それでも夜になると、盾を打つ音が三度だけ響く。",
      territories: ["ruined-chapel", "watchfire-hill"],
      clueGoal: 2,
      enemyKind: "guard",
      lair: {
        id: "bellless-vault",
        name: "鐘なき地下聖堂",
        kicker: "鐘の代わりに、鉄の盾が石床を叩く。",
        description: "崩れた祭壇の地下。折れた武器が墓標のように並び、その奥で甲冑の男が立ち上がる。",
        omen: "正面からの軽い一撃は、すべて盾に殺される",
        palette: "chapel",
        risk: 5,
        reward: 5
      },
      boss: {
        name: "鐘なき騎士",
        maxHealth: 158,
        damage: 17,
        moveSpeed: 78,
        attackRange: 84
      },
      relic: {
        type: "sword",
        style: "blade",
        styleLabel: "長剣",
        playstyle: "間合い / 強打",
        name: "鐘喰らいの武装剣",
        rarity: "relic",
        power: 15,
        description: "盾の縁を砕くためだけに刃厚を増した古剣。振り切った後に重い静寂が残る。",
        modifier: {
          id: "bell-eater",
          name: "〈鐘砕き〉",
          tag: "HUNT RELIC / GUARD BREAK",
          description: "重攻撃の怯みと吹き飛ばしが極端に強くなる。",
          effect: { heavyStagger: 2.25 }
        }
      }
    },
    {
      id: "fen-crow",
      name: "沼鴉",
      epithet: "見えない距離から射る者",
      rumor: "水辺で倒れた者には、必ず一本だけ黒い矢が残る。二本目を見る者はいない。",
      territories: ["drowned-mill", "pilgrims-cut"],
      clueGoal: 2,
      enemyKind: "skirmisher",
      lair: {
        id: "fen-crow-perch",
        name: "沼鴉の射場",
        kicker: "杭の先に黒い羽根。足元には、何本もの古い射線。",
        description: "浅い水と崩れた足場が続く射場。遠くの高台で、細身の影が弦を引く。",
        omen: "追えば離れ、止まれば射抜かれる",
        palette: "marsh",
        risk: 5,
        reward: 5
      },
      boss: {
        name: "沼鴉",
        maxHealth: 112,
        damage: 14,
        moveSpeed: 124,
        attackRange: 292
      },
      relic: {
        type: "dagger",
        style: "blade",
        styleLabel: "短刀",
        playstyle: "差し込み / 回避",
        name: "沼鴉の嘴",
        rarity: "relic",
        power: 14,
        description: "黒い矢尻を打ち直した短刀。避けた直後だけ、身体が一歩先へ出る。",
        modifier: {
          id: "crow-step",
          name: "〈黒羽歩〉",
          tag: "HUNT RELIC / PERFECT EVADE",
          description: "寸前回避で次の一撃が強化され、移動速度もわずかに上がる。",
          effect: { evadeEmpower: true, moveSpeedMult: 1.1 }
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
    returnHome: Core.returnHome,
    resolveDefeat: Core.resolveDefeat,
    equipItem: Core.equipItem,
    getCombatTuning: Core.getCombatTuning
  };

  let lastKnownState = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeHuntState() {
    return {
      activeIndex: 0,
      entries: HUNTS.map((hunt) => ({ id: hunt.id, clues: 0, completed: false, defeatedAtRun: null }))
    };
  }

  function ensureHunts(state) {
    if (!state.hunts) state.hunts = makeHuntState();
    if (!state.stats) state.stats = {};
    if (typeof state.stats.huntClues !== "number") state.stats.huntClues = 0;
    if (typeof state.stats.huntsCompleted !== "number") state.stats.huntsCompleted = 0;
    return state;
  }

  function getHuntDefinition(id) {
    return HUNTS.find((hunt) => hunt.id === id) || null;
  }

  function getActiveHunt(state) {
    if (!state || !state.hunts) return null;
    const entry = state.hunts.entries[state.hunts.activeIndex];
    if (!entry || entry.completed) return null;
    const definition = getHuntDefinition(entry.id);
    return definition ? { ...clone(definition), progress: clone(entry) } : null;
  }

  function activeEntry(state) {
    if (!state || !state.hunts) return null;
    return state.hunts.entries[state.hunts.activeIndex] || null;
  }

  function advanceClue(state, discovery) {
    ensureHunts(state);
    const hunt = getActiveHunt(state);
    const entry = activeEntry(state);
    if (!hunt || !entry || !discovery || !hunt.territories.includes(discovery.locationId)) return false;
    if (entry.clues >= hunt.clueGoal) return false;

    entry.clues += 1;
    state.stats.huntClues += 1;
    if (state.expedition) {
      const found = entry.clues >= hunt.clueGoal
        ? `痕跡が繋がった。${hunt.name}の居場所を突き止めた。`
        : `${hunt.name}の痕跡を掴んだ。あと${hunt.clueGoal - entry.clues}つで追える。`;
      state.expedition.lastEventSummary = state.expedition.lastEventSummary
        ? `${state.expedition.lastEventSummary} ${found}`
        : found;
    }
    return true;
  }

  function targetChoice(hunt, depth) {
    return {
      id: hunt.lair.id,
      locationId: hunt.lair.id,
      choiceId: `hunt:${hunt.id}`,
      name: hunt.lair.name,
      kicker: hunt.lair.kicker,
      description: hunt.lair.description,
      omen: hunt.lair.omen,
      palette: hunt.lair.palette,
      risk: hunt.lair.risk,
      reward: hunt.lair.reward,
      signal: `標的 / ${hunt.name}`,
      eventKind: "hunt",
      huntId: hunt.id,
      huntTrace: true,
      depth: depth + 1
    };
  }

  function bossEnemy(hunt, depth) {
    return {
      id: `hunt-${hunt.id}-${depth}`,
      kind: hunt.enemyKind,
      name: hunt.boss.name,
      maxHealth: hunt.boss.maxHealth + depth * 8,
      damage: hunt.boss.damage + Math.floor(depth / 2),
      moveSpeed: hunt.boss.moveSpeed,
      attackRange: hunt.boss.attackRange,
      boss: true,
      huntId: hunt.id
    };
  }

  function discoverHuntTarget(state, hunt) {
    const next = clone(state);
    ensureHunts(next);
    const choice = targetChoice(hunt, next.expedition.depth);
    const discovery = {
      id: `${choice.id}-${next.expedition.depth}-${next.expedition.discoveries.length}`,
      locationId: choice.locationId,
      name: choice.name,
      kicker: choice.kicker,
      flavor: choice.description,
      omen: choice.omen,
      risk: choice.risk,
      reward: choice.reward,
      palette: choice.palette,
      depth: next.expedition.depth + 1,
      signal: choice.signal,
      eventKind: "hunt",
      huntId: hunt.id
    };

    next.expedition.discoveries.push(discovery);
    next.expedition.lastDiscovery = discovery;
    next.expedition.encounter = {
      kind: "hunt",
      huntId: hunt.id,
      discovery,
      enemies: [bossEnemy(hunt, next.expedition.depth)],
      rewardBonus: 5
    };
    next.expedition.lastEventSummary = `${hunt.name}を追い詰めた。ここで倒れれば、居場所は分かっていても戦利品は残らない。`;
    next.phase = "combat";
    return remember(next);
  }

  function signatureRelic(hunt, state) {
    const relic = clone(hunt.relic);
    const run = state.expedition ? state.expedition.id : state.stats.expeditionsStarted;
    relic.id = `hunt-relic-${hunt.id}-${run}`;
    relic.signature = true;
    relic.huntId = hunt.id;
    relic.origin = hunt.name;
    return relic;
  }

  function completeHunt(state, hunt) {
    ensureHunts(state);
    const entry = state.hunts.entries.find((candidate) => candidate.id === hunt.id);
    if (!entry || entry.completed) return;

    entry.completed = true;
    entry.defeatedAtRun = state.expedition ? state.expedition.id : state.stats.expeditionsStarted;
    state.stats.huntsCompleted += 1;
    while (state.hunts.activeIndex < state.hunts.entries.length && state.hunts.entries[state.hunts.activeIndex].completed) {
      state.hunts.activeIndex += 1;
    }
  }

  function remember(state) {
    if (state) {
      ensureHunts(state);
      lastKnownState = state;
      if (typeof document !== "undefined") queueMicrotask(function () { renderBoard(state); });
    }
    return state;
  }

  Core.createInitialState = function createInitialStateWithHunts() {
    return remember(ensureHunts(base.createInitialState()));
  };

  Core.beginExpedition = function beginExpeditionWithHunts(state, seed) {
    return remember(base.beginExpedition(ensureHunts(clone(state)), seed));
  };

  Core.generateExplorationChoices = function generateExplorationChoicesWithHunts(state) {
    const choices = base.generateExplorationChoices(state).map((choice) => ({ ...choice }));
    const hunt = getActiveHunt(state);
    if (!hunt) return choices;

    if (hunt.progress.clues >= hunt.clueGoal) {
      choices[0] = targetChoice(hunt, state.expedition.depth);
      return choices;
    }

    return choices.map((choice) => {
      if (!hunt.territories.includes(choice.id)) return choice;
      return {
        ...choice,
        huntTrace: true,
        signal: `${choice.signal} / 痕跡`,
        omen: `${hunt.name}に繋がる痕跡があるかもしれない。${choice.omen}`
      };
    });
  };

  Core.discoverLocation = function discoverLocationWithHunts(state, choiceId) {
    const hunt = getActiveHunt(state);
    if (hunt && choiceId === `hunt:${hunt.id}` && hunt.progress.clues >= hunt.clueGoal) {
      return discoverHuntTarget(state, hunt);
    }

    const next = base.discoverLocation(state, choiceId);
    if (next.phase === "decision" && next.expedition && next.expedition.lastDiscovery) {
      advanceClue(next, next.expedition.lastDiscovery);
    }
    return remember(next);
  };

  Core.resolveEventChoice = function resolveEventChoiceWithHunts(state, optionId) {
    const discovery = state.expedition && state.expedition.pendingEvent
      ? clone(state.expedition.pendingEvent.discovery)
      : null;
    const next = base.resolveEventChoice(state, optionId);
    if (next.phase === "decision" && discovery) advanceClue(next, discovery);
    return remember(next);
  };

  Core.resolveVictory = function resolveVictoryWithHunts(state, remainingHealth) {
    const encounter = state.expedition && state.expedition.encounter ? clone(state.expedition.encounter) : null;
    const next = base.resolveVictory(state, remainingHealth);

    if (encounter && encounter.kind === "hunt" && encounter.huntId) {
      const hunt = getHuntDefinition(encounter.huntId);
      if (hunt) {
        const relic = signatureRelic(hunt, next);
        next.expedition.unsecuredLoot.push(relic);
        next.expedition.lastLootIds = [...(next.expedition.lastLootIds || []), relic.id];
        completeHunt(next, hunt);
        const nextHunt = getActiveHunt(next);
        next.expedition.lastEventSummary = `${hunt.name}を討ち取った。固有のレリックを奪った。${nextHunt ? ` 灰炉では次の噂「${nextHunt.name}」が待っている。` : " 噂板から、追うべき名前が消えた。"}`;
      }
      return remember(next);
    }

    if (encounter && encounter.discovery) advanceClue(next, encounter.discovery);
    return remember(next);
  };

  Core.returnHome = function returnHomeWithHunts(state) {
    return remember(base.returnHome(state));
  };

  Core.resolveDefeat = function resolveDefeatWithHunts(state) {
    return remember(base.resolveDefeat(state));
  };

  Core.equipItem = function equipItemWithHunts(state, itemId) {
    return remember(base.equipItem(state, itemId));
  };

  Core.getCombatTuning = function getCombatTuningWithHunts(state) {
    const tuning = base.getCombatTuning(state);
    const equipped = Core.getEquippedItem(state);
    const effect = equipped && equipped.modifier ? equipped.modifier.effect || {} : {};
    if (effect.moveSpeedMult) tuning.moveSpeed *= effect.moveSpeedMult;
    return tuning;
  };

  Core.HUNTS = HUNTS;
  Core.getActiveHunt = getActiveHunt;
  Core.getHuntBoard = function getHuntBoard(state) {
    ensureHunts(state);
    return state.hunts.entries.map((entry, index) => {
      const definition = getHuntDefinition(entry.id);
      return {
        ...clone(definition),
        progress: clone(entry),
        active: index === state.hunts.activeIndex && !entry.completed,
        locked: index > state.hunts.activeIndex && !entry.completed,
        located: !entry.completed && entry.clues >= definition.clueGoal
      };
    });
  };
  Core.__huntsInstalled = true;

  function injectBoardStyles() {
    if (document.getElementById("hunt-board-styles")) return;
    const style = document.createElement("style");
    style.id = "hunt-board-styles";
    style.textContent = `
      .hunt-board { margin: 22px 0 0; overflow: hidden; }
      .hunt-board-head { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:16px; }
      .hunt-board-head h2 { margin:0; }
      .hunt-board-head > span { color:var(--dim); font-size:10px; letter-spacing:.08em; }
      .hunt-chain { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
      .hunt-card { min-height:154px; padding:16px; border:1px solid var(--line); background:rgba(255,255,255,.018); position:relative; }
      .hunt-card.active { border-color:rgba(240,199,114,.36); background:linear-gradient(145deg,rgba(160,111,48,.13),rgba(255,255,255,.018)); }
      .hunt-card.located { box-shadow:inset 0 0 0 1px rgba(211,79,62,.22); }
      .hunt-card.completed { opacity:.58; }
      .hunt-card.locked { opacity:.3; filter:grayscale(.5); }
      .hunt-card small { color:var(--gold); font-size:9px; letter-spacing:.11em; text-transform:uppercase; }
      .hunt-card h3 { margin:8px 0 2px; font-size:26px; }
      .hunt-card .hunt-epithet { color:#c8b99f; font-size:11px; }
      .hunt-card p { margin:10px 0 12px; font-size:11px; line-height:1.55; }
      .hunt-progress { display:flex; align-items:center; gap:6px; color:var(--muted); font-size:10px; }
      .hunt-progress i { flex:1; height:4px; background:rgba(255,255,255,.07); }
      .hunt-progress i.on { background:var(--gold); }
      .hunt-status { margin-top:10px; color:#dfb965; font-weight:800; font-size:10px; letter-spacing:.08em; }
      .hunt-card.located .hunt-status { color:#ef7966; }
      .hunt-card.completed .hunt-status { color:#9db18e; }
      @media (max-width:850px) { .hunt-chain { grid-template-columns:1fr; } .hunt-card { min-height:0; } }
      @media (max-height:760px) and (min-width:701px) { .hunt-board { margin-top:14px; } .hunt-card p { display:none; } .hunt-card { min-height:112px; } }
    `;
    document.head.appendChild(style);
  }

  function ensureBoard() {
    injectBoardStyles();
    let board = document.getElementById("hunt-board");
    if (board) return board;
    const hub = document.getElementById("hub-screen");
    const grid = hub && hub.querySelector(".hub-grid");
    if (!hub || !grid) return null;

    board = document.createElement("section");
    board.id = "hunt-board";
    board.className = "panel hunt-board";
    board.innerHTML = `
      <div class="hunt-board-head">
        <div><p class="eyebrow">RUMOR BOARD</p><h2>追うべき名前</h2></div>
        <span>痕跡は生還・敗北をまたいで残る</span>
      </div>
      <div id="hunt-chain" class="hunt-chain"></div>
    `;
    hub.insertBefore(board, grid);
    return board;
  }

  function renderBoard(state) {
    if (!state || typeof document === "undefined") return;
    const board = ensureBoard();
    if (!board) return;
    const chain = board.querySelector("#hunt-chain");
    if (!chain) return;

    chain.innerHTML = "";
    Core.getHuntBoard(state).forEach((hunt, index) => {
      const card = document.createElement("article");
      card.className = `hunt-card${hunt.active ? " active" : ""}${hunt.located ? " located" : ""}${hunt.progress.completed ? " completed" : ""}${hunt.locked ? " locked" : ""}`;
      const clues = Math.min(hunt.clueGoal, hunt.progress.clues);
      const status = hunt.progress.completed
        ? "討伐済 / RELIC RECOVERED"
        : hunt.locked
          ? "前の噂を終えれば開く"
          : hunt.located
            ? "居場所判明 / 次の探索に出現"
            : `痕跡 ${clues} / ${hunt.clueGoal}`;
      card.innerHTML = `
        <small>0${index + 1} / ${hunt.enemyKind.toUpperCase()}</small>
        <h3>${hunt.name}</h3>
        <div class="hunt-epithet">${hunt.epithet}</div>
        <p>${hunt.rumor}</p>
        <div class="hunt-progress">${Array.from({ length: hunt.clueGoal }, (_, i) => `<i class="${i < clues ? "on" : ""}"></i>`).join("")}</div>
        <div class="hunt-status">${status}</div>
      `;
      chain.appendChild(card);
    });
  }

  if (typeof document !== "undefined") {
    ensureBoard();
    if (lastKnownState) renderBoard(lastKnownState);
  }

  return Core;
});
