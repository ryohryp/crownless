'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const D=require('../src/gemini-forest-discoveries.js');
const R=require('../src/gemini-rpg-loop.js');

test('three distinct forest landmarks are placed in the actually walkable action world',()=>{
  assert.equal(D.spots.length,3);
  assert.deepEqual(D.spots.map(s=>s.id),['traces','shrine','hollow']);
  assert(D.spots.every(s=>s.x>=50 && s.x<=950 && s.z>=210 && s.z<=410));
  assert.notEqual(D.spots[0].x,D.spots[1].x,'exploration requires physically moving');
});
test('approaching the traces and tapping earns exactly one unbanked material, not a banked weapon',()=>{
  const visited=new Set(),run=R.create();
  const player={x:800,z:365};
  assert.equal(D.near({x:700,z:365},visited),null);
  assert.equal(D.near(player,visited)?.id,'traces');
  const find=D.uncover(player,visited,'fight',140,140);
  assert.equal(find.ok,true);
  assert.equal(find.material,1);
  assert.equal(find.heal,0);
  assert.equal(R.claimMaterial(run),true);
  assert.equal(run.unbanked,1);
  assert.equal(run.banked,0);
  assert.equal(D.uncover(player,visited,'fight',140,140).ok,false,'one find per expedition');
  assert.equal(visited.size,1);
});
test('shrine restores HP only when injured and cannot be harvested indefinitely',()=>{
  const visited=new Set();
  const player={x:660,z:230};
  const healthy=D.uncover(player,visited,'fight',140,140);
  assert.equal(healthy.ok,false);
  assert.equal(healthy.reason,'full');
  assert.equal(visited.has('shrine'),false,'save healing until needed');
  const find=D.uncover(player,visited,'fight',75,140);
  assert.equal(find.ok,true);
  assert.equal(find.heal,35);
  assert.equal(find.material,0);
  assert.equal(D.uncover(player,visited,'fight',50,140).ok,false);
});
test('the stone gate stays discoverable while locked and needs both a trail and a crafted sword',()=>{
  const visited=new Set(),player={x:910,z:235};
  assert.equal(D.near(player,visited)?.id,'hollow','locked sites remain reachable for their hint');
  for(const crafted of [false,true]){
    const locked=D.uncover(player,visited,'fight',90,140,crafted);
    assert.equal(locked.ok,false);
    assert.equal(locked.reason,'trail');
    assert.equal(locked.spot.id,'hollow');
    assert.equal(visited.size,0);
  }
  D.uncover({x:800,z:365},visited,'fight',90,140);
  const locked=D.uncover(player,visited,'fight',90,140);
  assert.equal(locked.ok,false,'existing callers without equipment cannot open the gate');
  assert.equal(locked.reason,'thorns');
  assert.equal(locked.spot.id,'hollow');
  assert.equal(visited.has('hollow'),false);
  const opened=D.uncover(player,visited,'fight',90,140,true);
  assert.equal(opened.ok,true);
  assert.equal(opened.material,2);
  assert.equal(opened.heal,45);
  assert.equal(visited.has('hollow'),true);
  assert.equal(D.near(player,visited),null);
  assert.equal(D.uncover(player,visited,'fight',50,140,true).ok,false,'no duplicate reward');
});
test('cache healing is capped at missing HP and its materials can be found at full HP',()=>{
  for(const [hp,heal] of [[125,15],[140,0]]){
    const opened=D.uncover({x:910,z:235},new Set(['traces']),'return',hp,140,true);
    assert.equal(opened.ok,true);
    assert.equal(opened.material,2);
    assert.equal(opened.heal,heal);
  }
  const visited=new Set(['traces']);
  assert.equal(D.uncover({x:910,z:235},visited,'camp',80,140,true).ok,false);
  assert.equal(visited.has('hollow'),false,'camp cannot consume an expedition find');
});
test('a forged sword opens the gate on a later expedition and loot banks only after returning alive',()=>{
  const run=R.create();
  for(let i=0;i<3;i++) R.claimMaterial(run);
  R.clearWave(run);
  R.returnAlive(run,70);
  assert.equal(R.forge(run),true);
  assert.equal(R.depart(run),true);
  const visited=new Set();
  const trail=D.uncover({x:800,z:365},visited,run.phase,70,140,run.crafted);
  for(let i=0;i<trail.material;i++) R.claimMaterial(run);
  R.clearWave(run);
  const opened=D.uncover({x:910,z:235},visited,run.phase,70,140,run.crafted);
  assert.equal(opened.ok,true,'cleared combat permits deeper exploration');
  for(let i=0;i<opened.material;i++) R.claimMaterial(run);
  assert.equal(run.unbanked,3);
  assert.equal(run.banked,0);
  assert.equal(R.returnAlive(run,0),false);
  assert.equal(run.banked,0,'defeated players cannot bank the cache');
  assert.equal(R.returnAlive(run,70+opened.heal),true);
  assert.equal(run.banked,3);
  assert.equal(run.unbanked,0);
});
test('defeat loses cache loot and a fresh expedition can rediscover it with the retained sword',()=>{
  const run=R.create();
  for(let i=0;i<3;i++) R.claimMaterial(run);
  R.clearWave(run);
  R.returnAlive(run,70);
  R.forge(run);
  R.depart(run);
  const visited=new Set(['traces']);
  const opened=D.uncover({x:910,z:235},visited,run.phase,50,140,run.crafted);
  for(let i=0;i<opened.material;i++) R.claimMaterial(run);
  assert.equal(run.unbanked,2);
  assert.equal(R.loseExpedition(run),true);
  assert.equal(run.unbanked,0);
  assert.equal(run.banked,0);
  assert.equal(run.crafted,true);
  R.depart(run);
  const nextVisited=new Set();
  assert.equal(D.uncover({x:910,z:235},nextVisited,run.phase,90,140,run.crafted).reason,'trail');
  D.uncover({x:800,z:365},nextVisited,run.phase,90,140,run.crafted);
  assert.equal(D.uncover({x:910,z:235},nextVisited,run.phase,90,140,run.crafted).material,2);
});
test('after defeating the three goblins, player can keep exploring, then return alive with loot',()=>{
  const run=R.create(),visited=new Set();
  for(let i=0;i<3;i++) R.claimMaterial(run);
  assert.equal(R.clearWave(run),true);
  assert.equal(run.phase,'return');
  assert.equal(D.available(run.phase),true,'combat clear does not end the playable world');
  const find=D.uncover({x:800,z:365},visited,run.phase,70,140);
  assert.equal(find.material,1);
  assert.equal(R.claimMaterial(run),true);
  assert.equal(run.unbanked,4);
  assert.equal(R.returnAlive(run,70),true);
  assert.equal(run.banked,4,'discovered fang is only banked on living return');
  assert.equal(D.available(run.phase),false);
  assert.equal(R.claimMaterial(run),false);
});
test('defeat still discards discovered material; deeper exploration keeps existing risk',()=>{
  const run=R.create(),visited=new Set();
  const find=D.uncover({x:800,z:365},visited,'fight',80,140);
  assert.equal(find.material,1);
  R.claimMaterial(run);
  R.loseExpedition(run);
  assert.equal(run.unbanked,0);
  assert.equal(run.banked,0);
});
test('direct touch coordinates hit the same clue sprite after scaling and camera scrolling',()=>{
  const rect={left:7,top:100,width:390,height:500};
  const canvas={width:483,height:420};
  const flat=()=>0;
  const touch=(x,y,camera,ground=flat)=>{
    return D.spotAtTap({x:rect.left+(x-camera)*rect.width/canvas.width,
      y:rect.top+y*rect.height/canvas.height},rect,canvas,camera,ground);
  };
  assert.equal(touch(800,310,550)?.id,'traces',
    'touching material text/icon on right half finds its actual world place');
  assert.equal(touch(660,145,620,()=>30)?.id,'shrine',
    'a left-half touch recognizes shrine after camera moves');
  assert.equal(touch(660,190,620,()=>30)?.id,'shrine');
  assert.equal(touch(800,310,150),null,
    'out-of-viewport site cannot be remotely triggered');
  assert.equal(D.spotAtTap({x:0,y:0},rect,canvas,550,flat),null);
  assert.equal(D.spotAtTap({x:NaN,y:300},rect,canvas,550,flat),null);
});
test('scene registers direct touch and keeps cleared-wave right-hand gesture actions live',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/CrownlessForestDiscoveries\.spotAtTap\(/);
  assert.match(html,/function tryTapForestSite\(clientX,clientY,allowNearby\)/);
  assert.match(html,/tryTapForestSite\(e\.clientX,e\.clientY,false\)/);
  assert.match(html,/tryTapForestSite\(event\.clientX,event\.clientY,false\)/,'gesture must only investigate a tapped landmark');
  assert.doesNotMatch(html,/tryTapForestSite\(event\.clientX,event\.clientY,true\)/,'nearby gesture attacks cannot auto-collect clues');
  assert.match(html,/if\(combatInputMode!=='buttons'\) return;/);
  assert.match(html,/canvas\.addEventListener\('pointerup'/);
  assert.match(html,/if \(rpg\.phase !== 'fight' && rpg\.phase !== 'return'\) return;/);
  assert.match(html,/気になる地点を直接タップ/,'the on-screen hint must require deliberate inspection');
});

