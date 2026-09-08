const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wego = require('../src/reboot-wego-encounter.js');
const battlefield = require('../src/reboot-wego-battlefield.js');

test('resolution presentation distinguishes press guard and maneuver without adding encounter state', () => {
  const initial = wego.createEncounter({ clues: ['乱れた轍'], gear: 'round_shield' });
  const shotPlan = { id: 'probe_shot', tags: ['shot'] };

  const pressed = wego.resolveRound(initial, 'press');
  const guarded = wego.resolveRound(initial, 'guard');
  const maneuvered = wego.resolveRound(initial, 'maneuver');

  const pressFx = battlefield.resolutionPresentation(initial, pressed, shotPlan, 'press');
  const guardFx = battlefield.resolutionPresentation(initial, guarded, shotPlan, 'guard');
  const maneuverFx = battlefield.resolutionPresentation(initial, maneuvered, shotPlan, 'maneuver');

  assert.equal(pressFx.action, 'press');
  assert.equal(guardFx.action, 'guard');
  assert.equal(maneuverFx.action, 'maneuver');
  assert.equal(guardFx.defense, 'shield');
  assert.equal(maneuverFx.defense, 'terrain');
  assert.equal(pressFx.frontMotion, 'close');
  assert.equal(pressFx.archerMotion, 'shot');
  assert.deepEqual(Object.keys(pressed).sort(), Object.keys(guarded).sort());
});

test('flank presentation makes pressure legible as a narrowing retreat lane', () => {
  const before = { advantage: 0, pressure: 1, gear: 'long_spear', injury: null };
  const after = { ...before, advantage: -1, pressure: 2 };
  const plan = { id: 'brace_flank', tags: ['brace', 'flank', 'shot'] };
  const fx = battlefield.resolutionPresentation(before, after, plan, 'press');

  assert.equal(fx.frontMotion, 'flank');
  assert.equal(fx.archerMotion, 'reposition');
  assert.equal(fx.retreat, 'narrowing');
  assert.equal(fx.tone, 'unfavorable');
});

test('new injury is exposed as a transient visual mark only', () => {
  const before = { advantage: 0, pressure: 1, gear: 'long_spear', injury: null };
  const after = { ...before, injury: 'arrow_graze' };
  const plan = { id: 'probe_shot', tags: ['shot'] };
  const fx = battlefield.resolutionPresentation(before, after, plan, 'press');

  assert.equal(fx.injury, 'arrow_graze');

  const record = wego.persistentRecord({
    status: 'resolved',
    result: 'cleared',
    injury: 'arrow_graze',
    intel: ['frontliner', 'archer']
  });
  assert.ok(record);
  assert.equal('resolutionPhase' in record, false);
  assert.equal('resolutionTone' in record, false);
  assert.deepEqual(Object.keys(record).sort(), ['encounterId', 'injury', 'intel', 'placeState', 'result', 'version'].sort());
});

test('resolution polish remains short, input-locked, non-QTE, and reduced-motion safe', () => {
  const root = path.resolve(__dirname, '..');
  const board = fs.readFileSync(path.join(root, 'src', 'reboot-wego-battlefield.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'reboot-wego-resolution.css'), 'utf8');

  assert.match(board, /RESOLUTION_MS = 340/);
  assert.match(board, /setButtonsLocked\(actions, true\)/);
  assert.match(board, /event\.stopImmediatePropagation\(\)/);
  assert.match(board, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-resolution-action='press'/);
  assert.match(css, /data-resolution-action='guard'/);
  assert.match(css, /data-resolution-action='maneuver'/);
  assert.match(css, /data-resolution-plan='cutoff_volley'/);
  assert.match(css, /data-resolution-defense='shield'/);
  assert.match(css, /data-resolution-defense='terrain'/);
  assert.match(css, /data-injury='marked'/);
  assert.match(css, /data-retreat='danger'.*width: 16%/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(board, /requestAnimationFrame|pointermove|keydown|enemyHp|QTE/i);
});
