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

test('camp reload exposes the actual re-expedition button, not just its parent panel (#1064)', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  assert.match(html, /id="rpgDepart"/, 'the re-expedition button exists');
  const start = html.indexOf("    const depart=document.getElementById('rpgDepart');");
  const end = html.indexOf('\n', html.indexOf("    depart.classList.toggle('hidden', !camp);", start));
  assert.ok(start >= 0 && end > start, 'live camp-dependent depart visibility exists');
  const visibleFor = phase => {
    let hidden;
    const document = {getElementById: id => {
      assert.equal(id, 'rpgDepart');
      return {classList: {toggle: (name, value) => {
        assert.equal(name, 'hidden');
        hidden = value;
      }}};
    }};
    new Function('document', 'camp', html.slice(start, end))(
      document, phase === 'camp');
    return !hidden;
  };
  assert.equal(visibleFor('camp'), true, 'saved camp exposes re-expedition');
  assert.equal(visibleFor('return'), false, 'return requires banking first');
  assert.equal(visibleFor('fight'), false, 'combat cannot start another expedition');
  assert.match(html, /getElementById\('rpgDepart'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{\s*if\s*\(!rpgRules\.depart\(rpg\)\)\s*return;/,
    'visible button remains wired to the actual depart rule');
});

test('forest clue follow-up names the unsecured material risk on the actual choice (#1064)', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('    const unsecuredRisk=');
  const end = html.indexOf('\n', html.indexOf('    keepExploring.textContent=', start));
  assert.ok(start > 0 && end > start, 'live exploration choice risk label exists');
  const label = (unbanked, clue) => {
    const keepExploring = {textContent: ''};
    new Function('rpg', 'unexploredCue', 'keepExploring', html.slice(start, end))(
      {unbanked}, clue, keepExploring);
    return keepExploring.textContent;
  };
  assert.match(label(3, 'hint'), /気配を追って調べる.*未帰還の牙3個・敗北で喪失/);
  assert.match(label(2, ''), /森の探索を続ける.*未帰還の牙2個・敗北で喪失/);
  assert.doesNotMatch(label(0, 'hint'), /敗北で喪失/, 'no loot means no false loss warning');
});

test('camp re-expedition click starts a fresh battle without replaying a bank action (#1064)', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf("  document.getElementById('rpgDepart').addEventListener('click', () => {");
  const end = html.indexOf("\n  });", start);
  assert.ok(start >= 0 && end > start, 'real re-expedition click handler exists');
  let departClick;
  const document = {getElementById: id => {
    assert.equal(id, 'rpgDepart');
    return {addEventListener: (event, handler) => {
      assert.equal(event, 'click');
      departClick = handler;
    }};
  }};
  const calls = [];
  const state = {waveCount: 7, tokenManager: null, kabukiBurstTimer: 10};
  const rpg = {phase: 'camp', banked: 3, unbanked: 0};
  const rpgRules = {depart: run => {
    assert.equal(run, rpg);
    calls.push('depart');
    return true;
  }};
  class BattleTokenManager {
    constructor(count) { this.count = count; }
  }
  new Function('document', 'rpgRules', 'rpg', 'state', 'BattleTokenManager',
    'initStage', 'updateRpgStatus', 'showRpgPanel',
    html.slice(start, end + 5))(
    document, rpgRules, rpg, state, BattleTokenManager,
    () => calls.push('stage'), () => calls.push('status'), () => calls.push('panel'));
  assert.equal(typeof departClick, 'function');
  departClick();
  assert.deepEqual(calls, ['depart', 'stage', 'status', 'panel']);
  assert.equal(state.waveCount, 1, 'next expedition starts at the first wave');
  assert.equal(state.tokenManager.count, 2);
  assert.equal(state.kabukiBurstTimer, 0);
  assert.equal(rpg.banked, 3, 'departing does not spend safely banked materials');
});

test('re-expedition rejects a blocked departure without resetting battle or stored loot (#1064)', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf("  document.getElementById('rpgDepart').addEventListener('click', () => {");
  const end = html.indexOf("\n  });", start);
  assert.ok(start >= 0 && end > start, 'real departure handler exists');
  let click;
  const document = {getElementById: id => {
    assert.equal(id, 'rpgDepart');
    return {addEventListener: (type, handler) => {
      assert.equal(type, 'click');
      click = handler;
    }};
  }};
  const rpg = {phase: 'return', banked: 5, unbanked: 2};
  const state = {waveCount: 7, tokenManager: {existing: true}, kabukiBurstTimer: 9};
  const before = JSON.stringify({rpg, state});
  const rpgRules = {depart: run => {
    assert.equal(run, rpg);
    return false;
  }};
  new Function('document', 'rpgRules', 'rpg', 'state', 'BattleTokenManager',
    'initStage', 'updateRpgStatus', 'showRpgPanel',
    html.slice(start, end + 5))(
    document, rpgRules, rpg, state, class BattleTokenManager {},
    () => assert.fail('blocked departure must not reset the stage'),
    () => assert.fail('blocked departure must not refresh the status'),
    () => assert.fail('blocked departure must not alter the panel'));
  click();
  assert.equal(JSON.stringify({rpg, state}), before,
    'failed departure preserves unbanked and banked materials and battle state');
});


test('rapid double-tap on re-expedition cannot reset the next battle twice (#1064)', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf("  document.getElementById('rpgDepart').addEventListener('click', () => {");
  const end = html.indexOf("\n  });", start);
  assert.ok(start >= 0 && end > start, 'live departure handler exists');
  let click;
  const document = {getElementById: id => {
    assert.equal(id, 'rpgDepart');
    return {addEventListener: (type, handler) => {
      assert.equal(type, 'click');
      click = handler;
    }};
  }};
  const rpg = {phase: 'camp', banked: 4, unbanked: 0};
  const state = {waveCount: 8, tokenManager: null, kabukiBurstTimer: 5};
  let stages = 0;
  const rpgRules = {depart: run => {
    if (run.phase !== 'camp') return false;
    run.phase = 'fight';
    return true;
  }};
  class BattleTokenManager { constructor(count) { this.count = count; } }
  new Function('document', 'rpgRules', 'rpg', 'state', 'BattleTokenManager',
    'initStage', 'updateRpgStatus', 'showRpgPanel', html.slice(start, end + 5))(
    document, rpgRules, rpg, state, BattleTokenManager,
    () => { stages++; }, () => {}, () => {});
  assert.equal(typeof click, 'function');
  click();
  const tokenManager = state.tokenManager;
  click();
  assert.equal(stages, 1, 'a second tap must not initialize another battle');
  assert.equal(state.tokenManager, tokenManager, 'battle tokens remain from first departure');
  assert.equal(rpg.phase, 'fight');
  assert.equal(rpg.banked, 4, 'double-tap cannot consume stored materials');
});
