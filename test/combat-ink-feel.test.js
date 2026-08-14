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
  assert.match(feel, /const ENEMY_HUD_LIFT = 52/);
  assert.match(feel, /function isEnemyHealthBar/);
  assert.match(feel, /Math\.abs\(height - 5\)/);
  assert.match(feel, /shifted\[1\].*ENEMY_HUD_LIFT/);
  assert.match(feel, /shifted\[2\].*ENEMY_HUD_LIFT/);
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