test('undiscovered forest hints convey sensory cues without naming every hidden location',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf('function updateForestExploreHint() {');
  const end=html.indexOf('function showRpgPanel() {',start);
  assert(start>=0 && end>start,'the live forest hint must be present');
  const hint=html.slice(start,end);
  assert.match(hint,/湿った土に細い筋がある/,'tracks are sensed before they are named');
  assert.match(hint,/苔の間から冷たい風が流れる/,'shrine is sensed before it is named');
  assert.match(hint,/茨の向こうで何かが軋む/,'gate is sensed before it is named');
  assert.match(hint,/足跡は右奥へ続いている/,'discovered tracks still guide deeper exploration');
  assert.match(hint,/足元のかすかな筋を辿ろう/,'unread tracks are suggested without naming the gate');
  assert.match(hint,/茨の奥で何かが軋む/,'locked gate invites an actual inspection before revealing equipment requirements');
  assert.match(hint,/奥の茨を調べてみよう/,'trail alone does not spoil the crafting solution');
  assert.doesNotMatch(hint,/石門の手前に獣の痕跡|茨の石門：風裂きの剣|鍛冶した剣があれば先へ/,'uninspected gate cannot reveal its name or answer');
  assert.match(hint,/気になる地点を直接タップ/,'the player must deliberately inspect');
  assert.doesNotMatch(hint,/near\.label/,'the hint must not automatically reveal an undiscovered name');
  assert.doesNotMatch(hint,/獣の痕跡や古い祠へ近づき/,'generic hint must not spoil specific locations');
});

