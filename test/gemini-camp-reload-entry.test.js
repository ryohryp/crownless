'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('saved camp reload restores the actual RPG entry after stage initialization (#1064)', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const onloadStart = html.indexOf('  window.onload = () => {');
  const onloadEnd = html.indexOf('\n  };', onloadStart);
  assert.ok(onloadStart >= 0 && onloadEnd > onloadStart, 'live startup handler exists');
  const calls = [];
  const window = {};
  new Function('window', 'applyCombatInputMode', 'initStage', 'updateRpgStatus',
    'showRpgPanel', 'requestAnimationFrame', 'gameLoop', html.slice(onloadStart, onloadEnd + 5))(
    window, () => calls.push('input'), () => calls.push('stage'),
    () => calls.push('status'), () => calls.push('panel'),
    () => calls.push('frame'), () => {});
  window.onload();
  assert.deepEqual(calls, ['input', 'stage', 'status', 'panel', 'frame'],
    'the saved phase must be restored before reopening the camp panel and scheduling frames');

  const panelStart = html.indexOf('  function showRpgPanel() {');
  const panelEnd = html.indexOf('    const unexploredCue=', panelStart);
  assert.ok(panelStart >= 0 && panelEnd > panelStart, 'live panel visibility code exists');
  const visibleFor = phase => {
    const toggles = [];
    const document = {getElementById: id => {
      assert.equal(id, 'rpgPanel');
      return {classList: {toggle: (name, hidden) => toggles.push([name, hidden])}};
    }};
    new Function('document', 'rpg', html.slice(panelStart, panelEnd) + '\n}\nshowRpgPanel();')(
      document, {phase});
    return toggles;
  };
  assert.deepEqual(visibleFor('camp'), [['hidden', false]],
    'saved camp must expose the entry to forge and depart');
  assert.deepEqual(visibleFor('return'), [['hidden', false]],
    'victory must expose the living-return decision');
  assert.deepEqual(visibleFor('fight'), [['hidden', true]],
    'active combat must not overlay the RPG panel');
});
