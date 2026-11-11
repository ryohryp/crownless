'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/gemini-action-save.js');
const R = require('../src/gemini-rpg-loop.js');
const fs = require('node:fs');
const vm = require('node:vm');

test('action-lab progress has its own per-mode save key, never production key', () => {
  assert.equal(P.key('demo'), 'crownless-action-forest-v1-demo');
  assert.equal(P.key('walk'), 'crownless-action-forest-v1-walk');
  assert.equal(P.key('bogus'), null);
  assert.notEqual(P.key('demo'), P.key('walk'));
  assert.doesNotMatch(P.key('demo'), /crownless-expedition-v1/);
});

test('only genuinely returned materials and smith equipment survive a reload', () => {
  const expedition = R.create();
  R.claimMaterial(expedition);
  R.claimMaterial(expedition);
  R.claimMaterial(expedition);
  assert.deepEqual(JSON.parse(P.encode(expedition)), { version: 1, banked: 0, crafted: false, tempered: false },
    'unreturned battle loot must never be written');
  R.clearWave(expedition);
  R.returnAlive(expedition, 10);
  const savedAfterReturn = P.encode(expedition);
  const resumed = R.create();
  assert.equal(P.restore(resumed, P.decode(savedAfterReturn)), true);
  assert.equal(resumed.banked, 3);
  assert.equal(resumed.crafted, false);
  assert.equal(resumed.phase, 'camp');
  assert.equal(R.depart(resumed), true, 'saved camp can deliberately begin the next fight');
  assert.equal(resumed.phase, 'fight');
  assert.equal(resumed.unbanked, 0);
  R.loseExpedition(resumed);
  assert.equal(resumed.banked, 3, 'a later defeat cannot erase a previous safe return');
  R.forge(expedition);
  assert.equal(expedition.crafted, true);
  const savedAfterForge = P.encode(expedition);
  const future = R.create();
  P.restore(future, P.decode(savedAfterForge));
  assert.equal(future.crafted, true);
  assert.equal(future.banked, 0);
  assert.equal(future.unbanked, 0);
});

test('saved camp restores only secured loot and offers a real next departure', () => {
  const s = R.create();
  R.claimMaterial(s);
  R.clearWave(s);
  assert.equal(R.returnAlive(s, 70), true);
  const raw = P.encode(s);
  assert.equal(JSON.parse(raw).camp, true);
  const restored = R.create();
  assert.equal(P.restore(restored, P.decode(raw)), true);
  assert.equal(restored.phase, 'camp');
  assert.equal(restored.banked, 1);
  assert.equal(restored.unbanked, 0);
  assert.equal(R.depart(restored), true);
  assert.equal(restored.phase, 'fight');
  assert.equal(restored.unbanked, 0);
  R.claimMaterial(restored);
  const interrupted = R.create();
  assert.equal(P.restore(interrupted, P.decode(P.encode(restored))), true);
  assert.equal(interrupted.phase, 'fight');
  assert.equal(interrupted.unbanked, 0, 'interrupted expedition loot cannot be restored');
  assert.equal(interrupted.banked, 1);
});

test('new storage is empty but corrupted/versioned data is rejected rather than rewritten', () => {
  assert.deepEqual(P.decode(null), { version: 1, banked: 0, crafted: false, tempered: false });
  for (const raw of [
    '', '{}', 'invalid JSON', '[]', '{"version":2,"banked":3,"crafted":true}',
    '{"version":1,"banked":-1,"crafted":true}',
    '{"version":1,"banked":1.2,"crafted":true}',
    '{"version":1,"banked":1000001,"crafted":true}',
    '{"version":1,"banked":1,"crafted":"yes"}',
    '{"version":1,"banked":0,"crafted":false,"tempered":true}',
    '{"version":1,"banked":0,"crafted":true,"tempered":"yes"}',
    '"hello"', '0', 'null',
    '{"version":1,"banked":0,"crafted":false,"camp":"yes"}', 'a'.repeat(2001),
  ]) assert.equal(P.decode(raw), null, 'unsafe save: ' + raw.slice(0, 50));
  assert.throws(() => P.encode({ banked: NaN, crafted: false }), /invalid/);
  assert.throws(() => P.encode({ banked: 5, crafted: null }), /invalid/);
});

