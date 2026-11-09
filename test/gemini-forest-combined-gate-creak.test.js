'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../src/gemini-forest-discoveries.js');

test('shrine and tracks together earn an earlier gate creak, not a shortcut or reward',()=>{
  const found=new Set(['traces','shrine']);
  const at=distance=>({x:910-distance,z:235,state:'IDLE'});
  assert.equal(D.cueNear(at(115),found),null,'sound remains within its radial boundary');
  assert.equal(D.cueNear(at(114.9),found)?.id,'hollow');
  assert.equal(D.cueNear(at(110),new Set(['traces'])),null,
    'reading tracks alone does not grant the longer sound range');
  assert.equal(D.cueNear(at(110),new Set(['shrine'])),null,
    'finding the shrine alone does not grant the longer sound range');
  assert.equal(D.near(at(80),found),null,'sound never extends the 54-unit inspection range');
  assert.equal(D.uncover(at(80),found,'return',100,140,true,'cautious').ok,false,
    'hearing the gate cannot grant fangs or open a choice remotely');
  assert.deepEqual([...found],['traces','shrine'],'sensing cannot discover the gate');
  assert.equal(D.near(at(53),found)?.id,'hollow','normal inspection still works');
  assert.equal(D.cueNear(at(110),new Set(['traces','shrine','hollow'])),null,
    'an already discovered gate does not repeat its clue');
});
