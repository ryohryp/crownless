'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const D = require('../src/gemini-forest-discoveries.js');
const R = require('../src/gemini-rpg-loop.js');

const tracks = {x:800,z:365,state:'IDLE'};
const shrine = {x:660,z:230,state:'IDLE'};
const gate = {x:910,z:235,state:'IDLE'};

test('gate-first cautious scouting earns a later opening; shrine-first cannot earn it retroactively', () => {
  const gateFirst = new Set();
  assert.equal(D.uncover(tracks,gateFirst,'return',140,140).ok,true);
  const careful = D.uncover(gate,gateFirst,'return',100,140,false,'cautious');
  assert.equal(careful.ok,true);
  assert.equal(careful.material,1);
  assert.equal(careful.damage,6,'gate-first keeps its original wound cost');
  assert.equal(gateFirst.has('hollow-scout'),true);
  assert.equal(D.guardianOpeningSeconds(gateFirst),2.4);
  assert.equal(gateFirst.has('shrine'),false,'the detour cannot auto-discover the shrine');

  const shrineFirst = new Set();
  assert.equal(D.uncover(tracks,shrineFirst,'return',140,140).ok,true);
  const safe = D.uncover(shrine,shrineFirst,'return',140,140,false,'material');
  assert.equal(safe.ok,true);
  assert.equal(safe.material,1);
  const late = D.uncover(gate,shrineFirst,'return',100,140,false,'cautious');
  assert.equal(late.ok,true,'the late gate still offers its one-fang salvage');
  assert.equal(late.material,1);
  assert.equal(late.damage,4,'shrine-first moss knowledge saves 2 HP on careful salvage');
  assert.equal(shrineFirst.has('hollow-scout'),false,
    'an already visited shrine cannot grant a phantom future guardian bonus');
  assert.equal(D.guardianOpeningSeconds(shrineFirst),1.8,
    'tracks remain useful, but late salvage cannot change a past encounter');
});

test('shrine-first late salvage remains provisional, one-time and lost on defeat', () => {
  const found = new Set();
  const run = R.create();
  assert.equal(R.clearWave(run),true);
  for (const [spot,choice] of [[tracks,'auto'],[shrine,'material'],[gate,'cautious']]) {
    const result = D.uncover(spot,found,run.phase,100,140,false,choice);
    assert.equal(result.ok,true);
    for (let i=0;i<result.material;i++) assert.equal(R.claimMaterial(run),true);
  }
  assert.equal(run.unbanked,3);
  assert.equal(run.banked,0);
  assert.equal(D.uncover(gate,found,run.phase,94,140,false,'cautious').ok,false,
    'late salvage cannot be repeated in the same expedition');
  assert.equal(found.has('hollow-scout'),false);
  assert.equal(R.loseExpedition(run),true);
  assert.equal(run.unbanked,0);
  assert.equal(run.banked,0);
});

test('late track discovery feedback never promises a retroactive shrine injury reduction', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf("      spawnPopup(discovery.spot.id==='shrine' && discovery.damage?");
  const suffix = ",f.x,f.z,f.y+48,'#fde68a');";
  const end = html.indexOf(suffix, start);
  assert(start >= 0 && end > start, 'evaluate the live discovery popup expression');
  const popup = html.slice(start, end + suffix.length);
  const messageFor = ids => {
    const messages = [];
    vm.runInNewContext(popup, {
      discovery: {spot: {id: 'traces'}, material: 1, damage: 0},
      state: {forestFinds: new Set(['traces', ...ids])},
      spawnPopup: message => messages.push(message),
      f: {x: 800, z: 365, y: 0}
    });
    assert.equal(messages.length, 1);
    return messages[0];
  };
  const early = messageFor([]);
  assert.match(early, /牙 \+1（未帰還）/);
  assert.match(early, /この先の危険な調査で負傷 -3/);
  assert.doesNotMatch(early, /祠|石門|右|左/,
    'an unvisited site must remain undisclosed');
  const late = messageFor(['shrine']);
  assert.match(late, /牙 \+1（未帰還）/);
  assert.match(late, /済んだ調査には効かない/);
  assert.match(late, /まだ茨の軋みを追える/,
    'shrine-first readers get a sensory lead to the still-unexplored gate');
  assert.doesNotMatch(late, /祠|石門|右|左|負傷 -3|3軽減/,
    'do not reveal the gate location or retroactively change shrine injury');
  const found = new Set(['shrine']);
  const gate = {x:910,z:235};
  assert.equal(D.uncover(gate,found,'return',140,140,false,'cautious').reason,'trail',
    'the gate remains blocked until the player actually reads the tracks');
  const tracks = D.uncover({x:800,z:365},found,'return',140,140);
  assert.equal(tracks.ok,true);
  assert.equal(tracks.material,1);
  const afterClue = D.uncover(gate,found,'return',140,140,false,'cautious');
  assert.equal(afterClue.ok,true,
    'late track reading makes the gate choice available without auto-discovery');
  assert.equal(afterClue.material,1);
  assert.equal(found.has('hollow-scout'),false,
    'shrine-first exploration never earns a retroactive guardian opening');
});

test('shrine-first moss seam changes a real gate choice, not forceful loot or the guardian', () => {
  for (const [crafted,tempered,ordinary,afterShrine] of [
    [false,false,6,4], [true,false,3,1], [true,true,0,0]
  ]) {
    assert.equal(D.gateSalvageDamage('cautious',tempered,crafted,false),ordinary);
    assert.equal(D.gateSalvageDamage('cautious',tempered,crafted,true),afterShrine);
    const found=new Set(['traces','shrine']);
    if(afterShrine>0){
      assert.equal(D.uncover(gate,found,'return',afterShrine,140,crafted,'cautious',tempered).reason,'weak',
        'the moss seam cannot permit a lethal salvage');
      assert.equal(found.has('hollow'),false,'a rejected choice never consumes the gate');
    }
    const reward=D.uncover(gate,found,'return',afterShrine+1,140,crafted,'cautious',tempered);
    assert.equal(reward.ok,true);
    assert.equal(reward.damage,afterShrine);
    assert.equal(reward.material,1,'safer salvage never increases the unbanked reward');
    assert.equal(found.has('hollow-scout'),false,
      'shrine-first exploration never creates a retroactive guardian bonus');
    assert.equal(D.uncover(gate,found,'return',140,140,crafted,'cautious',tempered).ok,false,
      'the reward remains one-time');
  }
  assert.equal(D.gateSalvageDamage('material',false,true,true),8,
    'shrine knowledge does not make forceful two-fang salvage safer');
  assert.equal(D.gateSalvageDamage('material',true,true,true),4);
});