test('saves are content-minimal and never disclose coordinates, routes or user location', () => {
  const encoded = P.encode({ banked: 7, crafted: true, unbanked: 100,
    phase: 'return', latitude: 35.7, longitude: 139.8, path: '/secret' });
  assert.equal(encoded, '{"version":1,"banked":7,"crafted":true,"tempered":false}');
  assert.equal(Object.keys(JSON.parse(encoded)).length, 4);
});


test('tempered sword persists after safe return, while current v1 saves still load', () => {
  const old = P.decode('{"version":1,"banked":5,"crafted":true}');
  assert.equal(old.tempered, false);
  const s = R.create();
  assert.equal(P.restore(s, old), true);
  assert.equal(R.temper(s), false, 'restoring enters combat, not the camp');
  R.clearWave(s);
  R.returnAlive(s, 70);
  assert.equal(R.temper(s), true);
  const saved = P.encode(s);
  const fresh = R.create();
  assert.equal(P.restore(fresh, P.decode(saved)), true);
  assert.equal(fresh.tempered, true);
  assert.equal(fresh.banked, 0);
  assert.equal(fresh.unbanked, 0);
  assert.equal(fresh.phase, 'camp');
  assert.equal(R.depart(fresh), true);
});

test('safe return previews the unsecured haul and celebrates only actual banking', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const labelStart = html.indexOf("    const returnButton=document.getElementById('rpgReturn');");
  const labelEnd = html.indexOf('    const pushDeeper=', labelStart);
  assert(labelStart >= 0 && labelEnd > labelStart, 'inspect the live return-button formatter');
  const buttonLabel = (unbanked, result = true, banked = 0, crafted = false) => {
    const button = { textContent: '', classList: { toggle: () => {} } };
    vm.runInNewContext(html.slice(labelStart, labelEnd), {
      document: { getElementById: () => button },
      result, rpg: { unbanked, banked, crafted }, rpgRules: R
    });
    return button.textContent;
  };
  assert.match(buttonLabel(3), /牙3個を持ち帰る.*剣を作れる/,
    'a living return with the missing fangs unlocks a concrete smithing goal');
  assert.match(buttonLabel(2, true, 1), /牙2個を持ち帰る.*剣を作れる/,
    'already banked fangs count toward the threshold without being duplicated');
  assert.match(buttonLabel(2), /牙2個を倉庫へ持ち帰る/);
  assert.doesNotMatch(buttonLabel(2), /剣を作れる/,
    'an incomplete haul must not promise forging');
  assert.doesNotMatch(buttonLabel(2, true, 3), /剣を作れる/,
    'the cue must not claim a newly earned craft when the bank already suffices');
  assert.doesNotMatch(buttonLabel(3, true, 0, true), /剣を作れる/,
    'an already crafted sword cannot be crafted twice');
  assert.match(buttonLabel(0), /素材なし/);
  assert.equal(buttonLabel(3, false), '', 'no return action while in camp or combat');
  const ready = R.create();
  for (let i = 0; i < R.COST; i++) R.claimMaterial(ready);
  assert.equal(R.clearWave(ready), true);
  assert.equal(R.forge(ready), false, 'unbanked materials never craft in the field');
  assert.equal(R.returnAlive(ready, 50), true);
  assert.equal(R.forge(ready), true, 'only an actual living return unlocks forging');

  const start = html.indexOf("  document.getElementById('rpgReturn').addEventListener('click', () => {");
  const end = html.indexOf("  document.getElementById('rpgPush').addEventListener", start);
  assert(start >= 0 && end > start, 'exercise the actual return click handler');
  const invoke = (loot, hp, saveSucceeds = true) => {
    const run = R.create();
    for (let i = 0; i < loot; i++) R.claimMaterial(run);
    R.clearWave(run);
    const events = [];
    let onReturn;
    vm.runInNewContext(html.slice(start, end), {
      document: { getElementById: () => ({
        addEventListener: (_name, fn) => { onReturn = fn; }
      }) },
      rpgRules: R, rpg: run, ginji: { hp },
      sfx: { play: type => events.push('sound:' + type),
        haptic: pattern => events.push('haptic:' + Array.from(pattern).join(',')) },
      saveActionProgress: () => { events.push('save'); return saveSucceeds; },
      updateRpgStatus: () => events.push('status'),
      showRpgPanel: () => events.push('panel')
    });
    assert.equal(typeof onReturn, 'function');
    onReturn();
    return { run, events, onReturn };
  };
  assert.match(html.slice(start, end), /lastCampSaveSucceeded=saved;/,
    'the live return handler must record persistence status for the camp title');
  const successful = invoke(2, 80);
  assert.equal(successful.run.banked, 2);
  assert.equal(successful.run.unbanked, 0);
  assert.equal(successful.run.phase, 'camp');
  assert.deepEqual(successful.events, ['save', 'sound:coin', 'haptic:18,45,24', 'status', 'panel']);
  assert.equal(P.decode(P.encode(successful.run)).banked, 2,
    'celebration must not change the current secure-save contract');
  successful.onReturn();
  assert.equal(successful.events.length, 5, 'repeated taps cannot bank or celebrate twice');
  assert.deepEqual(invoke(0, 80).events, ['save', 'status', 'panel'],
    'a no-loot return is valid but has no loot fanfare');
  const unsaved = invoke(2, 80, false);
  assert.equal(unsaved.run.banked, 2, 'the session still shows returned loot');
  assert.deepEqual(unsaved.events, ['save', 'status', 'panel'],
    'a failed save must not play a false loot-secured sound or vibration');
  const defeated = invoke(2, 0);
  assert.equal(defeated.run.banked, 0);
  assert.equal(defeated.run.unbanked, 2);
  assert.deepEqual(defeated.events, [], 'failed return cannot celebrate or save a provisional bag');
});

