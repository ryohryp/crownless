import fs from "node:fs";

const appPath = "src/app.js";
let app = fs.readFileSync(appPath, "utf8");

function replaceOnce(label, before, after) {
  if (!app.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
  app = app.replace(before, after);
}

replaceOnce("battlefield weapon helpers",
`  function showScreen(name) {\n`,
`  function battlefieldWeaponSpec(enemy) {\n    if (enemy.kind === "guard") return { type: "sword", name: "欠け盾兵の剣" };\n    if (enemy.kind === "skirmisher") return { type: "dagger", name: "藪射ちの狩猟刀" };\n    return { type: "dagger", name: "街道荒らしの短刀" };\n  }\n\n  function battlefieldWeaponTuning(type) {\n    const base = battle.baseTuning || battle.tuning;\n    const lightBase = Math.max(11, base.lightDamage);\n    const heavyBase = Math.max(21, base.heavyDamage);\n    if (type === "sword") {\n      return {\n        style: "blade", weaponType: "sword",\n        lightDamage: lightBase * 1.08, heavyDamage: heavyBase * 1.12,\n        reach: 82, moveSpeed: 190, heavyStagger: 1.15,\n        evadeEmpower: false, unarmedTempo: 1, comboFinisher: 1, lowHealthRisk: false\n      };\n    }\n    return {\n      style: "blade", weaponType: "dagger",\n      lightDamage: lightBase * 0.92, heavyDamage: heavyBase * 0.95,\n      reach: 62, moveSpeed: 218, heavyStagger: 0.95,\n      evadeEmpower: false, unarmedTempo: 1, comboFinisher: 1, lowHealthRisk: false\n    };\n  }\n\n  function dropEnemyWeapon(enemy) {\n    if (!battle || enemy.weaponDropped) return;\n    enemy.weaponDropped = true;\n    const spec = battlefieldWeaponSpec(enemy);\n    battle.droppedWeapons.push({\n      id: \\`field-\\${enemy.id}-\\${battle.elapsed.toFixed(3)}\\`,\n      type: spec.type,\n      name: spec.name,\n      x: enemy.x,\n      y: enemy.y + 10,\n      angle: enemy.strafeDir * 0.55,\n      age: 0,\n      pickup: 0,\n      picked: false\n    });\n    addText(enemy.x, enemy.y - 18, "WEAPON", "#e5cf91");\n  }\n\n  function equipBattlefieldWeapon(drop) {\n    const p = battle.player;\n    battle.tuning = battlefieldWeaponTuning(drop.type);\n    battle.heldBattlefieldWeapon = { type: drop.type, name: drop.name };\n    drop.picked = true;\n    p.attack = null;\n    p.comboStep = 0;\n    p.comboTimer = 0;\n    p.stationary = 0;\n    p.autoDelay = Math.max(p.autoDelay, 0.08);\n    spawnBurst(drop.x, drop.y, 12, drop.type === "sword" ? "#e5c875" : "#c8d3b1");\n    addText(p.x, p.y - 58, drop.type === "sword" ? "SWORD" : "DAGGER", "#f2df9c");\n    flashMessage(\\`\\${drop.name} — 拾った。戦い方が変わる。\\`, 950);\n  }\n\n  function updateBattlefieldPickup(dt) {\n    const p = battle.player;\n    const available = battle.droppedWeapons\n      .filter((drop) => !drop.picked && dist(drop, p) <= 48)\n      .sort((a, b) => dist(a, p) - dist(b, p));\n    const target = available[0] || null;\n    battle.droppedWeapons.forEach((drop) => {\n      if (drop !== target && !drop.picked) drop.pickup = 0;\n    });\n    if (!target) return false;\n    if (p.attack || p.recovery > 0) {\n      target.pickup = 0;\n      return true;\n    }\n    target.pickup += dt;\n    if (target.pickup >= 0.18) equipBattlefieldWeapon(target);\n    return true;\n  }\n\n  function beginVictoryPickupWindow() {\n    if (!battle || battle.ending || battle.victoryPickupTimer > 0) return;\n    const unpicked = battle.droppedWeapons.filter((drop) => !drop.picked);\n    battle.victoryPickupTimer = unpicked.length ? 1.6 : 0.35;\n    if (unpicked.length) flashMessage("敵の武器が落ちた。近くで止まれば拾える。", 1150);\n  }\n\n  function showScreen(name) {\n`);

replaceOnce("enemy weapon drop state",
`      wobbleSeed: index * 1.73,\n      deadTimer: 0\n`,
`      wobbleSeed: index * 1.73,\n      weaponDropped: false,\n      deadTimer: 0\n`);

replaceOnce("battle weapon state",
`    battle = {\n      tuning,\n      player: {\n`,
`    battle = {\n      tuning,\n      baseTuning: { ...tuning },\n      heldBattlefieldWeapon: null,\n      droppedWeapons: [],\n      victoryPickupTimer: 0,\n      player: {\n`);

replaceOnce("victory pickup timer update",
`    p.comboTimer = Math.max(0, p.comboTimer - dt);\n\n    updatePlayerIntent(dt);\n`,
`    p.comboTimer = Math.max(0, p.comboTimer - dt);\n\n    if (battle.victoryPickupTimer > 0) {\n      battle.victoryPickupTimer = Math.max(0, battle.victoryPickupTimer - dt);\n      if (battle.victoryPickupTimer <= 0) {\n        finishVictory();\n        return;\n      }\n    }\n\n    updatePlayerIntent(dt);\n`);

replaceOnce("dropped weapon age",
`    battle.texts = battle.texts.filter((text) => text.life > 0);\n  }\n`,
`    battle.texts = battle.texts.filter((text) => text.life > 0);\n    battle.droppedWeapons.forEach((drop) => { drop.age += dt; });\n  }\n`);

replaceOnce("movement resets pickup",
`      p.autoDelay = Math.max(p.autoDelay, 0.035);\n    } else {\n      p.stationary += dt;\n      updateAutoStrike();\n    }\n`,
`      p.autoDelay = Math.max(p.autoDelay, 0.035);\n      battle.droppedWeapons.forEach((drop) => { if (!drop.picked) drop.pickup = 0; });\n    } else {\n      p.stationary += dt;\n      if (!updateBattlefieldPickup(dt)) updateAutoStrike();\n    }\n`);

replaceOnce("drop weapon on defeat",
`      if (enemy.hp <= 0) {\n        enemy.deadTimer = 0.9;\n`,
`      if (enemy.hp <= 0) {\n        dropEnemyWeapon(enemy);\n        enemy.deadTimer = 0.9;\n`);

replaceOnce("last kill pickup window",
`    updateCombatHud();\n    if (battle.enemies.every((enemy) => enemy.hp <= 0)) finishVictory();\n`,
`    updateCombatHud();\n    if (battle.enemies.every((enemy) => enemy.hp <= 0)) beginVictoryPickupWindow();\n`);

replaceOnce("finish victory clears pickup window",
`    battle.ending = true;\n    battle.victoryTimer = 0.82;\n`,
`    battle.ending = true;\n    battle.victoryPickupTimer = 0;\n    battle.victoryTimer = 0.82;\n`);

replaceOnce("draw dropped weapons",
`    battle.projectiles.forEach(drawProjectile);\n    battle.enemies.forEach(drawEnemy);\n    drawPlayer();\n`,
`    battle.projectiles.forEach(drawProjectile);\n    battle.enemies.forEach(drawEnemy);\n    battle.droppedWeapons.filter((drop) => !drop.picked).forEach(drawDroppedWeapon);\n    drawPlayer();\n`);

replaceOnce("draw held player weapon",
`    ctx.moveTo(0, 18); ctx.lineTo(-11, 35); ctx.stroke();\n    if (p.counterWindow > 0) {\n`,
`    ctx.moveTo(0, 18); ctx.lineTo(-11, 35); ctx.stroke();\n    if (battle.tuning.weaponType === "sword") {\n      ctx.strokeStyle = battle.heldBattlefieldWeapon ? "#e9d38d" : "#d7c7a3";\n      ctx.lineWidth = 4;\n      ctx.beginPath(); ctx.moveTo(16, p.attack ? -7 : 3); ctx.lineTo(48, p.attack ? -18 : -6); ctx.stroke();\n      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26, p.attack ? -15 : -4); ctx.lineTo(30, p.attack ? -4 : 8); ctx.stroke();\n    } else if (battle.tuning.weaponType === "dagger") {\n      ctx.strokeStyle = battle.heldBattlefieldWeapon ? "#dce0bd" : "#c8c6b7";\n      ctx.lineWidth = 4;\n      ctx.beginPath(); ctx.moveTo(16, p.attack ? -7 : 3); ctx.lineTo(32, p.attack ? -16 : -5); ctx.stroke();\n    }\n    if (p.counterWindow > 0) {\n`);

replaceOnce("dropped weapon renderer",
`  function drawEnemy(enemy) {\n`,
`  function drawDroppedWeapon(drop) {\n    const p = battle.player;\n    const near = dist(drop, p) <= 62;\n    const pulse = 1 + Math.sin(battle.elapsed * 8 + drop.age) * 0.08;\n    ctx.save();\n    ctx.translate(drop.x, drop.y);\n    ctx.rotate(drop.angle);\n    ctx.shadowColor = drop.type === "sword" ? "rgba(237,202,112,.8)" : "rgba(194,210,173,.75)";\n    ctx.shadowBlur = near ? 18 : 10;\n    ctx.strokeStyle = drop.type === "sword" ? "#e8cf88" : "#cbd5b8";\n    ctx.lineCap = "round";\n    ctx.lineWidth = drop.type === "sword" ? 5 : 4;\n    ctx.beginPath();\n    ctx.moveTo(drop.type === "sword" ? -23 : -14, 0);\n    ctx.lineTo(drop.type === "sword" ? 24 : 15, 0);\n    ctx.stroke();\n    ctx.shadowBlur = 0;\n    ctx.lineWidth = 3;\n    ctx.beginPath();\n    ctx.moveTo(-8, -7); ctx.lineTo(-8, 7); ctx.stroke();\n    ctx.restore();\n\n    ctx.save();\n    ctx.strokeStyle = near ? "rgba(240,220,153,.72)" : "rgba(222,207,163,.24)";\n    ctx.lineWidth = 2;\n    ctx.beginPath(); ctx.arc(drop.x, drop.y, 24 * pulse, 0, Math.PI * 2); ctx.stroke();\n    if (near) {\n      const progress = clamp(drop.pickup / 0.18, 0, 1);\n      ctx.strokeStyle = "#f1d77e";\n      ctx.lineWidth = 4;\n      ctx.beginPath(); ctx.arc(drop.x, drop.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();\n      ctx.fillStyle = "rgba(246,232,194,.95)";\n      ctx.font = "800 11px ui-sans-serif, system-ui";\n      ctx.textAlign = "center";\n      ctx.fillText("止まって拾う", drop.x, drop.y - 36);\n    }\n    ctx.restore();\n  }\n\n  function drawEnemy(enemy) {\n`);

replaceOnce("combat pickup help",
`    if (help) help.innerHTML = \\`<span><kbd>WASD</kbd> / ドラッグ 移動</span><span>停止 <b>AUTO STRIKE</b></span><span><kbd>K</kbd> 技</span><span><kbd>SPACE</kbd> 回避</span><span class="hint">敵の狙いを外す → 止まって反撃。</span>\\`;\n`,
`    if (help) help.innerHTML = \\`<span><kbd>WASD</kbd> / ドラッグ 移動</span><span>停止 <b>AUTO STRIKE</b></span><span>武器の上で停止 <b>PICK UP</b></span><span><kbd>K</kbd> 技</span><span><kbd>SPACE</kbd> 回避</span><span class="hint">敵の狙いを外す → 止まって反撃。倒した敵の武器も使える。</span>\\`;\n`);

fs.writeFileSync(appPath, app);

const test = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

test("defeated enemies drop battlefield weapons", () => {
  assert.match(app, /function dropEnemyWeapon/);
  assert.match(app, /dropEnemyWeapon\(enemy\)/);
  assert.match(app, /enemy\.kind === "guard".*type: "sword"/s);
  assert.match(app, /enemy\.kind === "skirmisher".*type: "dagger"/s);
});

test("picking a weapon reuses the stand-to-strike stop decision", () => {
  assert.match(app, /function updateBattlefieldPickup\(dt\)/);
  assert.match(app, /dist\(drop, p\) <= 48/);
  assert.match(app, /target\.pickup \+= dt/);
  assert.match(app, /target\.pickup >= 0\.18/);
  assert.match(app, /if \(!updateBattlefieldPickup\(dt\)\) updateAutoStrike\(\)/);
});

test("battlefield weapons only replace combat tuning", () => {
  assert.match(app, /battle\.tuning = battlefieldWeaponTuning\(drop\.type\)/);
  assert.match(app, /battle\.heldBattlefieldWeapon =/);
  assert.match(app, /baseTuning: \{ \.\.\.tuning \}/);
  const pickupBlock = app.slice(app.indexOf("function equipBattlefieldWeapon"), app.indexOf("function updateBattlefieldPickup"));
  assert.doesNotMatch(pickupBlock, /Core\.equipItem|state\.equippedItemId|securedLoot/);
});

test("the last kill leaves time to grab a dropped weapon", () => {
  assert.match(app, /function beginVictoryPickupWindow/);
  assert.match(app, /battle\.victoryPickupTimer = unpicked\.length \? 1\.6 : 0\.35/);
  assert.match(app, /battle\.enemies\.every\(\(enemy\) => enemy\.hp <= 0\)\) beginVictoryPickupWindow\(\)/);
  assert.match(app, /if \(battle\.victoryPickupTimer <= 0\) \{\s*finishVictory\(\)/s);
});

test("dropped weapons are visible and explain how to pick them up", () => {
  assert.match(app, /function drawDroppedWeapon/);
  assert.match(app, /止まって拾う/);
  assert.match(app, /武器の上で停止 <b>PICK UP<\/b>/);
  assert.match(app, /battle\.droppedWeapons\.filter\(\(drop\) => !drop\.picked\)\.forEach\(drawDroppedWeapon\)/);
});
`;
fs.writeFileSync("test/battlefield-weapon-pickup.test.js", test);
console.log("Applied battlefield weapon pickup migration");