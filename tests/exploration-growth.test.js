const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const F=require('../src/expedition-field.js');
const fresh=()=>({...E.initial(),mode:'demo'});
const steps=(s,...tiles)=>tiles.reduce((n,t)=>E.act(n,'field-step:'+t),s);

test('investigating tracks and returning teaches only the traveler',()=>{
  let s=E.start(fresh(),'wood');
  s=steps(s,21,22,23,F.TRACKS);
  assert.equal(s.expedition.field.tracks,true);
  assert.equal(s.characters[0].skills.trailReading,undefined,'knowledge is not banked in the wilderness');
  assert.deepEqual(E.act(s,'field-follow-trail'),s,'first visit cannot claim advanced cache');
  const home=E.act(s,'return');
  assert.equal(home.characters[0].skills.trailReading,true);
  assert.equal(home.characters[1].skills.trailReading,undefined);
  assert.equal(home.report.newSkill,'trailReading');
  assert.deepEqual(E.parse(E.serialize(home)),home);
  const revisit=E.start({...home,report:null},'wood');
  const secondHome=E.act(revisit,'return');
  assert.equal(secondHome.report.newSkill,undefined,'do not award the skill twice');
});

test('new insight reveals a choice and blueprint only on the second expedition',()=>{
  let s=steps(E.start(fresh(),'wood'),21,22,23,F.TRACKS);
  s=E.act(s,'return');
  s=E.start({...s,report:null},'wood');
  const away=steps(s,21);
  assert.deepEqual(E.act(away,'field-follow-trail'),away,'cannot investigate from a remote tile');
  s=steps(s,21,22);
  assert.match(s.expedition.log[0],/獣道読み/);
  assert(!s.designs.fang_moon);
  const found=E.act(s,'field-follow-trail');
  assert.equal(found.expedition.foundDesign,'fang_moon');
  assert.deepEqual(E.act(found,'field-follow-trail'),found,'hidden cache cannot be repeated');
  assert.deepEqual(E.parse(E.serialize(found)),found);
  const returned=E.act(found,'return');
  assert.equal(returned.designs.fang_moon,'wood');
  assert.equal(returned.report.newDesign,'fang_moon');
  assert.deepEqual(E.parse(E.serialize(returned)),returned);
  let maker={...returned,report:null,materials:{...returned.materials,wolfFang:3},scrap:6};
  maker=E.switchCharacter(maker,1);
  maker=E.craftItem(maker,'fang_moon');
  assert(maker.owned.includes('fang_moon'));
  maker=E.switchCharacter(maker,0);
  maker=E.equip(maker,'fang_moon');
  assert.equal(E.combatProfile(maker).dodgeCost,0,'crafted gear changes future combat');
  assert.deepEqual(E.parse(E.serialize(maker)),maker);
});

test('old saves migrate without erasing characters, existing shrine or original recipes',()=>{
  const legacy=fresh();
  for(const c of legacy.characters)delete c.skills;
  const restored=E.parse(JSON.stringify(legacy));
  assert(restored);
  assert.deepEqual(restored.characters.map(c=>c.skills),[{},{},{}]);
  assert.equal(E.parse(E.serialize(restored)).characters[0].skills.trailReading,undefined);
  assert.deepEqual(E.RECIPES.shield.materials,{watchIron:2});
  const run=E.start(restored,'wood');
  const shrine=steps(run,21,22,F.TREASURE,F.SECRET,F.SECRET,F.SHRINE);
  assert.equal(shrine.expedition.field.shrine,true);
  assert.equal(shrine.expedition.foundDesign,undefined);
});

test('cannot forge the moon dagger without returning the earned blueprint',()=>{
  let s=fresh();
  s.scrap=100;s.materials.wolfFang=10;
  s=E.switchCharacter(s,1);
  assert.deepEqual(E.craftItem(s,'fang_moon'),s);
  const forged=E.craftItem({...s,designs:{fang_moon:'wood'}},'fang_moon');
  assert(forged.owned.includes('fang_moon'));
});
