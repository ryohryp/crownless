(() => {
  "use strict";

  const Core = window.CrownlessCore;
  let state = Core.createInitialState();
  let battle = null;
  let raf = null;
  let lastFrame = 0;
  let messageTimer = null;
  let lastOutcome = "";

  const screens = {
    hub: document.getElementById("hub-screen"),
    explore: document.getElementById("explore-screen"),
    combat: document.getElementById("combat-screen"),
    decision: document.getElementById("decision-screen")
  };

  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");
  const runStatus = document.getElementById("run-status");
  const lootReveal = document.getElementById("loot-reveal");
  const combatBars = document.querySelector(".combat-bars");
  const techniqueButton = document.getElementById("touch-heavy");
  const evadeButton = document.getElementById("touch-evade");
  const mobileView = () => window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function norm(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function livingEnemies() {
    return battle ? battle.enemies.filter((enemy) => enemy.hp > 0) : [];
  }

  function nearestEnemy() {
    if (!battle) return null;
    return livingEnemies().sort((a, b) => dist(a, battle.player) - dist(b, battle.player))[0] || null;
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
        renderHub();
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
      : "武器はない。移動と連撃は身体に任せ、技と回避の瞬間を選ぶ。";

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
      recover: 0,
      stagger: 0,
      hitFlash: 0,
      guarding: enemy.kind === "guard",
      guardCycle: enemy.kind === "guard" ? 0.2 + index * 0.4 : 0,
      strafeDir: index % 2 ? 1 : -1,
      wobbleSeed: index * 1.73,
      deadTimer: 0
    }));

    battle = {
      tuning,
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
        autoDelay: 0.14,
        flash: 0,
        attack: null,
        comboStep: 0,
        comboTimer: 0,
        empowered: false
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
    flashMessage("通常攻撃は自動。予兆へ技で割り込む。寸前回避なら反撃好機。", 2600);
    lastFrame = performance.now();
    raf = requestAnimationFrame(combatLoop);
  }

  function stopCombat() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    lastFrame = 0;
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

    updatePlayerAttack(dt);
    updateAutoPilot(dt);
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

  function updateAutoPilot(dt) {
    const p = battle.player;
    const target = nearestEnemy();
    if (!target || p.invulnerable > 0.24 || p.recovery > 0) return;
    const to = norm(target.x - p.x, target.y - p.y);
    const d = dist(p, target);
    if (!p.attack) {
      p.facingX = to.x;
      p.facingY = to.y;
    }

    const strikeRange = battle.tuning.reach + target.radius + 4;
    if (!p.attack && d > strikeRange - 3) {
      const speed = battle.tuning.moveSpeed * (target.kind === "skirmisher" ? 1.08 : 0.92);
      p.x += to.x * speed * dt;
      p.y += to.y * speed * dt;
    }

    if (!p.attack && p.autoDelay <= 0 && d <= strikeRange + 5) {
      performLight();
      p.autoDelay = 0.05;
    }

    p.x = clamp(p.x, 64, canvas.width - 64);
    p.y = clamp(p.y, 92, canvas.height - 58);
  }

  function updatePlayerAttack(dt) {
    const p = battle.player;
    const attack = p.attack;
    if (!attack) return;
    attack.elapsed += dt;
    const progress = attack.elapsed / attack.duration;
    if (!attack.lunged && progress > 0.12) {
      attack.lunged = true;
      const amount = attack.lunge || (attack.kind === "light" ? 18 + attack.step * 5 : 31);
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
      } else if (wasLight) p.comboTimer = 0.5;
      else { p.comboStep = 0; p.comboTimer = 0; }
    }
  }

  function performLight() {
    if (!battle || battle.finished || battle.ending) return;
    const p = battle.player;
    if (p.attack || p.recovery > 0) return;
    const tempo = battle.tuning.style === "unarmed" ? battle.tuning.unarmedTempo : 1;
    p.comboStep = p.comboTimer > 0 ? (p.comboStep % 3) + 1 : 1;
    const step = p.comboStep;
    const duration = [0, 0.27, 0.30, 0.39][step] / tempo;
    const activeAt = [0, 0.082, 0.095, 0.13][step] / tempo;
    p.attack = { kind: "light", step, elapsed: 0, duration, activeAt, didHit: false, hitAny: false, lunged: false };
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
    p.skillCooldown = counter ? 1.05 : 1.8;
    startTechnique(counter);
  }

  function startTechnique(counter = false) {
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
      lunge: profile.lunge,
      damageMultiplier: profile.damage,
      staggerMultiplier: profile.stagger,
      knockMultiplier: profile.knock,
      label: profile.label
    };
    p.counterWindow = 0;
    p.comboStep = 0;
    p.comboTimer = 0;
    flashMessage(counter ? `${profile.label} — 反撃` : "TECHNIQUE — 技", 460);
  }

  function applyAttackHits(attack) {
    const p = battle.player;
    const heavy = attack.kind === "heavy";
    const counter = attack.kind === "counter";
    const technique = heavy || counter;
    const finisher = !technique && attack.step === 3;
    const reach = battle.tuning.reach + (technique ? 24 : finisher ? 13 : 0);
    let damage = technique
      ? battle.tuning.heavyDamage * (attack.damageMultiplier || 1)
      : battle.tuning.lightDamage * (attack.step === 2 ? 1.08 : finisher ? 1.32 * battle.tuning.comboFinisher : 1);
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
      if (toEnemy.x * p.facingX + toEnemy.y * p.facingY < 0.05) return;
      if (enemy.kind === "guard" && enemy.guarding && !technique && !finisher) {
        enemy.stagger = 0.1;
        spawnBurst(enemy.x, enemy.y, 8, "#d4c18c");
        addText(enemy.x, enemy.y - 48, "BLOCK", "#dfcf9b");
        battle.hitStop = 0.03;
        hit = true;
        attack.hitAny = true;
        return;
      }

      let dealt = damage;
      let reaction = counter ? attack.label : "";
      if (technique && enemy.telegraph > 0) {
        reaction = enemy.kind === "rusher" ? "COUNTER" : "INTERRUPT";
        enemy.telegraph = 0;
        enemy.telegraphTotal = 0;
        enemy.recover = Math.max(enemy.recover, counter ? 0.72 : 0.52);
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
      enemy.stagger = Math.max(enemy.stagger, technique ? 0.42 * staggerScale : finisher ? 0.3 : 0.12);
      const knock = technique ? 50 * staggerScale * (attack.knockMultiplier || 1) : finisher ? 38 : 11;
      enemy.vx += toEnemy.x * knock * 3.2;
      enemy.vy += toEnemy.y * knock * 3.2;
      spawnBurst(enemy.x, enemy.y, technique ? 15 : finisher ? 12 : 8, technique ? "#f0c96a" : "#e6d0a7");
      battle.slashes.push({ x: p.x + p.facingX * 31, y: p.y + p.facingY * 31, angle: Math.atan2(p.facingY, p.facingX), life: 0.13, heavy: technique, finisher });
      battle.hitStop = Math.max(battle.hitStop, technique ? (counter ? 0.13 : 0.095) : finisher ? 0.075 : 0.045);
      battle.shake = Math.max(battle.shake, technique ? (counter ? 13 : 10) : finisher ? 7 : 4);
      addText(enemy.x, enemy.y - 48, `${Math.round(dealt)}`, technique ? "#ffd875" : "#f5e0bd");
      hit = true;
      attack.hitAny = true;
      if (enemy.hp <= 0) {
        enemy.deadTimer = 0.9;
        enemy.vx += toEnemy.x * 230;
        enemy.vy += toEnemy.y * 230;
        battle.lastDown = { x: enemy.x, y: enemy.y };
        addText(enemy.x, enemy.y - 78, "DOWN", "#d96858");
      }
    });
    if (!hit) battle.slashes.push({ x: p.x + p.facingX * 31, y: p.y + p.facingY * 31, angle: Math.atan2(p.facingY, p.facingX), life: 0.1, heavy: technique, finisher });
    updateCombatHud();
    if (battle.enemies.every((enemy) => enemy.hp <= 0)) finishVictory();
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
    enemy.telegraph = duration;
    enemy.telegraphTotal = duration;
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
    const dir = norm(p.x - enemy.x, p.y - enemy.y);
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
    const move = smartEvadeVector();
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
      addText(p.x, p.y - 55, "PERFECT", "#e6d98e");
      flashMessage(p.empowered ? "PERFECT — 反撃好機 / AFTERSTEP" : "PERFECT — 反撃好機", 900);
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
    updateCombatHud();
    if (p.hp <= 0) finishDefeat();
  }

  function finishVictory() {
    if (!battle || battle.finished || battle.ending) return;
    battle.ending = true;
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
    const carried = state.expedition.unsecuredLoot.length;
    const lost = carried - Math.floor(carried / 2);
    stopCombat();
    state = Core.resolveDefeat(state);
    lastOutcome = lost > 0 ? `DEFEATED / ${lost} LOOT LOST` : "DEFEATED / RETURNED EMPTY";
    window.setTimeout(() => {
      renderHub();
      window.setTimeout(() => { lastOutcome = ""; runStatus.innerHTML = "<span>GREY HEARTH</span><strong>SAFE</strong>"; }, 2400);
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
    updateActionButtons();
  }

  function updateActionButtons() {
    if (!battle) return;
    const p = battle.player;
    if (techniqueButton) {
      if (p.recovery > 0) techniqueButton.textContent = `隙 ${p.recovery.toFixed(1)}`;
      else if (p.counterWindow > 0 && p.skillCooldown <= 0) techniqueButton.textContent = `反撃 ${p.counterWindow.toFixed(1)}`;
      else techniqueButton.textContent = p.skillCooldown > 0 ? `技 ${p.skillCooldown.toFixed(1)}` : "技";
      techniqueButton.classList.toggle("cooling", p.skillCooldown > 0 || p.recovery > 0);
      techniqueButton.dataset.counter = p.counterWindow > 0 && p.skillCooldown <= 0 ? "ready" : "";
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

    const target = nearestEnemy();
    const zoom = mobileView() ? 1.38 : 1.08;
    const focusX = target ? battle.player.x * 0.52 + target.x * 0.48 : battle.player.x;
    const focusY = target ? battle.player.y * 0.55 + target.y * 0.45 : battle.player.y;
    const shakeX = battle.shake ? (Math.random() - 0.5) * battle.shake : 0;
    const shakeY = battle.shake ? (Math.random() - 0.5) * battle.shake : 0;

    ctx.save();
    ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-focusX, -focusY);
    if (battle.lootBeacon) drawLootBeacon(battle.lootBeacon);
    battle.projectiles.forEach(drawProjectile);
    battle.enemies.forEach(drawEnemy);
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
    ctx.save();
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
    if (p.counterWindow > 0) {
      ctx.strokeStyle = "#f0d979"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 6, 35, 0, Math.PI * 2); ctx.stroke();
    } else if (p.empowered) {
      ctx.strokeStyle = "#e3c66e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 6, 32, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(enemy) {
    if (enemy.hp <= 0 && enemy.deadTimer <= 0) return;
    const toward = norm(battle.player.x - enemy.x, battle.player.y - enemy.y);
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
    const count = state.expedition.unsecuredLoot.length;
    state = Core.returnHome(state);
    lastOutcome = count ? `${count} LOOT SECURED` : label;
    renderHub();
    setTimeout(() => { lastOutcome = ""; runStatus.innerHTML = "<span>GREY HEARTH</span><strong>SAFE</strong>"; }, 2400);
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
    if (help) help.innerHTML = `<span>移動・通常攻撃 <b>AUTO</b></span><span><kbd>K</kbd> 技 / 割込</span><span><kbd>SPACE</kbd> 回避</span><span class="hint">予兆に技。寸前回避の後は反撃。</span>`;

    techniqueButton?.addEventListener("pointerdown", (event) => { event.preventDefault(); performTechnique(); });
    evadeButton?.addEventListener("pointerdown", (event) => { event.preventDefault(); performEvade(); });
    window.addEventListener("keydown", (event) => {
      if (!screens.combat.classList.contains("active") || !battle || event.repeat) return;
      if (event.code === "KeyK") performTechnique();
      if (event.code === "Space") { event.preventDefault(); performEvade(); }
    });
  }

  document.getElementById("start-expedition").addEventListener("click", () => {
    state = Core.beginExpedition(state, Date.now());
    renderExplore();
  });
  document.getElementById("continue-expedition").addEventListener("click", () => {
    state = Core.continueExpedition(state);
    renderExplore();
  });
  document.getElementById("return-home").addEventListener("click", () => returnHome("RETURNED SAFE"));
  document.getElementById("return-from-explore").addEventListener("click", () => returnHome("TURNED BACK"));
  document.getElementById("loot-reveal-continue").addEventListener("click", renderDecision);

  installControls();
  renderHub();
})();