test('smithing sound confirms saved gear, not an unsaved in-session change', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf("  document.getElementById('rpgForge').addEventListener('click', () => {");
  const end = html.indexOf("  document.getElementById('rpgBackToMap').addEventListener", start);
  assert(start >= 0 && end > start, 'exercise both real smithing click handlers');
  const handlers = html.slice(start, end);
  assert.equal((handlers.match(/lastCampSaveSucceeded=saved;/g) || []).length, 2,
    'forge and temper must also report their real persistence result');
  const invoke = (kind, saveSucceeds) => {
    const run = R.create();
    run.phase = 'camp';
    run.banked = kind === 'forge' ? R.COST : R.TEMPER_COST;
    run.crafted = kind === 'temper';
    const events = [];
    const clicks = {};
    vm.runInNewContext(handlers, {
      document: { getElementById: id => ({
        addEventListener: (name, fn) => {
          assert.equal(name, 'click');
          clicks[id] = fn;
        }
      }) },
      rpgRules: R, rpg: run,
      saveActionProgress: () => { events.push('save'); return saveSucceeds; },
      sfx: { play: sound => events.push('sound:' + sound) },
      updateRpgStatus: () => events.push('status'),
      showRpgPanel: () => events.push('panel')
    });
    const click = clicks[kind === 'forge' ? 'rpgForge' : 'rpgTemper'];
    assert.equal(typeof click, 'function');
    click();
    return { run, events, click };
  };
  for (const kind of ['forge', 'temper']) {
    const saved = invoke(kind, true);
    assert.deepEqual(saved.events, ['save', 'sound:heavy', 'status', 'panel'],
      kind + ' must play the earned smithing sound only after a successful save');
    assert.equal(saved.run.banked, 0);
    assert.equal(saved.run.crafted, true);
    assert.equal(saved.run.tempered, kind === 'temper');
    const restored = R.create();
    assert.equal(P.restore(restored, P.decode(P.encode(saved.run))), true);
    assert.equal(restored.crafted, true);
    assert.equal(restored.tempered, kind === 'temper');
    saved.click();
    assert.equal(saved.events.length, 4, 'repeat tap must not save or celebrate twice');

    const failed = invoke(kind, false);
    assert.deepEqual(failed.events, ['save', 'status', 'panel'],
      kind + ' must not claim a persisted result when storage fails');
    assert.equal(failed.run.crafted, true,
      'the existing in-session crafting outcome remains visible with the save warning');
    assert.equal(failed.run.tempered, kind === 'temper');
    failed.click();
    assert.equal(failed.events.length, 3, 'repeat tap must not mask a failed save');
  }
});


