'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const D = require('../src/gemini-forest-discoveries.js');

test('earned gate scouting is acknowledged after shrine deep search only when it saves HP', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf("      spawnPopup(discovery.spot.id==='shrine' && discovery.damage?");
  const suffix = ",f.x,f.z,f.y+48,'#fde68a');";
  const end = html.indexOf(suffix, start);
  assert(start >= 0 && end > start, 'use the actual live reward popup');
  const popup = html.slice(start, end + suffix.length);

  function inspect(foundIds, crafted, tempered) {
    const found = new Set(foundIds);
    const discovery = D.uncover(
      {x:660,z:230,state:'IDLE'}, found, 'return', 100, 140,
      crafted, 'risk', tempered
    );
    assert.equal(discovery.ok, true);
    assert.equal(discovery.material, 2, 'the deeper reward remains provisional');
    const messages = [];
    vm.runInNewContext(popup, {
      discovery, state:{forestFinds:found}, rpg:{crafted,tempered},
      spawnPopup:message=>messages.push(message),
      f:{x:660,z:230,y:0}
    });
    assert.equal(messages.length, 1);
    return {message:messages[0],damage:discovery.damage};
  }

  const ordinary = inspect(['traces'],true,false);
  assert.equal(ordinary.damage,3);
  assert.match(ordinary.message,/祠の奥で牙 \+2（未帰還）／HP -3/);
  assert.doesNotMatch(ordinary.message,/石門で覚えた|負傷 -1/);

  const scouted = inspect(['traces','hollow','hollow-scout'],true,false);
  assert.equal(scouted.damage,2);
  assert.match(scouted.message,/石門で覚えた茨の揺れを読み、負傷 -1/);
  assert.match(scouted.message,/祠の奥で牙 \+2（未帰還）／HP -2/);
  assert.doesNotMatch(scouted.message,/右|左|隠し道|帰還済み/);

  const tempered = inspect(['traces','hollow','hollow-scout'],true,true);
  assert.equal(tempered.damage,1, 'the 1 HP floor remains');
  assert.match(tempered.message,/祠の奥で牙 \+2（未帰還）／HP -1/);
  assert.doesNotMatch(tempered.message,/負傷 -1|石門で覚えた/,
    'do not claim an ineffective scouting discount for a tempered blade');
});


test('the actual landed scouting strike popup distinguishes earned gate-first +12 from tracks-only +12', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('        if (scoutBonus) {\\n'.replace('\\n', '\n'));
  const end = html.indexOf('        spawnSpark(', start);
  assert(start >= 0 && end > start, 'inspect the live landed-hit feedback, not a copied message');
  const landedHit = html.slice(start, end);
  function feedback(openingSeconds) {
    const target = {scoutOpeningSeconds:openingSeconds, x:0, z:0, y:0};
    const messages = [];
    vm.runInNewContext(landedHit, {
      scoutBonus:12, target,
      performance:{now:()=>1000},
      spawnPopup:(message)=>messages.push(message)
    });
    assert.equal(target.scoutStrikeClaimed, true);
    assert.equal(messages.length, 1);
    return messages[0];
  }
  assert.match(feedback(2.4), /石門の観察が効いた！先手 \+12/,
    'a lethal first strike must still produce its earned popup even if the guardian HUD disappears');
  assert.match(feedback(1.8), /先手成功！\+12/);
  assert.doesNotMatch(feedback(1.8), /石門の観察が効いた/,
    'tracks-only scouting must not claim a gate-first reward');
});

