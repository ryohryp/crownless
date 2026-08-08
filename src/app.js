(() => {
  "use strict";

  const Core = window.CrownlessCore;
  let state = Core.createInitialState();
  let battle = null;
  let animationFrame = null;
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
  const input = { up: false, down: false, left: false, right: false };
  const lootReveal = document.getElementById("loot-reveal");
  const combatBars = document.querySelector(".combat-bars");

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalized(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, element]) => element.classList.toggle("active", key === name));
    const exp = state.expedition;
    const carried = exp ? exp.unsecuredLoot.length : 0;
    const depth = exp ? exp.depth + 1 : 0;
    runStatus.classList.toggle("active", Boolean(exp));
    runStatus.innerHTML = exp
      ? `<span>遠征 深度 ${depth}</span><strong>${carried} 未確定</strong>`
      : `<span>${lastOutcome || "GREY HEARTH"}</span><strong>SAFE</strong>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const comparison = Core.compareItem(state, item);
    const sign = comparison.delta > 0 ? "+" : "";
    const delta = Math.abs(comparison.delta) < 0.1 ? "±0" : `${sign}${comparison.delta.toFixed(1)}`;
    return `${comparison.summary} / ${delta}`;
  }

  function lootCard(item, secured, featured = false) {
    const equipped = state.equippedItemId === item.id;
    const card = document.createElement("article");
    card.className = `loot-card rarity-${item.rarity}${equipped ? " equipped" : ""}${featured ? " featured" : ""}`;

    const glyph = document.createElement("div");
    glyph.className = "loot-glyph";
    glyph.textContent = rarityGlyph(item);

    const body = document.createElement("div");
    body.className = "loot-copy";
    body.innerHTML = `
      <small>${rarityLabel(item)}</small>
      <strong>${item.name}</strong>
      <p>${item.styleLabel || item.style} · ${item.playstyle || "戦型変化"} · ${comparisonLabel(item)}</p>
      <em>${item.modifier.tag ? `${item.modifier.tag} — ` : ""}${item.modifier.description}</em>
    `;

    card.append(glyph, body);

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
    stopCombatLoop();
    hideOverlay();
    if (combatBars) combatBars.style.display = "";

    const equipped = Core.getEquippedItem(state);
    document.getElementById("equipped-label").textContent = equipped ? equipped.styleLabel || equipped.name : "素手";
    document.getElementById("loadout-title").textContent = equipped ? equipped.name : "拳だけで出る";
    document.getElementById("loadout-description").textContent = equipped
      ? `${equipped.playstyle || "戦型"}。${equipped.modifier.description}`
      : "武器はない。けれど、拳は最初から最後まで選べる戦い方だ。";

    const secured = document.getElementById("secured-loot");
    secured.innerHTML = "";
    document.getElementById("secured-count").textContent = state.securedLoot.length;
    if (!state.securedLoot.length) {
      secured.innerHTML = `<div class="empty-state">棚は空だ。最初の戦利品を持ち帰れ。</div>`;
    } else {
      state.securedLoot.slice().reverse().forEach((item) => secured.appendChild(lootCard(item, true)));
    }

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
    stopCombatLoop();
    hideOverlay();
    if (combatBars) combatBars.style.display = "";
    const exp = state.expedition;
    document.getElementById("explore-hp").textContent = exp.health;
    document.getElementById("explore-depth").textContent = exp.depth + 1;
    document.getElementById("explore-loot-count").textContent = exp.unsecuredLoot.length;

    const choices = Core.generateExplorationChoices(state);
    const leads = document.getElementById("lead-list");
    leads.innerHTML = "";

    choices.forEach((choice, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `lead-card palette-${choice.palette}`;
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
        </div>
      `;
      card.addEventListener("click", () => enterLead(choice.choiceId));
      leads.appendChild(card);
    });

    const carried = exp.unsecuredLoot.length;
    const warning = document.getElementById("carried-warning");
    warning.classList.toggle("hot", carried > 0);
    const scoutCopy = exp.scouting > 0 ? ` 地図のおかげで、あと${exp.scouting}回は危険を読みやすい。` : "";
    warning.innerHTML = carried
      ? `<strong>${carried}個の戦利品はまだ自分の物ではない。</strong><span>倒れれば失う。今なら帰れる。${scoutCopy}</span>`
      : `<strong>まだ失う物はない。</strong><span>だからこそ、最初の一歩は軽い。${scoutCopy}</span>`;

    showScreen("explore");
  }

  function enterLead(choiceId) {
    state = Core.discoverLocation(state, choiceId);
    const exp = state.expedition;
    const discovery = exp.lastDiscovery;
    setCombatScene(discovery);

    if (state.phase === "combat") {
      if (combatBars) combatBars.style.display = "";
      showScreen("combat");
      startCombat();
      return;
    }

    if (state.phase === "event") {
      showScreen("combat");
      renderStillScene(discovery);
      showEvent(exp.pendingEvent);
      return;
    }

    if (state.phase === "decision") {
      showScreen("combat");
      renderStillScene(discovery);
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
    document.getElementById("decision-hp").textContent = exp.health;
    document.getElementById("decision-count").textContent = exp.unsecuredLoot.length;
    document.getElementById("decision-place").textContent = exp.lastDiscovery ? exp.lastDiscovery.name : "名もない場所";

    let nextRisk = exp.health <= 35
      ? "傷が深い。次の一戦はかなり危険だ。"
      : exp.unsecuredLoot.length >= 3
        ? "荷が重い。ここから先は、強欲そのものが敵になる。"
        : exp.unsecuredLoot.length >= 1
          ? "持ち帰りたい物ができた。それでも次の気配が気になる。"
          : "何も拾っていない。次へ進む理由は十分にある。";
    if (exp.lastEventSummary) nextRisk = `${exp.lastEventSummary} ${nextRisk}`;
    document.getElementById("decision-risk-copy").textContent = nextRisk;

    showScreen("decision");
  }

  function showEvent(event) {
    stopCombatLoop();
    if (combatBars) combatBars.style.display = "none";
    const place = document.getElementById("loot-reveal-place");
    const heading = lootReveal.querySelector("h2");
    const copy = lootReveal.querySelector(".loot-reveal-inner > p:not(.eyebrow)");
    const items = document.getElementById("loot-reveal-items");
    const continueButton = document.getElementById("loot-reveal-continue");

    place.textContent = event.discovery.name;
    heading.textContent = event.title;
    copy.textContent = event.text;
    items.innerHTML = "";
    items.style.display = "grid";
    items.style.gap = "10px";

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
        } else {
          showOutcomeOverlay();
        }
      });
      items.appendChild(button);
    });

    continueButton.style.display = "none";
    showOverlay();
  }

  function showOutcomeOverlay() {
    stopCombatLoop();
    if (combatBars) combatBars.style.display = "none";
    const exp = state.expedition;
    const place = document.getElementById("loot-reveal-place");
    const heading = lootReveal.querySelector("h2");
    const copy = lootReveal.querySelector(".loot-reveal-inner > p:not(.eyebrow)");
    const items = document.getElementById("loot-reveal-items");
    const continueButton = document.getElementById("loot-reveal-continue");
    const fresh = exp.lastLootIds
      .map((id) => exp.unsecuredLoot.find((item) => item.id === id))
      .filter(Boolean);

    place.textContent = exp.lastDiscovery ? exp.lastDiscovery.name : "遠征先";
    heading.textContent = fresh.length ? "見つけた。" : "何かが残った。";
    copy.textContent = exp.lastEventSummary || (fresh.length
      ? "まだあなたの物ではない。持ち帰って初めて確保される。"
      : "戦利品はない。だが、傷と情報も遠征の結果だ。");

    items.innerHTML = "";
    if (fresh.length) {
      fresh.forEach((item) => items.appendChild(lootCard(item, false, true)));
    } else {
      const note = document.createElement("div");
      note.className = "empty-state";
      note.textContent = "新しい装備はない。";
      items.appendChild(note);
    }

    continueButton.style.display = "";
    continueButton.innerHTML = `結果を抱えて判断する <span>→</span>`;
    continueButton.onclick = () => renderDecision();
    showOverlay();
  }

  function showLootReveal() {
    showOutcomeOverlay();
  }

  function showOverlay() {
    lootReveal.classList.add("show");
    lootReveal.style.display = "grid";
  }

  function hideOverlay() {
    lootReveal.classList.remove("show");
    lootReveal.style.display = "none";
    const continueButton = document.getElementById("loot-reveal-continue");
    continueButton.onclick = null;
  }

  function startCombat() {
    stopCombatLoop();
    hideOverlay();
    if (combatBars) combatBars.style.display = "";

    const tuning = Core.getCombatTuning(state);
    const defs = state.expedition.encounter.enemies;
    const enemies = defs.map((enemy, index) => ({
      ...enemy,
      x: 650 + index * 92,
      y: 300 + (index % 2 ? 78 : -45),
      hp: enemy.maxHealth,
      vx: 0,
      vy: 0,
      radius: enemy.kind === "guard" ? 29 : enemy.kind === "skirmisher" ? 23 : 25,
      attackCooldown: 0.7 + index * 0.32,
      telegraph: 0,
      telegraphTotal: 0,
      recover: 0,
      stagger: 0,
      hitFlash: 0,
      guarding: enemy.kind === "guard",
      guardCycle: enemy.kind === "guard" ? 0.2 + index * 0.4 : 0,
      strafeDir: index % 2 ? 1 : -1,
      deadTimer: 0
    }));

    battle = {
      tuning,
      player: {
        x: 300,
        y: 300,
        hp: state.expedition.health,
        maxHp: 100,
        facingX: 1,
        facingY: 0,
        invulnerable: 0,
        evadeCooldown: 0,
        evadeAge: 99,
        flash: 0,
        attack: null,
        comboStep: 0,
        comboTimer: 0,
        bufferedLight: false,
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
      finished: false
    };

    updateCombatHud();
    const types = [...new Set(enemies.map((enemy) => enemy.kind))];
    const lessons = [];
    if (types.includes("rusher")) lessons.push("赤い突進は横へ避けろ");
    if (types.includes("guard")) lessons.push("盾は重攻撃で割れ");
    if (types.includes("skirmisher")) lessons.push("射手を放置するな");
    flashMessage(lessons.join(" / "), 1500);
    lastFrame = performance.now();
    animationFrame = requestAnimationFrame(combatLoop);
  }

  function stopCombatLoop() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    lastFrame = 0;
    Object.keys(input).forEach((key) => { input[key] = false; });
  }

  function combatLoop(now) {
    if (!battle || battle.finished) return;
    const rawDt = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;

    if (battle.hitStop > 0) {
      battle.hitStop = Math.max(0, battle.hitStop - rawDt);
      drawBattle();
      animationFrame = requestAnimationFrame(combatLoop);
      return;
    }

    updateBattle(rawDt);
    drawBattle();
    animationFrame = requestAnimationFrame(combatLoop);
  }

  function updateBattle(dt) {
    const p = battle.player;
    battle.elapsed += dt;
    battle.shake = Math.max(0, battle.shake - dt * 22);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.evadeCooldown = Math.max(0, p.evadeCooldown - dt);
    p.evadeAge += dt;
    p.flash = Math.max(0, p.flash - dt);
    p.comboTimer = Math.max(0, p.comboTimer - dt);

    updatePlayerAttack(dt);

    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx || dy) {
      const move = normalized(dx, dy);
      if (!p.attack || p.attack.elapsed < 0.07) {
        p.facingX = move.x;
        p.facingY = move.y;
      }
      const speedScale = p.attack ? 0.34 : 1;
      p.x += move.x * battle.tuning.moveSpeed * speedScale * dt;
      p.y += move.y * battle.tuning.moveSpeed * speedScale * dt;
    }
    p.x = clamp(p.x, 48, canvas.width - 48);
    p.y = clamp(p.y, 72, canvas.height - 42);

    battle.enemies.forEach((enemy) => updateEnemy(enemy, dt));
    updateProjectiles(dt);

    battle.particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
    });
    battle.particles = battle.particles.filter((particle) => particle.life > 0);

    battle.slashes.forEach((slash) => { slash.life -= dt; });
    battle.slashes = battle.slashes.filter((slash) => slash.life > 0);

    battle.texts.forEach((text) => {
      text.life -= dt;
      text.y -= 24 * dt;
    });
    battle.texts = battle.texts.filter((text) => text.life > 0);
  }

  function updatePlayerAttack(dt) {
    const p = battle.player;
    const attack = p.attack;
    if (!attack) return;

    attack.elapsed += dt;
    const progress = attack.elapsed / attack.duration;
    if (!attack.lunged && progress > 0.12) {
      attack.lunged = true;
      const lunge = attack.kind === "heavy" ? 27 : 18 + attack.step * 5;
      p.x = clamp(p.x + p.facingX * lunge, 48, canvas.width - 48);
      p.y = clamp(p.y + p.facingY * lunge, 72, canvas.height - 42);
    }

    if (!attack.didHit && attack.elapsed >= attack.activeAt) {
      attack.didHit = true;
      applyAttackHits(attack);
    }

    if (attack.elapsed >= attack.duration) {
      const wasLight = attack.kind === "light";
      p.attack = null;
      if (wasLight) {
        p.comboTimer = 0.45;
        if (p.bufferedLight) {
          p.bufferedLight = false;
          performLight();
        }
      } else {
        p.comboStep = 0;
        p.comboTimer = 0;
      }
    }
  }

  function performLight() {
    if (!battle || battle.finished) return;
    const p = battle.player;
    if (p.attack) {
      if (p.attack.kind === "light" && p.attack.elapsed > p.attack.duration * 0.45) p.bufferedLight = true;
      return;
    }

    const tempo = battle.tuning.style === "unarmed" ? battle.tuning.unarmedTempo : 1;
    p.comboStep = p.comboTimer > 0 ? (p.comboStep % 3) + 1 : 1;
    const step = p.comboStep;
    const durations = [0, 0.27, 0.30, 0.39];
    const active = [0, 0.082, 0.095, 0.13];
    p.attack = {
      kind: "light",
      step,
      elapsed: 0,
      duration: durations[step] / tempo,
      activeAt: active[step] / tempo,
      didHit: false,
      lunged: false
    };
    p.comboTimer = 0;
  }

  function performHeavy() {
    if (!battle || battle.finished) return;
    const p = battle.player;
    if (p.attack) return;
    p.bufferedLight = false;
    p.attack = {
      kind: "heavy",
      step: 0,
      elapsed: 0,
      duration: 0.62,
      activeAt: 0.31,
      didHit: false,
      lunged: false
    };
    p.comboStep = 0;
    p.comboTimer = 0;
    flashMessage("HEAVY — 振り切れ", 380);
  }

  function applyAttackHits(attack) {
    const p = battle.player;
    const heavy = attack.kind === "heavy";
    const finisher = !heavy && attack.step === 3;
    const reach = battle.tuning.reach + (heavy ? 20 : finisher ? 12 : 0);
    const baseDamage = heavy
      ? battle.tuning.heavyDamage
      : battle.tuning.lightDamage * (attack.step === 2 ? 1.08 : finisher ? 1.32 * battle.tuning.comboFinisher : 1);

    let damage = baseDamage;
    if (p.empowered) {
      damage *= 1.65;
      p.empowered = false;
      flashMessage("AFTERSTEP — 強化打撃", 520);
    }
    if (battle.tuning.lowHealthRisk && p.hp <= 35) damage *= 1.38;

    let hitSomething = false;
    battle.enemies.forEach((enemy) => {
      if (enemy.hp <= 0 || enemy.deadTimer > 0) return;
      if (distance(enemy, p) > reach + enemy.radius) return;
      const toEnemy = normalized(enemy.x - p.x, enemy.y - p.y);
      const facingDot = toEnemy.x * p.facingX + toEnemy.y * p.facingY;
      if (facingDot < 0.15) return;

      if (enemy.kind === "guard" && enemy.guarding && !heavy && !finisher) {
        enemy.stagger = 0.10;
        spawnBurst(enemy.x, enemy.y, 8, "#d4c18c");
        battle.hitStop = 0.025;
        battle.shake = Math.max(battle.shake, 2);
        addText(enemy.x, enemy.y - 44, "BLOCK", "#dfcf9b");
        flashMessage("盾に弾かれた — 重攻撃で崩せ", 600);
        hitSomething = true;
        return;
      }

      let dealt = damage;
      if (enemy.kind === "guard" && enemy.guarding && (heavy || finisher)) {
        dealt *= heavy ? 1.2 : 0.9;
        enemy.guarding = false;
        enemy.guardCycle = 1.3;
        addText(enemy.x, enemy.y - 48, "GUARD BREAK", "#f2c96f");
      }

      enemy.hp = Math.max(0, enemy.hp - dealt);
      enemy.hitFlash = 0.13;
      const staggerScale = heavy ? battle.tuning.heavyStagger : 1;
      enemy.stagger = heavy ? 0.42 * staggerScale : finisher ? 0.30 : 0.12;
      const knock = heavy ? 42 * staggerScale : finisher ? 34 : 10;
      enemy.vx += toEnemy.x * knock * 3.2;
      enemy.vy += toEnemy.y * knock * 3.2;
      spawnBurst(enemy.x, enemy.y, heavy ? 15 : finisher ? 12 : 8, heavy ? "#f0c96a" : "#e6d0a7");
      battle.slashes.push({
        x: p.x + p.facingX * 28,
        y: p.y + p.facingY * 28,
        angle: Math.atan2(p.facingY, p.facingX),
        life: 0.13,
        heavy,
        finisher
      });
      battle.hitStop = Math.max(battle.hitStop, heavy ? 0.075 : finisher ? 0.060 : 0.035);
      battle.shake = Math.max(battle.shake, heavy ? 8 : finisher ? 6 : 3);
      addText(enemy.x, enemy.y - 43, `${Math.round(dealt)}`, heavy ? "#ffd875" : "#f5e0bd");
      hitSomething = true;

      if (enemy.hp <= 0) {
        enemy.deadTimer = 0.46;
        enemy.stagger = 1;
        enemy.vx += toEnemy.x * 210;
        enemy.vy += toEnemy.y * 210;
        addText(enemy.x, enemy.y - 58, "DOWN", "#d96858");
      }
    });

    if (!hitSomething) {
      battle.slashes.push({
        x: p.x + p.facingX * 31,
        y: p.y + p.facingY * 31,
        angle: Math.atan2(p.facingY, p.facingX),
        life: 0.10,
        heavy,
        finisher
      });
    }

    updateCombatHud();
    if (battle.enemies.every((enemy) => enemy.hp <= 0)) finishVictory();
  }

  function updateEnemy(enemy, dt) {
    if (enemy.hp <= 0) {
      enemy.deadTimer = Math.max(0, enemy.deadTimer - dt);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.vx *= 0.90;
      enemy.vy *= 0.90;
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
      if (enemy.guardCycle < 1.18 && enemy.recover <= 0 && enemy.telegraph <= 0) enemy.guarding = true;
      else if (enemy.guardCycle > 1.5) enemy.guarding = false;
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
    else if (enemy.kind === "guard") updateGuard(enemy, dt);
    else updateRusher(enemy, dt);

    enemy.x = clamp(enemy.x, 50, canvas.width - 50);
    enemy.y = clamp(enemy.y, 76, canvas.height - 42);
  }

  function updateRusher(enemy, dt) {
    const p = battle.player;
    const toPlayer = normalized(p.x - enemy.x, p.y - enemy.y);
    const dist = distance(enemy, p);

    if (dist > enemy.attackRange) {
      enemy.x += toPlayer.x * enemy.moveSpeed * dt;
      enemy.y += toPlayer.y * enemy.moveSpeed * dt;
    }

    if (dist <= enemy.attackRange + 8 && enemy.attackCooldown <= 0) startEnemyTelegraph(enemy, 0.34);
  }

  function updateGuard(enemy, dt) {
    const p = battle.player;
    const toPlayer = normalized(p.x - enemy.x, p.y - enemy.y);
    const dist = distance(enemy, p);
    const desired = 70;

    if (dist > desired + 10) {
      enemy.x += toPlayer.x * enemy.moveSpeed * dt;
      enemy.y += toPlayer.y * enemy.moveSpeed * dt;
    } else if (dist < desired - 16) {
      enemy.x -= toPlayer.x * enemy.moveSpeed * 0.45 * dt;
      enemy.y -= toPlayer.y * enemy.moveSpeed * 0.45 * dt;
    }

    if (dist <= enemy.attackRange + 8 && enemy.attackCooldown <= 0 && !enemy.guarding) startEnemyTelegraph(enemy, 0.58);
  }

  function updateSkirmisher(enemy, dt) {
    const p = battle.player;
    const toPlayer = normalized(p.x - enemy.x, p.y - enemy.y);
    const dist = distance(enemy, p);
    const desired = 205;

    if (dist < 145) {
      enemy.x -= toPlayer.x * enemy.moveSpeed * 1.25 * dt;
      enemy.y -= toPlayer.y * enemy.moveSpeed * 1.25 * dt;
    } else if (dist > 255) {
      enemy.x += toPlayer.x * enemy.moveSpeed * 0.9 * dt;
      enemy.y += toPlayer.y * enemy.moveSpeed * 0.9 * dt;
    } else {
      const tangent = { x: -toPlayer.y * enemy.strafeDir, y: toPlayer.x * enemy.strafeDir };
      enemy.x += tangent.x * enemy.moveSpeed * 0.65 * dt;
      enemy.y += tangent.y * enemy.moveSpeed * 0.65 * dt;
      if (Math.abs(dist - desired) > 18) {
        const correction = dist > desired ? 1 : -1;
        enemy.x += toPlayer.x * enemy.moveSpeed * 0.25 * correction * dt;
        enemy.y += toPlayer.y * enemy.moveSpeed * 0.25 * correction * dt;
      }
    }

    if (enemy.attackCooldown <= 0 && dist <= 310) startEnemyTelegraph(enemy, 0.78);
  }

  function startEnemyTelegraph(enemy, duration) {
    enemy.telegraph = duration;
    enemy.telegraphTotal = duration;
    enemy.guarding = false;
  }

  function resolveEnemyMelee(enemy) {
    const p = battle.player;
    enemy.attackCooldown = enemy.kind === "rusher" ? 0.82 : 1.28;
    enemy.recover = enemy.kind === "rusher" ? 0.18 : 0.34;
    const range = enemy.attackRange + 17;

    if (distance(enemy, p) > range) {
      addText(enemy.x, enemy.y - 44, "MISS", "#9b9b91");
      return;
    }

    if (p.invulnerable > 0) {
      perfectEvade(enemy.x, enemy.y);
      return;
    }

    damagePlayer(enemy.damage, enemy.x, enemy.y);
  }

  function launchProjectile(enemy) {
    const p = battle.player;
    enemy.attackCooldown = 1.65;
    enemy.recover = 0.25;
    const dir = normalized(p.x - enemy.x, p.y - enemy.y);
    battle.projectiles.push({
      x: enemy.x + dir.x * 24,
      y: enemy.y + dir.y * 24,
      vx: dir.x * 360,
      vy: dir.y * 360,
      radius: 7,
      damage: enemy.damage,
      life: 1.8
    });
    spawnBurst(enemy.x, enemy.y, 5, "#b9c59d");
  }

  function updateProjectiles(dt) {
    const p = battle.player;
    battle.projectiles.forEach((projectile) => {
      if (projectile.life <= 0) return;
      projectile.life -= dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;

      if (distance(projectile, p) <= projectile.radius + 18) {
        projectile.life = 0;
        if (p.invulnerable > 0) perfectEvade(projectile.x, projectile.y);
        else damagePlayer(projectile.damage, projectile.x, projectile.y);
      }
    });
    battle.projectiles = battle.projectiles.filter((projectile) =>
      projectile.life > 0 &&
      projectile.x > -30 &&
      projectile.x < canvas.width + 30 &&
      projectile.y > -30 &&
      projectile.y < canvas.height + 30
    );
  }

  function perfectEvade(x, y) {
    const p = battle.player;
    const perfect = p.evadeAge < 0.19;
    if (perfect) {
      p.empowered = true;
      flashMessage("PERFECT EVADE — 次の一撃が強化", 850);
      addText(p.x, p.y - 50, "PERFECT", "#d9d9b0");
      battle.hitStop = 0.045;
      battle.shake = Math.max(battle.shake, 3);
    } else {
      flashMessage("EVADE", 320);
    }
    spawnBurst(x, y, 9, "#b8c8b0");
  }

  function damagePlayer(amount, sourceX, sourceY) {
    const p = battle.player;
    let incoming = amount;
    if (battle.tuning.lowHealthRisk && p.hp <= 35) incoming *= 1.22;
    p.hp = Math.max(0, p.hp - incoming);
    p.flash = 0.18;
    const away = normalized(p.x - sourceX, p.y - sourceY);
    p.x = clamp(p.x + away.x * 24, 48, canvas.width - 48);
    p.y = clamp(p.y + away.y * 24, 72, canvas.height - 42);
    battle.hitStop = 0.055;
    battle.shake = Math.max(battle.shake, 7);
    spawnBurst(p.x, p.y, 11, "#c95d4e");
    addText(p.x, p.y - 48, `-${Math.round(incoming)}`, "#ef7b66");
    flashMessage(`${Math.round(incoming)} DAMAGE`, 500);
    updateCombatHud();
    if (p.hp <= 0) finishDefeat();
  }

  function performEvade() {
    if (!battle || battle.finished) return;
    const p = battle.player;
    if (p.evadeCooldown > 0) return;

    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (!dx && !dy) {
      dx = p.facingX;
      dy = p.facingY;
    }
    const move = normalized(dx, dy);
    p.x = clamp(p.x + move.x * 105, 48, canvas.width - 48);
    p.y = clamp(p.y + move.y * 105, 72, canvas.height - 42);
    p.facingX = move.x;
    p.facingY = move.y;
    p.invulnerable = 0.32;
    p.evadeAge = 0;
    p.evadeCooldown = 0.68;
    p.attack = null;
    p.bufferedLight = false;
    spawnBurst(p.x, p.y, 8, "#8ea18b");
  }

  function finishVictory() {
    if (!battle || battle.finished) return;
    battle.finished = true;
    stopCombatLoop();
    state = Core.resolveVictory(state, battle.player.hp);
    updateCombatHud();
    window.setTimeout(showLootReveal, 320);
  }

  function finishDefeat() {
    if (!battle || battle.finished) return;
    battle.finished = true;
    const carried = state.expedition.unsecuredLoot.length;
    const lost = carried - Math.floor(carried / 2);
    stopCombatLoop();
    state = Core.resolveDefeat(state);
    lastOutcome = lost > 0 ? `DEFEATED / ${lost} LOOT LOST` : "DEFEATED / RETURNED EMPTY";
    window.setTimeout(() => {
      renderHub();
      window.setTimeout(() => {
        lastOutcome = "";
        runStatus.innerHTML = "<span>GREY HEARTH</span><strong>SAFE</strong>";
      }, 2600);
    }, 520);
  }

  function updateCombatHud() {
    if (!battle) return;
    const hpPercent = clamp((battle.player.hp / battle.player.maxHp) * 100, 0, 100);
    document.getElementById("player-health-bar").style.width = `${hpPercent}%`;
    document.getElementById("player-health-text").textContent = Math.ceil(battle.player.hp);
    const totalEnemyHp = battle.enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0);
    const totalEnemyMax = battle.enemies.reduce((sum, enemy) => sum + enemy.maxHealth, 0) || 1;
    document.getElementById("enemy-health-bar").style.width = `${(totalEnemyHp / totalEnemyMax) * 100}%`;
    document.getElementById("enemy-count").textContent = battle.enemies.filter((enemy) => enemy.hp > 0).length;
  }

  function flashMessage(text, duration = 700) {
    const element = document.getElementById("combat-message");
    element.textContent = text;
    element.classList.add("show");
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => element.classList.remove("show"), duration);
  }

  function spawnBurst(x, y, count, color) {
    if (!battle) return;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 120;
      battle.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.22 + Math.random() * 0.30,
        color
      });
    }
  }

  function addText(x, y, value, color) {
    if (!battle) return;
    battle.texts.push({ x, y, value, color, life: 0.62 });
  }

  function renderStillScene(discovery) {
    battle = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround(discovery ? discovery.palette : "road", 0);
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#16130f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function drawBattle() {
    if (!battle) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shakeX = battle.shake ? (Math.random() - 0.5) * battle.shake : 0;
    const shakeY = battle.shake ? (Math.random() - 0.5) * battle.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    const discovery = state.expedition && state.expedition.lastDiscovery;
    drawGround(discovery ? discovery.palette : "road", battle.elapsed);
    battle.projectiles.forEach(drawProjectile);
    battle.enemies.forEach(drawEnemy);
    drawPlayer();
    battle.slashes.forEach(drawSlash);

    battle.particles.forEach((particle) => {
      ctx.globalAlpha = Math.min(1, particle.life * 4);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    battle.texts.forEach((text) => {
      ctx.globalAlpha = Math.min(1, text.life * 2.2);
      ctx.fillStyle = text.color;
      ctx.font = "700 14px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(text.value, text.x, text.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGround(palette, elapsed) {
    const palettes = {
      chapel: ["#17140f", "#262017", "#8b7449"],
      woods: ["#10150f", "#1b281a", "#65714f"],
      road: ["#17150f", "#272219", "#857452"],
      marsh: ["#0f1716", "#172522", "#55766e"],
      hill: ["#18140f", "#2a2017", "#98734b"],
      cut: ["#151315", "#261e24", "#785e70"]
    };
    const colors = palettes[palette] || palettes.road;
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, colors[1]);
    gradient.addColorStop(1, colors[0]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = `${colors[2]}22`;
    ctx.lineWidth = 1;
    for (let y = 110; y < canvas.height; y += 68) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(230, y - 16, 610, y + 20, canvas.width, y - 8);
      ctx.stroke();
    }

    if (palette === "woods" || palette === "marsh") {
      ctx.fillStyle = `${colors[2]}14`;
      for (let i = 0; i < 8; i += 1) {
        const x = 70 + i * 130 + Math.sin(elapsed * 0.3 + i) * 6;
        ctx.fillRect(x, 70, 12, 330);
      }
    }

    if (palette === "chapel" || palette === "cut") {
      ctx.strokeStyle = `${colors[2]}28`;
      ctx.lineWidth = 8;
      ctx.strokeRect(90, 80, 250, 350);
      ctx.strokeRect(620, 120, 210, 300);
    }

    const vignette = ctx.createRadialGradient(480, 270, 90, 480, 270, 560);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.46)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawPlayer() {
    const p = battle.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.facingY, p.facingX));

    const attackLean = p.attack ? Math.sin(Math.min(1, p.attack.elapsed / p.attack.activeAt) * Math.PI) * 5 : 0;
    ctx.translate(attackLean, 0);
    ctx.fillStyle = p.flash > 0 ? "#ef8c75" : p.invulnerable > 0 ? "#d9e1d2" : "#d8c39a";
    ctx.strokeStyle = "#211b14";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(0, -18, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 17);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(18, p.attack ? -6 : 4);
    ctx.moveTo(0, 3);
    ctx.lineTo(-13, 10);
    ctx.moveTo(0, 17);
    ctx.lineTo(11, 34);
    ctx.moveTo(0, 17);
    ctx.lineTo(-10, 34);
    ctx.stroke();

    if (p.empowered) {
      ctx.strokeStyle = "#e3c66e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 6, 31, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(enemy) {
    if (enemy.hp <= 0 && enemy.deadTimer <= 0) return;
    const p = battle.player;
    const toward = normalized(p.x - enemy.x, p.y - enemy.y);
    const angle = Math.atan2(toward.y, toward.x);
    const alpha = enemy.hp <= 0 ? clamp(enemy.deadTimer / 0.46, 0, 1) : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(angle);

    if (enemy.telegraph > 0) {
      const pulse = 1 - enemy.telegraph / enemy.telegraphTotal;
      ctx.strokeStyle = enemy.kind === "skirmisher" ? `rgba(226,194,108,${0.35 + pulse * 0.6})` : `rgba(220,77,62,${0.35 + pulse * 0.6})`;
      ctx.lineWidth = 3 + pulse * 4;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 16 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();

      if (enemy.kind === "skirmisher") {
        ctx.strokeStyle = `rgba(230,210,145,${0.25 + pulse * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(180, 0);
        ctx.stroke();
      }
    }

    const base = enemy.kind === "guard" ? "#77705c" : enemy.kind === "skirmisher" ? "#6f7658" : "#934d43";
    ctx.fillStyle = enemy.hitFlash > 0 ? "#f0b28c" : base;
    ctx.strokeStyle = "#1b1713";
    ctx.lineWidth = enemy.kind === "guard" ? 7 : 5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(0, -18, enemy.kind === "skirmisher" ? 9 : 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 18);
    ctx.stroke();

    if (enemy.kind === "rusher") {
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(20, 8);
      ctx.moveTo(0, 2);
      ctx.lineTo(-14, 9);
      ctx.moveTo(0, 18);
      ctx.lineTo(14, 34);
      ctx.moveTo(0, 18);
      ctx.lineTo(-9, 35);
      ctx.stroke();
    } else if (enemy.kind === "guard") {
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(14, 5);
      ctx.moveTo(0, 18);
      ctx.lineTo(12, 34);
      ctx.moveTo(0, 18);
      ctx.lineTo(-11, 34);
      ctx.stroke();
      if (enemy.guarding) {
        ctx.fillStyle = "#b19a67";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(13, -8, 13, 31, 5);
        else ctx.rect(13, -8, 13, 31);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(15, -4);
      ctx.moveTo(0, 2);
      ctx.lineTo(-12, 12);
      ctx.moveTo(0, 18);
      ctx.lineTo(9, 35);
      ctx.moveTo(0, 18);
      ctx.lineTo(-13, 33);
      ctx.stroke();
      ctx.strokeStyle = "#b7a77b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(17, 0, 13, -1.1, 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(22, -12);
      ctx.lineTo(22, 12);
      ctx.stroke();
    }

    ctx.restore();

    if (enemy.hp > 0) {
      const ratio = enemy.hp / enemy.maxHealth;
      ctx.fillStyle = "rgba(0,0,0,.5)";
      ctx.fillRect(enemy.x - 25, enemy.y - enemy.radius - 29, 50, 4);
      ctx.fillStyle = enemy.kind === "skirmisher" ? "#879064" : enemy.kind === "guard" ? "#aa9362" : "#a95649";
      ctx.fillRect(enemy.x - 25, enemy.y - enemy.radius - 29, 50 * ratio, 4);

      ctx.fillStyle = "rgba(235,226,204,.55)";
      ctx.font = "700 9px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      const label = enemy.kind === "rusher" ? "RUSHER" : enemy.kind === "guard" ? "GUARD" : "SKIRMISHER";
      ctx.fillText(label, enemy.x, enemy.y - enemy.radius - 36);
    }
    ctx.globalAlpha = 1;
  }

  function drawProjectile(projectile) {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(angle);
    ctx.strokeStyle = "#d9c993";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.fillStyle = "#f1ddb0";
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(5, -4);
    ctx.lineTo(5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSlash(slash) {
    const alpha = clamp(slash.life / 0.13, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(slash.x, slash.y);
    ctx.rotate(slash.angle);
    ctx.strokeStyle = slash.heavy ? "#ffd875" : slash.finisher ? "#f2c96f" : "#e8d8b7";
    ctx.lineWidth = slash.heavy ? 6 : slash.finisher ? 5 : 3;
    ctx.beginPath();
    ctx.arc(0, 0, slash.heavy ? 51 : 38, -0.85, 0.85);
    ctx.stroke();
    ctx.restore();
  }

  function mapKey(code, down) {
    if (["ArrowUp", "KeyW"].includes(code)) input.up = down;
    if (["ArrowDown", "KeyS"].includes(code)) input.down = down;
    if (["ArrowLeft", "KeyA"].includes(code)) input.left = down;
    if (["ArrowRight", "KeyD"].includes(code)) input.right = down;
  }

  window.addEventListener("keydown", (event) => {
    if (!screens.combat.classList.contains("active") || !battle) return;
    mapKey(event.code, true);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === "KeyJ") performLight();
    if (event.code === "KeyK") performHeavy();
    if (event.code === "Space") performEvade();
  });

  window.addEventListener("keyup", (event) => mapKey(event.code, false));

  document.querySelectorAll("[data-move]").forEach((button) => {
    const direction = button.dataset.move;
    const start = (event) => { event.preventDefault(); input[direction] = true; };
    const end = (event) => { event.preventDefault(); input[direction] = false; };
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("pointerleave", end);
  });

  document.getElementById("touch-light").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    performLight();
  });
  document.getElementById("touch-heavy").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    performHeavy();
  });
  document.getElementById("touch-evade").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    performEvade();
  });

  document.getElementById("start-expedition").addEventListener("click", () => {
    state = Core.beginExpedition(state, Date.now());
    renderExplore();
  });

  document.getElementById("continue-expedition").addEventListener("click", () => {
    state = Core.continueExpedition(state);
    renderExplore();
  });

  document.getElementById("return-home").addEventListener("click", () => {
    const count = state.expedition.unsecuredLoot.length;
    state = Core.returnHome(state);
    lastOutcome = count ? `${count} LOOT SECURED` : "RETURNED SAFE";
    renderHub();
    window.setTimeout(() => {
      lastOutcome = "";
      runStatus.innerHTML = "<span>GREY HEARTH</span><strong>SAFE</strong>";
    }, 2500);
  });

  document.getElementById("return-from-explore").addEventListener("click", () => {
    const count = state.expedition.unsecuredLoot.length;
    state = Core.returnHome(state);
    lastOutcome = count ? `${count} LOOT SECURED` : "TURNED BACK";
    renderHub();
    window.setTimeout(() => {
      lastOutcome = "";
      runStatus.innerHTML = "<span>GREY HEARTH</span><strong>SAFE</strong>";
    }, 2500);
  });

  document.getElementById("loot-reveal-continue").addEventListener("click", renderDecision);

  renderHub();
})();
