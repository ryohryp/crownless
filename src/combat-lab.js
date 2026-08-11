(() => {
  "use strict";

  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");
  const ui = {
    hpBar: document.getElementById("hp-bar"), hpText: document.getElementById("hp-text"),
    stance: document.getElementById("stance"), stanceKicker: document.getElementById("stance-kicker"),
    wave: document.getElementById("wave"), kills: document.getElementById("kills"), message: document.getElementById("message"),
    result: document.getElementById("result"), resultTitle: document.getElementById("result-title"), resultCopy: document.getElementById("result-copy"),
    tech: document.getElementById("technique"), evade: document.getElementById("evade"),
    techCd: document.getElementById("tech-cooldown"), evadeCd: document.getElementById("evade-cooldown"),
    weaponName: document.getElementById("weapon-name"), chain: document.getElementById("chain")
  };

  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;
  const keys = new Set();
  const pointer = { active: false, id: null, startX: 0, startY: 0, x: 0, y: 0 };
  const WEAPONS = {
    fists: {
      label: "拳", range: 108, settle: .10, windup: .05, cooldown: .145, damage: 10, knock: 72,
      techniqueDamage: 43, techniqueRange: 170, techniqueLunge: 38, comboMax: 4,
      copy: "速い。止まり続けるほど四連撃が伸びる。最後の一発が重い。"
    },
    dagger: {
      label: "短剣", range: 88, settle: .065, windup: .025, cooldown: .095, damage: 8, knock: 42,
      techniqueDamage: 36, techniqueRange: 150, techniqueLunge: 64, comboMax: 6,
      copy: "最短距離。止まった瞬間から刺し続ける。危険地帯へ入る勇気が要る。"
    },
    sword: {
      label: "剣", range: 146, settle: .16, windup: .12, cooldown: .34, damage: 27, knock: 165,
      techniqueDamage: 58, techniqueRange: 205, techniqueLunge: 30, comboMax: 2, cleave: true,
      copy: "遅いが長い。構え切れば複数を薙ぐ。欲張るほど危険。"
    }
  };

  let game;
  let selectedWeapon = "fists";
  let last = performance.now();
  let messageTimer = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const length = (x, y) => Math.hypot(x, y);
  const normal = (x, y) => { const n = length(x, y) || 1; return { x: x / n, y: y / n }; };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function weapon() { return WEAPONS[selectedWeapon]; }

  function makePlayer() {
    return {
      x: W * .5, y: H * .68, r: 17, hp: 100, maxHp: 100, speed: 218,
      moving: false, moveX: 0, moveY: 0, facingX: 0, facingY: -1, stationary: 0,
      attackCooldown: 0, attackWindup: 0, attackTarget: null, attackFlash: 0, combo: 0,
      techniqueCooldown: 0, techniqueFlash: 0, evadeCooldown: 0, invulnerable: 0,
      dashTime: 0, dashX: 0, dashY: 0, hurtFlash: 0
    };
  }

  function enemy(kind, x, y) {
    const stats = kind === "archer"
      ? { hp: 42, speed: 60, r: 15 }
      : kind === "brute" ? { hp: 118, speed: 46, r: 22 }
        : { hp: 58, speed: 86, r: 17 };
    return {
      kind, x, y, r: stats.r, hp: stats.hp, maxHp: stats.hp, speed: stats.speed,
      cooldown: .42 + Math.random() * .55, telegraph: 0, telegraphMax: 0, attackType: "",
      aimX: x, aimY: y, dashTime: 0, dashX: 0, dashY: 0, hurt: 0, vx: 0, vy: 0, dead: false
    };
  }

  function spawnWave(number) {
    const layouts = {
      1: [["raider", 160, 145], ["raider", 790, 170], ["archer", 480, 105]],
      2: [["raider", 150, 130], ["raider", 810, 130], ["archer", 205, 365], ["archer", 755, 365], ["brute", 480, 120]],
      3: [["raider", 120, 125], ["raider", 840, 125], ["raider", 145, 410], ["raider", 815, 410], ["archer", 320, 105], ["archer", 640, 105], ["brute", 480, 150]]
    };
    game.wave = number;
    game.enemies = layouts[number].map(([kind, x, y]) => enemy(kind, x, y));
    game.projectiles = [];
    game.nextWave = 0;
    game.player.combo = 0;
    showMessage(number === 1 ? "予兆をずらせ。止まって取り返せ。" : `WAVE ${number} — 敵が空振る場所を作れ。`, 1.35);
    syncUi();
  }

  function reset() {
    game = {
      player: makePlayer(), enemies: [], projectiles: [], sparks: [], texts: [],
      wave: 1, kills: 0, shake: 0, hitStop: 0, nextWave: 0, ended: false, elapsed: 0
    };
    ui.result.classList.remove("show");
    spawnWave(1);
  }

  function selectWeapon(name, announce = true) {
    if (!WEAPONS[name]) return;
    selectedWeapon = name;
    document.querySelectorAll("[data-weapon]").forEach((button) => button.classList.toggle("active", button.dataset.weapon === name));
    if (game) {
      const p = game.player;
      p.attackWindup = 0;
      p.attackTarget = null;
      p.attackCooldown = 0;
      p.combo = 0;
    }
    if (announce) showMessage(`${WEAPONS[name].label} — ${WEAPONS[name].copy}`, 1.15);
    syncUi();
  }

  function showMessage(text, seconds = .8) {
    ui.message.textContent = text;
    ui.message.classList.add("show");
    messageTimer = seconds;
  }

  function inputVector() {
    let x = 0, y = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) y -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) y += 1;
    if (x || y) return normal(x, y);
    if (!pointer.active) return { x: 0, y: 0 };
    const dx = pointer.x - pointer.startX;
    const dy = pointer.y - pointer.startY;
    const mag = length(dx, dy);
    if (mag < 10) return { x: 0, y: 0 };
    const n = normal(dx, dy);
    const strength = clamp(mag / 56, .25, 1);
    return { x: n.x * strength, y: n.y * strength };
  }

  function livingEnemies() { return game.enemies.filter((e) => !e.dead); }
  function nearestEnemy(maxRange = Infinity) {
    const p = game.player;
    let best = null, bestD = maxRange;
    for (const e of livingEnemies()) {
      const d = distance(p, e);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  function resetAttackCommitment() {
    const p = game.player;
    p.stationary = 0;
    p.attackWindup = 0;
    p.attackTarget = null;
    p.combo = 0;
  }

  function updatePlayer(dt) {
    const p = game.player;
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    p.techniqueCooldown = Math.max(0, p.techniqueCooldown - dt);
    p.evadeCooldown = Math.max(0, p.evadeCooldown - dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    p.attackFlash = Math.max(0, p.attackFlash - dt);
    p.techniqueFlash = Math.max(0, p.techniqueFlash - dt);

    if (p.dashTime > 0) {
      p.dashTime = Math.max(0, p.dashTime - dt);
      p.x += p.dashX * 440 * dt;
      p.y += p.dashY * 440 * dt;
      p.moving = true;
      resetAttackCommitment();
    } else {
      const v = inputVector();
      const mag = length(v.x, v.y);
      p.moving = mag > .08;
      p.moveX = v.x;
      p.moveY = v.y;
      if (p.moving) {
        const n = normal(v.x, v.y);
        p.facingX = n.x; p.facingY = n.y;
        p.x += v.x * p.speed * dt;
        p.y += v.y * p.speed * dt;
        resetAttackCommitment();
      } else {
        p.stationary += dt;
        updateAutoStrike(dt);
      }
    }
    p.x = clamp(p.x, 42, W - 42);
    p.y = clamp(p.y, 54, H - 42);
  }

  function strikeDamage(profile, combo) {
    if (selectedWeapon === "fists") return combo === 4 ? 22 : combo === 3 ? 14 : profile.damage;
    if (selectedWeapon === "dagger") return combo === 6 ? 17 : combo % 3 === 0 ? 12 : profile.damage;
    return combo === 2 ? 35 : profile.damage;
  }

  function updateAutoStrike(dt) {
    const p = game.player;
    const profile = weapon();
    const target = nearestEnemy(profile.range);
    if (!target || p.stationary < profile.settle) {
      p.attackWindup = 0;
      p.attackTarget = null;
      return;
    }
    const to = normal(target.x - p.x, target.y - p.y);
    p.facingX = to.x; p.facingY = to.y;
    if (p.attackCooldown > 0) return;
    if (!p.attackWindup) {
      p.attackWindup = profile.windup;
      p.attackTarget = target;
      return;
    }
    p.attackWindup -= dt;
    if (p.attackWindup > 0) return;

    const locked = p.attackTarget;
    p.attackWindup = 0;
    p.attackTarget = null;
    p.attackCooldown = profile.cooldown;
    if (!locked || locked.dead || p.moving || distance(p, locked) > profile.range + 14) return;

    p.combo = (p.combo % profile.comboMax) + 1;
    const damage = strikeDamage(profile, p.combo);
    hitEnemy(locked, damage, profile.knock);
    if (profile.cleave) {
      const facing = normal(locked.x - p.x, locked.y - p.y);
      for (const other of livingEnemies()) {
        if (other === locked || distance(p, other) > profile.range + 10) continue;
        const toward = normal(other.x - p.x, other.y - p.y);
        if (facing.x * toward.x + facing.y * toward.y > .35) hitEnemy(other, Math.round(damage * .72), profile.knock * .72);
      }
    }
    p.attackFlash = selectedWeapon === "sword" ? .16 : .10;
    game.hitStop = selectedWeapon === "sword" ? .055 : .025;
    game.shake = Math.max(game.shake, selectedWeapon === "sword" ? 5.5 : 3.2);
  }

  function hitEnemy(e, damage, knock) {
    const p = game.player;
    const to = normal(e.x - p.x, e.y - p.y);
    e.hp -= damage;
    e.hurt = .13;
    e.vx += to.x * knock;
    e.vy += to.y * knock;
    burst(e.x, e.y, selectedWeapon === "sword" ? 9 : 6, "#e5d7b7");
    textPop(e.x, e.y - e.r, `${Math.round(damage)}`);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      game.kills += 1;
      game.shake = Math.max(game.shake, 7);
      burst(e.x, e.y, 15, e.kind === "brute" ? "#d0a454" : "#9e4d3e");
    }
  }

  function technique() {
    if (game.ended) return;
    const p = game.player;
    const profile = weapon();
    if (p.techniqueCooldown > 0) return;
    const target = nearestEnemy(profile.techniqueRange);
    p.techniqueCooldown = selectedWeapon === "dagger" ? 2.8 : selectedWeapon === "sword" ? 4.1 : 3.4;
    p.techniqueFlash = .22;
    p.attackWindup = 0;
    p.attackTarget = null;
    p.combo = 0;
    if (!target) { showMessage("技は空を切った。", .45); return; }
    const to = normal(target.x - p.x, target.y - p.y);
    p.facingX = to.x; p.facingY = to.y;
    p.x = clamp(p.x + to.x * profile.techniqueLunge, 42, W - 42);
    p.y = clamp(p.y + to.y * profile.techniqueLunge, 54, H - 42);
    hitEnemy(target, profile.techniqueDamage, profile.knock * 1.8);
    game.hitStop = selectedWeapon === "sword" ? .10 : .065;
    game.shake = selectedWeapon === "sword" ? 12 : 9;
  }

  function evade() {
    if (game.ended) return;
    const p = game.player;
    if (p.evadeCooldown > 0 || p.dashTime > 0) return;
    let v = inputVector();
    if (length(v.x, v.y) < .08) {
      const threat = nearestEnemy();
      v = threat ? normal(p.x - threat.x, p.y - threat.y) : { x: p.facingX, y: p.facingY };
    } else v = normal(v.x, v.y);
    p.dashX = v.x; p.dashY = v.y;
    p.dashTime = .18;
    p.invulnerable = .29;
    p.evadeCooldown = .95;
    resetAttackCommitment();
  }

  function damagePlayer(amount, sourceX, sourceY) {
    const p = game.player;
    if (p.invulnerable > 0 || game.ended) return;
    p.hp = Math.max(0, p.hp - amount);
    p.invulnerable = .42;
    p.hurtFlash = .18;
    p.combo = 0;
    const away = normal(p.x - sourceX, p.y - sourceY);
    p.x += away.x * 16; p.y += away.y * 16;
    game.shake = Math.max(game.shake, 9);
    showMessage(`-${amount}  予兆を見たら先にずらせ`, .45);
    if (p.hp <= 0) finish(false);
  }

  function startTelegraph(e, type, duration) {
    e.attackType = type;
    e.telegraph = duration;
    e.telegraphMax = duration;
    e.aimX = game.player.x;
    e.aimY = game.player.y;
  }

  function updateEnemies(dt) {
    const p = game.player;
    for (const e of game.enemies) {
      e.hurt = Math.max(0, e.hurt - dt);
      e.vx *= Math.pow(.04, dt);
      e.vy *= Math.pow(.04, dt);
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.dead) continue;
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (e.dashTime > 0) {
        e.dashTime -= dt;
        e.x += e.dashX * 360 * dt;
        e.y += e.dashY * 360 * dt;
        if (distance(e, p) < e.r + p.r + 5) { damagePlayer(22, e.x, e.y); e.dashTime = 0; }
        continue;
      }
      if (e.telegraph > 0) {
        e.telegraph -= dt;
        if (e.telegraph <= 0) resolveEnemyAttack(e);
        continue;
      }
      const d = distance(e, p);
      const to = normal(p.x - e.x, p.y - e.y);
      if (e.kind === "archer") {
        if (d < 175) { e.x -= to.x * e.speed * dt; e.y -= to.y * e.speed * dt; }
        else if (d > 265) { e.x += to.x * e.speed * dt; e.y += to.y * e.speed * dt; }
        if (e.cooldown <= 0 && d < 390) startTelegraph(e, "shot", .52);
      } else if (e.kind === "brute") {
        if (d > 94) { e.x += to.x * e.speed * dt; e.y += to.y * e.speed * dt; }
        if (e.cooldown <= 0 && d < 245) startTelegraph(e, "charge", .76);
      } else {
        if (d > 42) { e.x += to.x * e.speed * dt; e.y += to.y * e.speed * dt; }
        if (e.cooldown <= 0 && d < 56) startTelegraph(e, "slash", .40);
      }
      e.x = clamp(e.x, 28, W - 28); e.y = clamp(e.y, 46, H - 28);
    }
  }

  function resolveEnemyAttack(e) {
    const p = game.player;
    const locked = normal(e.aimX - e.x, e.aimY - e.y);
    if (e.attackType === "shot") {
      game.projectiles.push({ x: e.x, y: e.y, vx: locked.x * 260, vy: locked.y * 260, r: 6, life: 2.2 });
      e.cooldown = 1.12 + Math.random() * .34;
    } else if (e.attackType === "charge") {
      e.dashX = locked.x; e.dashY = locked.y; e.dashTime = .46; e.cooldown = 2.0;
    } else {
      if (distance(e, p) < 66) damagePlayer(13, e.x, e.y);
      e.cooldown = .88 + Math.random() * .26;
    }
    e.attackType = "";
  }

  function updateProjectiles(dt) {
    const p = game.player;
    for (const shot of game.projectiles) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (shot.life > 0 && distance(shot, p) < shot.r + p.r) { shot.life = 0; damagePlayer(15, shot.x, shot.y); }
      if (shot.x < -20 || shot.x > W + 20 || shot.y < -20 || shot.y > H + 20) shot.life = 0;
    }
    game.projectiles = game.projectiles.filter((s) => s.life > 0);
  }

  function burst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, speed = 35 + Math.random() * 110;
      game.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .18 + Math.random() * .25, max: .43, color });
    }
  }

  function textPop(x, y, text) { game.texts.push({ x, y, text, life: .45 }); }

  function updateEffects(dt) {
    for (const s of game.sparks) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .92; s.vy *= .92; }
    game.sparks = game.sparks.filter((s) => s.life > 0);
    for (const t of game.texts) { t.life -= dt; t.y -= 22 * dt; }
    game.texts = game.texts.filter((t) => t.life > 0);
    game.shake = Math.max(0, game.shake - dt * 35);
  }

  function checkWave(dt) {
    if (game.ended || livingEnemies().length) return;
    if (!game.nextWave) {
      if (game.wave >= 3) { finish(true); return; }
      game.nextWave = 1.2;
      showMessage("WAVE CLEAR — 武器を替えてもいい。", 1);
    }
    game.nextWave -= dt;
    if (game.nextWave <= 0) spawnWave(game.wave + 1);
  }

  function finish(won) {
    game.ended = true;
    ui.resultTitle.textContent = won ? "生還" : "倒れた";
    ui.resultCopy.textContent = won
      ? "今度は『敵が空振った瞬間に止まりたくなったか』『武器で止まり方が変わったか』を見てほしい。どちらもYESなら本編へ移す価値がある。"
      : "負けてもOK。予兆をずらして反撃する流れが自然に出たなら、戦闘の芯は前より強くなっている。";
    ui.result.classList.add("show");
  }

  function dangerousCommitmentNearPlayer() {
    const p = game.player;
    return livingEnemies().some((e) => {
      if (e.telegraph <= 0) return false;
      if (e.attackType === "slash") return distance(e, p) < 72;
      const ax = e.aimX - e.x, ay = e.aimY - e.y;
      const bx = p.x - e.x, by = p.y - e.y;
      const aa = ax * ax + ay * ay || 1;
      const t = clamp((ax * bx + ay * by) / aa, 0, 1.35);
      const px = e.x + ax * t, py = e.y + ay * t;
      return Math.hypot(p.x - px, p.y - py) < (e.attackType === "charge" ? 32 : 20);
    });
  }

  function syncUi() {
    if (!game) return;
    const p = game.player;
    const profile = weapon();
    ui.hpText.textContent = Math.ceil(p.hp);
    ui.hpBar.style.transform = `scaleX(${p.hp / p.maxHp})`;
    ui.wave.textContent = `${game.wave} / 3`;
    ui.kills.textContent = game.kills;
    ui.weaponName.textContent = profile.label;
    ui.chain.textContent = p.combo ? `${p.combo} / ${profile.comboMax}` : "—";
    const target = nearestEnemy(profile.range);
    let stance = "MOVE", cls = "", kicker = "STANCE";
    if (!p.moving && p.stationary >= profile.settle && target) {
      stance = p.attackWindup || p.attackFlash > 0 ? "STRIKE" : "READY";
      cls = stance === "READY" ? "ready" : "striking";
      kicker = dangerousCommitmentNearPlayer() ? "GREED / DANGER" : "PUNISH WINDOW";
    } else if (!p.moving) {
      stance = "HOLD";
      kicker = target ? "SETTLING" : "OUT OF RANGE";
    }
    ui.stance.textContent = stance;
    ui.stance.className = cls;
    ui.stanceKicker.textContent = kicker;
    ui.techCd.textContent = p.techniqueCooldown > 0 ? `${p.techniqueCooldown.toFixed(1)}s` : "READY";
    ui.evadeCd.textContent = p.evadeCooldown > 0 ? `${p.evadeCooldown.toFixed(1)}s` : "READY";
  }

  function drawArena() {
    ctx.fillStyle = "#100e0a"; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * .5, H * .55, 20, W * .5, H * .55, 500);
    g.addColorStop(0, "#262117"); g.addColorStop(1, "#0b0a08"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(232,218,190,.055)"; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(208,164,84,.18)"; ctx.strokeRect(24, 36, W - 48, H - 60);
  }

  function drawTelegraph(e) {
    if (e.telegraph <= 0) return;
    const pulse = .45 + .45 * Math.sin((1 - e.telegraph / e.telegraphMax) * Math.PI * 7);
    ctx.save();
    ctx.strokeStyle = `rgba(211,73,57,${.48 + pulse * .35})`;
    ctx.fillStyle = `rgba(185,55,43,${.06 + pulse * .07})`;
    ctx.lineWidth = 3;
    if (e.attackType === "shot" || e.attackType === "charge") {
      const to = normal(e.aimX - e.x, e.aimY - e.y);
      const len = e.attackType === "charge" ? 285 : 560;
      ctx.setLineDash(e.attackType === "charge" ? [18, 9] : [12, 10]);
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + to.x * len, e.y + to.y * len); ctx.stroke();
      if (e.attackType === "charge") { ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 15 + pulse * 7, 0, TAU); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.arc(e.x, e.y, 61, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    const hp = clamp(e.hp / e.maxHp, 0, 1);
    ctx.save(); ctx.translate(e.x, e.y);
    if (e.dead) ctx.globalAlpha = .22;
    const body = e.kind === "archer" ? "#6e7569" : e.kind === "brute" ? "#785a43" : "#70433a";
    ctx.fillStyle = e.hurt > 0 ? "#eadcc0" : body;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = e.kind === "archer" ? "#a9b197" : e.kind === "brute" ? "#c69b61" : "#a66b5b"; ctx.lineWidth = 3; ctx.stroke();
    if (e.kind === "archer") { ctx.strokeStyle = "#c9b88e"; ctx.beginPath(); ctx.arc(5, 0, 12, -1.2, 1.2); ctx.stroke(); }
    if (e.kind === "brute") { ctx.fillStyle = "#c4a36c"; ctx.fillRect(-13, -3, 26, 6); }
    ctx.restore();
    if (!e.dead) {
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(e.x - e.r, e.y - e.r - 11, e.r * 2, 4);
      ctx.fillStyle = e.kind === "brute" ? "#d0a454" : "#ad5547"; ctx.fillRect(e.x - e.r, e.y - e.r - 11, e.r * 2 * hp, 4);
    }
  }

  function drawPlayer() {
    const p = game.player;
    const profile = weapon();
    const target = nearestEnemy(profile.range);
    ctx.save();
    if (!p.moving) {
      ctx.strokeStyle = target ? "rgba(142,173,121,.25)" : "rgba(238,232,220,.08)";
      ctx.lineWidth = 2; ctx.setLineDash([7, 9]); ctx.beginPath(); ctx.arc(p.x, p.y, profile.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (target && !p.moving && p.stationary >= profile.settle) {
      ctx.strokeStyle = dangerousCommitmentNearPlayer() ? "rgba(211,73,57,.88)" : "rgba(208,164,84,.78)";
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(target.x, target.y, target.r + 8, 0, TAU); ctx.stroke();
    }
    ctx.translate(p.x, p.y);
    if (p.invulnerable > 0) ctx.globalAlpha = .55 + .45 * Math.sin(game.elapsed * 45) ** 2;
    ctx.rotate(Math.atan2(p.facingY, p.facingX));
    ctx.fillStyle = p.hurtFlash > 0 ? "#d76c5d" : "#e7e0d2"; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#625b50"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = selectedWeapon === "dagger" ? "#c6cbd0" : selectedWeapon === "sword" ? "#d0b779" : "#1b1812";
    ctx.fillRect(5, -3, selectedWeapon === "sword" ? 30 : selectedWeapon === "dagger" ? 24 : 18, selectedWeapon === "sword" ? 7 : 6);
    if (p.attackFlash > 0 || p.techniqueFlash > 0) {
      ctx.strokeStyle = p.techniqueFlash > 0 ? "#e3c477" : "#f0e1be";
      ctx.lineWidth = p.techniqueFlash > 0 ? 8 : selectedWeapon === "sword" ? 7 : 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(8, 0, p.techniqueFlash > 0 ? 62 : selectedWeapon === "sword" ? 68 : selectedWeapon === "dagger" ? 38 : 44, -.78, .78);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPointer() {
    if (!pointer.active) return;
    const dx = pointer.x - pointer.startX, dy = pointer.y - pointer.startY, n = normal(dx, dy), mag = Math.min(length(dx, dy), 56);
    ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = "#eee8dc"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pointer.startX, pointer.startY, 34, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(238,232,220,.22)"; ctx.beginPath(); ctx.arc(pointer.startX + n.x * mag, pointer.startY + n.y * mag, 17, 0, TAU); ctx.fill(); ctx.restore();
  }

  function draw() {
    ctx.save();
    const sx = game.shake ? (Math.random() - .5) * game.shake : 0, sy = game.shake ? (Math.random() - .5) * game.shake : 0;
    ctx.translate(sx, sy);
    drawArena();
    for (const e of game.enemies) drawTelegraph(e);
    for (const shot of game.projectiles) { ctx.fillStyle = "#d54b3d"; ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r, 0, TAU); ctx.fill(); }
    for (const e of game.enemies) drawEnemy(e);
    drawPlayer();
    for (const s of game.sparks) { ctx.globalAlpha = clamp(s.life / s.max, 0, 1); ctx.fillStyle = s.color; ctx.fillRect(s.x - 2, s.y - 2, 4, 4); }
    ctx.globalAlpha = 1;
    for (const t of game.texts) { ctx.globalAlpha = clamp(t.life / .45, 0, 1); ctx.fillStyle = "#eee8dc"; ctx.font = "700 15px system-ui"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
    drawPointer();
    ctx.restore();
  }

  function update(dt) {
    if (game.ended) return;
    game.elapsed += dt;
    if (messageTimer > 0) { messageTimer -= dt; if (messageTimer <= 0) ui.message.classList.remove("show"); }
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    checkWave(dt);
    syncUi();
  }

  function frame(now) {
    let dt = Math.min(.034, (now - last) / 1000 || .016);
    last = now;
    if (game.hitStop > 0) { game.hitStop = Math.max(0, game.hitStop - dt); dt = 0; }
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function pointerPosition(event) {
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * W / r.width, y: (event.clientY - r.top) * H / r.height };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (game.ended) return;
    const pos = pointerPosition(event);
    pointer.active = true; pointer.id = event.pointerId; pointer.startX = pointer.x = pos.x; pointer.startY = pointer.y = pos.y;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pointer.active || event.pointerId !== pointer.id) return;
    const pos = pointerPosition(event); pointer.x = pos.x; pointer.y = pos.y;
  });
  function releasePointer(event) {
    if (event.pointerId !== pointer.id) return;
    pointer.active = false; pointer.id = null;
  }
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.repeat) { keys.add(event.code); return; }
    keys.add(event.code);
    if (event.code === "KeyK") technique();
    if (event.code === "Space") evade();
    if (event.code === "Digit1") selectWeapon("fists");
    if (event.code === "Digit2") selectWeapon("dagger");
    if (event.code === "Digit3") selectWeapon("sword");
    if (event.code === "KeyR") reset();
  }, { passive: false });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());

  ui.tech.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); technique(); });
  ui.evade.addEventListener("pointerdown", (event) => { event.preventDefault(); event.stopPropagation(); evade(); });
  document.querySelectorAll("[data-weapon]").forEach((button) => button.addEventListener("click", () => selectWeapon(button.dataset.weapon)));
  document.getElementById("restart").addEventListener("click", reset);
  document.getElementById("restart-result").addEventListener("click", reset);

  reset();
  selectWeapon("fists", false);
  requestAnimationFrame(frame);
})();