test('earned cold-air clue strengthens on approach without naming or revealing the shrine', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf(": rpg.phase==='return' && cue?.id==='shrine' && !near");
  const end = html.indexOf(": state.forestFinds.has('traces')", start);
  assert(start >= 0 && end > start, 'test the live exploration HUD branch');
  const expression = html.slice(start + 1, end).trim() + ' : null';

  function hint(distance, foundIds, phase = 'return') {
    const found = new Set(foundIds);
    const ginji = {x:660 + distance, z:230};
    const near = D.near(ginji, found);
    const cue = D.cueNear(ginji, found);
    return {
      near, cue,
      label: vm.runInNewContext(expression, {rpg:{phase}, cue, near, ginji})
    };
  }

  const scouted = ['traces','hollow','hollow-scout'];
  const far = hint(120, scouted);
  assert.equal(far.cue?.id, 'shrine');
  assert.equal(far.near, null, 'the far cue must not enable early inspection');
  assert.match(far.label, /冷たい風が頬をかすめる/);
  const closer = hint(80, scouted);
  assert.equal(closer.near, null);
  assert.match(closer.label, /冷たい風が強くなる/);
  for (const label of [far.label, closer.label]) {
    assert.doesNotMatch(label, /祠|右|左|北|南|隠し道|タップ/);
  }
  assert.equal(hint(120, ['traces']).label, null,
    'without gate scouting the 135-unit early breeze is not earned');
  assert.match(hint(80, ['traces']).label, /冷たい風が強くなる/,
    'ordinary track readers still notice the nearer breeze');
  assert.equal(hint(40, scouted).label, null,
    'within the normal interaction radius the existing near-site HUD wins');
  assert.equal(hint(80, scouted, 'fight').label, null,
    'a distant clue must not override combat objectives');
  assert.equal(hint(80, ['traces','shrine']).label, null,
    'an already discovered site must not advertise a new clue');
});

test('earned distant thorn creak stays readable until the player reaches the gate', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('    const label=guardian' + String.fromCharCode(10));
  const end = html.indexOf('    if(hint.textContent!==label)', start);
  assert(start >= 0 && end > start, 'exercise the actual live HUD expression');
  const source = html.slice(start, end) + String.fromCharCode(10) + 'label';
  function observe(x, z, ids, phase = 'return') {
    const found = new Set(ids);
    const ginji = {x, z, hp:100, maxHp:140};
    const near = D.near(ginji, found);
    const cue = D.cueNear(ginji, found);
    const label = vm.runInNewContext(source, {
      guardian:null, near, cue, ginji,
      state:{forestFinds:found},
      rpg:{phase, crafted:false, unbanked:1}
    });
    return {near, cue, label, found};
  }

  const distant = observe(830, 270, ['traces']);
  assert.equal(distant.near, null, 'a sound cue cannot enable distant inspection');
  assert.equal(distant.cue?.id, 'hollow', 'reading tracks earns the far gate sound');
  assert.match(distant.label, /枝が軋む音がする。音が強まる場所を探そう/);
  const closer = observe(850, 270, ['traces']);
  assert.equal(closer.near, null, 'stronger sound must not enable early inspection');
  assert.equal(closer.cue?.id, 'hollow');
  assert.match(closer.label, /枝の軋みが強くなる。もう少し周囲を探そう/,
    'the sound grows stronger as the player searches nearby');
  for (const clue of [distant, closer]) {
    assert.doesNotMatch(clue.label, /石門|祠|右|左|北|南|隠し道|タップ/,
      'the sound must not name the gate, disclose a route or offer early tapping');
    assert.equal(clue.found.has('hollow'), false, 'the clue never auto-discovers the gate');
  }

  assert.doesNotMatch(observe(850, 270, []).label, /枝が軋む音がする/,
    'without reading tracks the early clue is not earned');
  assert.doesNotMatch(observe(850, 270, ['traces', 'hollow']).label, /枝.*軋/,
    'an already inspected gate no longer advertises a mystery');
  const atGate = observe(910, 235, ['traces']);
  assert.equal(atGate.near?.id, 'hollow');
  assert.doesNotMatch(atGate.label, /枝が軋む音がする/,
    'inside normal interaction range the tap-to-investigate prompt wins');
  assert.doesNotMatch(observe(850, 270, ['traces'], 'fight').label, /枝.*軋/,
    'distant exploration clues never override combat');
});
