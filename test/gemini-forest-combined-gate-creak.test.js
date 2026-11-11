'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../src/gemini-forest-discoveries.js');

test('shrine and tracks together earn an earlier gate creak, not a shortcut or reward',()=>{
  const found=new Set(['traces','shrine']);
  const at=distance=>({x:910-distance,z:235,state:'IDLE'});
  assert.equal(D.cueNear(at(135),found),null,'sound remains within its radial boundary');
  assert.equal(D.cueNear(at(134.9),found)?.id,'hollow');
  assert.equal(D.cueNear(at(125),new Set(['traces'])),null,
    'reading tracks alone does not grant the longer sound range');
  assert.equal(D.cueNear(at(125),new Set(['shrine'])),null,
    'finding the shrine alone does not grant the longer sound range');
  assert.equal(D.near(at(80),found),null,'sound never extends the 54-unit inspection range');
  assert.equal(D.uncover(at(80),found,'return',100,140,true,'cautious').ok,false,
    'hearing the gate cannot grant fangs or open a choice remotely');
  assert.deepEqual([...found],['traces','shrine'],'sensing cannot discover the gate');
  assert.equal(D.near(at(53),found)?.id,'hollow','normal inspection still works');
  assert.equal(D.cueNear(at(110),new Set(['traces','shrine','hollow'])),null,
    'an already discovered gate does not repeat its clue');
});

test('earned gate creak grows stronger only on approach, without early inspection',()=>{
  const both=new Set(['traces','shrine']);
  const at=distance=>({x:910-distance,z:235,state:'IDLE'});
  assert.equal(D.gateCreakIntensifies(at(85),both),false);
  assert.equal(D.gateCreakIntensifies(at(84.9),both),true);
  assert.equal(D.gateCreakIntensifies(at(54),both),true);
  assert.equal(D.gateCreakIntensifies(at(53),both),false);
  assert.equal(D.gateCreakIntensifies(at(80),new Set(['traces'])),false);
  assert.equal(D.gateCreakIntensifies(at(80),new Set(['shrine'])),false);
  assert.equal(D.gateCreakIntensifies(at(80),new Set(['traces','shrine','hollow'])),false);
  assert.equal(D.near(at(80),both),null);
  assert.equal(D.uncover(at(80),both,'return',100,140,true,'cautious').ok,false);
});
