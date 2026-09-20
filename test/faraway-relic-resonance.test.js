const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SEALED_RELIC,
  AWAKENED_RELIC,
  discoverFarawayRelicResonance,
} = require('../src/faraway-relic-resonance');

const far = { regionKey: '35.700,139.700', label: '遠くの地域' };

test('sealed relic reacts after a coarse far journey', () => {
  const result = discoverFarawayRelicResonance('35.600,139.600', far, [SEALED_RELIC]);
  assert.equal(result.resonance?.distanceBand, 'far');
  assert.equal(result.resonance?.relicId, SEALED_RELIC);
  assert.match(result.resonance?.cue || '', /月片/);
  assert.deepEqual(result.state.resonatedRegions, [far.regionKey]);
});

test('nearby movement does not trigger relic resonance', () => {
  const result = discoverFarawayRelicResonance('35.690,139.690', far, [SEALED_RELIC]);
  assert.equal(result.resonance, null);
});

test('no sealed relic means no resonance', () => {
  const result = discoverFarawayRelicResonance('35.600,139.600', far, []);
  assert.equal(result.resonance, null);
});

test('already awakened relic no longer asks for a faraway clue', () => {
  const result = discoverFarawayRelicResonance('35.600,139.600', far, [SEALED_RELIC, AWAKENED_RELIC]);
  assert.equal(result.resonance, null);
});

test('same coarse region only resonates once', () => {
  const first = discoverFarawayRelicResonance('35.600,139.600', far, [SEALED_RELIC]);
  const second = discoverFarawayRelicResonance('35.600,139.600', far, [SEALED_RELIC], first.state);
  assert.equal(second.resonance, null);
  assert.deepEqual(second.state.resonatedRegions, [far.regionKey]);
});
