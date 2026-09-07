const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = require('../src/reboot-prototype-state.js');
const p2 = require('../src/reboot-phase2-state.js');
const p3 = require('../src/reboot-phase3-state.js');
const p4 = require('../src/reboot-phase4-state.js');
const p5 = require('../src/reboot-phase5-state.js');

function reachHill(hillChoice, bellChoice = base.CHOICES.RING_BELL, crossingChoice = p2.CHOICES.CUT_CROSSING) {
  let state = base.discoverBellTower(base.createInitialState());
  state = base.applyBellChoice(state, bellChoice);
  state = p2.discoverOldCrossing(state);
  state = p2.applyCrossingChoice(state, crossingChoice);
  state = p3.discoverBlackRavenHill(state);
  return p3.applyHillChoice(state, hillChoice);
}

function reachFork(hillChoice, firstVisit, bellChoice, crossingChoice) {
  return p4.discoverForkPlace(reachHill(hillChoice, bellChoice, crossingChoice), firstVisit);
}

const combinations = [
  {
    name: 'warned chapel + passed gate',
    hill: p3.CHOICES.SIGNAL_CHAPEL,
    first: p4.SALT_CHAPEL,
    key: p5.OUTCOME_KEYS.BLACK_CARGO,
    state: p5.OUTCOMES.BLACK_CARGO,
    title: '黒荷の市'
  },
  {
    name: 'exposed chapel + barricaded gate',
    hill: p3.CHOICES.SIGNAL_GATE,
    first: p4.SALT_CHAPEL,
    key: p5.OUTCOME_KEYS.DEAD_END,
    state: p5.OUTCOMES.DEAD_END,
    title: '行き止まりの市'
  },
  {
    name: 'warned gate + crowded chapel',
    hill: p3.CHOICES.SIGNAL_GATE,
    first: p4.RUINED_GATE,
    key: p5.OUTCOME_KEYS.CANVAS,
    state: p5.OUTCOMES.CANVAS,
    title: '布屋根の市'
  },
  {
    name: 'exposed gate + sealed chapel',
    hill: p3.CHOICES.SIGNAL_CHAPEL,
    first: p4.RUINED_GATE,
    key: p5.OUTCOME_KEYS.SALT_LANTERN,
    state: p5.OUTCOMES.SALT_LANTERN,
    title: '塩灯の市'
  }
];

test('collision place does not exist before Phase 4 chooses a first destination', () => {
  const state = p5.normalizeState(reachHill(p3.CHOICES.SIGNAL_CHAPEL));
  assert.equal(state.placeStates[p5.COLLISION_PLACE], 'unknown');
  assert.equal(state.consequences[p5.COLLISION_PLACE], null);
});

test('Phase 4 completion hints one shared collision place instead of another branch', () => {
  const state = p5.normalizeState(reachFork(p3.CHOICES.SIGNAL_CHAPEL, p4.SALT_CHAPEL));
  assert.equal(state.placeStates[p5.COLLISION_PLACE], 'hinted');
  assert.equal(state.consequences[p5.COLLISION_PLACE], p5.OUTCOME_KEYS.BLACK_CARGO);
  assert.ok(!state.discoveredPlaces.includes(p5.COLLISION_PLACE));
  const hint = p5.getCollisionHintPresentation(state);
  assert.match(hint.summary, /塩の礼拝堂/);
  assert.match(hint.summary, /朽ちた関門/);
});

for (const combo of combinations) {
  test(`collision outcome: ${combo.name} becomes ${combo.title}`, () => {
    const before = reachFork(combo.hill, combo.first);
    assert.equal(p5.deriveCollisionKey(before), combo.key);

    const discovered = p5.discoverCollisionPlace(before);
    assert.equal(discovered.placeStates[p5.COLLISION_PLACE], combo.state);
    assert.ok(discovered.discoveredPlaces.includes(p5.COLLISION_PLACE));

    const presentation = p5.getCollisionPresentation(discovered);
    assert.equal(presentation.title, combo.title);
    assert.equal(presentation.collisionKey, combo.key);
    assert.ok(presentation.sources.chapel.state);
    assert.ok(presentation.sources.gate.state);
  });
}

test('all four histories produce distinct place names, marks, and visuals', () => {
  const presentations = combinations.map((combo) => {
    const state = p5.discoverCollisionPlace(reachFork(combo.hill, combo.first));
    return p5.getCollisionPresentation(state);
  });
  assert.equal(new Set(presentations.map((item) => item.title)).size, 4);
  assert.equal(new Set(presentations.map((item) => item.mark)).size, 4);
  assert.equal(new Set(presentations.map((item) => item.visual)).size, 4);
});

test('collision arrival preserves the actor from the earlier Bell Tower and Old Crossing history', () => {
  const before = reachFork(
    p3.CHOICES.SIGNAL_CHAPEL,
    p4.SALT_CHAPEL,
    base.CHOICES.RING_BELL,
    p2.CHOICES.CUT_CROSSING
  );
  const state = p5.discoverCollisionPlace(before);
  const presentation = p5.getCollisionPresentation(state);
  assert.match(presentation.history, /黒旗の一団と王兵/);
  assert.equal(presentation.actor, '黒旗の一団と王兵');
});

test('collision discovery is idempotent and remains derived from history', () => {
  const before = reachFork(p3.CHOICES.SIGNAL_GATE, p4.RUINED_GATE);
  const once = p5.discoverCollisionPlace(before);
  const twice = p5.discoverCollisionPlace(once);
  assert.deepEqual(twice, p5.normalizeState(once));
  assert.equal(twice.placeStates[p5.COLLISION_PLACE], p5.OUTCOMES.CANVAS);
});

test('collision outcome survives reload while raw location data is stripped', () => {
  const before = reachFork(p3.CHOICES.SIGNAL_CHAPEL, p4.RUINED_GATE);
  const state = p5.discoverCollisionPlace(before);
  const serialized = p5.serializeState({
    ...state,
    latitude: 35.7,
    longitude: 139.8,
    coords: { latitude: 35.7 },
    routeHistory: [{ latitude: 35.7 }]
  });
  const reloaded = p5.parseState(serialized);
  assert.equal(reloaded.placeStates[p5.COLLISION_PLACE], p5.OUTCOMES.SALT_LANTERN);
  assert.ok(reloaded.discoveredPlaces.includes(p5.COLLISION_PLACE));
  assert.doesNotMatch(serialized, /latitude|longitude|routeHistory|coords|track/i);
});

test('Phase 5 UI converges two routes without adding another fate choice', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase5-controller.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-phase5.css'), 'utf8');

  assert.match(html, /id="collision-summary"/);
  assert.match(html, /id="dev-walk-collision"/);
  assert.match(html, /DEV: 二つの痕跡が交わる場所へ向かう/);
  assert.match(html, /reboot-phase5-state\.js/);
  assert.match(html, /reboot-phase5-controller\.js/);
  assert.match(html, /reboot-phase5\.css/);
  assert.match(controller, /collision-from-chapel/);
  assert.match(controller, /collision-from-gate/);
  assert.match(controller, /discoverCollisionPlace\(state\)/);
  assert.match(css, /data-collision-state/);

  const phase5Section = html.match(/<section id="collision-summary"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(phase5Section, /data-choice=/);
  assert.doesNotMatch(html + controller, /expedition-system|territory-phase1|world-atlas\.js|save-system\.js/);
});
