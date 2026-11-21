const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const F=require('../src/expedition-field.js');

test('staged foraging state is a valid saved forest field',()=>{
 const f={...F.initial(),tracks:true,pos:F.TRACKS,seen:2**F.TRACKS+2**17+2**19,foragingStage:1};
 assert.equal(F.valid(f),true);
 assert.equal(F.valid({...f,foragingStage:99}),false);
 assert.equal(F.valid({...f,foragingDone:true}),true);
});
test('forest starts with a fresh, valid staged encounter',()=>{
 const f=F.initial();
 assert.equal(F.valid(f),true);
 assert.equal(f.foragingStage,0);
 assert.equal(f.foragingDone,false);
});

test('foraging at full herb capacity does not consume the one-time choice',()=>{
 let s=E.start({...E.initial(),mode:'demo'},'wood');
 for(const pos of [21,22,23,F.TRACKS])s=E.act(s,'field-step:'+pos);
 assert.equal(s.expedition.field.tracks,true);
 const full={...s,expedition:{...s.expedition,potions:3}};
 assert.equal(E.act(full,'forest-forage-herbs'),full);
 assert.equal(full.expedition.field.foragingDone,false);
 const partial={...s,expedition:{...s.expedition,potions:2}};
 const gathered=E.act(partial,'forest-forage-herbs');
 assert.equal(gathered.expedition.potions,3);
 assert.equal(gathered.expedition.field.foragingDone,true);
 assert.equal(E.act(gathered,'forest-forage-herbs'),gathered);
});
