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

test('shrine-first scent has strict 90-unit cue and 54-unit inspection boundaries',()=>{
  const found=new Set(['shrine']);
  const at=distance=>({x:800-distance,z:365,state:'IDLE'});
  assert.equal(D.cueNear(at(90),found),null,
    'the early scent must not leak beyond its earned 90-unit radius');
  assert.equal(D.cueNear(at(89.9),found)?.id,'traces',
    'the scent begins inside 90 units after deliberate shrine inspection');
  assert.equal(D.near(at(72),found),null,
    'stronger scent is still not a touch action or automatic discovery');
  assert.equal(D.near(at(54),found),null,
    'the original 54-unit inspection boundary stays strict');
  assert.equal(D.near(at(53.9),found)?.id,'traces',
    'only approaching within 54 units offers the real inspection');
  assert.equal(D.uncover(at(72),found,'return',100,140).ok,false,
    'a strong scent cannot mint provisional loot from outside tap range');
  assert.deepEqual([...found],['shrine'],
    'walking through either scent band does not mutate discovery state');
});

test('actual phone HUD and popup announce the earned scent once without spoiling tracks',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const fn=html.indexOf('  function updateForestExploreHint()');
  const start=html.indexOf('    const near=window.CrownlessForestDiscoveries.near(ginji,state.forestFinds);',fn);
  const end=html.indexOf("    if (near?.id!=='shrine')",start);
  assert(fn>=0 && start>fn && end>start,'execute the live cue block');
  const tick=new Function('window','ginji','state','rpg','document','sfx','spawnPopup',html.slice(start,end));
  const hero={x:720,z:330,y:0,state:'IDLE'};
  const found=new Set(['shrine']);
  const state={forestFinds:found,forestCuePulsed:new Set()};
  const popups=[],haptics=[];
  const doc={getElementById:()=>({classList:{contains:()=>true}})};
  const run=(phase='return')=>tick({CrownlessForestDiscoveries:D},hero,state,{phase},doc,
    {haptic:p=>haptics.push(p)},(...args)=>popups.push(args));
  run('fight');
  assert.equal(popups.length,0,'no far discovery popup during combat');
  assert.equal(state.forestCuePulsed.size,0,
    'combat must not silently consume the later exploration cue');
  assert.deepEqual([...found],['shrine'],
    'combat cannot auto-discover the nearby tracks');
  run();
  assert.equal(popups.length,1,'a phone without haptics still receives visible feedback');
  assert.equal(popups[0][0],'湿った土の匂いがした');
  assert.equal(popups[0][1],hero.x,'the popup is at the hero, not the hidden site');
  assert.deepEqual(haptics,[[16,70,16]],'far scent has its own gentle pulse');
  assert.equal(state.forestCuePulsed.has('traces:far'),true);
  assert.deepEqual([...found],['shrine'],'cue never discovers or collects');
  run();
  assert.equal(popups.length,1,'staying in range does not spam the cue');
  hero.x=740;hero.z=330;
  run();
  assert.equal(popups.length,2,'walking closer earns one stronger sensory cue');
  assert.equal(popups[1][0],'湿った土の匂いが濃くなった');
  assert.deepEqual(haptics[1],[22,55,22],'closer scent has a distinct gentle pulse');
  assert.equal(state.forestCuePulsed.has('traces:strong'),true);
  run();
  assert.equal(popups.length,2,'remaining in the stronger band cannot spam');
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
  hero.x=800;hero.z=365;
  assert.doesNotMatch(read('fight'),/湿った土|気になる地点|タップで調査/,
    'combat must not expose an inspectable discovery even at touch range');
  hero.x=740;hero.z=330;
  found.add('traces');
  assert.doesNotMatch(read(),/湿った土の匂い/,
    'once inspected, the distant scent is no longer advertised');
});


test('strong scent remains a one-time discovery cue after retreating and returning',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const fn=html.indexOf('  function updateForestExploreHint()');
  const start=html.indexOf('    const near=window.CrownlessForestDiscoveries.near(ginji,state.forestFinds);',fn);
  const end=html.indexOf("    if (near?.id!=='shrine')",start);
  assert(fn>=0 && start>fn && end>start,'exercise the live scent logic');
  const tick=new Function('window','ginji','state','rpg','document','sfx','spawnPopup',html.slice(start,end));
  const hero={x:740,z:330,y:0,state:'IDLE'};
  const found=new Set(['shrine']);
  const state={forestFinds:found,forestCuePulsed:new Set()};
  const messages=[];
  const doc={getElementById:()=>({classList:{contains:()=>true}})};
  const run=()=>tick({CrownlessForestDiscoveries:D},hero,state,{phase:'return'},doc,
    {haptic:()=>{}},message=>messages.push(message));
  run();
  assert.deepEqual(messages,['湿った土の匂いが濃くなった']);
  hero.x=700;hero.z=330;
  run();
  hero.x=720;hero.z=330;
  run();
  hero.x=740;hero.z=330;
  run();
  assert.deepEqual(messages,['湿った土の匂いが濃くなった'],
    'retreating and re-entering must not repeat either the weaker or stronger cue');
  assert.deepEqual([...found],['shrine'],'scent alone must not discover tracks');
});
