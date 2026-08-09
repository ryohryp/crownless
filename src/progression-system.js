(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }

  if (root.CrownlessCore) {
    root.CrownlessCore = factory(root.CrownlessCore);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function installProgression(Core) {
  "use strict";

  if (!Core || Core.__progressionInstalled) return Core;

  const MILESTONES = [
    {
      rank: 0,
      threshold: 0,
      name: "消えない火",
      tag: "GREY HEARTH",
      description: "まだ何者でもない。それでも帰る場所だけはある。",
      benefit: "帰還した遠征の名声が灰炉に積み上がる"
    },
    {
      rank: 1,
      threshold: 5,
      name: "地図掛け",
      tag: "SCOUTING",
      description: "生還者の書き込みが壁に増え、危険な道の癖が少し読める。",
      benefit: "新しい遠征の最初に偵察1を得る"
    },
    {
      rank: 2,
      threshold: 15,
      name: "回収係",
      tag: "RECOVERY",
      description: "倒れた者を探しに行く物好きが、灰炉に一人居ついた。",
      benefit: "敗北時、通常より未確定品を1個多く回収する"
    },
    {
      rank: 3,
      threshold: 30,
      name: "鍛冶火",
      tag: "TEMPER",
      description: "小さな炉が赤くなった。武器も拳帯も、出る前に一度だけ手が入る。",
      benefit: "通常攻撃+2 / 技+3ダメージ"
    }
  ];

  const base = {
    createInitialState: Core.createInitialState,
    beginExpedition: Core.beginExpedition,
    returnHome: Core.returnHome,
    resolveDefeat: Core.resolveDefeat,
    equipItem: Core.equipItem,
    getCombatTuning: Core.getCombatTuning
  };

  let lastKnownState = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function rankForRenown(renown) {
    let rank = 0;
    MILESTONES.forEach((milestone) => {
      if (renown >= milestone.threshold) rank = milestone.rank;
    });
    return rank;
  }

  function ensureProgression(state) {
    if (!state.progression) {
      state.progression = {
        renown: 0,
        rank: 0,
        lastGain: 0
      };
    }
    if (typeof state.progression.renown !== "number") state.progression.renown = 0;
    if (typeof state.progression.lastGain !== "number") state.progression.lastGain = 0;
    state.progression.rank = rankForRenown(state.progression.renown);
    if (!state.stats) state.stats = {};
    if (typeof state.stats.renownEarned !== "number") state.stats.renownEarned = state.progression.renown;
    return state;
  }

  function renownForExpedition(expedition) {
    if (!expedition || !Array.isArray(expedition.discoveries) || expedition.discoveries.length === 0) return 0;

    const depthBonus = Math.min(3, Math.max(0, expedition.depth || 0));
    const lootBonus = Math.min(3, Array.isArray(expedition.unsecuredLoot) ? expedition.unsecuredLoot.length : 0);
    const huntBonus = expedition.discoveries.some((discovery) => discovery.eventKind === "hunt") ? 3 : 0;
    const dungeonBonus = expedition.discoveries.some((discovery) => discovery.eventKind === "dungeon-boss") ? 5 : 0;
    return 1 + depthBonus + lootBonus + huntBonus + dungeonBonus;
  }

  function nextMilestone(state) {
    ensureProgression(state);
    return MILESTONES.find((milestone) => milestone.threshold > state.progression.renown) || null;
  }

  function remember(state) {
    if (state) {
      ensureProgression(state);
      lastKnownState = state;
      if (typeof document !== "undefined") queueMicrotask(function () { renderProgression(state); });
    }
    return state;
  }

  Core.createInitialState = function createInitialStateWithProgression() {
    return remember(ensureProgression(base.createInitialState()));
  };

  Core.beginExpedition = function beginExpeditionWithProgression(state, seed) {
    const prepared = ensureProgression(clone(state));
    const next = base.beginExpedition(prepared, seed);
    if (next.progression.rank >= 1 && next.expedition) {
      next.expedition.scouting = Math.max(1, next.expedition.scouting || 0);
      next.expedition.lastEventSummary = "灰炉の地図を一枚持ち出した。最初の探索は危険を少し読みやすい。";
    }
    return remember(next);
  };

  Core.returnHome = function returnHomeWithRenown(state) {
    const prepared = ensureProgression(clone(state));
    const gain = renownForExpedition(prepared.expedition);
    const next = base.returnHome(prepared);
    ensureProgression(next);
    next.progression.renown += gain;
    next.progression.lastGain = gain;
    next.progression.rank = rankForRenown(next.progression.renown);
    next.stats.renownEarned = (next.stats.renownEarned || 0) + gain;
    return remember(next);
  };

  Core.resolveDefeat = function resolveDefeatWithRecovery(state) {
    const prepared = ensureProgression(clone(state));
    const rank = prepared.progression.rank;
    const carried = prepared.expedition && Array.isArray(prepared.expedition.unsecuredLoot)
      ? clone(prepared.expedition.unsecuredLoot)
      : [];
    const baseKeepCount = Math.floor(carried.length / 2);
    const next = base.resolveDefeat(prepared);
    ensureProgression(next);
    next.progression.lastGain = 0;

    if (rank >= 2 && carried.length > baseKeepCount) {
      const extra = carried[baseKeepCount];
      const alreadyPresent = next.securedLoot.some((item) => item.id === extra.id);
      if (!alreadyPresent) {
        next.securedLoot.push({ ...extra, secured: true, recovered: true, hearthRecovered: true });
      }
    }
    return remember(next);
  };

  Core.equipItem = function equipItemWithProgression(state, itemId) {
    return remember(base.equipItem(ensureProgression(clone(state)), itemId));
  };

  Core.getCombatTuning = function getCombatTuningWithHearth(state) {
    const tuning = base.getCombatTuning(state);
    const progression = state && state.progression ? state.progression : { rank: 0 };
    if ((progression.rank || 0) >= 3) {
      tuning.lightDamage += 2;
      tuning.heavyDamage += 3;
    }
    return tuning;
  };

  Core.HEARTH_MILESTONES = MILESTONES;
  Core.getHearthProgression = function getHearthProgression(state) {
    ensureProgression(state);
    const current = MILESTONES[state.progression.rank] || MILESTONES[0];
    const next = nextMilestone(state);
    return {
      renown: state.progression.renown,
      rank: state.progression.rank,
      lastGain: state.progression.lastGain,
      current: clone(current),
      next: next ? clone(next) : null,
      milestones: MILESTONES.map(clone)
    };
  };
  Core.renownForExpedition = renownForExpedition;
  Core.__progressionInstalled = true;

  function injectStyles() {
    if (document.getElementById("hearth-progression-styles")) return;
    const style = document.createElement("style");
    style.id = "hearth-progression-styles";
    style.textContent = `
      .hearth-progress { margin:16px 0 0; padding:18px; }
      .hearth-progress-head { display:grid; grid-template-columns:1fr auto; gap:18px; align-items:end; margin-bottom:14px; }
      .hearth-progress-head h2 { margin:0; }
      .renown-total { text-align:right; }
      .renown-total small { display:block; color:var(--dim); font-size:9px; letter-spacing:.11em; }
      .renown-total strong { display:block; color:var(--gold-2); font:42px/1 Georgia,serif; font-weight:400; }
      .renown-total em { display:block; margin-top:3px; color:#9fb18f; font-size:10px; font-style:normal; }
      .hearth-rank-line { display:flex; justify-content:space-between; gap:14px; margin-bottom:10px; color:var(--muted); font-size:10px; }
      .hearth-rank-line strong { color:#d8c6a2; }
      .renown-track { height:6px; overflow:hidden; background:rgba(255,255,255,.06); }
      .renown-track i { display:block; height:100%; background:linear-gradient(90deg,#73513a,#d1a55f); }
      .hearth-milestones { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:14px; }
      .hearth-milestone { padding:12px; border:1px solid var(--line); background:rgba(255,255,255,.016); min-height:118px; }
      .hearth-milestone.unlocked { border-color:rgba(240,199,114,.28); background:rgba(139,99,48,.07); }
      .hearth-milestone.current { box-shadow:inset 0 0 0 1px rgba(240,199,114,.16); }
      .hearth-milestone small { color:var(--gold); font-size:8px; letter-spacing:.1em; }
      .hearth-milestone strong { display:block; margin:5px 0; font-family:Georgia,serif; font-size:18px; font-weight:500; }
      .hearth-milestone p { margin:0; font-size:10px; line-height:1.45; }
      .hearth-benefit { margin-top:8px; color:#baa77f; font-size:9px; line-height:1.4; }
      @media (max-width:800px) { .hearth-milestones { grid-template-columns:1fr 1fr; } }
      @media (max-width:460px) {
        .hearth-progress { padding:14px; }
        .hearth-progress-head { grid-template-columns:1fr auto; gap:8px; }
        .renown-total strong { font-size:34px; }
        .hearth-milestones { grid-template-columns:1fr; }
        .hearth-milestone { min-height:0; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    injectStyles();
    let panel = document.getElementById("hearth-progress");
    if (panel) return panel;
    const hub = document.getElementById("hub-screen");
    const grid = hub && hub.querySelector(".hub-grid");
    if (!hub || !grid) return null;
    panel = document.createElement("section");
    panel.id = "hearth-progress";
    panel.className = "panel hearth-progress";
    hub.insertBefore(panel, grid);
    return panel;
  }

  function renderProgression(state) {
    if (!state || typeof document === "undefined") return;
    const panel = ensurePanel();
    if (!panel) return;
    const data = Core.getHearthProgression(state);
    const currentThreshold = data.current.threshold;
    const nextThreshold = data.next ? data.next.threshold : data.renown;
    const span = Math.max(1, nextThreshold - currentThreshold);
    const progress = data.next ? Math.max(0, Math.min(1, (data.renown - currentThreshold) / span)) : 1;
    const nextCopy = data.next ? `${data.next.name}まで ${data.next.threshold - data.renown}` : "現在の灰炉は最大段階";

    panel.innerHTML = `
      <div class="hearth-progress-head">
        <div><p class="eyebrow">GREY HEARTH / RENOWN</p><h2>${data.current.name}</h2></div>
        <div class="renown-total"><small>RENOWN</small><strong>${data.renown}</strong>${data.lastGain > 0 ? `<em>+${data.lastGain} 前回帰還</em>` : ""}</div>
      </div>
      <div class="hearth-rank-line"><span>灰炉 RANK ${data.rank}</span><strong>${nextCopy}</strong></div>
      <div class="renown-track"><i style="width:${Math.round(progress * 100)}%"></i></div>
      <div class="hearth-milestones">
        ${data.milestones.map((milestone) => {
          const unlocked = data.renown >= milestone.threshold;
          const current = milestone.rank === data.rank;
          return `<article class="hearth-milestone${unlocked ? " unlocked" : ""}${current ? " current" : ""}">
            <small>RANK ${milestone.rank} / ${milestone.threshold} RENOWN</small>
            <strong>${milestone.name}</strong>
            <p>${milestone.description}</p>
            <div class="hearth-benefit">${unlocked ? "解放済：" : "解放："}${milestone.benefit}</div>
          </article>`;
        }).join("")}
      </div>
    `;
  }

  if (typeof document !== "undefined") {
    ensurePanel();
    if (lastKnownState) renderProgression(lastKnownState);
  }

  return Core;
});
