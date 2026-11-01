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
  assert.match(feedback(2.4), /石門の観察が効いた！先手 \\+12/,
    'a lethal first strike must still produce its earned popup even if the guardian HUD disappears');
  assert.match(feedback(1.8), /先手成功！\\+12/);
  assert.doesNotMatch(feedback(1.8), /石門の観察が効いた/,
    'tracks-only scouting must not claim a gate-first reward');
});
