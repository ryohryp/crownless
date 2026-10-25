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
test('shrine offers a one-time full-HP material or later healing, never both',()=>{
  const player={x:660,z:230};
  const healthyVisited=new Set();
  const healthy=D.uncover(player,healthyVisited,'fight',140,140);
  assert.equal(healthy.ok,true);
  assert.equal(healthy.material,1,'healthy inspection yields a provisional material');
  assert.equal(healthy.heal,0);
  assert.equal(healthyVisited.has('shrine'),true);
  assert.equal(D.uncover(player,healthyVisited,'return',75,140).ok,false,
    'taking the material sacrifices this expedition healing');
  const injuredVisited=new Set();
  const healed=D.uncover(player,injuredVisited,'fight',75,140);
  assert.equal(healed.ok,true);
  assert.equal(healed.heal,35);
  assert.equal(healed.material,0,'waiting until hurt trades away the material');
  assert.equal(D.uncover(player,injuredVisited,'fight',50,140).ok,false);
  const lost=R.create();
  assert.equal(R.claimMaterial(lost),true);
  assert.equal(lost.unbanked,1);
  assert.equal(R.loseExpedition(lost),true);
  assert.equal(lost.banked,0);
  assert.equal(lost.unbanked,0,'shrine material is lost on defeat');
  const returned=R.create();
  assert.equal(R.claimMaterial(returned),true);
  assert.equal(R.clearWave(returned),true);
  assert.equal(R.returnAlive(returned,140),true);
  assert.equal(returned.banked,1,'shrine material banks only on living return');
});
test('injured explorers can deliberately take provisional material instead of healing',()=>{
  const player={x:660,z:230};
  const found=new Set();
  const material=D.uncover(player,found,'fight',75,140,false,'material');
  assert.equal(material.ok,true);
  assert.equal(material.material,1);
  assert.equal(material.heal,0);
  assert.equal(D.uncover(player,found,'fight',60,140,false,'heal').ok,false);
  const healFound=new Set();
  const healed=D.uncover(player,healFound,'return',75,140,false,'heal');
  assert.equal(healed.ok,true);
  assert.equal(healed.material,0);
  assert.equal(healed.heal,35);
  const fullFound=new Set();
  assert.equal(D.uncover(player,fullFound,'fight',140,140,false,'heal').reason,'full');
  assert.equal(fullFound.size,0,'a useless full-HP heal must not consume the shrine');
  assert.equal(D.uncover(player,fullFound,'fight',140,140,false,'invalid').reason,'choice');
  assert.equal(fullFound.size,0);
});

test('shrine deep search exchanges 12 HP for two provisional fangs without bypassing survival',()=>{
  const player={x:660,z:230},found=new Set();
  const risk=D.uncover(player,found,'fight',75,140,false,'risk');
  assert.equal(risk.ok,true);
  assert.equal(risk.material,2);
  assert.equal(risk.damage,12);
  assert.equal(risk.heal,0);
  assert.equal(D.uncover(player,found,'fight',63,140,false,'risk').ok,false,
    'one expedition cannot farm the risky branch');
  const exhausted=new Set();
  assert.equal(D.uncover(player,exhausted,'fight',12.5,140,false,'risk').reason,'weak');
  assert.equal(exhausted.size,0,'too little HP must not consume the shrine');
  assert.equal(D.uncover(player,exhausted,'fight',12,140,false,'material').material,1,
    'the safe material option remains available at low HP');
  const run=R.create();
  for(let i=0;i<risk.material;i++) assert.equal(R.claimMaterial(run),true);
  assert.equal(run.unbanked,2);
  R.loseExpedition(run);
  assert.equal(run.banked,0);
  assert.equal(run.unbanked,0,'risky fangs are lost on defeat');
});

test('shrine risk preview rounds fractional HP down instead of overstating survivability',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/現在 HP '\+Math\.floor\(ginji\.hp\)/,
    'decision panel must not claim 13 HP when the player has only 12.5');
  assert.match(html,/残り'\+Math\.floor\(ginji\.hp-riskCost\)/,
    'post-risk preview must not overstate the HP that survives');
  assert.match(html,/risk\.disabled=ginji\.hp<riskCost\+1/,
    'fractional HP cannot bypass the minimum one-HP survival requirement');
  assert.equal(D.uncover({x:660,z:230},new Set(),'fight',12.5,140,false,'risk').reason,'weak');
  assert.equal(D.uncover({x:660,z:230},new Set(),'fight',13,140,false,'risk').damage,12);
});

test('forged sword mitigates shrine deep-search wounds without free loot',()=>{
  const player={x:660,z:230};
  const forged=new Set();
  const risk=D.uncover(player,forged,'return',7,140,true,'risk');
  assert.equal(risk.ok,true);
  assert.equal(risk.material,2);
  assert.equal(risk.damage,6);
  assert.equal(risk.heal,0);
  assert.equal(D.uncover(player,forged,'return',90,140,true,'risk').ok,false);
  const weak=new Set();
  assert.equal(D.uncover(player,weak,'fight',6.5,140,true,'risk').reason,'weak');
  assert.equal(weak.size,0);
  assert.equal(D.uncover(player,new Set(),'fight',7,140,false,'risk').reason,'weak');
  assert.equal(D.uncover(player,weak,'fight',6.5,140,true,'material').material,1);
});

