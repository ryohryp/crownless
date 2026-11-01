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
  const buttonLabel = (unbanked, result = true) => {
    const button = { textContent: '', classList: { toggle: () => {} } };
    vm.runInNewContext(html.slice(labelStart, labelEnd), {
      document: { getElementById: () => button },
      result, rpg: { unbanked }
    });
    return button.textContent;
  };
  assert.match(buttonLabel(3), /牙3個を倉庫へ持ち帰る/);
  assert.match(buttonLabel(0), /素材なし/);
  assert.equal(buttonLabel(3, false), '', 'no return action while in camp or combat');

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
