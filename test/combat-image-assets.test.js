const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const rendererPath = path.join(root, 'src', 'combat-manuscript-render.js');
const js = fs.readFileSync(rendererPath, 'utf8');

const expectedAssets = [
  'actors/player-unarmed.png',
  'actors/player-unarmed-combat-sprite-sheet-v0.3.png',
  'actors/enemy-rusher.png',
  'actors/enemy-guard.png',
  'actors/enemy-skirmisher.png',
  'weapons/dropped-sword.png',
  'weapons/dropped-dagger.png',
  'effects/ink-effects-sheet.png',
  'effects/vermilion-telegraphs-sheet.png'
];

test('generated minimal combat asset set is wired into the runtime renderer', () => {
  expectedAssets.forEach((asset) => assert.ok(js.includes(asset), `missing runtime asset reference: ${asset}`));
  assert.ok(!js.includes('actors/player-unarmed-combat-sprite-sheet-v0.1.png'), 'directional player sheet must not be replayed as runtime animation');
});

test('image integration stays presentation-only and falls back to legacy primitives', () => {
  assert.match(js, /const previousGetContext = HTMLCanvasElement\.prototype\.getContext/);
  assert.match(js, /new Image\(\)/);
  assert.match(js, /drawTrimmed/);
  assert.match(js, /drawSheetSlice/);
  assert.match(js, /if \(!record \|\| !record\.ready \|\| !record\.image\) return false/);
  assert.match(js, /CrownlessCombatAssets/);
});

test('actor sprites preserve their source proportions in final screen space', () => {
  assert.match(js, /function actorScreenAxes\(target\)/);
  assert.match(js, /canvas\.getBoundingClientRect\(\)/);
  assert.match(js, /target\.getTransform\(\)/);
  assert.match(js, /Math\.hypot\(matrix\.a \* cssX, matrix\.b \* cssY\)/);
  assert.match(js, /Math\.hypot\(matrix\.c \* cssX, matrix\.d \* cssY\)/);
  assert.match(js, /function drawActorBillboard\(target, record, logicalHeight/);
  assert.match(js, /function drawPlayerActorBillboard\(target, record, logicalHeight/);
  assert.match(js, /axes\.x \/ axes\.y/);
  assert.match(js, /drawActorBillboard\(ctx, assets\[role\], logicalHeight, 37\)/);
  assert.match(js, /drawActorBillboard\(ctx, assets\.player, logicalHeight, 37\)/);
  assert.match(js, /playerAnimationConfig\.referenceVisibleHeight/);
  assert.match(js, /playerAnimationConfig\.pivotY \* scale \* yCompensation/);
});

test('actor shadow shares the billboard foot anchor and survives image fallback', () => {
  assert.match(js, /function actorFootMetrics\(target, logicalFootOffset = 37\)/);
  assert.match(js, /footY:\s*logicalFootOffset \* yCompensation/);
  assert.match(js, /const \{ yCompensation, footY \} = actorFootMetrics\(target, logicalFootOffset\)/);
  assert.match(js, /drawGroundShadow\(target, footY\)/);
  assert.match(js, /function drawFallbackActorShadow\(\)/);
  assert.match(js, /const \{ footY \} = actorFootMetrics\(ctx, 37\)/);
  assert.match(js, /if \(drawActor\(role\)\)[\s\S]*drawFallbackActorShadow\(\)/);
});

test('all three ink and telegraph sheet regions are mapped to combat states', () => {
  assert.match(js, /slice: 0/);
  assert.match(js, /slice: 1/);
  assert.match(js, /slice: 2/);
  assert.match(js, /drawSheetSlice\(ctx, "telegraph", 0/);
  assert.match(js, /drawSheetSlice\(ctx, "telegraph", 1/);
  assert.match(js, /drawSheetSlice\(ctx, "telegraph", 2/);
});

test('renderer remains valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', rendererPath]);
});
