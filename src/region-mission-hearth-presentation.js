(() => {
  "use strict";

  const Core = window.CrownlessCore;
  const hub = document.getElementById("hub-screen");
  const hubGrid = hub && hub.querySelector(".hub-grid");
  const startExpedition = document.getElementById("start-expedition");
  const leadList = document.getElementById("lead-list");
  if (!Core || !hub || !hubGrid || !startExpedition || !leadList || typeof Core.getRegionMissionBoard !== "function") return;

  const style = document.createElement("style");
  style.id = "region-mission-hearth-styles";
  style.textContent = `
    .region-mission-hearth { margin:18px 0; padding:18px; border:1px solid rgba(201,163,93,.24); background:linear-gradient(115deg,rgba(201,163,93,.07),rgba(12,11,9,.72)); }
    .region-mission-hearth[hidden] { display:none !important; }
    .region-mission-hearth-head { display:flex; align-items:start; justify-content:space-between; gap:16px; }
    .region-mission-hearth-head .eyebrow { margin:0 0 5px; }
    .region-mission-hearth-head h2 { margin:0; font:500 24px/1.15 Georgia,serif; }
    .region-mission-hearth-state { flex:0 0 auto; padding:5px 8px; border:1px solid rgba(201,163,93,.28); color:#d8bd79; font-size:9px; font-weight:800; letter-spacing:.08em; }
    .region-mission-hearth-copy { margin:10px 0 0; color:var(--muted); font-size:12px; line-height:1.65; }
    .region-mission-clues { display:grid; gap:7px; margin:12px 0 0; }
    .region-mission-clue { padding:8px 10px; border-left:2px solid rgba(201,163,93,.35); background:rgba(255,255,255,.018); color:#d9cfb8; font-size:11px; line-height:1.55; }
    .region-mission-hearth-action { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(201,163,93,.14); }
    .region-mission-hearth-action span { color:var(--muted); font-size:10px; line-height:1.5; }
    .region-mission-hearth-action button { flex:0 0 auto; }
    @media (max-width:700px) {
      .region-mission-hearth { margin:12px 0; padding:14px; }
      .region-mission-hearth-head h2 { font-size:20px; }
      .region-mission-hearth-action { align-items:stretch; flex-direction:column; }
      .region-mission-hearth-action button { width:100%; }
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "region-mission-hearth";
  panel.className = "region-mission-hearth";
  panel.hidden = true;
  hubGrid.parentNode.insertBefore(panel, hubGrid);

  function latestMission() {
    if (typeof Core.loadSafeState !== "function") return null;
    const board = Core.getRegionMissionBoard(Core.loadSafeState());
    if (!Array.isArray(board) || !board.length) return null;
    return board.find((mission) => mission && !mission.completed) || board[0] || null;
  }

  function huntLabel(mission) {
    const hunts = Array.isArray(Core.HUNTS) ? Core.HUNTS : [];
    const hunt = hunts.find((candidate) => candidate && candidate.id === mission.nextHuntId);
    return hunt ? `${hunt.name}――${hunt.epithet}` : "次のNamed Hunt";
  }

  function assault(mission) {
    if (!mission || mission.stage !== "investigated" || typeof Core.armRegionMissionAssault !== "function") return;
    if (!Core.armRegionMissionAssault(mission.key)) return;

    startExpedition.click();
    const target = leadList.querySelector(".lead-card");
    if (!target) {
      if (typeof Core.cancelRegionMissionAssault === "function") Core.cancelRegionMissionAssault();
      return;
    }
    target.click();
  }

  function render() {
    const mission = latestMission();
    if (!mission) {
      panel.hidden = true;
      panel.innerHTML = "";
      delete panel.dataset.missionKey;
      return;
    }

    panel.hidden = false;
    panel.dataset.missionKey = mission.key;
    const stateLabel = mission.completed
      ? "RESOLVED"
      : mission.finalPoiDiscovered
        ? "TARGET FOUND"
        : `CLUES ${mission.clues}/${mission.clueGoal}`;
    const copy = mission.completed
      ? mission.knowledge
      : mission.finalPoiDiscovered
        ? "痕跡が繋がった。街道荒らしの野営地は特定済みだ。危険地点への攻略は、ここ灰炉から始められる。"
        : `街道で荷駄隊が消えた。あと${Math.max(0, mission.clueGoal - mission.clues)}つ、屋外で痕跡を見つければ追跡地点を絞り込める。`;
    const clues = Array.isArray(mission.clueTexts) ? mission.clueTexts : [];

    panel.innerHTML = `
      <div class="region-mission-hearth-head">
        <div><p class="eyebrow">REGIONAL CHRONICLE / 地域依頼</p><h2>${mission.title}</h2></div>
        <span class="region-mission-hearth-state">${stateLabel}</span>
      </div>
      <p class="region-mission-hearth-copy">${copy}</p>
      <div class="region-mission-clues">${clues.map((clue) => `<div class="region-mission-clue">${clue}</div>`).join("")}</div>
      <div class="region-mission-hearth-action"></div>`;

    const action = panel.querySelector(".region-mission-hearth-action");
    if (mission.stage === "investigated" && !mission.completed) {
      const note = document.createElement("span");
      note.textContent = "発見は外で。危険な攻略は灰炉から。戦利品は生還するまで未確定のままだ。";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "primary";
      button.textContent = "野営地を攻略する →";
      button.addEventListener("click", () => assault(mission));
      action.append(note, button);
    } else if (mission.completed) {
      const note = document.createElement("span");
      note.textContent = `新しい噂：${huntLabel(mission)}`;
      action.appendChild(note);
    } else {
      const note = document.createElement("span");
      note.textContent = "霧の外へ出て、街道の気配をもう一度調べる。";
      action.appendChild(note);
    }
  }

  document.getElementById("return-to-hub")?.addEventListener("click", () => queueMicrotask(render));
  render();
})();