test('reading tracks first makes the shrine deep search safer without making the detour mandatory',()=>{
  const shrine={x:660,z:230};
  for(const [crafted,base,read] of [[false,12,9],[true,6,3]]){
    const direct=new Set();
    assert.equal(D.shrineRiskDamage(direct,crafted),base);
    assert.equal(D.uncover(shrine,direct,'return',read+1,140,crafted,'risk').reason,'weak',
      'the unprepared player cannot spend more HP than they have');
    assert.equal(direct.size,0,'a failed attempt must not consume the shrine');
    const tracks=new Set();
    assert.equal(D.uncover({x:800,z:365},tracks,'return',140,140,crafted).material,1);
    assert.equal(D.shrineRiskDamage(tracks,crafted),read);
    const find=D.uncover(shrine,tracks,'return',read+1,140,crafted,'risk');
    assert.equal(find.ok,true);
    assert.equal(find.damage,read);
    assert.equal(find.material,2,'safer footing must not mint extra materials');
    assert.equal(find.heal,0);
    assert.equal(D.uncover(shrine,tracks,'return',140,140,crafted,'risk').ok,false,
      'the shrine remains once per expedition');
    assert.equal(D.uncover(shrine,new Set(),'return',base+1,140,crafted,'risk').damage,base,
      'skipping tracks is still a viable route');
  }
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/足跡は右奥へ続いている。安全な足場を発見（危険な調査の負傷 -3）/,
    'the discovered tracks should explain their benefit without naming the hidden shrine');
  assert.ok(html.includes('CrownlessForestDiscoveries.shrineRiskDamage(state.forestFinds,rpg.crafted)'),
    'the visible HP cost must come from the same rule as the reward');
  assert.match(html,/足跡を読んで負傷 -3/,'the benefit must be visible before committing');
  assert.ok(html.includes('獣の痕跡！牙 +1／苔の奥で負傷 -3'),
    'finding tracks must reveal the safer-footing payoff without naming a hidden place');
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
  assert.match(hint,/素材を探すか、傷ついてから癒やすか/,
    'healthy players see the irreversible shrine trade-off before tapping');
  assert.match(hint,/near\.id==='shrine' && ginji\.hp>=ginji\.maxHp/,
    'full-health shrine hint is chosen only when healthy');
  assert.match(hint,/near\.id==='shrine'\s*\? '🍃 苔の間から冷たい風が流れる。素材か癒やしか、一度だけ選べる/,
    'injured players see healing versus lost material before a one-time tap');
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
  assert.match(html,/function tryExploreForest\(f,shrineChoice='auto'\)/);
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

test('a deliberate shrine tap opens touch-sized material and healing actions',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/id="forestShrineChoice"[^>]*class="hidden/);
  assert.match(html,/id="forestShrineMaterial"[^>]*min-h-11/);
  assert.match(html,/id="forestShrineHeal"[^>]*min-h-11/);
  assert.match(html,/id="forestShrineCancel"[^>]*min-h-11/);
  assert.match(html,/id="forestShrineStakes"[^>]*role="status"/,
    'the one-time choice shows its live expedition stakes');
  assert.match(html,/Math\.floor\(ginji\.hp\).*rpg\.unbanked/s,
    'current HP and unsecured materials must use the same conservative display as risk eligibility');
  assert.match(html,/Math\.floor\(ginji\.hp-riskCost\)/,
    'the risky shrine option must preview remaining HP without rounding up');
  assert.match(html,/素材は生還時だけ倉庫に残る（敗北すると失う）/,
    'the player must know that gathering is not yet banked');
  assert.match(html,/if \(site\?\.id==='shrine'\)/);
  assert.match(html,/tryExploreForest\(ginji,choice\)/);
  assert.match(html,/rpg\.crafted,shrineChoice\)/);
});

test('shrine decision is a full-stage modal and suspends live combat until resolved',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/id="forestShrineChoice"[^>]*class="hidden absolute inset-0/,
    'the decision backdrop must intercept stray gameplay touches');
  assert.match(html,/id="forestShrineChoice"[^>]*role="dialog" aria-modal="true"/);
  const loop=html.slice(html.indexOf('function gameLoop(now) {'));
  assert.match(loop,/lastTimestamp = now;[\s\S]*?if \(!document\.getElementById\('forestShrineChoice'\)\.classList\.contains\('hidden'\)\) \{\s*renderScene\(\);\s*requestAnimationFrame\(gameLoop\);\s*return;/,
    'freeze combat and timers, but keep rendering and scheduling frames');
});

test('first-paint forest hint keeps undiscovered locations secret before scripts run',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const hint=html.match(/<div id="forestExploreHint"[^>]*>\s*([^<]*)<\/div>/);
  assert.ok(hint,'a first-paint hint is visible before JavaScript updates it');
  assert.match(hint[1],/森の音や足元の違和感を探そう/);
  assert.match(hint[1],/気になる地点は直接タップ/);
  assert.doesNotMatch(hint[1],/獣の痕跡|古い祠|茨の石門/,
    'undiscovered location names must not flash on first paint');
});


test('both forest art modes show sensory cues until a landmark is actually found',()=>{
  assert.deepEqual(D.spots.map(spot=>spot.clue),['湿った土の筋','苔の冷気','茨の軋み']);
  assert(D.spots.every(spot=>spot.clue!==spot.label));
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const pixel=fs.readFileSync('src/pixel-forest.js','utf8');
  assert.match(html,/ctx\.fillText\(found\?spot\.label:spot\.clue,0,-69\)/,
    'classic view must not print a place name before investigation');
  assert.match(pixel,/const label=found\?spot\.label:spot\.clue;/,
    'pixel view must not print a place name before investigation');
  assert.doesNotMatch(pixel,/spot\.id==='hollow'&&!traced\?'茨に閉ざされた石門'/,
    'the hidden gate name must not be revealed by proximity');
});
