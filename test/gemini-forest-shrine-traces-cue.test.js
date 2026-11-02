'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const D=require('../src/gemini-forest-discoveries.js');

test('shrine-first damp-soil scent is an earned cue, not an early track discovery',()=>{
  const far={x:740,z:330,state:'IDLE'};
  const found=new Set(['shrine']);
  assert.equal(D.near(far,found),null,'the 54-unit tap range is unchanged');
  assert.equal(D.cueNear(far,found)?.id,'traces',
    'after the shrine, damp soil can be sensed before tracks are inspectable');
  assert.equal(D.cueNear(far,new Set()),null,'no free clue before the shrine');
  assert.equal(D.cueNear({x:700,z:330},found),null,'the cue is local, not a route reveal');
  assert.equal(D.uncover(far,found,'return',100,140).ok,false,
    'a distant scent never collects materials or unlocks a site');
  assert.deepEqual([...found],['shrine'],'sensing is not discovering');
  const inspected=D.uncover({x:800,z:365,state:'IDLE'},found,'return',100,140);
  assert.equal(inspected.ok,true,'deliberate close inspection still works');
  assert.equal(inspected.material,1,'existing provisional reward is unchanged');
  assert.equal(D.cueNear(far,found),null,'inspected tracks no longer advertise a scent');
  assert.equal(D.uncover({x:800,z:365,state:'IDLE'},found,'return',100,140).ok,false,
    'repeat taps cannot farm the material');
});

test('actual phone HUD and popup announce the earned scent once without spoiling tracks',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const fn=html.indexOf('  function updateForestExploreHint()');
  const start=html.indexOf('    const near=window.CrownlessForestDiscoveries.near(ginji,state.forestFinds);',fn);
  const end=html.indexOf("    if (near?.id!=='shrine')",start);
  assert(fn>=0 && start>fn && end>start,'execute the live cue block');
  const tick=new Function('window','ginji','state','rpg','document','sfx','spawnPopup',html.slice(start,end));
  const hero={x:740,z:330,y:0,state:'IDLE'};
  const found=new Set(['shrine']);
  const state={forestFinds:found,forestCuePulsed:new Set()};
  const popups=[],haptics=[];
  const doc={getElementById:()=>({classList:{contains:()=>true}})};
  const run=(phase='return')=>tick({CrownlessForestDiscoveries:D},hero,state,{phase},doc,
    {haptic:p=>haptics.push(p)},(...args)=>popups.push(args));
  run('fight');
  assert.equal(popups.length,0,'no far discovery popup during combat');
  run();
  assert.equal(popups.length,1,'a phone without haptics still receives visible feedback');
  assert.equal(popups[0][0],'湿った土の匂いがした');
  assert.equal(popups[0][1],hero.x,'the popup is at the hero, not the hidden site');
  assert.deepEqual(haptics,[[16,70,16]],'far scent has its own gentle pulse');
  assert.equal(state.forestCuePulsed.has('traces:far'),true);
  assert.deepEqual([...found],['shrine'],'cue never discovers or collects');
  run();
  assert.equal(popups.length,1,'staying in range does not spam the cue');
  hero.x=800;hero.z=365;
  run();
  assert.equal(state.forestCuePulsed.has('traces'),true,
    'actual touch range still gets a separate confirmation');
  assert.equal(found.has('traces'),false,'close approach is not auto-inspection');

  const labelStart=html.indexOf('    const label=guardian',fn);
  const labelEnd=html.indexOf(';\n    if(hint.textContent!==label)',labelStart);
  assert(labelStart>fn && labelEnd>labelStart,'execute the live HUD label');
  const label=new Function('guardian','near','cue','state','rpg','ginji','forestGuardianHint',
    html.slice(labelStart,labelEnd)+';return label;');
  hero.x=740;hero.z=330;
  const read=(phase='return',bag=2)=>label(null,D.near(hero,found),D.cueNear(hero,found),
    state,{phase,unbanked:bag,crafted:false},{...hero,hp:100,maxHp:140},
    ()=>{throw new Error('unexpected guardian');});
  hero.x=720;hero.z=330;
  assert.match(read(),/湿った土の匂いがする。足元の違和感を探そう/,
    'the first scent is subtle and does not reveal a destination');
  hero.x=740;hero.z=330;
  assert.match(read(),/湿った土の匂いが強まる。足元をよく探そう/,
    'the scent grows stronger as the player walks closer without a marker');
  assert.match(read(),/牙2個は未帰還/,'sensing does not hide safe-return stakes');
  assert.doesNotMatch(read('return',0),/未帰還/,'empty bags have no false warning');
  assert.doesNotMatch(read(),/獣の痕跡|隠し道|右|左|座標/,
    'no site identity, hidden path, or navigation is given away');
  assert.doesNotMatch(read('fight'),/湿った土の匂い/,
    'active combat has priority over exploration scents');
  found.add('traces');
  assert.doesNotMatch(read(),/湿った土の匂い/,
    'once inspected, the distant scent is no longer advertised');
});