test('next-wave phone button shows the actual unsecured loss at the moment of choice', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf("    const pushDeeper=document.getElementById('rpgPush');");
  const end = html.indexOf("    document.getElementById('rpgForge').classList.toggle", start);
  assert(start >= 0 && end > start, 'exercise the live next-wave action label');
  const live = html.slice(start, end);
  const render = (hp, unbanked, result = true) => {
    const button = { textContent: '', classList: { toggle: () => {} } };
    vm.runInNewContext(live, {
      document: { getElementById: id => {
        assert.equal(id, 'rpgPush');
        return button;
      } },
      result, ginji: { hp, maxHp: 140 }, rpg: { unbanked }
    });
    return button.textContent;
  };
  assert.match(render(73.4, 2), /HP 73\/140・未帰還の牙 2個／敗北で喪失/,
    'the risk action itself must state the concrete provisional loss');
  assert.match(render(140, 0), /HP 140\/140・未帰還の牙 0個/);
  assert.doesNotMatch(render(140, 0), /敗北で喪失/,
    'an empty bag must not falsely claim there are materials to lose');
  assert.equal(render(140, 3, false), '', 'the next-wave action is absent outside the result phase');
});


test('restored camp never falsely claims a new living return', () => {
  // The compact save stores secured gear/loot and camp status, not the last
  // expedition outcome. In particular, a reload cannot infer a victory.
  const previous = R.create();
  previous.phase = 'camp';
  previous.banked = 2;
  previous.lastOutcome = 'defeated';
  const restored = R.create();
  assert.equal(P.restore(restored, P.decode(P.encode(previous))), true);
  assert.equal(restored.phase, 'camp');
  assert.equal(restored.lastOutcome, '');

  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('    const unsavedCampOutcome=');
  const end = html.indexOf('    // Tie the decision to the actual next craft', start);
  assert(start >= 0 && end > start, 'evaluate the live camp title formatter');
  const live = html.slice(start, end);
  const title = (phase, lastOutcome, lastCampSaveSucceeded = null) => {
    const node = { textContent: '' };
    vm.runInNewContext(live, {
      document: { getElementById: id => {
        assert.equal(id, 'rpgTitle');
        return node;
      } },
      result: phase === 'return', camp: phase === 'camp',
      state: { forestFinds: new Set() },
      rpg: { lastOutcome }, lastCampSaveSucceeded
    });
    return node.textContent;
  };
  assert.equal(title(restored.phase, restored.lastOutcome), 'キャンプで再開',
    'a restored camp must not invent a safe return');
  assert.equal(title('camp', 'returned', false), '⚠ 保存できない（成果はこの画面限り）',
    'failed persistence must not present a durable victory');
  assert.equal(title('camp', 'crafted', false), '⚠ 保存できない（成果はこの画面限り）',
    'unsaved smithing must not look permanently secured');
  assert.equal(title('camp', 'tempered', false), '⚠ 保存できない（成果はこの画面限り）');
  assert.equal(title('camp', 'defeated', false), '敗北。素材を失った……',
    'defeat is not a save celebration');
  assert.equal(title('camp', 'returned', true), '無事に生還！',
    'a living return in the current session retains its earned celebration');
  assert.equal(title('camp', 'defeated'), '敗北。素材を失った……',
    'an actual defeat still reports the loss');
  assert.equal(title('camp', 'crafted'), '鍛冶師の剣が完成！');
  assert.equal(title('camp', 'tempered'), '風裂きの剣を研ぎ直した！');
  assert.equal(title('return', 'victory'), '敵を退けた！ 帰還する？');
});
