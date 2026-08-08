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

  const runStatus = document.getElementById("run-status");
  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");
  const input = { up: false, down: false, left: false, right: false };

  function showScreen(name) {
    Object.entries(screens).forEach(([key, element]) => element.classList.toggle("active", key === name));
    const activeRun = name !== "hub";
    runStatus.classList.toggle("active", activeRun);
    runStatus.textContent = activeRun ? "EXPEDITION / UNSECURED" : (lastOutcome || "SAFE HAVEN");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function rarityLabel(item) {
    return `${item.rarity} · power ${Math.round(item.power)}`;
  }

  function lootCard(item, secured) {
    const equipped = state.equippedItemId === item.id;
    const card = document.createElement("article");
    card.className = `loot-card${equipped ? " equipped" : ""}`;
    const body = document.createElement("div");
    body.innerHTML = `<small>${rarityLabel(item)}</small><strong>${item.name}</strong><p>${item.modifier.description}</p>`;
    card.appendChild(body);
    if (secured) {
      const button = document.createElement("button");
      button.textContent = equipped ? "装備中" : "装備";
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
    const equipped = Core.getEquippedItem(state);
    document.getElementById("equipped-label").textContent = equipped ? equipped.type.toUpperCase() : "素手";
    const equippedCard = document.getElementById("equipped-card");
    equippedCard.innerHTML = "";
    if (equipped) {
      equippedCard.className = "loot-list";
      equippedCard.appendChild(lootCard(equipped, false));
    } else {
      equippedCard.className = "empty-state";
      equippedCard.textContent = "何も装備していない。拳だけが頼りだ。";
    }

    const secured = document.getElementById("secured-loot");
    secured.innerHTML = "";
    document.getElementById("secured-count").textContent = state.securedLoot.length;
    if (state.securedLoot.length === 0) {
      secured.className = "loot-list empty-state";
      secured.textContent = "まだ何も持ち帰っていない。";
    } else {
      secured.className = "loot-list";
      state.securedLoot.slice().reverse().forEach((item) => secured.appendChild(lootCard(item, true)));
    }

    document.getElementById("stat-runs").textContent = state.stats.expeditionsStarted;
    document.getElementById("stat-survived").textContent = state.stats.expeditionsSurvived;
    document.getElementById("stat-kills").textContent = state.stats.enemiesDefeated;
    document.getElementById("stat-defeats").textContent = state.stats.defeats;
    showScreen("hub");
  }

  function renderExplore() {
    document.getElementById("explore-hp").textContent = state.expedition.health;
    document.getElementById("explore-loot-count").textContent = state.expedition.unsecuredLoot.length;
    const grid = document.getElementById("map-grid");
    grid.innerHTML = "";

    const currentIndex = 7;
    const candidates = [2, 6, 8, 12];
    const labels = { 2: "北へ", 6: "西へ", 8: "東へ", 12: "南へ" };
    for (let i = 0; i < 15; i += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "map-cell";
      if (i === currentIndex) {
        cell.classList.add(state.expedition.depth === 0 ? "hub" : "trail");
        cell.textContent = state.expedition.depth === 0 ? "GREY HEARTH" : `現在地 / 深度 ${state.expedition.depth}`;
      } else if (candidates.includes(i)) {
        cell.classList.add("available");
        cell.textContent = `未知\n${labels[i]}`;
        cell.addEventListener("click", () => enterUnknownCell(labels[i]));
      } else {
        cell.textContent = "霧";
        cell.disabled = true;
      }
      grid.appendChild(cell);
    }

    const carrying = state.expedition.unsecuredLoot.length;
    document.getElementById("map-hint").textContent = carrying
      ? `${carrying}個の未確定戦利品を抱えている。未知へ進むか、確保して戻るか。`
      : "隣接する未知の領域を選べ。位置情報の代わりに移動をシミュレートしている。";
    showScreen("explore");
  }

  function enterUnknownCell(direction) {
    state = Core.discoverNextCell(state);
    const discovery = state.expedition.encounter.discovery;
    document.getElementById("combat-location").textContent = `${direction} / ${discovery.name}`;
    document.getElementById("combat-title").textContent = discovery.flavor;
    showScreen("combat");
    startCombat();
  }

  function renderDecision() {
    const loot = document.getElementById("unsecured-loot");
    loot.innerHTML = "";
    state.expedition.unsecuredLoot.slice().reverse().forEach((item) => loot.appendChild(lootCard(item, false)));
    showScreen("decision");
  }

  function startCombat() {
    stopCombatLoop();
    const tuning = Core.getCombatTuning(state);
    const enemyDefs = state.expedition.encounter.enemies;
    const angleStep = (Math.PI * 2) / enemyDefs.length;
    const enemies = enemyDefs.map((enemy, index) => {
      const angle = index * angleStep + 0.2;
      return {
        ...enemy,
        x: 480 + Math.cos(angle) * (210 + index * 28),
        y: 270 + Math.sin(angle) * (165 + index * 18),
        hp: enemy.maxHealth,
        radius: enemy.kind === "guard" ? 23 : 19,
        attackCooldown: 0.5 + index * 0.3,
        stagger: 0,
        guardCycle: enemy.kind === "guard" ? 0.2 + index * 0.25 : 0,
        guarding: enemy.kind === "guard"
      };
    });

    battle = {
      tuning,
      player: {
        x: 480,
        y: 270,
        radius: 17,
        hp: state.expedition.health,
        maxHp: 100,
        facingX: 1,
        facingY: 0,
        attackCooldown: 0,
        invulnerable: 0,
        evadeCooldown: 0,
        flash: 0,
        empowered: false
      },
      enemies,
      finished: false,
      particles: [],
      elapsed: 0
    };

    updateCombatHud();
    flashMessage(`敵 ${enemies.length}体 — ${tuning.style === "unarmed" ? "拳で生き残れ" : "装備の間合いを使え"}`);
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
    const dt = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    updateBattle(dt);
    drawBattle();
    animationFrame = requestAnimationFrame(combatLoop);
  }

  function normalized(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function updateBattle(dt) {
    const p = battle.player;
    battle.elapsed += dt;
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    p.evadeCooldown = Math.max(0, p.evadeCooldown - dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.flash = Math.max(0, p.flash - dt);

    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx || dy) {
      const move = normalized(dx, dy);
      p.facingX = move.x;
      p.facingY = move.y;
      p.x += move.x * battle.tuning.moveSpeed * dt;
      p.y += move.y * battle.tuning.moveSpeed * dt;
    }
    p.x = clamp(p.x, 28, canvas.width - 28);
    p.y = clamp(p.y, 28, canvas.height - 28);

    battle.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      enemy.stagger = Math.max(0, enemy.stagger - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      if (enemy.kind === "guard") {
        enemy.guardCycle = (enemy.guardCycle + dt) % 2.35;
        enemy.guarding = enemy.guardCycle < 1.15;
      }
      if (enemy.stagger > 0) return;

      const toPlayer = normalized(p.x - enemy.x, p.y - enemy.y);
      const dist = distance(enemy, p);
      const desired = enemy.kind === "rusher" ? 42 : 62;
      const speed = enemy.kind === "rusher" ? 116 : 78;
      if (dist > desired) {
        enemy.x += toPlayer.x * speed * dt;
        enemy.y += toPlayer.y * speed * dt;
      }

      if (dist < desired + 13 && enemy.attackCooldown <= 0) {
        enemy.attackCooldown = enemy.kind === "rusher" ? 1.0 : 1.35;
        if (p.invulnerable > 0) {
          if (battle.tuning.evadeEmpower) {
            p.empowered = true;
            flashMessage("AFTERSTEP — 次の軽攻撃が強化");
          }
          spawnBurst(p.x, p.y, 8, "#b7c5b2");
          return;
        }
        let incoming = enemy.damage;
        if (battle.tuning.lowHealthRisk && p.hp <= 35) incoming *= 1.22;
        p.hp = Math.max(0, p.hp - incoming);
        p.flash = 0.18;
        spawnBurst(p.x, p.y, 9, "#b95649");
        flashMessage(`${Math.round(incoming)} DAMAGE`);
        updateCombatHud();
        if (p.hp <= 0) finishDefeat();
      }
    });

    battle.particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.95;
      particle.vy *= 0.95;
    });
    battle.particles = battle.particles.filter((particle) => particle.life > 0);
  }

  function performAttack(kind) {
    if (!battle || battle.finished) return;
    const p = battle.player;
    if (p.attackCooldown > 0) return;

    const heavy = kind === "heavy";
    const tempo = battle.tuning.style === "unarmed" ? battle.tuning.unarmedTempo : 1;
    p.attackCooldown = (heavy ? 0.66 : 0.27) / tempo;
    const reach = battle.tuning.reach + (heavy ? 14 : 0);
    let damage = heavy ? battle.tuning.heavyDamage : battle.tuning.lightDamage;
    if (!heavy && p.empowered) {
      damage *= 1.65;
      p.empowered = false;
    }
    if (battle.tuning.lowHealthRisk && p.hp <= 35) damage *= 1.38;

    let hit = false;
    battle.enemies.forEach((enemy) => {
      if (enemy.hp <= 0 || distance(enemy, p) > reach + enemy.radius) return;
      const toEnemy = normalized(enemy.x - p.x, enemy.y - p.y);
      const facingDot = toEnemy.x * p.facingX + toEnemy.y * p.facingY;
      if (facingDot < -0.12) return;

      if (enemy.kind === "guard" && enemy.guarding && !heavy) {
        enemy.stagger = 0.12;
        spawnBurst(enemy.x, enemy.y, 7, "#c7b27e");
        flashMessage("BLOCKED — 重攻撃か隙を狙え");
        hit = true;
        return;
      }

      const dealt = heavy && enemy.kind === "guard" ? damage * 1.2 : damage;
      enemy.hp = Math.max(0, enemy.hp - dealt);
      enemy.stagger = heavy ? 0.34 * battle.tuning.heavyStagger : 0.11;
      const knock = heavy ? 21 * battle.tuning.heavyStagger : 7;
      enemy.x += toEnemy.x * knock;
      enemy.y += toEnemy.y * knock;
      spawnBurst(enemy.x, enemy.y, heavy ? 12 : 7, heavy ? "#e2b55c" : "#d7c29d");
      hit = true;
    });

    if (hit) updateCombatHud();
    const alive = battle.enemies.filter((enemy) => enemy.hp > 0);
    if (alive.length === 0) finishVictory();
  }

  function performEvade() {
    if (!battle || battle.finished) return;
    const p = battle.player;
    if (p.evadeCooldown > 0) return;
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (!dx && !dy) { dx = p.facingX; dy = p.facingY; }
    const move = normalized(dx, dy);
    p.x = clamp(p.x + move.x * 92, 28, canvas.width - 28);
    p.y = clamp(p.y + move.y * 92, 28, canvas.height - 28);
    p.invulnerable = 0.34;
    p.evadeCooldown = 0.72;
    spawnBurst(p.x, p.y, 8, "#8ba08a");
  }

  function spawnBurst(x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 80;
      battle.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.28 + Math.random() * 0.28, color });
    }
  }

  function finishVictory() {
    if (!battle || battle.finished) return;
    battle.finished = true;
    stopCombatLoop();
    state = Core.resolveVictory(state, battle.player.hp);
    updateCombatHud();
    flashMessage("VICTORY — 戦利品はまだ未確定だ", 900);
    window.setTimeout(renderDecision, 850);
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
        runStatus.textContent = "SAFE HAVEN";
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

  function drawBattle() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround();
    battle.enemies.forEach(drawEnemy);
    drawPlayer();
    battle.particles.forEach((particle) => {
      ctx.globalAlpha = Math.min(1, particle.life * 4);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    ctx.fillStyle = "#171912";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(204,181,134,0.055)";
    ctx.lineWidth = 1;
    for (let x = -120; x < canvas.width + 120; x += 78) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 240, canvas.height);
      ctx.stroke();
    }
    for (let y = 55; y < canvas.height; y += 95) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(260, y - 28, 650, y + 30, canvas.width, y - 8);
      ctx.stroke();
    }
    const gradient = ctx.createRadialGradient(480, 270, 60, 480, 270, 540);
    gradient.addColorStop(0, "rgba(123,105,67,0.05)");
    gradient.addColorStop(1, "rgba(0,0,0,0.31)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawPlayer() {
    const p = battle.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.flash > 0 ? "#ef8c75" : (p.invulnerable > 0 ? "#cad8c6" : "#d6c19a");
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(25,19,12,.8)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(p.facingX * 23, p.facingY * 23);
    ctx.stroke();
    if (p.empowered) {
      ctx.strokeStyle = "#d9bb72";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(enemy) {
    if (enemy.hp <= 0) return;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.kind === "guard" ? "#786e58" : "#944d43";
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    if (enemy.kind === "guard" && enemy.guarding) {
      const toward = normalized(battle.player.x - enemy.x, battle.player.y - enemy.y);
      const px = -toward.y;
      const py = toward.x;
      ctx.strokeStyle = "#c2ad7e";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(toward.x * 20 + px * 15, toward.y * 20 + py * 15);
      ctx.lineTo(toward.x * 20 - px * 15, toward.y * 20 - py * 15);
      ctx.stroke();
    }
    const ratio = enemy.hp / enemy.maxHealth;
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(-23, -enemy.radius - 13, 46, 4);
    ctx.fillStyle = "#a95649";
    ctx.fillRect(-23, -enemy.radius - 13, 46 * ratio, 4);
    ctx.restore();
  }

  function mapKey(code, down) {
    if (["ArrowUp", "KeyW"].includes(code)) input.up = down;
    if (["ArrowDown", "KeyS"].includes(code)) input.down = down;
    if (["ArrowLeft", "KeyA"].includes(code)) input.left = down;
    if (["ArrowRight", "KeyD"].includes(code)) input.right = down;
  }

  window.addEventListener("keydown", (event) => {
    if (!screens.combat.classList.contains("active")) return;
    mapKey(event.code, true);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === "KeyJ") performAttack("light");
    if (event.code === "KeyK") performAttack("heavy");
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

  document.getElementById("touch-light").addEventListener("pointerdown", (event) => { event.preventDefault(); performAttack("light"); });
  document.getElementById("touch-heavy").addEventListener("pointerdown", (event) => { event.preventDefault(); performAttack("heavy"); });
  document.getElementById("touch-evade").addEventListener("pointerdown", (event) => { event.preventDefault(); performEvade(); });

  document.getElementById("start-expedition").addEventListener("click", () => {
    lastOutcome = "";
    state = Core.beginExpedition(state, Date.now());
    renderExplore();
  });

  document.getElementById("return-from-explore").addEventListener("click", () => {
    state = Core.returnHome(state);
    lastOutcome = "RETURNED / LOOT SECURED";
    renderHub();
    window.setTimeout(() => { lastOutcome = ""; runStatus.textContent = "SAFE HAVEN"; }, 2200);
  });

  document.getElementById("continue-expedition").addEventListener("click", () => {
    state = Core.continueExpedition(state);
    renderExplore();
  });

  document.getElementById("return-home").addEventListener("click", () => {
    const securedCount = state.expedition.unsecuredLoot.length;
    state = Core.returnHome(state);
    lastOutcome = `SURVIVED / ${securedCount} LOOT SECURED`;
    renderHub();
    window.setTimeout(() => { lastOutcome = ""; runStatus.textContent = "SAFE HAVEN"; }, 2600);
  });

  window.addEventListener("blur", () => Object.keys(input).forEach((key) => { input[key] = false; }));

  renderHub();
})();