test('forest discoveries are in-scene actions, no navigation route/save/GPS coupling',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/src\/gemini-forest-discoveries\.js/);
  assert.match(html,/id="forestExploreHint"/);
  assert.match(html,/id="rpgOpenResults"/);
  assert.match(html,/id="rpgKeepExploring"/);
  assert.match(html,/function tryExploreForest\(f\)/);
  assert.doesNotMatch(html,/if \(tryExploreForest\(f\)\) return true/,'punch must not auto-explore');
  assert.match(html,/rpg\.phase === 'fight' \|\| rpg\.phase === 'return'/);
  assert.match(html,/function updateForestExploreHint\(\)/);
  const clearWave=html.match(/if \(remainingEnemies.length === 0 && rpgRules.clearWave\(rpg\)\) \{([^}]+)\}/);
  assert.ok(clearWave);
  assert.doesNotMatch(clearWave[1],/showRpgPanel\(\)/,'clearing enemies must not force modal');
  assert.doesNotMatch(html,/CrownlessControlBarricade/);
});

test('action forest requires direct clue taps, not incidental combat pickup',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/if \(action==='punch' && tryTapForestSite\(event\.clientX,event\.clientY,false\)\) return;/);
  assert.match(html,/if \(!site && !allowNearby\) return false;/);
  assert.match(html,/if \(site\) return tryExploreForest\(ginji\);/);
  assert.doesNotMatch(html,/if \(site \|\| near\) return tryExploreForest\(ginji\);/);
  const pickup=html.slice(html.indexOf('function tryPickupItem(f) {'),html.indexOf('function tryPickupItem(f) {')+300);
  assert.doesNotMatch(pickup,/tryExploreForest\(f\)/);
  assert.match(html,/気になる地点を直接タップ/);
});
