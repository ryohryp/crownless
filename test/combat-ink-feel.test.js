const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const feelPath = path.join(root, 'src', 'combat-ink-feel-v3.js');
const depthPath = path.join(root, 'src', 'combat-depth-order-v1.js');
const tuningPath = path.join(root, 'src', 'combat-feel-tuning.js');
const feel = fs.readFileSync(feelPath, 'utf8');
const depth = fs.readFileSync(depthPath, 'utf8');
const tuning = fs.readFileSync(tuningPath, 'utf8');

test('depth ordering installs before the manuscript renderer while HUD installs after it', () => {
  const depthIndex = tuning.indexOf('combat-depth-order-v1.js');
  const hudIndex = tuning.indexOf('combat-ink-feel-v3.js');
  assert.ok(depthIndex >= 0, 'depth-order layer must be loaded');
  assert.ok(hudIndex > depthIndex, 'HUD layer must load after depth-order layer');
  assert.match(feel, /combat-manuscript-render\\\.js/);
  assert.match(feel, /MutationObserver/);
  assert.match(feel, /addEventListener\("load", install/);
});

test('enemy actor sprites are buffered and replayed by projected foot Y', () => {
  assert.match(depth, /ENEMY_ACTOR/);
  assert.match(depth, /enemyQueue\.push\(captureDraw/);
  assert.match(depth, /enemyQueue\.sort/);
  assert.match(depth, /a\.foot\.y - b\.foot\.y/);
  assert.match(depth, /publicState\.enemyBounds/);
  assert.match(depth, /PLAYER_ACTOR/);
  assert.match(depth, /publicState\.flushHud\(\)/);
});

test('enemy HUD avoids actor silhouettes with vertical lanes and side nudges', () => {
  assert.match(feel, /const ENEMY_HUD_LIFT = 60/);
  assert.match(feel, /const ENEMY_HUD_LANE_GAP = 18/);
  assert.match(feel, /const ENEMY_HUD_SIDE_NUDGES = \[0, -12, 12, -24, 24\]/);
  assert.match(feel, /function rectsOverlap/);
  assert.match(feel, /actorOccupiedRects/);
  assert.match(feel, /function choosePlacement/);
  assert.match(feel, /occupied\.some\(\(other\) => rectsOverlap/);
});

test('only priority enemies keep names while other enemies retain compact HP bars', () => {
  assert.match(feel, /const NON_PRIORITY_ALPHA = 0\.58/);
  assert.match(feel, /function priorityIndex/);
  assert.match(feel, /group\.priority = true/);
  assert.match(feel, /if \(priority\) drawLabel/);
  assert.match(feel, /drawBar\(group\.background/);
  assert.match(feel, /drawBar\(group\.foreground/);
});

test('presentation layers remain simulation-only observers', () => {
  assert.doesNotMatch(feel, /enemy\.hp\s*=/);
  assert.doesNotMatch(feel, /hitStop\s*=/);
  assert.doesNotMatch(depth, /enemy\.hp\s*=/);
  assert.doesNotMatch(depth, /moveSpeed\s*=/);
});

test('combat presentation scripts remain valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', feelPath]);
  execFileSync(process.execPath, ['--check', depthPath]);
  execFileSync(process.execPath, ['--check', tuningPath]);
});
