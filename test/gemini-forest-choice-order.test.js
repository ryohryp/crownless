'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
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
  assert.equal(careful.damage,6);
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
  assert.equal(late.damage,6);
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
