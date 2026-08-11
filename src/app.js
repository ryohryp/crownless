(() => {
  "use strict";

  const Core = window.CrownlessCore;
  let state = Core.createInitialState();
  let battle = null;
  let raf = null;
  let lastFrame = 0;
  let messageTimer = null;
  let lastOutcome = "";
  const combatKeys = new Set();
  const combatPointer = { active: false, id: null, startX: 0, startY: 0, x: 0, y: 0 };

  const screens = {
    hub: document.getElementById("hub-screen"),
    explore: document.getElementById("explore-screen"),
    combat: document.getElementById("combat-screen"),
    decision: document.getElementById("decision-screen"),
    return: document.getElementById("return-screen")
  };

  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");
  const runStatus = document.getElementById("run-status");
  const lootReveal = document.getElementById("loot-reveal");
  const combatBars = document.querySelector(".combat-bars");
  const techniqueButton = document.getElementById("touch-heavy");
  const evadeButton = document.getElementById("touch-evade");
  const soundToggle = document.getElementById("sound-toggle");
  const mobileView = () => window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function norm(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function readSoundPreference() {
    try { return localStorage.getItem("crownless.sound") !== "off"; }
    catch (_) { return true; }
  }

  function saveSoundPreference() {
    try { localStorage.setItem("crownless.sound", soundEnabled ? "on" : "off"); }
    catch (_) {}
  }

  function ensureAudio() {
    if (!soundEnabled) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioContext) audioContext = new AudioCtor();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function sound(kind) {
    const audio = ensureAudio();
    if (!audio) return;
    const now = audio.currentTime;
    const profiles = {
      hit: [150, 82, 0.055, "square", 0.035],
      heavy: [110, 48, 0.13, "sawtooth", 0.07],
      perfect: [520, 920, 0.16, "sine", 0.055],
      hurt: [90, 42, 0.2, "sawtooth", 0.07],
      loot: [440, 660, 0.22, "triangle", 0.045],
      return: [330, 550, 0.34, "sine", 0.04],
      edge: [220, 880, 0.28, "square", 0.055]
    };
    const [from, to, duration, type, volume] = profiles[kind] || profiles.hit;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function pulse(pattern = 12) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function livingEnemies() {
    return battle ? battle.enemies.filter((enemy) => enemy.hp > 0) : [];
  }

  function nearestEnemy(maxRange = Infinity) {
    if (!battle) return null;
    let best = null;
    let bestDistance = maxRange;
    livingEnemies().forEach((enemy) => {
      const d = dist(enemy, battle.player);
      if (d < bestDistance) {
        best = enemy;
        bestDistance = d;
      }
    });
    return best;
  }

  function techniqueTarget() {
    if (!battle) return null;
    return livingEnemies()
      .filter((enemy) => enemy.telegraph > 0)
      .sort((a, b) => a.telegraph - b.telegraph)[0] || nearestEnemy();
  }

  function techniqueProfile(counter = false) {
    const weapon = battle ? battle.tuning.weaponType : "fists";
    if (!counter) {
      if (weapon === "dagger") return { duration: 0.5, activeAt: 0.2, lunge: 46, damage: 0.96, stagger: 0.95, knock: 0.9, label: "TECHNIQUE" };
      if (weapon === "sword") return { duration: 0.68, activeAt: 0.34, lunge: 34, damage: 1.1, stagger: 1.18, knock: 1.2, label: "TECHNIQUE" };
      return { duration: 0.54, activeAt: 0.23, lunge: 38, damage: 1, stagger: 1, knock: 1, label: "TECHNIQUE" };
    }
    if (weapon === "dagger") return { duration: 0.34, activeAt: 0.09, lunge: 78, damage: 1.75, stagger: 0.9, knock: 0.72, label: "RIPOSTE" };
    if (weapon === "sword") return { duration: 0.5, activeAt: 0.18, lunge: 50, damage: 1.6, stagger: 1.75, knock: 1.5, label: "CLASH" };
    return { duration: 0.37, activeAt: 0.1, lunge: 54, damage: 1.48, stagger: 1.15, knock: 1.08, label: "RUSH" };
  }

  function normalAttackProfile() {
    const weapon = battle ? battle.tuning.weaponType : "fists";
    const reach = battle ? battle.tuning.reach : 53;
    if (weapon === "dagger") {
      return { settle: 0.06, range: reach + 8, comboLength: 6, duration: 0.17, activeAt: 0.046, cadence: 0.015, lunge: 9, damage: 0.82, finisher: 1.5, arc: 0.28 };
    }
    if (weapon === "sword") {
      return { settle: 0.14, range: reach + 14, comboLength: 3, duration: 0.39, activeAt: 0.145, cadence: 0.055, lunge: 6, damage: 1.18, finisher: 1.3, arc: -0.16 };
    }
    const tempo = battle ? battle.tuning.unarmedTempo : 1;
    return { settle: 0.085, range: reach + 6, comboLength: 4, duration: 0.215 / tempo, activeAt: 0.06 / tempo, cadence: 0.02, lunge: 10, damage: 1, finisher: 1.38, arc: 0.04 };
  }

  function battlefieldWeaponSpec(enemy) {
    if (enemy.kind === "guard") return { type: "sword", name: "欠け盾兵の剣" };
    if (enemy.kind === "skirmisher") return { type: "dagger", name: "藪射ちの狩猟刀" };
    return { type: "dagger", name: "街道荒らしの短刀" };
  }

  function battlefieldWeaponTuning(type) {
    const base = battle.baseTuning || battle.tuning;
    const lightBase = Math.max(11, base.lightDamage);
    const heavyBase = Math.max(21, base.heavyDamage);
    if (type === "sword") {
      return {
        style: "blade", weaponType: "sword",
        lightDamage: lightBase * 1.08, heavyDamage: heavyBase * 1.12,
        reach: 82, moveSpeed: 190, heavyStagger: 1.15,
        evadeEmpower: false, unarmedTempo: 1, comboFinisher: 1, lowHealthRisk: false
      };
    }
    return {
      style: "blade", weaponType: "dagger",
      lightDamage: lightBase * 0.92, heavyDamage: heavyBase * 0.95,
      reach: 62, moveSpeed: 218, heavyStagger: 0.95,
      evadeEmpower: false, unarmedTempo: 1, comboFinisher: 1, lowHealthRisk: false
    };
  }

  function dropEnemyWeapon(enemy) {
    if (!battle || enemy.weaponDropped) return;
    enemy.weaponDropped = true;
    const spec = battlefieldWeaponSpec(enemy);
    battle.droppedWeapons.push({
      id: "field-" + enemy.id + "-" + battle.elapsed.toFixed(3),
      type: spec.type,
      name: spec.name,
      x: enemy.x,
      y: enemy.y + 10,
      angle: enemy.strafeDir * 0.55,
      age: 0,
      pickup: 0,
      picked: false
    });
    addText(enemy.x, enemy.y - 18, "WEAPON", "#e5cf91");
  }

  function equipBattlefieldWeapon(drop) {
    const p = battle.player;
    battle.tuning = battlefieldWeaponTuning(drop.type);
    battle.heldBattlefieldWeapon = { type: drop.type, name: drop.name };
    drop.picked = true;
    p.attack = null;
    p.comboStep = 0;
    p.comboTimer = 0;
    p.stationary = 0;
    p.autoDelay = Math.max(p.autoDelay, 0.08);
    spawnBurst(drop.x, drop.y, 12, drop.type === "sword" ? "#e5c875" : "#c8d3b1");
    addText(p.x, p.y - 58, drop.type === "sword" ? "SWORD" : "DAGGER", "#f2df9c");
    flashMessage(drop.name + " — 拾った。戦い方が変わる。", 950);
  }

  function updateBattlefieldPickup() {
  const p = battle.player;
  if (p.attack && p.attack.kind !== "light") return false;
  const target = battle.droppedWeapons
    .filter((drop) => !drop.picked && dist(drop, p) <= 64)
    .sort((a, b) => dist(a, p) - dist(b, p))[0] || null;
  if (!target) return false;
  equipBattlefieldWeapon(target);
  return true;
}
  function beginVictoryPickupWindow() {
    if (!battle || battle.ending || battle.victoryPickupTimer > 0) return;
    const unpicked = battle.droppedWeapons.filter((drop) => !drop.picked);
    battle.victoryPickupTimer = unpicked.length ? 0.7 : 0.35;
    if (unpicked.length) flashMessage("敵の武器が落ちた。触れれば拾える。", 800);
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle("active", key === name));
    const exp = state.expedition;
    const carried = exp ? exp.unsecuredLoot.length : 0;
    const depth = exp ? exp.depth + 1 : 0;
    runStatus.classList.toggle("active", Boolean(exp));
    runStatus.innerHTML = exp
      ? `<span>遠征 深度 ${depth}</span><strong>${carried} 未確定</strong>`
      : `<span>${lastOutcome || "GREY HEARTH"}</span><strong>SAFE</strong>`;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function rarityLabel(item) {
    const labels = { uncommon: "UNCOMMON", rare: "RARE", relic: "RELIC" };
    return `${labels[item.rarity] || item.rarity} / POWER ${Math.round(item.power)}`;
  }

  function rarityGlyph(item) {
    if (item.type === "sword") return "†";
    if (item.type === "dagger") return "⌁";
    return "✦";
  }

  function comparisonLabel(item) {
    const c = Core.compareItem(state, item);
    const delta = Math.abs(c.delta) < 0.1 ? "±0" : `${c.delta > 0 ? "+" : ""}${c.delta.toFixed(1)}`;
    return `${c.summary} / ${delta}`;
  }

  function lootCard(item, secured, featured = false) {
    const equipped = state.equippedItemId === item.id;
    const card = document.createElement("article");
    card.className = `loot-card rarity-${item.rarity}${equipped ? " equipped" : ""}${featured ? " featured" : ""}`;
    card.innerHTML = `
      <div class="loot-glyph">${rarityGlyph(item)}</div>
      <div class="loot-copy">
        <small>${rarityLabel(item)}</small>
        <strong>${item.name}</strong>
        <p>${item.styleLabel || item.style} · ${item.playstyle || "戦型変化"} · ${comparisonLabel(item)}</p>
        <em>${item.modifier.tag ? `${item.modifier.tag} — ` : ""}${item.modifier.description}</em>
      </div>`;

    if (secured) {
      const button = document.createElement("button");
      button.className = "equip-button";
      button.textContent = equipped ? "装備中" : "装備する";
      button.disabled = equipped;
      button.addEventListener("click", () => {
        state = Core.equipItem(state, item.id);
        if (screens.return.classList.contains("active") && lastReturnReport) {
          const items = lastReturnReport.items.map((reportItem) => state.securedLoot.find((candidate) => candidate.id === reportItem.id) || reportItem);
          renderReturn({ ...lastReturnReport, items, silent: true });
        } else renderHub();
      });
      card.appendChild(button);
    }
    return card;
  }

  function renderHub() {
    stopCombat();
    hideOverlay();
    if (combatBars) combatBars.style.display = "";
    const equipped = Core.getEquippedItem(state);
    document.getElementById("equipped-label").textContent = equipped ? equipped.styleLabel || equipped.name : "素手";
    document.getElementById("loadout-title").textContent = equipped ? equipped.name : "拳だけで出る";
    document.getElementById("loadout-description").textContent = equipped
      ? `${equipped.playstyle || "戦型"}。${equipped.modifier.description}`
      : "武器はない。動けば攻撃を止め、立ち止まれば拳が出る。危険な場所で欲張るかは自分で決める。";

    const secured = document.getElementById("secured-loot");
    secured.innerHTML = "";
    document.getElementById("secured-count").textContent = state.securedLoot.length;
    if (!state.securedLoot.length) secured.innerHTML = `<div class="empty-state">棚は空だ。最初の戦利品を持ち帰れ。</div>`;
    else state.securedLoot.slice().reverse().forEach((item) => secured.appendChild(lootCard(item, true)));

    document.getElementById("stat-runs").textContent = state.stats.expeditionsStarted;
    document.getElementById("stat-survived").textContent = state.stats.expeditionsSurvived;
    document.getElementById("stat-kills").textContent = state.stats.enemiesDefeated;
    document.getElementById("stat-defeats").textContent = state.stats.defeats;
    showScreen("hub");
  }

  function pips(count, kind) {
    return `<span class="pips ${kind}">${Array.from({ length: 5 }, (_, i) => `<i class="${i < count ? "on" : ""}"></i>`).join("")}</span>`;
  }

  function renderRoute(exp) {
    const route = document.getElementById("expedition-route");
    if (!route) return;
    const stops = [
      { name: "灰炉", kind: "hearth", cleared: true },
      ...exp.discoveries.map((discovery) => ({
        name: discovery.name,
        kind: discovery.eventKind || "unknown",
        cleared: true
      })),
      { name: "未知", kind: "unknown", cleared: false }
    ];
    route.innerHTML = `
      <div class="route-heading"><span>YOUR EXPEDITION</span><strong>歩いた場所が、世界になる。</strong></div>
      <div class="route-track">
        ${stops.map((stop, index) => `<div class="route-stop ${stop.cleared ? "cleared" : "future"}" title="${stop.name}">
          <i>${stop.kind === "hearth" ? "⌂" : stop.kind === "hunt" ? "⚔" : stop.kind.includes("dungeon") ? "◆" : index}</i>
          <span>${stop.name}</span>
        </div>`).join("")}
      </div>`;
  }

  function renderExplore() {
    stopCombat();
    hideOverlay();
    if (combatBars) combatBars.style.display = "";
    const exp = state.expedition;
    document.getElementById("explore-hp").textContent = Math.ceil(exp.health);
    document.getElementById("explore-depth").textContent = exp.depth + 1;
    document.getElementById("explore-loot-count").textContent = exp.unsecuredLoot.length;

    const leads = document.getElementById("lead-list");
    leads.innerHTML = "";
    Core.generateExplorationChoices(state).forEach((choice, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `lead-card palette-${choice.palette}${choice.eventKind === "hunt" ? " hunt-target" : ""}`;
      card.innerHTML = `
        <div class="lead-number">0${index + 1}</div>
        <div class="lead-content">
          <div class="lead-topline"><span>${choice.kicker}</span><b>調べる →</b></div>
          <h3>${choice.name}</h3>
          <p>${choice.description}</p>
          <div class="lead-omen">噂：${choice.omen}</div>
          <div class="lead-signals">
            <label>気配 <strong>${choice.signal}</strong></label>
            <label>危険 ${pips(choice.risk, "risk")}</label>
            <label>期待 ${pips(choice.reward, "reward")}</label>
          </div>
        </div>`;
      card.addEventListener("click", () => enterLead(choice.choiceId));
      leads.appendChild(card);
    });

    const carried = exp.unsecuredLoot.length;
    const warning = document.getElementById("carried-warning");
    warning.classList.toggle("hot", carried > 0);
    const scouting = exp.scouting > 0 ? ` 地図の助けはあと${exp.scouting}回。` : "";
    warning.innerHTML = carried
      ? `<strong>${carried}個はまだ未確定。</strong><span>倒れれば失う。今なら帰れる。${scouting}</span>`
      : `<strong>まだ失う物はない。</strong><span>次の気配を追える。${scouting}</span>`;
    renderRoute(exp);
    showScreen("explore");
  }

  function enterLead(choiceId) {
    state = Core.discoverLocation(state, choiceId);
    const exp = state.expedition;
    setCombatScene(exp.lastDiscovery);
    showScreen("combat");

    if (state.phase === "combat") {
      if (combatBars) combatBars.style.display = "";
      startCombat();
    } else if (state.phase === "event") {
      renderStillScene(exp.lastDiscovery);
      showEvent(exp.pendingEvent);
    } else {
      renderStillScene(exp.lastDiscovery);
      showOutcomeOverlay();
    }
  }

  function setCombatScene(discovery) {
    document.getElementById("combat-location").textContent = discovery.name;
    document.getElementById("combat-title").textContent = discovery.kicker;
    document.getElementById("combat-flavor").textContent = discovery.flavor;
    document.getElementById("arena-wrap").dataset.palette = discovery.palette;
  }

  function renderDecision() {
    hideOverlay();
    if (combatBars) combatBars.style.display = "";
    const exp = state.expedition;
    const loot = document.getElementById("unsecured-loot");
    loot.innerHTML = "";
    exp.unsecuredLoot.slice().reverse().forEach((item) => loot.appendChild(lootCard(item, false)));
    document.getElementById("decision-depth").textContent = exp.depth + 1;
    document.getElementById("decision-hp").textContent = Math.ceil(exp.health);
    document.getElementById("decision-count").textContent = exp.unsecuredLoot.length;
    document.getElementById("decision-place").textContent = exp.lastDiscovery ? exp.lastDiscovery.name : "名もない場所";

    let copy = exp.health <= 35
      ? "傷が深い。次は回避を一度誤るだけで終わる。"
      : exp.unsecuredLoot.length >= 3
        ? "荷が重い。強欲そのものが敵になってきた。"
        : exp.unsecuredLoot.length
          ? "持ち帰りたい物ができた。それでも次の気配が気になる。"
          : "何も拾っていない。もう一歩踏み込む理由はある。";
    if (exp.lastEventSummary) copy = `${exp.lastEventSummary} ${copy}`;
    document.getElementById("decision-risk-copy").textContent = copy;
    showScreen("decision");
  }

  function renderReturn(report) {
    lastReturnReport = report;
    stopCombat();
    hideOverlay();
    const defeated = report.outcome === "defeat";
    document.getElementById("return-kicker").textContent = defeated ? "EXPEDITION FAILED / YOU SURVIVED" : "EXPEDITION COMPLETE";
    document.getElementById("return-title").innerHTML = defeated ? "王冠はなくても、<em>命はある。</em>" : "生きて、<em>戻った。</em>";
    document.getElementById("return-copy").textContent = defeated
      ? report.lostCount > 0
        ? `倒れた場所に${report.lostCount}個を残した。敗北は終わりではない。次は取り返せる。`
        : "装備は失わなかった。敗北の痛みを、次の遠征へ持っていけ。"
      : report.rankUp
        ? `灰炉が育った。「${report.rankUp.name}」が使えるようになった。`
        : "持ち帰った物と経験だけが、次の遠征を変える。";
    document.getElementById("return-depth").textContent = report.depth;
    document.getElementById("return-loot-count").textContent = report.items.length;
    document.getElementById("return-renown-gain").textContent = `+${report.renownGain}`;

    const tag = document.getElementById("return-result-tag");
    tag.textContent = defeated ? "RECOVERED" : "SECURED";
    tag.className = defeated ? "unsafe-tag" : "safe-tag";
    const loot = document.getElementById("return-loot");
    loot.innerHTML = "";
    if (report.items.length) report.items.forEach((item) => loot.appendChild(lootCard(item, true, true)));
    else loot.innerHTML = `<div class="empty-state">持ち帰った装備はない。それでも遠征の記録は残った。</div>`;

    const progress = Core.getHearthProgression ? Core.getHearthProgression(state) : null;
    document.getElementById("return-next-milestone").textContent = progress && progress.next
      ? `次の灰炉強化「${progress.next.name}」まで、あと ${progress.next.threshold - progress.renown} 名声。`
      : "灰炉は現在の最大段階まで育っている。";
    lastOutcome = defeated ? "RETURNED WOUNDED" : `${report.items.length} LOOT SECURED`;
    showScreen("return");
    if (!report.silent) sound(defeated ? "hurt" : "return");
  }

  function showEvent(event) {
    stopCombat();
    if (combatBars) combatBars.style.display = "none";
    const place = document.getElementById("loot-reveal-place");
    const heading = lootReveal.querySelector("h2");
    const copy = lootReveal.querySelector(".loot-reveal-inner > p:not(.eyebrow)");
    const items = document.getElementById("loot-reveal-items");
    const next = document.getElementById("loot-reveal-continue");
    place.textContent = event.discovery.name;
    heading.textContent = event.title;
    copy.textContent = event.text;
    items.innerHTML = "";

    event.options.forEach((option) => {
      const button = document.createElement("button");
      button.className = option.id.includes("follow") || option.id.includes("blood") ? "danger-button" : "ghost";
      button.innerHTML = `<strong>${option.label}</strong><small style="display:block;margin-top:4px">${option.detail}</small>`;
      button.addEventListener("click", () => {
        state = Core.resolveEventChoice(state, option.id);
        hideOverlay();
        if (state.phase === "combat") {
          if (combatBars) combatBars.style.display = "";
          setCombatScene(state.expedition.encounter.discovery);
          startCombat();
        } else showOutcomeOverlay();
      });
      items.appendChild(button);
    });
    next.style.display = "none";
    showOverlay();
  }

  function showOutcomeOverlay() {
    stopCombat();
    if (combatBars) combatBars.style.display = "none";
    const exp = state.expedition;
    const place = document.getElementById("loot-reveal-place");
    const heading = lootReveal.querySelector("h2");
    const copy = lootReveal.querySelector(".loot-reveal-inner > p:not(.eyebrow)");
    const items = document.getElementById("loot-reveal-items");
    const next = document.getElementById("loot-reveal-continue");
    const fresh = (exp.lastLootIds || []).map((id) => exp.unsecuredLoot.find((item) => item.id === id)).filter(Boolean);
    place.textContent = exp.lastDiscovery ? exp.lastDiscovery.name : "遠征先";
    heading.textContent = fresh.length ? "見つけた。" : "何かが残った。";
    copy.textContent = exp.lastEventSummary || (fresh.length
      ? "まだあなたの物ではない。持ち帰って初めて確保される。"
      : "装備はない。だが、傷と情報も遠征の結果だ。");
    items.innerHTML = "";
    if (fresh.length) fresh.forEach((item) => items.appendChild(lootCard(item, false, true)));
    else items.innerHTML = `<div class="empty-state">新しい装備はない。</div>`;
    next.style.display = "";
    next.innerHTML = `結果を抱えて判断する <span>→</span>`;
    next.onclick = renderDecision;
    showOverlay();
    if (fresh.length) { sound("loot"); pulse(16); }
  }

  function showOverlay() {
    lootReveal.classList.add("show");
    lootReveal.style.display = "grid";
  }

  function hideOverlay() {
    lootReveal.classList.remove("show");
    lootReveal.style.display = "none";
    const next = document.getElementById("loot-reveal-continue");
    next.onclick = null;
  }

  function startCombat() {
    stopCombat();
    hideOverlay();
    if (combatBars) combatBars.style.display = "";
    const tuning = Core.getCombatTuning(state);
    const defs = state.expedition.encounter.enemies;
    const close = mobileView();
    const enemies = defs.map((enemy, index) => ({
      ...enemy,
      x: (close ? 590 : 650) + index * (close ? 74 : 92),
      y: 286 + (index % 2 ? 64 : -38),
      hp: enemy.maxHealth,
      vx: 0,
      vy: 0,
      radius: enemy.kind === "guard" ? 30 : enemy.kind === "skirmisher" ? 24 : 26,
      attackCooldown: 0.8 + index * 0.3,
      telegraph: 0,
      telegraphTotal: 0,
      aimX: null,
      aimY: null,
      aimDirX: null,
      aimDirY: null,
      recover: 0,
      stagger: 0,
      hitFlash: 0,
      guarding: enemy.kind === "guard",
      guardCycle: enemy.kind === "guard" ? 0.2 + index * 0.4 : 0,
      strafeDir: index % 2 ? 1 : -1,
      wobbleSeed: index * 1.73,
      weaponDropped: false,
      deadTimer: 0
    }));

    battle = {
      tuning,
      baseTuning: { ...tuning },
      heldBattlefieldWeapon: null,
      droppedWeapons: [],
      victoryPickupTimer: 0,
      player: {
        x: close ? 360 : 300,
        y: 300,
        hp: state.expedition.health,
        maxHp: 100,
        facingX: 1,
        facingY: 0,
        invulnerable: 0,
        evadeCooldown: 0,
        evadeAge: 99,
        skillCooldown: 0,
        counterWindow: 0,
        recovery: 0,
        autoDelay: 0.08,
        moving: false,
        stationary: 0,
        moveX: 0,
        moveY: 0,
        flash: 0,
        attack: null,
        comboStep: 0,
        comboTimer: 0,
        empowered: false,
        edge: 0,
        edgeReady: false
      },
      enemies,
      particles: [],
      slashes: [],
      texts: [],
      projectiles: [],
      hitStop: 0,
      shake: 0,
      elapsed: 0,
      ending: false,
      victoryTimer: 0,
      lootBeacon: null,
      lastDown: null,
      finished: false
    };

    updateCombatHud();
    drawBattle();
    flashMessage("動け。止まれば攻撃する。敵の狙いを外して、止まれる場所を作れ。", 2600);
    lastFrame = performance.now();
    raf = requestAnimationFrame(combatLoop);
  }

  function stopCombat() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    lastFrame = 0;
    combatKeys.clear();
    combatPointer.active = false;
    combatPointer.id = null;
  }

  function combatLoop(now) {
    if (!battle || battle.finished) return;
    const dt = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (battle.hitStop > 0) {
      battle.hitStop = Math.max(0, battle.hitStop - dt);
      drawBattle();
      raf = requestAnimationFrame(combatLoop);
      return;
    }
    if (battle.ending) {
      const done = updateVictoryOutro(dt);
      drawBattle();
      if (done) {
        battle.finished = true;
        stopCombat();
        showOutcomeOverlay();
      } else raf = requestAnimationFrame(combatLoop);
      return;
    }
    updateBattle(dt);
    drawBattle();
    raf = requestAnimationFrame(combatLoop);
  }

  function updateBattle(dt) {
    const p = battle.player;
    battle.elapsed += dt;
    battle.shake = Math.max(0, battle.shake - dt * 34);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.evadeCooldown = Math.max(0, p.evadeCooldown - dt);
    p.skillCooldown = Math.max(0, p.skillCooldown - dt);
    p.counterWindow = Math.max(0, p.counterWindow - dt);
    p.recovery = Math.max(0, p.recovery - dt);
    p.evadeAge += dt;
    p.autoDelay = Math.max(0, p.autoDelay - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.comboTimer = Math.max(0, p.comboTimer - dt);

    if (battle.victoryPickupTimer > 0) {
      battle.victoryPickupTimer = Math.max(0, battle.victoryPickupTimer - dt);
      if (battle.victoryPickupTimer <= 0) {
        finishVictory();
        return;
      }
    }

    updatePlayerIntent(dt);
    updatePlayerAttack(dt);
    battle.enemies.forEach((enemy) => updateEnemy(enemy, dt));
    updateProjectiles(dt);

    updateCombatEffects(dt);
    updateActionButtons();
  }

  function updateCombatEffects(dt) {
    battle.particles.forEach((pt) => {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
    });
    battle.particles = battle.particles.filter((pt) => pt.life > 0);
    battle.slashes.forEach((slash) => { slash.life -= dt; });
    battle.slashes = battle.slashes.filter((slash) => slash.life > 0);
    battle.texts.forEach((text) => { text.life -= dt; text.y -= 24 * dt; });
    battle.texts = battle.texts.filter((text) => text.life > 0);
    battle.droppedWeapons.forEach((drop) => { drop.age += dt; });
  }

  function updateVictoryOutro(dt) {
    battle.elapsed += dt;
    battle.shake = Math.max(0, battle.shake - dt * 30);
    battle.victoryTimer = Math.max(0, battle.victoryTimer - dt);
    if (battle.lootBeacon) battle.lootBeacon.age += dt;
    battle.enemies.forEach((enemy) => {
      if (enemy.hp > 0) return;
      enemy.deadTimer = Math.max(0, enemy.deadTimer - dt);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.vx *= 0.9;
      enemy.vy *= 0.9;
    });
    updateCombatEffects(dt);
    return battle.victoryTimer <= 0;
  }

  function combatInputVector() {
    let x = 0;
    let y = 0;
    if (combatKeys.has("ArrowLeft") || combatKeys.has("KeyA")) x -= 1;
    if (combatKeys.has("ArrowRight") || combatKeys.has("KeyD")) x += 1;
    if (combatKeys.has("ArrowUp") || combatKeys.has("KeyW")) y -= 1;
    if (combatKeys.has("ArrowDown") || combatKeys.has("KeyS")) y += 1;
    if (x || y) return norm(x, y);
    if (!combatPointer.active) return { x: 0, y: 0 };
    const dx = combatPointer.x - combatPointer.startX;
    const dy = combatPointer.y - combatPointer.startY;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude < 10) return { x: 0, y: 0 };
    const direction = norm(dx, dy);
    const strength = clamp(magnitude / 56, 0.3, 1);
    return { x: direction.x * strength, y: direction.y * strength };
  }

  function updatePlayerIntent(dt) {
    const p = battle.player;
    const v = combatInputVector();
    const magnitude = Math.hypot(v.x, v.y);
    const committedTechnique = p.attack && p.attack.kind !== "light";
    p.moving = magnitude > 0.08 && !committedTechnique;
    p.moveX = v.x;
    p.moveY = v.y;

    if (p.moving) {
      const direction = norm(v.x, v.y);
      p.facingX = direction.x;
      p.facingY = direction.y;
      p.x += v.x * battle.tuning.moveSpeed * dt;
      p.y += v.y * battle.tuning.moveSpeed * dt;
      p.stationary = 0;
      if (p.attack && p.attack.kind === "light") p.attack = null;
      p.comboStep = 0;
      p.comboTimer = 0;
      p.autoDelay = Math.max(p.autoDelay, 0.035);
    } else {
      p.stationary += dt;
    }

    p.x = clamp(p.x, 64, canvas.width - 64);
    p.y = clamp(p.y, 92, canvas.height - 58);
    const pickedWeapon = updateBattlefieldPickup();
    if (!p.moving && !pickedWeapon) updateAutoStrike();
  }

  function updateAutoStrike() {
    const p = battle.player;
    const profile = normalAttackProfile();
    const target = nearestEnemy(profile.range + 36);
    if (!target || p.stationary < profile.settle || p.attack || p.recovery > 0 || p.autoDelay > 0) return;
    const d = dist(p, target);
    if (d > profile.range + target.radius) return;
    const to = norm(target.x - p.x, target.y - p.y);
    p.facingX = to.x;
    p.facingY = to.y;
    performLight();
  }

  function updatePlayerAttack(dt) {
    const p = battle.player;
    const attack = p.attack;
    if (!attack) return;
    attack.elapsed += dt;
    const progress = attack.elapsed / attack.duration;
    if (!attack.lunged && progress > 0.12) {
      attack.lunged = true;
      const amount = attack.lunge ?? (attack.kind === "light" ? 18 + attack.step * 5 : 31);
      p.x = clamp(p.x + p.facingX * amount, 64, canvas.width - 64);
      p.y = clamp(p.y + p.facingY * amount, 92, canvas.height - 58);
    }
    if (!attack.didHit && attack.elapsed >= attack.activeAt) {
      attack.didHit = true;
      applyAttackHits(attack);
    }
    if (attack.elapsed >= attack.duration) {
      const wasLight = attack.kind === "light";
      const wasTechnique = attack.kind === "heavy" || attack.kind === "counter";
      const whiffed = wasTechnique && !attack.hitAny;
      p.attack = null;
      if (whiffed) {
        p.recovery = attack.kind === "counter" ? 0.28 : 0.44;
        p.autoDelay = Math.max(p.autoDelay, p.recovery);
        flashMessage("MISS — 技の隙", 520);
      } else if (wasLight) {
        p.comboTimer = 0.46;
        p.autoDelay = Math.max(p.autoDelay, attack.cadence || 0);
      }
      else { p.comboStep = 0; p.comboTimer = 0; }
    }
  }

  function performLight() {
    if (!battle || battle.finished || battle.ending) return;
    const p = battle.player;
    if (p.attack || p.recovery > 0 || p.moving) return;
    const profile = normalAttackProfile();
    p.comboStep = p.comboTimer > 0 ? (p.comboStep % profile.comboLength) + 1 : 1;
    const step = p.comboStep;
    const finisher = step === profile.comboLength;
    p.attack = {
      kind: "light",
      step,
      elapsed: 0,
      duration: profile.duration * (finisher ? 1.12 : 1),
      activeAt: profile.activeAt * (finisher ? 1.08 : 1),
      didHit: false,
      hitAny: false,
      lunged: false,
      lunge: profile.lunge,
      range: profile.range,
      damageMultiplier: profile.damage,
      finisherMultiplier: profile.finisher,
      arcThreshold: profile.arc,
      cadence: profile.cadence,
      finisher
    };
    p.comboTimer = 0;
  }

  function performTechnique() {
    if (!battle || battle.finished || battle.ending) return;
    const p = battle.player;
    if (p.recovery > 0) {
      flashMessage(`隙 ${p.recovery.toFixed(1)}s`, 300);
      return;
    }
    if (p.skillCooldown > 0) {
      flashMessage(`技まで ${p.skillCooldown.toFixed(1)}s`, 350);
      return;
    }
    if (p.attack && p.attack.kind !== "light") return;
    if (p.attack && p.attack.kind === "light") {
      p.attack = null;
      p.comboStep = 0;
      p.comboTimer = 0;
    }
    const counter = p.counterWindow > 0;
    const edgeTechnique = Core.edgeTechnique(p.edge);
    const breakthrough = edgeTechnique.ready;
    p.skillCooldown = breakthrough ? edgeTechnique.cooldown : counter ? 1.05 : 1.8;
    if (breakthrough) setEdge(0);
    startTechnique(counter, breakthrough);
  }

  function startTechnique(counter = false, breakthrough = false) {
    const p = battle.player;
    const target = techniqueTarget();
    if (target) {
      const to = norm(target.x - p.x, target.y - p.y);
      p.facingX = to.x;
      p.facingY = to.y;
    }
    const profile = techniqueProfile(counter);
    p.attack = {
      kind: counter ? "counter" : "heavy",
      step: 0,
      elapsed: 0,
      duration: profile.duration,
      activeAt: profile.activeAt,
      didHit: false,
      hitAny: false,
      lunged: false,
      lunge: profile.lunge + (breakthrough ? 24 : 0),
      damageMultiplier: profile.damage * (breakthrough ? Core.edgeTechnique(Core.EDGE_MAX).damageMultiplier : 1),
      staggerMultiplier: profile.stagger * (breakthrough ? Core.edgeTechnique(Core.EDGE_MAX).staggerMultiplier : 1),
      knockMultiplier: profile.knock * (breakthrough ? 1.35 : 1),
      label: breakthrough ? "CROWNLESS" : profile.label,
      breakthrough
    };
    p.counterWindow = 0;
    p.comboStep = 0;
    p.comboTimer = 0;
    flashMessage(breakthrough ? "CROWNLESS — 決着打" : counter ? `${profile.label} — 反撃` : "TECHNIQUE — 技", breakthrough ? 780 : 460);
    if (breakthrough) { sound("edge"); pulse([18, 25, 36]); }
  }

  function applyAttackHits(attack) {
    const p = battle.player;
    const heavy = attack.kind === "heavy";
    const counter = attack.kind === "counter";
    const technique = heavy || counter;
    const finisher = !technique && Boolean(attack.finisher);
    const reach = technique ? battle.tuning.reach + 24 : (attack.range || battle.tuning.reach) + (finisher ? 8 : 0);
    let damage = technique
      ? battle.tuning.heavyDamage * (attack.damageMultiplier || 1)
      : battle.tuning.lightDamage * (attack.damageMultiplier || 1) * (finisher
        ? (attack.finisherMultiplier || 1.32) * battle.tuning.comboFinisher
        : 1 + Math.min(3, Math.max(0, attack.step - 1)) * 0.04);
    if (p.empowered) {
      damage *= 1.65;
      p.empowered = false;
      flashMessage("AFTERSTEP — 強化", 500);
    }
    if (battle.tuning.lowHealthRisk && p.hp <= 35) damage *= 1.38;

    let hit = false;
    battle.enemies.forEach((enemy) => {
      if (enemy.hp <= 0 || dist(enemy, p) > reach + enemy.radius) return;
      const toEnemy = norm(enemy.x - p.x, enemy.y - p.y);
      const arcThreshold = technique ? 0.05 : (attack.arcThreshold ?? 0.05);
      if (toEnemy.x * p.facingX + toEnemy.y * p.facingY < arcThreshold) return;
      if (enemy.kind === "guard" && enemy.guarding && !technique && !finisher) {
        enemy.stagger = 0.1;
        spawnBurst(enemy.x, enemy.y, 8, "#d4c18c");
        addText(enemy.x, enemy.y - 48, "BLOCK", "#dfcf9b");
        battle.hitStop = 0.035;
        hit = true;
        attack.hitAny = true;
        gainEdge(3);
        sound("hit");
        return;
      }

      let dealt = damage;
      let reaction = counter ? attack.label : "";
      if (technique && enemy.telegraph > 0) {
        reaction = enemy.kind === "rusher" ? "COUNTER" : "INTERRUPT";
        enemy.telegraph = 0;
        enemy.telegraphTotal = 0;
        enemy.recover = Math.max(enemy.recover, counter ? 0.72 : 0.52);
        gainEdge(counter ? 24 : 18);
      }
      if (enemy.kind === "guard" && enemy.guarding && (technique || finisher)) {
        dealt *= technique ? 1.2 : 0.9;
        enemy.guarding = false;
        enemy.guardCycle = 1.3;
        reaction = "BREAK";
      }
      if (reaction) addText(enemy.x, enemy.y - 64, reaction, counter ? "#f6df83" : "#f2c96f");

      enemy.hp = Math.max(0, enemy.hp - dealt);
      enemy.hitFlash = 0.14;
      const staggerScale = technique ? battle.tuning.heavyStagger * (attack.staggerMultiplier || 1) : 1;
      enemy.stagger = Math.max(enemy.stagger, technique ? 0.44 * staggerScale : finisher ? 0.32 : 0.16);
      const knock = technique ? 54 * staggerScale * (attack.knockMultiplier || 1) : finisher ? 44 : 18;
      enemy.vx += toEnemy.x * knock * 3.2;
      enemy.vy += toEnemy.y * knock * 3.2;
      spawnBurst(enemy.x, enemy.y, technique ? 15 : finisher ? 12 : 8, technique ? "#f0c96a" : "#e6d0a7");
      battle.slashes.push({ x: p.x + p.facingX * 31, y: p.y + p.facingY * 31, angle: Math.atan2(p.facingY, p.facingX), life: 0.13, heavy: technique, finisher });
      battle.hitStop = Math.max(battle.hitStop, technique ? (counter ? 0.14 : 0.105) : finisher ? 0.082 : 0.052);
      battle.shake = Math.max(battle.shake, technique ? (counter ? 14 : 11) : finisher ? 8 : 4);
      addText(enemy.x, enemy.y - 48, `${Math.round(dealt)}`, technique ? "#ffd875" : "#f5e0bd");
      hit = true;
      attack.hitAny = true;
      gainEdge(technique ? 8 : finisher ? 12 : 6);
      sound(technique ? "heavy" : "hit");
      if (technique || finisher) pulse(technique ? 24 : 12);
      if (enemy.hp <= 0) {
        dropEnemyWeapon(enemy);
        enemy.deadTimer = 0.9;
        enemy.vx += toEnemy.x * 230;
        enemy.vy += toEnemy.y * 230;
        battle.lastDown = { x: enemy.x, y: enemy.y };
        addText(enemy.x, enemy.y - 78, "DOWN", "#d96858");
      }
    });
    if (!hit) battle.slashes.push({ x: p.x + p.facingX * 31, y: p.y + p.facingY * 31, angle: Math.atan2(p.facingY, p.facingX), life: 0.1, heavy: technique, finisher });
    updateCombatHud();
    if (battle.enemies.every((enemy) => enemy.hp <= 0)) beginVictoryPickupWindow();
  }

  function updateEnemy(enemy, dt) {
    if (enemy.hp <= 0) {
      enemy.deadTimer = Math.max(0, enemy.deadTimer - dt);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.vx *= 0.9;
      enemy.vy *= 0.9;
      return;
    }
    enemy.stagger = Math.max(0, enemy.stagger - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.recover = Math.max(0, enemy.recover - dt);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.vx *= 0.84;
    enemy.vy *= 0.84;

    if (enemy.kind === "guard") {
      enemy.guardCycle = (enemy.guardCycle + dt) % 2.7;
      enemy.guarding = enemy.guardCycle < 1.18 && enemy.recover <= 0 && enemy.telegraph <= 0;
    }
    if (enemy.stagger > 0 || enemy.recover > 0) return;
    if (enemy.telegraph > 0) {
      enemy.telegraph -= dt;
      if (enemy.telegraph <= 0) {
        if (enemy.kind === "skirmisher") launchProjectile(enemy);
        else resolveEnemyMelee(enemy);
      }
      return;
    }
    if (enemy.kind === "skirmisher") updateSkirmisher(enemy, dt);
    else updateMeleeEnemy(enemy, dt);
    enemy.x = clamp(enemy.x, 54, canvas.width - 54);
    enemy.y = clamp(enemy.y, 84, canvas.height - 50);
  }

  function updateMeleeEnemy(enemy, dt) {
    const p = battle.player;
    const to = norm(p.x - enemy.x, p.y - enemy.y);
    const d = dist(enemy, p);
    const desired = enemy.kind === "guard" ? 72 : 48;
    if (d > desired + 8) {
      enemy.x += to.x * enemy.moveSpeed * dt;
      enemy.y += to.y * enemy.moveSpeed * dt;
    }
    if (d <= enemy.attackRange + 12 && enemy.attackCooldown <= 0 && !(enemy.kind === "guard" && enemy.guarding)) {
      startTelegraph(enemy, enemy.kind === "guard" ? 0.58 : 0.36);
    }
  }

  function updateSkirmisher(enemy, dt) {
    const p = battle.player;
    const to = norm(p.x - enemy.x, p.y - enemy.y);
    const d = dist(enemy, p);
    if (d < 150) {
      enemy.x -= to.x * enemy.moveSpeed * 1.2 * dt;
      enemy.y -= to.y * enemy.moveSpeed * 1.2 * dt;
    } else if (d > 250) {
      enemy.x += to.x * enemy.moveSpeed * 0.85 * dt;
      enemy.y += to.y * enemy.moveSpeed * 0.85 * dt;
    } else {
      const tangent = { x: -to.y * enemy.strafeDir, y: to.x * enemy.strafeDir };
      enemy.x += tangent.x * enemy.moveSpeed * 0.62 * dt;
      enemy.y += tangent.y * enemy.moveSpeed * 0.62 * dt;
    }
    if (enemy.attackCooldown <= 0 && d <= 315) startTelegraph(enemy, 0.82);
  }

  function startTelegraph(enemy, duration) {
    const p = battle.player;
    const aim = norm(p.x - enemy.x, p.y - enemy.y);
    enemy.telegraph = duration;
    enemy.telegraphTotal = duration;
    enemy.aimX = p.x;
    enemy.aimY = p.y;
    enemy.aimDirX = aim.x;
    enemy.aimDirY = aim.y;
    enemy.guarding = false;
  }

  function resolveEnemyMelee(enemy) {
    const p = battle.player;
    enemy.attackCooldown = enemy.kind === "rusher" ? 0.84 : 1.3;
    enemy.recover = enemy.kind === "rusher" ? 0.18 : 0.34;
    if (dist(enemy, p) > enemy.attackRange + 20) return;
    if (p.invulnerable > 0) return perfectEvade(enemy.x, enemy.y);
    damagePlayer(enemy.damage, enemy.x, enemy.y);
  }

  function launchProjectile(enemy) {
    const p = battle.player;
    enemy.attackCooldown = 1.65;
    enemy.recover = 0.25;
    const dir = Number.isFinite(enemy.aimDirX) && Number.isFinite(enemy.aimDirY)
      ? { x: enemy.aimDirX, y: enemy.aimDirY }
      : norm(p.x - enemy.x, p.y - enemy.y);
    battle.projectiles.push({ x: enemy.x + dir.x * 24, y: enemy.y + dir.y * 24, vx: dir.x * 360, vy: dir.y * 360, radius: 8, damage: enemy.damage, life: 1.9 });
    spawnBurst(enemy.x, enemy.y, 5, "#b9c59d");
  }

  function updateProjectiles(dt) {
    const p = battle.player;
    battle.projectiles.forEach((shot) => {
      if (shot.life <= 0) return;
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (dist(shot, p) <= shot.radius + 20) {
        shot.life = 0;
        if (p.invulnerable > 0) perfectEvade(shot.x, shot.y);
        else damagePlayer(shot.damage, shot.x, shot.y);
      }
    });
    battle.projectiles = battle.projectiles.filter((shot) => shot.life > 0 && shot.x > -40 && shot.x < canvas.width + 40 && shot.y > -40 && shot.y < canvas.height + 40);
  }

  function smartEvadeVector() {
    const p = battle.player;
    const shot = battle.projectiles.filter((x) => x.life > 0).sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (shot && dist(shot, p) < 210) {
      const velocity = norm(shot.vx, shot.vy);
      const a = { x: -velocity.y, y: velocity.x };
      const b = { x: velocity.y, y: -velocity.x };
      const score = (v) => Math.min(p.x + v.x * 110, canvas.width - (p.x + v.x * 110), p.y + v.y * 110, canvas.height - (p.y + v.y * 110));
      return score(a) >= score(b) ? a : b;
    }
    const threat = livingEnemies().filter((enemy) => enemy.telegraph > 0).sort((a, b) => a.telegraph - b.telegraph)[0] || nearestEnemy();
    if (!threat) return { x: p.facingX, y: p.facingY };
    const away = norm(p.x - threat.x, p.y - threat.y);
    if (threat.kind !== "skirmisher") return away;
    const lateralA = { x: -away.y, y: away.x };
    const lateralB = { x: away.y, y: -away.x };
    const room = (v) => Math.min(p.x + v.x * 110, canvas.width - (p.x + v.x * 110), p.y + v.y * 110, canvas.height - (p.y + v.y * 110));
    return room(lateralA) >= room(lateralB) ? lateralA : lateralB;
  }

  function performEvade() {
    if (!battle || battle.finished || battle.ending) return;
    const p = battle.player;
    if (p.evadeCooldown > 0) {
      flashMessage(`回避まで ${p.evadeCooldown.toFixed(1)}s`, 300);
      return;
    }
    if (p.attack && p.attack.kind !== "light") {
      flashMessage("技の最中は回避できない", 340);
      return;
    }
    const input = combatInputVector();
    const move = Math.hypot(input.x, input.y) > 0.08 ? norm(input.x, input.y) : smartEvadeVector();
    p.x = clamp(p.x + move.x * 112, 64, canvas.width - 64);
    p.y = clamp(p.y + move.y * 112, 92, canvas.height - 58);
    p.facingX = -move.x;
    p.facingY = -move.y;
    p.invulnerable = 0.36;
    p.evadeAge = 0;
    p.evadeCooldown = 0.74;
    p.attack = null;
    p.comboStep = 0;
    p.comboTimer = 0;
    spawnBurst(p.x, p.y, 9, "#9cb59a");
    updateActionButtons();
  }

  function perfectEvade(x, y) {
    const p = battle.player;
    const perfect = p.evadeAge < 0.21;
    if (perfect) {
      p.counterWindow = 0.9;
      p.skillCooldown = 0;
      p.empowered = battle.tuning.evadeEmpower;
      battle.hitStop = 0.05;
      battle.shake = Math.max(battle.shake, 3);
      gainEdge(28);
      addText(p.x, p.y - 55, "PERFECT", "#e6d98e");
      flashMessage(p.empowered ? "PERFECT — 反撃好機 / AFTERSTEP" : "PERFECT — 反撃好機", 900);
      sound("perfect");
      pulse([12, 18]);
    } else flashMessage("EVADE", 320);
    spawnBurst(x, y, 9, "#b8c8b0");
  }

  function damagePlayer(amount, sx, sy) {
    const p = battle.player;
    const committedTechnique = p.attack && (p.attack.kind === "heavy" || p.attack.kind === "counter");
    let incoming = amount;
    if (battle.tuning.lowHealthRisk && p.hp <= 35) incoming *= 1.22;
    p.hp = Math.max(0, p.hp - incoming);
    p.flash = 0.18;
    p.counterWindow = 0;
    p.empowered = false;
    setEdge(p.edge * 0.5);
    if (committedTechnique) {
      p.attack = null;
      p.recovery = Math.max(p.recovery, 0.38);
      p.comboStep = 0;
      p.comboTimer = 0;
      flashMessage("CRUSHED — 技を潰された", 600);
    }
    const away = norm(p.x - sx, p.y - sy);
    p.x = clamp(p.x + away.x * 24, 64, canvas.width - 64);
    p.y = clamp(p.y + away.y * 24, 92, canvas.height - 58);
    battle.hitStop = 0.065;
    battle.shake = Math.max(battle.shake, 8);
    spawnBurst(p.x, p.y, 11, "#c95d4e");
    addText(p.x, p.y - 52, `-${Math.round(incoming)}`, "#ef7b66");
    sound("hurt");
    pulse([32, 18, 32]);
    updateCombatHud();
    if (p.hp <= 0) finishDefeat();
  }

  function finishVictory() {
    if (!battle || battle.finished || battle.ending) return;
    battle.ending = true;
    battle.victoryPickupTimer = 0;
    battle.victoryTimer = 0.82;
    battle.player.attack = null;
    battle.projectiles = [];
    const hp = battle.player.hp;
    state = Core.resolveVictory(state, hp);

    const exp = state.expedition;
    const fresh = (exp.lastLootIds || []).map((id) => exp.unsecuredLoot.find((item) => item.id === id)).filter(Boolean);
    const rarityRank = { uncommon: 1, rare: 2, relic: 3 };
    const featured = fresh.slice().sort((a, b) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0))[0];
    if (featured) {
      const origin = battle.lastDown || { x: canvas.width * 0.62, y: canvas.height * 0.56 };
      battle.lootBeacon = { x: origin.x, y: origin.y, rarity: featured.rarity, age: 0, duration: battle.victoryTimer };
      if ((rarityRank[featured.rarity] || 0) >= 2) {
        flashMessage(featured.rarity === "relic" ? "RELIC DROP" : "RARE DROP", 720);
      } else flashMessage("LOOT", 420);
    }
  }

  function finishDefeat() {
    if (!battle || battle.finished) return;
    battle.finished = true;
    const expedition = state.expedition;
    const carried = expedition.unsecuredLoot.length;
    const securedBefore = new Set(state.securedLoot.map((item) => item.id));
    stopCombat();
    state = Core.resolveDefeat(state);
    const recovered = state.securedLoot.filter((item) => !securedBefore.has(item.id));
    const lost = Math.max(0, carried - recovered.length);
    const report = {
      outcome: "defeat",
      depth: expedition.depth + 1,
      items: recovered,
      lostCount: lost,
      renownGain: 0,
      rankUp: null
    };
    window.setTimeout(() => {
      renderReturn(report);
    }, 450);
  }

  function updateCombatHud() {
    if (!battle) return;
    const p = battle.player;
    document.getElementById("player-health-bar").style.width = `${clamp(p.hp, 0, 100)}%`;
    document.getElementById("player-health-text").textContent = Math.ceil(p.hp);
    const total = battle.enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0);
    const max = battle.enemies.reduce((sum, enemy) => sum + enemy.maxHealth, 0) || 1;
    document.getElementById("enemy-health-bar").style.width = `${(total / max) * 100}%`;
    document.getElementById("enemy-count").textContent = livingEnemies().length;
    const edge = Math.round(p.edge || 0);
    const edgeBar = document.getElementById("edge-bar");
    const edgeText = document.getElementById("edge-text");
    if (edgeBar) edgeBar.style.width = `${edge}%`;
    if (edgeText) edgeText.textContent = edge >= 100 ? "READY" : edge;
    updateActionButtons();
  }

  function setEdge(value) {
    if (!battle) return;
    const p = battle.player;
    const wasReady = p.edge >= 100;
    p.edge = Core.nextEdge(0, value);
    p.edgeReady = p.edge >= Core.EDGE_MAX;
    if (!wasReady && p.edgeReady) {
      flashMessage("闘志 MAX — 次の技が決着打", 1100);
      sound("edge");
      pulse([10, 22, 10]);
    }
    updateCombatHud();
  }

  function gainEdge(amount) {
    if (!battle || battle.finished) return;
    setEdge((battle.player.edge || 0) + amount);
  }

  function updateActionButtons() {
    if (!battle) return;
    const p = battle.player;
    if (techniqueButton) {
      if (p.edge >= 100 && p.recovery <= 0 && p.skillCooldown <= 0) techniqueButton.textContent = "決着";
      else if (p.recovery > 0) techniqueButton.textContent = `隙 ${p.recovery.toFixed(1)}`;
      else if (p.counterWindow > 0 && p.skillCooldown <= 0) techniqueButton.textContent = `反撃 ${p.counterWindow.toFixed(1)}`;
      else techniqueButton.textContent = p.skillCooldown > 0 ? `技 ${p.skillCooldown.toFixed(1)}` : "技";
      techniqueButton.classList.toggle("cooling", p.skillCooldown > 0 || p.recovery > 0);
      techniqueButton.dataset.counter = p.counterWindow > 0 && p.skillCooldown <= 0 ? "ready" : "";
      techniqueButton.dataset.edge = p.edge >= 100 ? "ready" : "";
    }
    if (evadeButton) {
      evadeButton.textContent = p.evadeCooldown > 0 ? `回避 ${p.evadeCooldown.toFixed(1)}` : "回避";
      evadeButton.classList.toggle("cooling", p.evadeCooldown > 0);
    }
  }

  function flashMessage(text, duration = 700) {
    const el = document.getElementById("combat-message");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => el.classList.remove("show"), duration);
  }

  function spawnBurst(x, y, count, color) {
    if (!battle) return;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 120;
      battle.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.22 + Math.random() * 0.3, color });
    }
  }

  function addText(x, y, value, color) {
    if (battle) battle.texts.push({ x, y, value, color, life: 0.62 });
  }

  function renderStillScene(discovery) {
    battle = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround(discovery ? discovery.palette : "road", 0);
    ctx.fillStyle = "rgba(10,9,7,.62)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawBattle() {
    if (!battle) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const discovery = state.expedition && state.expedition.lastDiscovery;
    drawGround(discovery ? discovery.palette : "road", battle.elapsed);

    const zoom = mobileView() ? 1.14 : 1.08;
    const focusX = canvas.width / 2;
    const focusY = canvas.height / 2;
    const shakeX = battle.shake ? (Math.random() - 0.5) * battle.shake : 0;
    const shakeY = battle.shake ? (Math.random() - 0.5) * battle.shake : 0;

    ctx.save();
    ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-focusX, -focusY);
    if (battle.lootBeacon) drawLootBeacon(battle.lootBeacon);
    battle.projectiles.forEach(drawProjectile);
    battle.enemies.forEach(drawEnemy);
    battle.droppedWeapons.filter((drop) => !drop.picked).forEach(drawDroppedWeapon);
    drawPlayer();
    battle.slashes.forEach(drawSlash);
    battle.particles.forEach((pt) => {
      ctx.globalAlpha = Math.min(1, pt.life * 4);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
    });
    ctx.globalAlpha = 1;
    battle.texts.forEach((text) => {
      ctx.globalAlpha = Math.min(1, text.life * 2.2);
      ctx.fillStyle = text.color;
      ctx.font = "800 15px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(text.value, text.x, text.y);
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    drawCombatPointer();
  }

  function drawCombatPointer() {
    if (!combatPointer.active) return;
    const dx = combatPointer.x - combatPointer.startX;
    const dy = combatPointer.y - combatPointer.startY;
    const magnitude = Math.hypot(dx, dy);
    const direction = norm(dx, dy);
    const reach = Math.min(magnitude, 56);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#eee8dc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(combatPointer.startX, combatPointer.startY, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(238,232,220,.22)";
    ctx.beginPath();
    ctx.arc(combatPointer.startX + direction.x * reach, combatPointer.startY + direction.y * reach, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGround(palette, elapsed) {
    const palettes = {
      chapel: ["#17140f", "#262017", "#8b7449"], woods: ["#10150f", "#1b281a", "#65714f"],
      road: ["#17150f", "#272219", "#857452"], marsh: ["#0f1716", "#172522", "#55766e"],
      hill: ["#18140f", "#2a2017", "#98734b"], cut: ["#151315", "#261e24", "#785e70"]
    };
    const colors = palettes[palette] || palettes.road;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, colors[1]); gradient.addColorStop(1, colors[0]);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = `${colors[2]}28`; ctx.lineWidth = 1;
    for (let y = 110; y < canvas.height; y += 68) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(230, y - 16, 610, y + 20, canvas.width, y - 8); ctx.stroke();
    }
    if (palette === "woods" || palette === "marsh") {
      ctx.fillStyle = `${colors[2]}18`;
      for (let i = 0; i < 8; i += 1) ctx.fillRect(70 + i * 130 + Math.sin(elapsed * 0.3 + i) * 6, 70, 12, 330);
    }
    const v = ctx.createRadialGradient(480, 270, 90, 480, 270, 560);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.46)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawPlayer() {
    const p = battle.player;
    const profile = normalAttackProfile();
    const readyTarget = nearestEnemy(profile.range + 36);
    ctx.save();
    if (!p.moving && !p.attack) {
      ctx.strokeStyle = readyTarget && dist(p, readyTarget) <= profile.range + readyTarget.radius ? "rgba(142,173,121,.34)" : "rgba(238,232,220,.1)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 9]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, profile.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.facingY, p.facingX));
    ctx.scale(1.22, 1.22);
    const lean = p.attack ? Math.sin(Math.min(1, p.attack.elapsed / Math.max(0.01, p.attack.activeAt)) * Math.PI) * 5 : 0;
    ctx.translate(lean, 0);
    ctx.fillStyle = p.flash > 0 ? "#ef8c75" : p.invulnerable > 0 ? "#eef2df" : "#e4c997";
    ctx.strokeStyle = "#211b14"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, -19, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 18); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 1); ctx.lineTo(19, p.attack ? -7 : 4);
    ctx.moveTo(0, 3); ctx.lineTo(-14, 10);
    ctx.moveTo(0, 18); ctx.lineTo(12, 35);
    ctx.moveTo(0, 18); ctx.lineTo(-11, 35); ctx.stroke();
    if (battle.tuning.weaponType === "sword") {
      ctx.strokeStyle = battle.heldBattlefieldWeapon ? "#e9d38d" : "#d7c7a3";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(16, p.attack ? -7 : 3); ctx.lineTo(48, p.attack ? -18 : -6); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26, p.attack ? -15 : -4); ctx.lineTo(30, p.attack ? -4 : 8); ctx.stroke();
    } else if (battle.tuning.weaponType === "dagger") {
      ctx.strokeStyle = battle.heldBattlefieldWeapon ? "#dce0bd" : "#c8c6b7";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(16, p.attack ? -7 : 3); ctx.lineTo(32, p.attack ? -16 : -5); ctx.stroke();
    }
    if (p.counterWindow > 0) {
      ctx.strokeStyle = "#f0d979"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 6, 35, 0, Math.PI * 2); ctx.stroke();
    } else if (p.empowered) {
      ctx.strokeStyle = "#e3c66e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 6, 32, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDroppedWeapon(drop) {
    const p = battle.player;
    const near = dist(drop, p) <= 76;
    const pulse = 1 + Math.sin(battle.elapsed * 8 + drop.age) * 0.08;
    ctx.save();
    ctx.translate(drop.x, drop.y);
    ctx.rotate(drop.angle);
    ctx.shadowColor = drop.type === "sword" ? "rgba(237,202,112,.8)" : "rgba(194,210,173,.75)";
    ctx.shadowBlur = near ? 18 : 10;
    ctx.strokeStyle = drop.type === "sword" ? "#e8cf88" : "#cbd5b8";
    ctx.lineCap = "round";
    ctx.lineWidth = drop.type === "sword" ? 5 : 4;
    ctx.beginPath();
    ctx.moveTo(drop.type === "sword" ? -23 : -14, 0);
    ctx.lineTo(drop.type === "sword" ? 24 : 15, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -7); ctx.lineTo(-8, 7); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = near ? "rgba(240,220,153,.72)" : "rgba(222,207,163,.24)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(drop.x, drop.y, 24 * pulse, 0, Math.PI * 2); ctx.stroke();
    if (near) {
      ctx.strokeStyle = "#f1d77e";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(drop.x, drop.y, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(246,232,194,.95)";
      ctx.font = "800 11px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("触れれば拾う", drop.x, drop.y - 36);
    }
    ctx.restore();
  }

  function drawEnemy(enemy) {
    if (enemy.hp <= 0 && enemy.deadTimer <= 0) return;
    const toward = enemy.telegraph > 0 && Number.isFinite(enemy.aimDirX) && Number.isFinite(enemy.aimDirY)
      ? { x: enemy.aimDirX, y: enemy.aimDirY }
      : norm(battle.player.x - enemy.x, battle.player.y - enemy.y);
    const hpRatio = enemy.maxHealth ? enemy.hp / enemy.maxHealth : 0;
    const wounded = enemy.hp > 0 && hpRatio <= 0.3;
    const down = enemy.hp <= 0;
    const alpha = down ? clamp(enemy.deadTimer / 0.9, 0, 1) : 1;
    const wobble = wounded ? Math.sin(battle.elapsed * 13 + enemy.wobbleSeed) * 0.09 : 0;
    const woundedDrop = wounded ? 4 + Math.sin(battle.elapsed * 8 + enemy.wobbleSeed) * 2 : 0;
    const scale = enemy.boss ? 1.42 : 1.2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(enemy.x, enemy.y + woundedDrop + (down ? 10 : 0));
    ctx.rotate(Math.atan2(toward.y, toward.x) + wobble + (down ? enemy.strafeDir * 1.15 : 0));
    ctx.scale(scale, scale * (down ? 0.72 : wounded ? 0.9 : 1));
    if (enemy.telegraph > 0) {
      const pulse = 1 - enemy.telegraph / enemy.telegraphTotal;
      ctx.strokeStyle = enemy.kind === "skirmisher" ? `rgba(240,210,110,${0.45 + pulse * 0.5})` : `rgba(235,72,58,${0.45 + pulse * 0.5})`;
      ctx.lineWidth = 4 + pulse * 4; ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 18 + pulse * 8, 0, Math.PI * 2); ctx.stroke();
      if (enemy.kind === "skirmisher") { ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(180, 0); ctx.stroke(); }
    }
    const base = enemy.kind === "guard" ? "#81765e" : enemy.kind === "skirmisher" ? "#78805b" : "#a65347";
    ctx.fillStyle = enemy.hitFlash > 0 ? "#f0b28c" : base;
    ctx.strokeStyle = "#1b1713"; ctx.lineWidth = enemy.kind === "guard" ? 7 : 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, -18, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(18, enemy.kind === "skirmisher" ? -4 : 7); ctx.moveTo(0, 4); ctx.lineTo(-14, 11); ctx.moveTo(0, 18); ctx.lineTo(12, 35); ctx.moveTo(0, 18); ctx.lineTo(-11, 35); ctx.stroke();
    if (enemy.kind === "guard" && enemy.guarding) { ctx.fillStyle = "#b9a06b"; ctx.fillRect(14, -8, 14, 32); }
    if (enemy.kind === "skirmisher") { ctx.strokeStyle = "#c2b27f"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(18, 0, 13, -1.1, 1.1); ctx.stroke(); }
    ctx.restore();
    if (enemy.hp > 0) {
      const ratio = enemy.hp / enemy.maxHealth;
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(enemy.x - 30, enemy.y - enemy.radius - 33, 60, 5);
      ctx.fillStyle = enemy.kind === "guard" ? "#aa9362" : enemy.kind === "skirmisher" ? "#879064" : "#b25d4e";
      ctx.fillRect(enemy.x - 30, enemy.y - enemy.radius - 33, 60 * ratio, 5);
      ctx.fillStyle = "rgba(245,235,212,.8)"; ctx.font = "800 10px ui-sans-serif, system-ui"; ctx.textAlign = "center";
      ctx.fillText(enemy.boss ? enemy.name : enemy.kind.toUpperCase(), enemy.x, enemy.y - enemy.radius - 41);
    }
    ctx.globalAlpha = 1;
  }

  function drawLootBeacon(beacon) {
    const rank = beacon.rarity === "relic" ? 3 : beacon.rarity === "rare" ? 2 : 1;
    const progress = clamp(beacon.age / Math.max(0.01, beacon.duration), 0, 1);
    const intro = clamp(progress / 0.16, 0, 1);
    const fade = clamp((1 - progress) / 0.22, 0, 1);
    const alpha = Math.min(intro, fade);
    const tall = rank >= 2;
    const height = rank === 3 ? 330 : rank === 2 ? 285 : 120;
    const width = rank === 3 ? 46 : rank === 2 ? 34 : 18;
    const color = rank === 3 ? [207, 177, 255] : rank === 2 ? [255, 216, 104] : [225, 214, 181];
    const pulse = 1 + Math.sin(battle.elapsed * 16) * 0.08;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const beam = ctx.createLinearGradient(beacon.x, beacon.y - height, beacon.x, beacon.y + 18);
    beam.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    beam.addColorStop(0.28, `rgba(${color[0]},${color[1]},${color[2]},${0.12 * alpha})`);
    beam.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},${(tall ? 0.68 : 0.34) * alpha})`);
    ctx.fillStyle = beam;
    ctx.fillRect(beacon.x - width / 2, beacon.y - height, width, height + 24);

    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.75 * alpha})`;
    ctx.lineWidth = tall ? 4 : 2;
    ctx.beginPath();
    ctx.ellipse(beacon.x, beacon.y + 8, 34 * pulse, 12 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (tall) {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(beacon.x, beacon.y + 8, 54 * pulse, 19 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawProjectile(shot) {
    ctx.save(); ctx.translate(shot.x, shot.y); ctx.rotate(Math.atan2(shot.vy, shot.vx));
    ctx.strokeStyle = "#f0dda8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke();
    ctx.restore();
  }

  function drawSlash(slash) {
    const alpha = clamp(slash.life / 0.13, 0, 1);
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(slash.x, slash.y); ctx.rotate(slash.angle);
    ctx.strokeStyle = slash.heavy ? "#ffd875" : slash.finisher ? "#f2c96f" : "#e8d8b7";
    ctx.lineWidth = slash.heavy ? 7 : slash.finisher ? 6 : 4; ctx.beginPath(); ctx.arc(0, 0, slash.heavy ? 54 : 40, -0.85, 0.85); ctx.stroke(); ctx.restore();
  }

  function returnHome(label) {
    const expedition = state.expedition;
    const items = expedition.unsecuredLoot.slice();
    const before = Core.getHearthProgression ? Core.getHearthProgression(state) : null;
    state = Core.returnHome(state);
    const after = Core.getHearthProgression ? Core.getHearthProgression(state) : null;
    const rankUp = before && after && after.rank > before.rank ? after.current : null;
    renderReturn({
      outcome: "survived",
      depth: expedition.depth + 1,
      items,
      lostCount: 0,
      renownGain: after ? after.lastGain : 0,
      rankUp,
      label
    });
  }

  function installControls() {
    const touch = document.querySelector(".touch-controls");
    const dpad = document.querySelector(".dpad");
    const light = document.getElementById("touch-light");
    if (dpad) dpad.remove();
    if (light) light.remove();
    if (touch) touch.classList.add("simple-actions");
    if (techniqueButton) { techniqueButton.textContent = "技"; techniqueButton.classList.add("technique"); }
    if (evadeButton) evadeButton.textContent = "回避";
    const help = document.querySelector(".combat-help");
    if (help) help.innerHTML = '<span><kbd>WASD</kbd> / ドラッグ 移動</span><span>停止 <b>AUTO STRIKE</b></span><span>武器に触れる <b>PICK UP</b></span><span><kbd>K</kbd> 技</span><span><kbd>SPACE</kbd> 回避</span><span class="hint">敵の狙いを外す → 止まって反撃。倒した敵の武器は触れるだけで拾える。</span>';

    const movementCodes = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"]);
    const pointerPosition = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (!screens.combat.classList.contains("active") || !battle || battle.ending || battle.finished) return;
      const pos = pointerPosition(event);
      combatPointer.active = true;
      combatPointer.id = event.pointerId;
      combatPointer.startX = combatPointer.x = pos.x;
      combatPointer.startY = combatPointer.y = pos.y;
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!combatPointer.active || event.pointerId !== combatPointer.id) return;
      const pos = pointerPosition(event);
      combatPointer.x = pos.x;
      combatPointer.y = pos.y;
    });
    const releasePointer = (event) => {
      if (event.pointerId !== combatPointer.id) return;
      combatPointer.active = false;
      combatPointer.id = null;
    };
    canvas.addEventListener("pointerup", releasePointer);
    canvas.addEventListener("pointercancel", releasePointer);

    techniqueButton?.addEventListener("pointerdown", (event) => { event.preventDefault(); performTechnique(); });
    evadeButton?.addEventListener("pointerdown", (event) => { event.preventDefault(); performEvade(); });
    window.addEventListener("keydown", (event) => {
      if (!screens.combat.classList.contains("active") || !battle) return;
      if (movementCodes.has(event.code)) {
        if (event.code.startsWith("Arrow")) event.preventDefault();
        combatKeys.add(event.code);
        return;
      }
      if (event.repeat) return;
      if (event.code === "KeyK") performTechnique();
      if (event.code === "Space") { event.preventDefault(); performEvade(); }
    }, { passive: false });
    window.addEventListener("keyup", (event) => combatKeys.delete(event.code));
    window.addEventListener("blur", () => {
      combatKeys.clear();
      combatPointer.active = false;
      combatPointer.id = null;
    });
  }

  function beginNewExpedition() {
    ensureAudio();
    lastReturnReport = null;
    state = Core.beginExpedition(state, Date.now());
    renderExplore();
  }

  document.getElementById("start-expedition").addEventListener("click", beginNewExpedition);
  document.getElementById("continue-expedition").addEventListener("click", () => {
    state = Core.continueExpedition(state);
    renderExplore();
  });
  document.getElementById("return-home").addEventListener("click", () => returnHome("RETURNED SAFE"));
  document.getElementById("return-from-explore").addEventListener("click", () => returnHome("TURNED BACK"));
  document.getElementById("loot-reveal-continue").addEventListener("click", renderDecision);
  document.getElementById("return-to-hub").addEventListener("click", () => {
    lastOutcome = "";
    renderHub();
  });
  document.getElementById("return-again").addEventListener("click", beginNewExpedition);
  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    saveSoundPreference();
    soundToggle.textContent = soundEnabled ? "音 ON" : "音 OFF";
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    if (soundEnabled) sound("perfect");
  });
  soundToggle.textContent = soundEnabled ? "音 ON" : "音 OFF";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));

  installControls();
  renderHub();
})();