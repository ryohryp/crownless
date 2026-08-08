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
      <p>${item.description}</p>
      <em>${item.modifier.description}</em>
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
    hideLootReveal();

    const equipped = Core.getEquippedItem(state);
    document.getElementById("equipped-label").textContent = equipped ? equipped.name : "素手";
    document.getElementById("loadout-title").textContent = equipped ? equipped.name : "拳だけで出る";
    document.getElementById("loadout-description").textContent = equipped
      ? equipped.modifier.description
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
    hideLootReveal();
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
            <label>危険 ${pips(choice.risk, "risk")}</label>
            <label>期待 ${pips(choice.reward, "reward")}</label>
          </div>
        </div>
      `;
      card.addEventListener("click", () => enterLead(choice.choiceId));
      leads.appendChild(card);
    });

    const carried = exp.unsecuredLoot.length;
    const riskCopy = document.getElementById("carried-warning");
    riskCopy.classList.toggle("hot", carried > 0);
    riskCopy.innerHTML = carried
      ? `<strong>${carried}個の戦利品はまだ自分の物ではない。</strong><span>倒れれば失う。今なら帰れる。</span>`
      : `<strong>まだ失う物はない。</strong><span>だからこそ、最初の一歩は軽い。</span>`;

    showScreen("explore");
  }

  function enterLead(choiceId) {
    state = Core.discoverLocation(state, choiceId);
    const discovery = state.expedition.encounter.discovery;
    document.getElementById("combat-location").textContent = discovery.name;
    document.getElementById("combat-title").textContent = discovery.kicker;
    document.getElementById("combat-flavor").textContent = discovery.flavor;
    document.getElementById("arena-wrap").dataset.palette = discovery.palette;
    showScreen("combat");
    startCombat();
  }

  function renderDecision() {
    hideLootReveal();
    const exp = state.expedition;
    const loot = document.getElementById("unsecured-loot");
    loot.innerHTML = "";
    exp.unsecuredLoot.slice().reverse().forEach((item) => loot.appendChild(lootCard(item, false)));

    document.getElementById("decision-depth").textContent = exp.depth + 1;
    document.getElementById("decision-hp").textContent = exp.health;
    document.getElementById("decision-count").textContent = exp.unsecuredLoot.length;
    document.getElementById("decision-place").textContent = exp.lastDiscovery ? exp.lastDiscovery.name : "名もない場所";

    const nextRisk = exp.health <= 35
      ? "傷が深い。次の一戦はかなり危険だ。"
      : exp.unsecuredLoot.length >= 2
        ? "荷が重くなってきた。欲張るほど、帰路は長く感じる。"
        : "まだ進める。だからこそ、帰る判断が難しい。";
    document.getElementById("decision-risk-copy").textContent = nextRisk;

    showScreen("decision");
  }

  function startCombat() {
    stopCombatLoop();
    const tuning = Core.getCombatTuning(state);
    const defs = state.expedition.encounter.enemies;
    const enemies = defs.map((enemy, index) => ({
      ...enemy,
      x: 650 + index * 92,
      y: 300 + (index % 2 ? 78 : -45),
      hp: enemy.maxHealth,
      vx: 0,
      vy: 0,
      radius: enemy.kind === "guard" ? 28 : 25,
      attackCooldown: 0.65 + index * 0.28,
      telegraph: 0,
      telegraphTotal: 0,
      recover: 0,
      stagger: 0,
      hitFlash: 0,
      guarding: enemy.kind === "guard",
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
      hitStop: 0,
      shake: 0,
      elapsed: 0,
      finished: false
    };

    updateCombatHud();
    flashMessage(`敵 ${enemies.length}体 — 攻撃の前兆を見ろ`, 1200);
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
    battle.shake = Math.max(0, battle.shake - dt * 20);
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
    p.y = clamp(p.y, 70, canvas.height - 42);

    battle.enemies.forEach((enemy) => updateEnemy(enemy, dt));

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
      const lunge = attack.kind === "heavy" ? 24 : 18 + attack.step * 4;
      p.x = clamp(p.x + p.facingX * lunge, 48, canvas.width - 48);
      p.y = clamp(p.y + p.facingY * lunge, 70, canvas.height - 42);
    }

    if (!attack.didHit && attack.elapsed >= attack.activeAt) {
      attack.didHit = true;
      applyAttackHits(attack);
    }

    if (attack.elapsed >= attack.duration) {
      const wasLight = attack.kind === "light";
      p.attack = null;
      if (wasLight) {
        p.comboTimer = 0.43;
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
      if (p.attack.kind === "light" && p.attack.elapsed > p.attack.duration * 0.48) p.bufferedLight = true;
      return;
    }

    const tempo = battle.tuning.style === "unarmed" ? battle.tuning.unarmedTempo : 1;
    p.comboStep = p.comboTimer > 0 ? (p.comboStep % 3) + 1 : 1;
    const step = p.comboStep;
    const durations = [0, 0.27, 0.30, 0.39];
    const active = [0, 0.085, 0.095, 0.13];
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
    addSlash(step === 3 ? "finisher" : "light");
  }

  function performHeavy() {
    if (!battle || battle.finished) return;
    const p = battle.player;
    if (p.attack) return;
    p.comboStep = 0;
    p.comboTimer = 0;
    p.attack = {
      kind: "heavy",
      step: 0,
      elapsed: 0,
      duration: 0.64,
      activeAt: 0.34,
      didHit: false,
      lunged: false
    };
    addSlash("heavy");
    flashMessage("HEAVY — 踏み込め", 420);
  }

  function applyAttackHits(attack) {
    const p = battle.player;
    const heavy = attack.kind === "heavy";
    const finisher = !heavy && attack.step === 3;
    const reach = battle.tuning.reach + (heavy ? 28 : attack.step * 5);
    let damage = heavy
      ? battle.tuning.heavyDamage
      : battle.tuning.lightDamage * (attack.step === 1 ? 0.82 : attack.step === 2 ? 0.94 : 1.34 * battle.tuning.comboFinisher);

    if (p.empowered) {
      damage *= 1.55;
      p.empowered = false;
      flashMessage("AFTERSTEP STRIKE", 500);
    }
    if (battle.tuning.lowHealthRisk && p.hp <= 35) damage *= 1.38;

    let hitAny = false;
    battle.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const dist = distance(p, enemy);
      if (dist > reach + enemy.radius) return;
      const toEnemy = normalized(enemy.x - p.x, enemy.y - p.y);
      const dot = toEnemy.x * p.facingX + toEnemy.y * p.facingY;
      if (dot < 0.05) return;

      if (enemy.kind === "guard" && enemy.guarding && !heavy && !finisher) {
        enemy.stagger = 0.12;
        enemy.vx += toEnemy.x * 35;
        enemy.vy += toEnemy.y * 35;
        spawnImpact(enemy.x, enemy.y, "#d9c28d", 9);
        battle.hitStop = 0.045;
        battle.shake = 2;
        addText(enemy.x, enemy.y - 38, "BLOCK", "#e5d09c");
        hitAny = true;
        return;
      }

      const guardBreak = enemy.kind === "guard" && enemy.guarding && (heavy || finisher);
      if (guardBreak) enemy.guarding = false;

      const dealt = damage * (guardBreak ? 1.12 : 1);
      enemy.hp = Math.max(0, enemy.hp - dealt);
      enemy.hitFlash = 0.12;
      enemy.telegraph = 0;
      enemy.recover = 0.18;
      enemy.stagger = heavy ? 0.48 * battle.tuning.heavyStagger : finisher ? 0.34 : 0.16;

      const knock = heavy ? 105 * battle.tuning.heavyStagger : finisher ? 88 : 38 + attack.step * 8;
      enemy.vx += toEnemy.x * knock;
      enemy.vy += toEnemy.y * knock;

      spawnImpact(enemy.x, enemy.y, heavy ? "#ffd27a" : "#f2e1bd", heavy ? 18 : finisher ? 15 : 9);
      battle.hitStop = Math.max(battle.hitStop, heavy ? 0.095 : finisher ? 0.078 : 0.052);
      battle.shake = Math.max(battle.shake, heavy ? 8 : finisher ? 6 : 3);
      addText(enemy.x, enemy.y - 40, String(Math.round(dealt)), heavy ? "#ffd27a" : "#f5ead4");
      hitAny = true;

      if (enemy.hp <= 0) {
        enemy.deadTimer = 0.65;
        enemy.vx += toEnemy.x * 125;
        enemy.vy += toEnemy.y * 125;
        spawnImpact(enemy.x, enemy.y, "#b94f42", 26);
        addText(enemy.x, enemy.y - 55, "DOWN", "#e76e5b");
      }
    });

    if (hitAny) updateCombatHud();
    if (battle.enemies.every((enemy) => enemy.hp <= 0)) finishVictory();
  }

  function updateEnemy(enemy, dt) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.recover = Math.max(0, enemy.recover - dt);
    enemy.stagger = Math.max(0, enemy.stagger - dt);

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.vx *= Math.pow(0.04, dt);
    enemy.vy *= Math.pow(0.04, dt);

    if (enemy.hp <= 0) {
      enemy.deadTimer = Math.max(0, enemy.deadTimer - dt);
      return;
    }

    const p = battle.player;
    const toPlayer = normalized(p.x - enemy.x, p.y - enemy.y);
    const dist = distance(enemy, p);

    if (enemy.telegraph > 0) {
      enemy.telegraph -= dt;
      if (enemy.telegraph <= 0) enemyStrike(enemy);
      return;
    }

    if (enemy.stagger > 0 || enemy.recover > 0) return;

    if (enemy.kind === "guard") {
      enemy.guarding = enemy.attackCooldown > 0.55;
    }

    const desired = enemy.kind === "rusher" ? 66 : 82;
    const speed = enemy.kind === "rusher" ? 112 : 78;

    if (dist > desired) {
      enemy.x += toPlayer.x * speed * dt;
      enemy.y += toPlayer.y * speed * dt;
    } else if (enemy.attackCooldown <= 0) {
      enemy.telegraphTotal = enemy.kind === "rusher" ? 0.48 : 0.68;
      enemy.telegraph = enemy.telegraphTotal;
      enemy.guarding = false;
      flashMessage(enemy.kind === "rusher" ? "来る。" : "大振りが来る。", 420);
    }
  }

  function enemyStrike(enemy) {
    const p = battle.player;
    enemy.attackCooldown = enemy.kind === "rusher" ? 1.05 : 1.42;
    enemy.recover = 0.34;
    const toPlayer = normalized(p.x - enemy.x, p.y - enemy.y);
    enemy.x += toPlayer.x * 24;
    enemy.y += toPlayer.y * 24;

    battle.slashes.push({
      x: enemy.x,
      y: enemy.y,
      angle: Math.atan2(toPlayer.y, toPlayer.x),
      life: 0.16,
      maxLife: 0.16,
      kind: "enemy"
    });

    if (distance(enemy, p) > (enemy.kind === "rusher" ? 86 : 102)) return;

    if (p.invulnerable > 0) {
      const perfect = p.evadeAge <= 0.19;
      spawnImpact(p.x, p.y, perfect ? "#fff0a8" : "#b6cbd2", perfect ? 18 : 10);
      if (perfect) {
        battle.hitStop = 0.075;
        battle.shake = 4;
        p.empowered = true;
        enemy.stagger = 0.55;
        enemy.vx -= toPlayer.x * 45;
        enemy.vy -= toPlayer.y * 45;
        addText(p.x, p.y - 48, "PERFECT", "#fff0a8");
        flashMessage("PERFECT EVADE — 次の一撃を叩き込め", 850);
      }
      return;
    }

    let incoming = enemy.damage;
    if (battle.tuning.lowHealthRisk && p.hp <= 35) incoming *= 1.22;
    p.hp = Math.max(0, p.hp - incoming);
    p.flash = 0.18;
    p.attack = null;
    p.comboStep = 0;
    p.comboTimer = 0;
    p.x = clamp(p.x + toPlayer.x * 18, 48, canvas.width - 48);
    p.y = clamp(p.y + toPlayer.y * 18, 70, canvas.height - 42);
    spawnImpact(p.x, p.y, "#d95c4c", 16);
    battle.hitStop = 0.065;
    battle.shake = 7;
    addText(p.x, p.y - 48, `-${Math.round(incoming)}`, "#ff7b69");
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
    p.attack = null;
    p.bufferedLight = false;
    p.x = clamp(p.x + move.x * 108, 48, canvas.width - 48);
    p.y = clamp(p.y + move.y * 108, 70, canvas.height - 42);
    p.facingX = move.x;
    p.facingY = move.y;
    p.invulnerable = 0.34;
    p.evadeCooldown = 0.68;
    p.evadeAge = 0;
    spawnTrail(p.x, p.y, "#a9c0b7", 10);
  }

  function spawnImpact(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 150;
      battle.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.18 + Math.random() * 0.28,
        size: 2 + Math.random() * 4,
        color
      });
    }
  }

  function spawnTrail(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      battle.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        life: 0.2 + Math.random() * 0.22,
        size: 3 + Math.random() * 4,
        color
      });
    }
  }

  function addText(x, y, text, color) {
    battle.texts.push({ x, y, text, color, life: 0.65 });
  }

  function addSlash(kind) {
    const p = battle.player;
    battle.slashes.push({
      x: p.x,
      y: p.y,
      angle: Math.atan2(p.facingY, p.facingX),
      life: kind === "heavy" ? 0.42 : 0.23,
      maxLife: kind === "heavy" ? 0.42 : 0.23,
      kind
    });
  }

  function finishVictory() {
    if (!battle || battle.finished) return;
    battle.finished = true;
    stopCombatLoop();
    const remainingHp = battle.player.hp;
    state = Core.resolveVictory(state, remainingHp);
    updateCombatHud();
    window.setTimeout(showLootReveal, 260);
  }

  function showLootReveal() {
    const ids = state.expedition.lastLootIds || [];
    const items = state.expedition.unsecuredLoot.filter((item) => ids.includes(item.id));
    const list = document.getElementById("loot-reveal-items");
    list.innerHTML = "";
    items.forEach((item) => list.appendChild(lootCard(item, false, true)));
    const place = state.expedition.lastDiscovery;
    document.getElementById("loot-reveal-place").textContent = place ? place.name : "戦場";
    lootReveal.classList.add("active");
  }

  function hideLootReveal() {
    lootReveal.classList.remove("active");
  }

  function finishDefeat() {
    if (!battle || battle.finished) return;
    battle.finished = true;
    const carried = state.expedition.unsecuredLoot.length;
    const lost = carried - Math.floor(carried / 2);
    stopCombatLoop();
    state = Core.resolveDefeat(state);
    lastOutcome = lost ? `敗北 / ${lost}個喪失` : "敗北 / 手ぶらで帰還";
    window.setTimeout(() => {
      renderHub();
      window.setTimeout(() => {
        lastOutcome = "";
        if (!state.expedition) showScreen("hub");
      }, 2200);
    }, 480);
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

  function drawBattle() {
    if (!battle) return;
    ctx.save();
    const shakeX = battle.shake ? (Math.random() - 0.5) * battle.shake : 0;
    const shakeY = battle.shake ? (Math.random() - 0.5) * battle.shake : 0;
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);
    drawGround();
    drawShadows();
    battle.slashes.forEach(drawSlash);
    battle.enemies.forEach(drawEnemy);
    drawPlayer();
    drawParticles();
    ctx.restore();
    drawTexts();
  }

  function drawGround() {
    const palette = document.getElementById("arena-wrap").dataset.palette || "road";
    const gradients = {
      chapel: ["#1a1916", "#090a09", "#5a5042"],
      woods: ["#141a13", "#080b08", "#314a31"],
      road: ["#1b1813", "#0b0a08", "#5d4c37"],
      marsh: ["#101918", "#070a0a", "#31524e"],
      hill: ["#1b1713", "#090908", "#674530"],
      cut: ["#181413", "#080707", "#583937"]
    };
    const [base, edge, glow] = gradients[palette] || gradients.road;

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const horizon = ctx.createLinearGradient(0, 0, 0, canvas.height);
    horizon.addColorStop(0, `${glow}66`);
    horizon.addColorStop(0.42, `${base}22`);
    horizon.addColorStop(1, edge);
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.moveTo(0, 415);
    ctx.quadraticCurveTo(230, 355, 430, 420);
    ctx.quadraticCurveTo(710, 485, 960, 380);
    ctx.lineTo(960, 540);
    ctx.lineTo(0, 540);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(236,218,180,.055)";
    ctx.lineWidth = 1;
    for (let y = 385; y < 540; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(480, y - 28, 960, y + 6);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(0,0,0,.22)";
    for (let i = 0; i < 8; i += 1) {
      const x = i * 145 - 40;
      ctx.fillRect(x, 90 + (i % 2) * 34, 22, 280);
      ctx.beginPath();
      ctx.moveTo(x - 70, 145);
      ctx.lineTo(x + 11, 35);
      ctx.lineTo(x + 92, 145);
      ctx.closePath();
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(480, 300, 170, 480, 280, 600);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.62)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawShadows() {
    const actors = [battle.player, ...battle.enemies.filter((enemy) => enemy.hp > 0 || enemy.deadTimer > 0)];
    actors.forEach((actor) => {
      ctx.save();
      ctx.translate(actor.x, actor.y + 27);
      ctx.scale(1.8, 0.48);
      ctx.fillStyle = "rgba(0,0,0,.42)";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHumanoid(x, y, facingX, facingY, options = {}) {
    const angle = Math.atan2(facingY, facingX);
    const flash = options.flash;
    const body = flash ? "#ffe2cf" : options.body;
    const accent = options.accent;
    const dead = options.dead || 0;
    const attack = options.attack;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dead ? dead * 1.2 : 0);

    ctx.strokeStyle = body;
    ctx.fillStyle = body;
    ctx.lineCap = "round";

    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 16);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -32, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-3, 13);
    ctx.lineTo(-11, 34);
    ctx.moveTo(3, 13);
    ctx.lineTo(12, 34);
    ctx.stroke();

    const armReach = attack ? 26 + attack * 16 : 21;
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);
    const px = -fy;
    const py = fx;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(fx * armReach + px * 5, -10 + fy * armReach + py * 5);
    ctx.moveTo(0, -8);
    ctx.lineTo(fx * (armReach - 5) - px * 8, -8 + fy * (armReach - 5) - py * 8);
    ctx.stroke();

    if (accent) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-9, -18);
      ctx.lineTo(10, 7);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPlayer() {
    const p = battle.player;
    let attackPose = 0;
    if (p.attack) {
      const t = clamp(p.attack.elapsed / p.attack.duration, 0, 1);
      attackPose = Math.sin(t * Math.PI);
    }
    drawHumanoid(p.x, p.y, p.facingX, p.facingY, {
      body: p.invulnerable > 0 ? "#d9f0e5" : "#ead7ae",
      accent: p.empowered ? "#ffd86b" : "#8a7354",
      flash: p.flash > 0,
      attack: attackPose
    });

    if (p.empowered) {
      ctx.strokeStyle = "rgba(255,216,107,.72)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 3, 38 + Math.sin(battle.elapsed * 9) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(enemy) {
    if (enemy.hp <= 0 && enemy.deadTimer <= 0) return;
    const toward = normalized(battle.player.x - enemy.x, battle.player.y - enemy.y);
    const deadRatio = enemy.hp <= 0 ? 1 - enemy.deadTimer / 0.65 : 0;

    if (enemy.telegraph > 0) {
      const progress = 1 - enemy.telegraph / enemy.telegraphTotal;
      ctx.strokeStyle = `rgba(232,91,67,${0.35 + progress * 0.55})`;
      ctx.lineWidth = 3 + progress * 3;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 38 + progress * 18, -Math.PI * 0.15, Math.PI * 2.15);
      ctx.stroke();

      ctx.fillStyle = `rgba(232,91,67,${0.08 + progress * 0.1})`;
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      const a = Math.atan2(toward.y, toward.x);
      ctx.arc(enemy.x, enemy.y, 105, a - 0.28, a + 0.28);
      ctx.closePath();
      ctx.fill();
    }

    drawHumanoid(enemy.x, enemy.y, toward.x, toward.y, {
      body: enemy.kind === "guard" ? "#aaa084" : "#bb6658",
      accent: enemy.kind === "guard" ? "#d2bd83" : "#5d2924",
      flash: enemy.hitFlash > 0,
      dead: deadRatio
    });

    if (enemy.kind === "guard" && enemy.guarding && enemy.hp > 0) {
      const px = -toward.y;
      const py = toward.x;
      ctx.strokeStyle = "#cbb98a";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(enemy.x + toward.x * 28 + px * 14, enemy.y - 7 + toward.y * 28 + py * 14);
      ctx.lineTo(enemy.x + toward.x * 28 - px * 14, enemy.y - 7 + toward.y * 28 - py * 14);
      ctx.stroke();
    }

    if (enemy.hp > 0) {
      const ratio = enemy.hp / enemy.maxHealth;
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(enemy.x - 29, enemy.y - 58, 58, 5);
      ctx.fillStyle = enemy.telegraph > 0 ? "#e65f4e" : "#a94e44";
      ctx.fillRect(enemy.x - 29, enemy.y - 58, 58 * ratio, 5);
    }
  }

  function drawSlash(slash) {
    const ratio = clamp(slash.life / slash.maxLife, 0, 1);
    ctx.save();
    ctx.translate(slash.x, slash.y);
    ctx.rotate(slash.angle);
    ctx.globalAlpha = ratio;
    ctx.strokeStyle = slash.kind === "enemy" ? "#e66a55" : slash.kind === "heavy" ? "#ffd27a" : "#f3dfb5";
    ctx.lineWidth = slash.kind === "heavy" ? 8 : 4;
    ctx.beginPath();
    ctx.arc(0, -8, slash.kind === "heavy" ? 66 : 48, -0.75, 0.6);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    battle.particles.forEach((particle) => {
      ctx.globalAlpha = clamp(particle.life * 4, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
  }

  function drawTexts() {
    battle.texts.forEach((text) => {
      ctx.save();
      ctx.globalAlpha = clamp(text.life * 2.2, 0, 1);
      ctx.fillStyle = text.color;
      ctx.font = "800 15px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    });
  }

  function mapKey(code, down) {
    if (["ArrowUp", "KeyW"].includes(code)) input.up = down;
    if (["ArrowDown", "KeyS"].includes(code)) input.down = down;
    if (["ArrowLeft", "KeyA"].includes(code)) input.left = down;
    if (["ArrowRight", "KeyD"].includes(code)) input.right = down;
  }

  window.addEventListener("keydown", (event) => {
    if (!screens.combat.classList.contains("active") || lootReveal.classList.contains("active")) return;
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

  document.getElementById("touch-light").addEventListener("pointerdown", (event) => { event.preventDefault(); performLight(); });
  document.getElementById("touch-heavy").addEventListener("pointerdown", (event) => { event.preventDefault(); performHeavy(); });
  document.getElementById("touch-evade").addEventListener("pointerdown", (event) => { event.preventDefault(); performEvade(); });

  document.getElementById("start-expedition").addEventListener("click", () => {
    state = Core.beginExpedition(state, Date.now());
    renderExplore();
  });

  document.getElementById("return-from-explore").addEventListener("click", () => {
    state = Core.returnHome(state);
    lastOutcome = "生還 / 戦利品確保";
    renderHub();
    window.setTimeout(() => { lastOutcome = ""; }, 1800);
  });

  document.getElementById("loot-reveal-continue").addEventListener("click", renderDecision);

  document.getElementById("continue-expedition").addEventListener("click", () => {
    state = Core.continueExpedition(state);
    renderExplore();
  });

  document.getElementById("return-home").addEventListener("click", () => {
    const count = state.expedition.unsecuredLoot.length;
    state = Core.returnHome(state);
    lastOutcome = `生還 / ${count}個確保`;
    renderHub();
    window.setTimeout(() => { lastOutcome = ""; }, 1800);
  });

  renderHub();
})();
