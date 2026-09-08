const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wego = require('../src/reboot-wego-encounter.js');
const battlefield = require('../src/reboot-wego-battlefield.js');

test('resolution presentation distinguishes press guard and maneuver without adding encounter state', () => {
  const initial = wego.createEncounter({ clues: ['乱れた轍'], gear: 'round_shield' });
  const plan = wego.enemyPlan(initial);

  const pressed = wego.resolveRound(initial, 'press');
  const guarded = wego.resolveRound(initial, 'guard');
  const maneuvered = wego.resolveRound(initial, 'maneuver');

  const pressFx = battlefield.resolutionPresentation(initial, pressed, plan, 'press');
  const guardFx = battlefield.resolutionPresentation(initial, guarded, plan, 'guard');
  const maneuverFx = battlefield.resolutionPresentation(initial, maneuvered, plan, 'maneuver');

  assert.equal(pressFx.action, 'press');
  assert.equal(guardFx.action, 'guard');
  assert.equal(maneuverFx.action, 'maneuver');
  assert.equal(guardFx.defense, 'shield');
  assert.equal(maneuverFx.defense, 'terrain');
  assert.equal(pressFx.frontMotion, 'close');
  assert.equal(pressFx.archerMotion, 'shot');
  assert.deepEqual(Object.keys(pressed).sort(), Object.keys(guarded).sort());
});

test('flank and cutoff plans become lateral frontliner motion and can narrow retreat', () => {
  let state = wego.createEncounter({ clues: [], gear: 'long_spear' });
  state = wego.resolveRound(state, 'press');
  const plan = wego.enemyPlan(state);
  const next = wego.resolveRound(state, 'press');
  const fx = battlefield.resolutionPresentation(state, next, plan, 'press');

  assert.equal(plan.id, 'brace_flank');
  assert.equal(fx.frontMotion, 'flank');
  assert.equal(fx.retreat, 'narrowing');
  assert.equal(fx.tone, 'unfavorable');
});

test('new injury is exposed as a transient visual mark only', () => {
  let state = wego.createEncounter({ clues: [], gear: 'long_spear' });
  state = wego.resolveRound(state, 'press');
  const plan = wego.enemyPlan(state);
  const next = wego.resolveRound(state, 'press');
  const fx = battlefield.resolutionPresentation(state, next, plan, 'press');

  assert.ok(next.injury);
  assert.equal(fx.injury, next.injury);
  const record = wego.persistentRecord(wego.resolveRound(next, 'press'));
  assert.equal('resolutionPhase' in record, false);
  assert.equal('resolutionTone' in record, false);
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
