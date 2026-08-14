const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const feelPath = path.join(root, 'src', 'combat-ink-feel-v3.js');
const tuningPath = path.join(root, 'src', 'combat-feel-tuning.js');
const feel = fs.readFileSync(feelPath, 'utf8');
const tuning = fs.readFileSync(tuningPath, 'utf8');

test('combat presentation layer still arms after manuscript install', () => {
  assert.match(tuning, /combat-ink-feel-v3\.js/);
  assert.match(feel, /combat-manuscript-render\\\.js/);
  assert.match(feel, /MutationObserver/);
  assert.match(feel, /addEventListener\("load", install/);
});

test('enemy HUD clears the accepted actor silhouette', () => {
  assert.match(feel, /const ENEMY_HUD_LIFT = 60/);
  assert.match(feel, /function isEnemyHealthBar/);
  assert.match(feel, /Math\.abs\(height - 5\)/);
  assert.match(feel, /pendingEnemyHud\.lift/);
  assert.match(feel, /shifted\[1\].*pendingEnemyHud\.lift/);
  assert.match(feel, /shifted\[2\].*pendingEnemyHud\.lift/);
});

test('crowded enemy HUD labels use collision-aware vertical lanes', () => {
  assert.match(feel, /const ENEMY_HUD_LANE_GAP = 18/);
  assert.match(feel, /const ENEMY_HUD_COLLISION_X = 72/);
  assert.match(feel, /const ENEMY_HUD_MAX_LANES = 4/);
  assert.match(feel, /function chooseHudLift/);
  assert.match(feel, /occupiedHudSlots/);
  assert.match(feel, /Math\.abs\(slot\.x - anchor\.x\)/);
  assert.match(feel, /Math\.abs\(slot\.y - shiftedY\)/);
  assert.match(feel, /occupiedHudSlots\.length = 0/);
});

test('health bar background and foreground reuse one HUD lane', () => {
  assert.match(feel, /function sameHealthBar/);
  assert.match(feel, /Math\.abs\(anchor\.x - pending\.x\) < 1\.5/);
  assert.match(feel, /if \(!sameHealthBar\(anchor, pendingEnemyHud\)\)/);
});

test('presentation layer no longer infers hit VFX from prototype colors', () => {
  assert.doesNotMatch(feel, /ink-effects-sheet/);
  assert.doesNotMatch(feel, /#f0b28c/);
  assert.doesNotMatch(feel, /drawSlice/);
  assert.doesNotMatch(feel, /warningAlpha/);
  assert.doesNotMatch(feel, /enemy\.hp\s*=/);
  assert.doesNotMatch(feel, /hitStop\s*=/);
});

test('combat presentation scripts remain valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', feelPath]);
  execFileSync(process.execPath, ['--check', tuningPath]);
});
