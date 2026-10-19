'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '../gemini-feel-lab.html'), 'utf8');
const inline = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);

test('Gemini-feel source remains a standalone playable document', () => {
  assert.match(html, /<title>Crownless — 原作手触り戦闘ラボ \/ 2\.5D<\/title>/);
  assert.match(html, /<canvas id="gameCanvas"/);
  assert.match(html, /id="btnPunch"/);
  assert.match(html, /id="btnKick"/);
  assert.match(html, /id="btnJump"/);
  assert.match(html, /id="btnGrab"/);
  assert.match(html, /data-combat-origin="gemini-original-2_5d"/);
  assert.ok(inline, 'original embedded battle script exists');
  assert.doesNotThrow(() => new vm.Script(inline[1]));
});

test('the feel-critical original routines are preserved instead of a simplified replacement', () => {
  for (const token of [
    'class BattleTokenManager', 'requestToken(fighterId', 'new BattleTokenManager(2)',
    'function sampleEnemyAI(', 'function sampleCompanionAI(', 'function samplePlayer1Input(',
    'function performAttackHitbox(', 'function inflictDamage(', 'function triggerDualTagArt(',
    "bindArcadeButton(", 'function updateContextualButtons(', 'function gameLoop(',
    'function getGroundHeightAt(', 'function throwHeldWeapon(',
    'touchInput.holdRepeatTimer', 'state.kabukiBurstTimer'
  ]) assert.ok(html.includes(token), 'mechanics regression: ' + token);
});

test('fantasy reskin is isolated from active Crownless player state and GPS', () => {
  assert.match(html, /苔牙ゴブリン/);
  assert.match(html, /黒鉄のオーク/);
  assert.match(html, /霧晴れの囁きの森/);
  assert.doesNotMatch(inline[1], /localStorage|sessionStorage|geolocation|fetch\s*\(/);
  assert.doesNotMatch(html, /src\/slice-engine\.js|src\/slice-app\.js/);
});
