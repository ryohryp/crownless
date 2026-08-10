import fs from "node:fs";

const appPath = "src/app.js";
let app = fs.readFileSync(appPath, "utf8");

function replaceOnce(label, before, after) {
  if (!app.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
  app = app.replace(before, after);
}

replaceOnce("combat input state",
`  let messageTimer = null;
  let lastOutcome = "";
`,
`  let messageTimer = null;
  let lastOutcome = "";
  const combatKeys = new Set();
  const combatPointer = { active: false, id: null, startX: 0, startY: 0, x: 0, y: 0 };
`);

replaceOnce("range-aware nearest enemy",
`  function nearestEnemy() {
    if (!battle) return null;
    return livingEnemies().sort((a, b) => dist(a, battle.player) - dist(b, battle.player))[0] || null;
  }
`,
`  function nearestEnemy(maxRange = Infinity) {
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
`);

replaceOnce("normal attack profiles",
`  function showScreen(name) {
`,
`  function normalAttackProfile() {
    const weapon = battle ? battle.tuning.weaponType : "fists";
    const reach = battle ? battle.tuning.reach : 53;
    if (weapon === "dagger") {
      return { settle: 0.07, range: reach + 8, comboLength: 6, duration: 0.18, activeAt: 0.052, cadence: 0.015, lunge: 9, damage: 0.82, finisher: 1.5, arc: 0.28 };
    }
    if (weapon === "sword") {
      return { settle: 0.16, range: reach + 14, comboLength: 3, duration: 0.42, activeAt: 0.17, cadence: 0.055, lunge: 6, damage: 1.18, finisher: 1.3, arc: -0.16 };
    }
    const tempo = battle ? battle.tuning.unarmedTempo : 1;
    return { settle: 0.1, range: reach + 6, comboLength: 4, duration: 0.23 / tempo, activeAt: 0.07 / tempo, cadence: 0.02, lunge: 10, damage: 1, finisher: 1.38, arc: 0.04 };
  }

  function showScreen(name) {
`);

replaceOnce("hub combat copy",
`      : "武器はない。移動と連撃は身体に任せ、技と回避の瞬間を選ぶ。";
`,
`      : "武器はない。動けば攻撃を止め、立ち止まれば拳が出る。危険な場所で欲張るかは自分で決める。";
`);

replaceOnce("enemy locked aim state",
`      telegraph: 0,
      telegraphTotal: 0,
      recover: 0,
`,
`      telegraph: 0,
      telegraphTotal: 0,
      aimX: null,
      aimY: null,
      aimDirX: null,
      aimDirY: null,
      recover: 0,
`);

replaceOnce("player movement state",
`        recovery: 0,
        autoDelay: 0.14,
        flash: 0,
`,
`        recovery: 0,
        autoDelay: 0.08,
        moving: false,
        stationary: 0,
        moveX: 0,
        moveY: 0,
        flash: 0,
`);

replaceOnce("combat intro copy",
`    flashMessage("通常攻撃は自動。予兆へ技で割り込む。寸前回避なら反撃好機。", 2600);
`,
`    flashMessage("動け。止まれば攻撃する。敵の狙いを外して、止まれる場所を作れ。", 2600);
`);

replaceOnce("stop combat input reset",
`  function stopCombat() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    lastFrame = 0;
  }
`,
`  function stopCombat() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    lastFrame = 0;
    combatKeys.clear();
    combatPointer.active = false;
    combatPointer.id = null;
  }
`);

replaceOnce("player intent update order",
`    updatePlayerAttack(dt);
    updateAutoPilot(dt);
`,
`    updatePlayerIntent(dt);
    updatePlayerAttack(dt);
`);

replaceOnce("replace auto pilot",
`  function updateAutoPilot(dt) {
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
`,
`  function combatInputVector() {
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
      updateAutoStrike();
    }

    p.x = clamp(p.x, 64, canvas.width - 64);
    p.y = clamp(p.y, 92, canvas.height - 58);
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
`);

replaceOnce("light attack lunge",
`      const amount = attack.lunge || (attack.kind === "light" ? 18 + attack.step * 5 : 31);
`,
`      const amount = attack.lunge ?? (attack.kind === "light" ? 18 + attack.step * 5 : 31);
`);

replaceOnce("light attack completion cadence",
`      } else if (wasLight) p.comboTimer = 0.5;
`,
`      } else if (wasLight) {
        p.comboTimer = 0.46;
        p.autoDelay = Math.max(p.autoDelay, attack.cadence || 0);
      }
`);

replaceOnce("weapon-shaped light attacks",
`  function performLight() {
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
`,
`  function performLight() {
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
`);

replaceOnce("weapon-shaped light damage",
`    const technique = heavy || counter;
    const finisher = !technique && attack.step === 3;
    const reach = battle.tuning.reach + (technique ? 24 : finisher ? 13 : 0);
    let damage = technique
      ? battle.tuning.heavyDamage * (attack.damageMultiplier || 1)
      : battle.tuning.lightDamage * (attack.step === 2 ? 1.08 : finisher ? 1.32 * battle.tuning.comboFinisher : 1);
`,
`    const technique = heavy || counter;
    const finisher = !technique && Boolean(attack.finisher);
    const reach = technique ? battle.tuning.reach + 24 : (attack.range || battle.tuning.reach) + (finisher ? 8 : 0);
    let damage = technique
      ? battle.tuning.heavyDamage * (attack.damageMultiplier || 1)
      : battle.tuning.lightDamage * (attack.damageMultiplier || 1) * (finisher
        ? (attack.finisherMultiplier || 1.32) * battle.tuning.comboFinisher
        : 1 + Math.min(3, Math.max(0, attack.step - 1)) * 0.04);
`);

replaceOnce("weapon attack arcs",
`      const toEnemy = norm(enemy.x - p.x, enemy.y - p.y);
      if (toEnemy.x * p.facingX + toEnemy.y * p.facingY < 0.05) return;
`,
`      const toEnemy = norm(enemy.x - p.x, enemy.y - p.y);
      const arcThreshold = technique ? 0.05 : (attack.arcThreshold ?? 0.05);
      if (toEnemy.x * p.facingX + toEnemy.y * p.facingY < arcThreshold) return;
`);

replaceOnce("lock telegraph aim",
`  function startTelegraph(enemy, duration) {
    enemy.telegraph = duration;
    enemy.telegraphTotal = duration;
    enemy.guarding = false;
  }
`,
`  function startTelegraph(enemy, duration) {
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
`);

replaceOnce("locked skirmisher shot",
`    const dir = norm(p.x - enemy.x, p.y - enemy.y);
    battle.projectiles.push({ x: enemy.x + dir.x * 24, y: enemy.y + dir.y * 24, vx: dir.x * 360, vy: dir.y * 360, radius: 8, damage: enemy.damage, life: 1.9 });
`,
`    const dir = Number.isFinite(enemy.aimDirX) && Number.isFinite(enemy.aimDirY)
      ? { x: enemy.aimDirX, y: enemy.aimDirY }
      : norm(p.x - enemy.x, p.y - enemy.y);
    battle.projectiles.push({ x: enemy.x + dir.x * 24, y: enemy.y + dir.y * 24, vx: dir.x * 360, vy: dir.y * 360, radius: 8, damage: enemy.damage, life: 1.9 });
`);

replaceOnce("movement-directed evade",
`    const move = smartEvadeVector();
`,
`    const input = combatInputVector();
    const move = Math.hypot(input.x, input.y) > 0.08 ? norm(input.x, input.y) : smartEvadeVector();
`);

replaceOnce("locked telegraph facing",
`    const toward = norm(battle.player.x - enemy.x, battle.player.y - enemy.y);
`,
`    const toward = enemy.telegraph > 0 && Number.isFinite(enemy.aimDirX) && Number.isFinite(enemy.aimDirY)
      ? { x: enemy.aimDirX, y: enemy.aimDirY }
      : norm(battle.player.x - enemy.x, battle.player.y - enemy.y);
`);

replaceOnce("player range feedback",
`  function drawPlayer() {
    const p = battle.player;
    ctx.save();
    ctx.translate(p.x, p.y);
`,
`  function drawPlayer() {
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
`);

replaceOnce("pointer feedback call",
`    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawGround(palette, elapsed) {
`,
`    ctx.restore();
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
`);

replaceOnce("combat controls",
`    const help = document.querySelector(".combat-help");
    if (help) help.innerHTML = \`<span>移動・通常攻撃 <b>AUTO</b></span><span><kbd>K</kbd> 技 / 割込</span><span><kbd>SPACE</kbd> 回避</span><span class="hint">予兆に技。寸前回避の後は反撃。</span>\`;

    techniqueButton?.addEventListener("pointerdown", (event) => { event.preventDefault(); performTechnique(); });
    evadeButton?.addEventListener("pointerdown", (event) => { event.preventDefault(); performEvade(); });
    window.addEventListener("keydown", (event) => {
      if (!screens.combat.classList.contains("active") || !battle || event.repeat) return;
      if (event.code === "KeyK") performTechnique();
      if (event.code === "Space") { event.preventDefault(); performEvade(); }
    });
`,
`    const help = document.querySelector(".combat-help");
    if (help) help.innerHTML = \`<span><kbd>WASD</kbd> / ドラッグ 移動</span><span>停止 <b>AUTO STRIKE</b></span><span><kbd>K</kbd> 技</span><span><kbd>SPACE</kbd> 回避</span><span class="hint">敵の狙いを外す → 止まって反撃。</span>\`;

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
`);

fs.writeFileSync(appPath, app);

const test = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

test("main combat removes auto pathing and uses player movement intent", () => {
  assert.doesNotMatch(app, /function updateAutoPilot/);
  assert.match(app, /function updatePlayerIntent/);
  assert.match(app, /combatInputVector/);
  assert.match(app, /p\\.moving = magnitude > 0\\.08/);
  assert.match(app, /p\\.stationary = 0/);
});

test("standing still gates automatic normal attacks", () => {
  assert.match(app, /function updateAutoStrike/);
  assert.match(app, /p\\.stationary < profile\\.settle/);
  assert.match(app, /d > profile\\.range \+ target\\.radius/);
  assert.match(app, /performLight\\(\\)/);
});

test("fists dagger and sword create different stop rhythms", () => {
  assert.match(app, /weapon === "dagger"/);
  assert.match(app, /comboLength: 6/);
  assert.match(app, /weapon === "sword"/);
  assert.match(app, /comboLength: 3/);
  assert.match(app, /comboLength: 4/);
  assert.match(app, /arc: -0\\.16/);
});

test("enemy ranged telegraphs lock their aim before release", () => {
  assert.match(app, /enemy\\.aimX = p\\.x/);
  assert.match(app, /enemy\\.aimDirX = aim\\.x/);
  assert.match(app, /Number\\.isFinite\\(enemy\\.aimDirX\\)/);
});

test("main combat supports keyboard and drag movement", () => {
  assert.match(app, /KeyW/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /canvas\\.addEventListener\\("pointerdown"/);
  assert.match(app, /canvas\\.addEventListener\\("pointermove"/);
  assert.match(app, /停止 <b>AUTO STRIKE<\\/b>/);
});
`;
fs.writeFileSync("test/main-stand-strike.test.js", test);
console.log("Applied main stand-to-strike migration");
