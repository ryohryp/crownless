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
test('reading tracks extends only the hidden gate vibration, never touch range or navigation',()=>{
  const approach={x:850,z:260};
  const unread=new Set(),tracked=new Set(['traces']);
  assert.equal(D.near(approach,tracked),null,'the gate cannot be investigated from the cue radius');
  assert.equal(D.cueNear(approach,unread),null,'without tracks there is no early gate cue');
  assert.equal(D.cueNear(approach,tracked)?.id,'hollow',
    'reading tracks gives an earlier non-directional cue for the unexamined gate');
  assert.equal(D.uncover(approach,tracked,'return',100,140,true).ok,false,
    'the player must still walk up to the gate and deliberately inspect it');
  assert.equal(D.cueNear({x:790,z:230},tracked),null,
    'the earned cue cannot disclose a remote destination');
  tracked.add('hollow');
  assert.equal(D.cueNear(approach,tracked),null,'examined sites do not pulse again');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/const cue=window\.CrownlessForestDiscoveries\.cueNear\(ginji,state\.forestFinds\)/);
  assert.match(html,/state\.forestCuePulsed\.has\(cuePulseKey\)/);
  const pulseKeySource=html.match(/const cuePulseKey=([^;]+);/)?.[1];
  assert.ok(pulseKeySource,'the earned far cue and the inspectable gate need separate pulse keys');
  const pulseKey=Function('cue','near','return ('+pulseKeySource+');');
  assert.equal(pulseKey({id:'hollow'},null),'hollow:far');
  assert.equal(pulseKey({id:'hollow'},{id:'hollow'}),'hollow');
  assert.equal(pulseKey({id:'shrine'},{id:'shrine'}),'shrine');
  assert.equal(pulseKey(null,null),undefined);
  const pulsed=new Set();
  const once=(cue,near)=>{
    const key=pulseKey(cue,near);
    if(pulsed.has(key)) return false;
    pulsed.add(key);
    return true;
  };
  assert.equal(once({id:'hollow'},null),true,'scouted distant cue is earned once');
  assert.equal(once({id:'hollow'},null),false,'walking within the far radius cannot spam');
  assert.equal(once({id:'hollow'},{id:'hollow'}),true,
    'finding the real gate still gives one tactile confirmation');
  assert.equal(once({id:'hollow'},{id:'hollow'}),false,'standing near cannot spam');
  assert.equal(once({id:'hollow'},null),false,'walking away cannot replay the distant cue');
  assert.equal(D.cueNear({x:910,z:235},new Set())?.id,'hollow',
    'without tracks the player receives only the ordinary near-site cue');
  assert.match(html,/const near=window\.CrownlessForestDiscoveries\.near\(ginji,state\.forestFinds\)/,
    'normal contextual hints still use the original interaction radius');
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

test('deep shrine search cannot grant unguarded loot before the initial wave is cleared',()=>{
  const spot={x:660,z:230},found=new Set(),run=R.create();
  assert.equal(run.phase,'fight');
  const denied=D.uncover(spot,found,run.phase,140,140,false,'risk');
  assert.equal(denied.ok,false);
  assert.equal(denied.reason,'clear-first');
  assert.equal(found.size,0,'denied deep search must not spend the shrine');
  assert.equal(run.unbanked,0,'the initial fight cannot mint risk-free materials');
  assert.equal(D.uncover(spot,new Set(),run.phase,140,140,false,'material').material,1,
    'safe scavenging remains available before the wave ends');
  assert.equal(R.clearWave(run),true);
  const reward=D.uncover(spot,found,run.phase,140,140,false,'risk');
  assert.equal(reward.ok,true);
  assert.equal(reward.material,2);
  assert.equal(R.pushDeeper(run),true,'the extra materials require another fight');
  assert.equal(R.returnAlive(run,140-reward.damage),false,
    'return is blocked until the guardian is defeated');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/risk\.disabled=ginji\.hp<riskCost\+1 \|\| rpg\.phase!=='return'/,
    'the phone action must be disabled during the initial wave');
  assert.match(html,/魔物を倒してから／番人が待っている/,
    'the unavailable option explains when and why it becomes available');
  assert.ok(html.includes("番人が待っている｜HP -'+riskCost+'・未帰還素材 +2"),
    'even before clearing enemies, the disabled risky route must preview its equipment-dependent HP cost and two provisional materials');
});

test('shrine deep search exchanges 12 HP for two provisional fangs without bypassing survival',()=>{
  const player={x:660,z:230},found=new Set();
  const risk=D.uncover(player,found,'return',75,140,false,'risk');
  assert.equal(risk.ok,true);
  assert.equal(risk.material,2);
  assert.equal(risk.damage,12);
  assert.equal(risk.heal,0);
  assert.equal(D.uncover(player,found,'return',63,140,false,'risk').ok,false,
    'one expedition cannot farm the risky branch');
  const exhausted=new Set();
  assert.equal(D.uncover(player,exhausted,'return',12.5,140,false,'risk').reason,'weak');
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
  assert.equal(D.uncover({x:660,z:230},new Set(),'return',12.5,140,false,'risk').reason,'weak');
  assert.equal(D.uncover({x:660,z:230},new Set(),'return',13,140,false,'risk').damage,12);
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
  assert.equal(D.uncover(player,weak,'return',6.5,140,true,'risk').reason,'weak');
  assert.equal(weak.size,0);
  assert.equal(D.uncover(player,new Set(),'return',7,140,false,'risk').reason,'weak');
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
  assert.ok(html.includes('獣の痕跡！牙 +1／危険な調査で受ける傷を3軽減'),
    'finding tracks must explain the future damage reduction without implying immediate HP loss');
  assert.doesNotMatch(html,/獣の痕跡！牙 \+1／(?:苔むす祠|茨の石門|苔祠の番人)/,
    'finding tracks must not reveal an uninspected location or enemy');
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
  assert.equal(opened.heal,0,'taking the gate loot uses up its healing herbs');
  assert.equal(opened.damage,D.GATE_SALVAGE_DAMAGE,'taking fangs costs health even with a forged sword');
  assert.equal(visited.has('hollow'),true);
  assert.equal(D.near(player,visited),null);
  assert.equal(D.uncover(player,visited,'fight',50,140,true).ok,false,'no duplicate reward');
});
test('stone gate offers either two provisional fangs or up to 45 HP, never both',()=>{
  const spot={x:910,z:235};
  for(const [hp,heal] of [[125,15],[80,45]]){
    const visited=new Set(['traces']);
    const healed=D.uncover(spot,visited,'return',hp,140,true,'heal');
    assert.equal(healed.ok,true);
    assert.equal(healed.material,0,'healing must not mint material');
    assert.equal(healed.heal,heal);
    assert.equal(healed.damage,0,'herbs must not inflict the salvage wound');
    assert.equal(D.uncover(spot,visited,'return',hp,140,true,'material').ok,false,
      'one visit cannot claim both routes');
  }
  for(const hp of [80,140]){
    const visited=new Set(['traces']);
    const loot=D.uncover(spot,visited,'return',hp,140,true,'material');
    assert.equal(loot.material,2);
    assert.equal(loot.heal,0,'material choice sacrifices healing even when injured');
    assert.equal(loot.damage,8,'the thorn wound must make the material choice consequential');
    assert.equal(D.uncover(spot,visited,'return',hp,140,true,'heal').ok,false);
  }
  for(const hp of [1,8,8.5]){
    const weak=new Set(['traces']);
    assert.equal(D.uncover(spot,weak,'return',hp,140,true,'material').reason,'weak');
    assert.equal(weak.has('hollow'),false,'insufficient HP must not spend the one-time gate choice');
    assert.equal(D.uncover(spot,weak,'return',hp,140,true,'heal').ok,true,
      'low-HP explorers must retain the safe healing route');
  }
  assert.equal(D.uncover(spot,new Set(['traces']),'return',9,140,true,'material').damage,8,
    'nine HP leaves one HP after the explicitly chosen salvage');
  const full=new Set(['traces']);
  assert.equal(D.uncover(spot,full,'return',140,140,true,'heal').reason,'full');
  assert.equal(D.uncover(spot,full,'return',80,140,true,'risk').reason,'choice');
  assert.equal(full.has('hollow'),false,'invalid or useless choices do not consume the gate');
  assert.equal(D.uncover(spot,full,'return',140,140,true,'material').material,2);
  const visited=new Set(['traces']);
  assert.equal(D.uncover(spot,visited,'camp',80,140,true,'material').ok,false);
  assert.equal(visited.has('hollow'),false,'camp cannot consume an expedition find');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/id="forestGateChoice"/);
  assert.match(html,/id="forestGateMaterial"/);
  assert.match(html,/id="forestGateHeal"/);
  assert.match(html,/id="forestGateCancel"/);
  assert.match(html,/石門の茨を払って牙 \+2（未帰還）／HP -.*薬草は見送った/,
    'taking materials must describe foregoing herbs, not consuming them');
  assert.match(html,/石門の薬草.*?牙 \+2は見送った/s,
    'healing must explicitly acknowledge the two provisional fangs forgone');
  assert.match(html,/tryExploreForest\(ginji,choice\)/,
    'phone choices must invoke the same authoritative reward rules');
  assert.match(html,/salvage\.disabled=ginji\.hp<salvageCost\+1/,
    'phone material choice must not be clickable at lethal HP');
  assert.match(html,/Math\.floor\(ginji\.hp-salvageCost\)/,
    'the phone decision previews surviving HP before taking the fangs');
  assert.match(html,/!document\.getElementById\('forestGateChoice'\)\.classList\.contains\('hidden'\)/,
    'combat and projectiles must pause while the gate decision is open');
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
  assert.equal(R.returnAlive(run,70-opened.damage+opened.heal),true);
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

test('guardian fight overrides stale clue hints with live HP and unsecured loot',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf('function updateForestExploreHint() {');
  const end=html.indexOf('function showRpgPanel() {',start);
  assert(start>=0 && end>start);
  const hint=html.slice(start,end);
  assert.match(hint,/rpg\.phase==='fight'[\s\S]*?f\.name==='苔祠の番人' && f\.state!=='DEAD'/,
    'only the active guardian fight can override ordinary exploration hints');
  assert.match(hint,/const label=guardian[\s\S]*?: near/,
    'after the guardian falls, ordinary discovery hints must return');
  assert.match(hint,/forestGuardianHint\(guardian,state\.forestFinds,rpg\.unbanked,performance\.now\(\)\/1000\)/,
    'the guardian hint must use live scouting state, time and unsecured loot');
  const guardianHint=html.match(/function forestGuardianHint\([^)]*\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(guardianHint,'the live guardian hint helper must exist');
  assert.match(guardianHint,/Math\.ceil\(guardian\.hp\).*guardian\.maxHp/,
    'the current guardian HP must be visible during the fight');
  assert.match(guardianHint,/倒すまで帰還不可｜未帰還の牙/,
    'the active threat must show the actual unsecured materials at stake');
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

test('unavailable deep shrine search still previews its cost, reward and guardian',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const expression=html.match(/risk\.textContent=([\s\S]*?);\s*heal\.textContent=/)?.[1];
  assert.ok(expression,'the actual risk button label expression must exist');
  const label=Function('risk','rpg','riskCost','ginji','state','return ('+expression+');');
  const state={forestFinds:new Set()};
  const weak=label({disabled:true},{phase:'return',crafted:false},12,{hp:12},state);
  assert.match(weak,/HP -12.*未帰還素材 \+2.*番人戦.*HP 13以上必要/,
    'even at low HP, show the real risk and possible reward before a safe return');
  const fighting=label({disabled:true},{phase:'fight',crafted:false},12,{hp:140},state);
  assert.match(fighting,/魔物を倒してから.*HP -12.*未帰還素材 \+2/,
    'the existing combat lockout and reward preview remain intact');
  const ready=label({disabled:false},{phase:'return',crafted:false},12,{hp:14},state);
  assert.match(ready,/HP -12.*→残り2.*未帰還素材 \+2/,
    'an eligible player still sees the exact remaining HP and reward');
});

test('shrine decision is a full-stage modal and suspends live combat until resolved',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/id="forestShrineChoice"[^>]*class="hidden absolute inset-0/,
    'the decision backdrop must intercept stray gameplay touches');
  assert.match(html,/id="forestShrineChoice"[^>]*role="dialog" aria-modal="true"/);
  const loop=html.slice(html.indexOf('function gameLoop(now) {'));
  assert.match(loop,/lastTimestamp = now;[\s\S]*?if \(!document\.getElementById\('forestShrineChoice'\)\.classList\.contains\('hidden'\) \|\|\s*!document\.getElementById\('forestGateChoice'\)\.classList\.contains\('hidden'\)\) \{\s*renderScene\(\);\s*requestAnimationFrame\(gameLoop\);\s*return;/,
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

test('post-victory deep search wakes one optional guardian before risky loot can be banked',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/rpg\.phase==='return'\?'／物音で番人が来る・撃退まで帰還不可'/,
    'the risky option must warn before the player commits');
  assert.match(html,/choice==='risk' && wasClear &&[\s\S]*?rpgRules\.pushDeeper\(rpg\)/,
    'only a chosen deep search after victory starts another fight');
  assert.match(html,/spawnEnemyWave\(state\.waveCount,1,true\)/,
    'the ambush is a single guardian, not an involuntary full wave');
  const run=R.create();
  assert.equal(R.clearWave(run),true);
  const found=new Set();
  const reward=D.uncover({x:660,z:230},found,run.phase,70,140,false,'risk');
  assert.equal(reward.material,2);
  for(let i=0;i<reward.material;i++) assert.equal(R.claimMaterial(run),true);
  assert.equal(R.pushDeeper(run),true);
  assert.equal(R.returnAlive(run,70-reward.damage),false,
    'risky materials remain provisional until the guardian is defeated');
  assert.equal(R.clearWave(run),true);
  assert.equal(R.returnAlive(run,70-reward.damage),true);
  assert.equal(run.banked,2);
  const defeated=R.create();
  R.clearWave(defeated);
  R.claimMaterial(defeated);
  R.pushDeeper(defeated);
  R.loseExpedition(defeated);
  assert.equal(defeated.banked,0);
  assert.equal(defeated.unbanked,0,'the guardian can cost the entire unsecured bag');
});


test('reading tracks gives reaction distance against the optional shrine guardian without skipping combat',()=>{
  assert.equal(D.guardianApproachDistance(new Set()),105);
  const found=new Set(['traces']);
  assert.equal(D.guardianApproachDistance(found),170);
  assert.equal(found.has('shrine'),false,'scouting must not consume or reveal the shrine');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/ginji\.x \+ window\.CrownlessForestDiscoveries\.guardianApproachDistance\(state\.forestFinds\)/);
  assert.match(html,/足跡を読んで負傷 -3・番人の接近を早く察知/);
  assert.match(html,/spawnEnemyWave\(state\.waveCount,1,true\)/,'scouting must not bypass the guardian');
});

test('reading tracks grants a short first-strike warning without changing normal enemies or loot',()=>{
  const Recovery=require('../src/gemini-hit-recovery.js');
  const unread=new Set();
  const read=new Set(['traces']);
  assert.equal(D.guardianOpeningSeconds(unread),0);
  assert.equal(D.guardianOpeningSeconds(read),1.8);
  assert.equal(read.has('shrine'),false,'warning must not auto-discover the shrine');
  const now=100;
  const alerted={team:1,isBoss:true,nextStrikeAt:now+D.guardianOpeningSeconds(read)};
  const surprised={team:1,isBoss:true,nextStrikeAt:now+D.guardianOpeningSeconds(unread)};
  assert.equal(Recovery.readyToStrike(alerted,now+1.79),false,'scouting gives time to react');
  assert.equal(Recovery.readyToStrike(alerted,now+1.8),true,'guardian remains dangerous after warning');
  assert.equal(Recovery.readyToStrike(surprised,now),true,'skipping tracks gives no warning');
  const ordinary={team:1,isBoss:false,nextStrikeAt:0};
  assert.equal(Recovery.readyToStrike(ordinary,now),true,'ordinary enemies retain their opening');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/if \(shrineGuardian\) enemy\.scoutOpeningSeconds=\s*window\.CrownlessForestDiscoveries\.guardianOpeningSeconds\(state\.forestFinds\)/,
    'scouting eligibility must be captured before the guardian fight');
  assert.match(html,/const scoutDistance=ginji && ginji\.state!=='DEAD'[\s\S]*?Math\.hypot\(ginji\.x-enemy\.x,ginji\.z-enemy\.z\)/,
    'companion proximity must not spend the player-only first-hit window');
  assert.match(html,/if \(window\.CrownlessForestDiscoveries\.armGuardianOpening\(enemy,scoutDistance,nowSec,scoutInStrikeLane\)\) \{\s*spawnPopup\('👁 予兆を察知！攻撃\+12か回避'/,
    'the earned warning must also appear beside the actual guardian, once per approach');
  assert.match(html,/if \(window\.CrownlessForestDiscoveries\.armGuardianOpening\(enemy,scoutDistance,nowSec,scoutInStrikeLane\)\) \{[^}]*sfx\.haptic\(\[20,45,20\]\)/,
    'a distinct double vibration must accompany only the earned one-shot warning, not every attack');
  assert.match(html,/spawnEnemyWave\(state\.waveCount,1,true\)/,'warning never bypasses the fight');
});

test('companion supports rather than solo-bursts the optional guardian before the player arrives',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const ai=html.slice(html.indexOf('function sampleCompanionAI('),html.indexOf('function sampleEnemyAI('));
  assert.match(ai,/const assistPace=bestTarget\.name==='苔祠の番人'\?0\.18:1/,
    'only the optional guardian gets slower ally attacks; normal enemies stay unchanged');
  assert.match(ai,/Math\.random\(\) < 0\.15\*assistPace/);
  assert.match(ai,/Math\.random\(\) < 0\.08\*assistPace/);
  assert.match(ai,/Math\.random\(\) < 0\.04\*assistPace/);
});

test('scouted guardian warning starts on close approach exactly once, not at spawn',()=>{
  const Recovery=require('../src/gemini-hit-recovery.js');
  const now=100;
  const enemy={name:'苔祠の番人',team:1,isBoss:true,
    scoutOpeningSeconds:D.guardianOpeningSeconds(new Set(['traces'])),nextStrikeAt:0};
  assert.equal(D.armGuardianOpening(enemy,170,now),false,'distant spawn must not waste warning time');
  assert.equal(enemy.scoutOpeningEndsAt,undefined);
  assert.equal(D.armGuardianOpening(enemy,95,now+2),false,'walking distance must not waste the strike window');
  assert.equal(D.armGuardianOpening(enemy,56,now+2),false,'just outside striking range remains unarmed');
  assert.equal(D.armGuardianOpening(enemy,55,now+2),true,'near striking range starts the earned warning');
  assert.equal(enemy.scoutOpeningEndsAt,103.8);
  assert.equal(Recovery.readyToStrike(enemy,103.79),false);
  assert.equal(Recovery.readyToStrike(enemy,103.8),true);
  Recovery.registerEnemyStrike(enemy,104);
  assert.equal(D.armGuardianOpening(enemy,30,105),false,'subsequent attacks cannot reset the warning');
  assert.equal(enemy.scoutOpeningEndsAt,103.8);
  const blind={name:'苔祠の番人',scoutOpeningSeconds:0,nextStrikeAt:0};
  assert.equal(D.armGuardianOpening(blind,20,now),false,'no tracks means no earned opening');
  assert.equal(Recovery.readyToStrike(blind,now),true);
  const ordinary={name:'苔牙ゴブリン',nextStrikeAt:0};
  assert.equal(D.armGuardianOpening(ordinary,20,now),false,'ordinary enemies are unchanged');
  assert.equal(D.armGuardianOpening({scoutOpeningSeconds:1.8},NaN,now),false);
});

test('grappling the guardian cannot waste the earned first-strike window',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const condition=html.match(/const scoutInStrikeLane=([\s\S]*?);/)?.[1];
  assert.ok(condition,'the live enemy AI must gate the warning on player control');
  const inLane=state=>require('node:vm').runInNewContext('Boolean('+condition+')',{
    ginji:{x:0,z:0,state},enemy:{x:30,z:0}
  });
  for(const state of ['HURT','DOWN','GRAB'])
    assert.equal(inLane(state),false,state+' must not spend the earned 1.8 seconds');
  assert.equal(inLane('IDLE'),true,'a recovered player can earn the full window');
  assert.equal(require('node:vm').runInNewContext('Boolean('+condition+')',{
    ginji:{x:0,z:0,state:'IDLE'},enemy:{x:30,z:0,state:'DOWN'}
  }),false,'a knocked-down guardian cannot be struck with the normal scouting attack');
  const guardian={name:'苔祠の番人',scoutOpeningSeconds:1.8,nextStrikeAt:0};
  assert.equal(D.armGuardianOpening(guardian,30,100,inLane('GRAB')),false);
  assert.equal(guardian.scoutOpeningArmed,undefined,'grapple must not consume the one-shot cue');
  assert.equal(D.armGuardianOpening(guardian,30,101,inLane('IDLE')),true);
  assert.equal(guardian.scoutOpeningEndsAt,102.8);
});

test('earned guardian opening warning is visible, expires, and never leaks to unscouted runs',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const source=html.match(/function forestGuardianHint\([^)]*\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(source,'guardian warning must be wired into the actual forest scene');
  const hint=Function('return ('+source+')')();
  const guardian={hp:180,maxHp:180,scoutOpeningEndsAt:101.8,nextStrikeAt:101.8};
  const scouted=new Set(['traces']);
  assert.match(hint(guardian,scouted,3,100),/足跡の先読み 残り1\.8秒/,
    'reading the tracks gives a legible first-strike reaction window');
  assert.match(hint(guardian,scouted,3,100),/攻撃\+12か回避/,
    'the warning names the real attack bonus and the option to evade');
  assert.match(hint(guardian,scouted,3,101.71),/残り0\.1秒/,
    'the warning follows real remaining time, not a permanent buff');
  assert.doesNotMatch(hint(guardian,scouted,3,101.8),/攻撃\+12か回避/,
    'the attack-or-evade prompt expires with the earned opening');
  assert.doesNotMatch(hint(guardian,scouted,3,101.8),/先読み/,
    'the warning disappears once the first-strike grace has elapsed');
  guardian.scoutStrikeClaimed=true;
  assert.match(hint(guardian,scouted,3,100.5),/先手成功/,
    'after landing the scouting strike the HUD acknowledges the earned payoff');
  assert.doesNotMatch(hint(guardian,scouted,3,100.5),/攻撃\+12か回避/,
    'the consumed +12 bonus must not be offered again while the guardian lives');
  guardian.scoutStrikeClaimed=false;
  guardian.nextStrikeAt=104;
  assert.doesNotMatch(hint(guardian,scouted,3,103),/先読み/,
    'later guardian attack cooldowns must not pretend to be fresh scouting warnings');
  assert.doesNotMatch(hint(guardian,new Set(),3,100),/先読み/,
    'players who skipped the tracks never receive unearned warning');
  assert.match(hint(guardian,scouted,3,102),/番人HP 180\/180.*帰還不可.*未帰還の牙 3個/,
    'the guardian and provisional loot stakes stay visible after the warning');
  assert.equal(hint(null,scouted,3,100),'',
    'normal exploration must not display a guardian warning');
});

test('reading tracks rewards one landed early guardian hit, never a miss or later strike',()=>{
  const guardian={name:'苔祠の番人',scoutOpeningSeconds:1.8,nextStrikeAt:0};
  assert.equal(D.guardianScoutStrikeBonus(guardian,100),0,'no bonus before approach');
  assert.equal(D.armGuardianOpening(guardian,55,100),true);
  assert.equal(D.guardianScoutStrikeBonus(guardian,100.1),12,
    'a deliberate first hit within the earned opening deals extra damage');
  assert.equal(D.guardianScoutStrikeBonus(guardian,101.8),0,'the bonus expires');
  assert.equal(D.guardianScoutStrikeBonus({...guardian,scoutStrikeClaimed:true},100.1),0,
    'only one hit may receive the bonus');
  assert.equal(D.guardianScoutStrikeBonus({...guardian,name:'苔牙ゴブリン'},100.1),0,
    'normal enemies do not inherit the guardian bonus');
  assert.equal(D.guardianScoutStrikeBonus({name:'苔祠の番人',scoutOpeningSeconds:0},100.1),0,
    'an unscouted guardian grants no bonus');
  assert.equal(D.guardianScoutStrikeBonus(guardian,NaN),0,'invalid time grants no bonus');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const hit=html.slice(html.indexOf('function performAttackHitbox('),html.indexOf('function inflictDamage('));
  assert.match(hit,/attacker===ginji[\s\S]*?guardianScoutStrikeBonus\(target,performance\.now\(\)\/1000\)/,
    'only the player can claim the scouting bonus');
  assert.match(hit,/inflictDamage\(target, finalDmg\+scoutBonus/,
    'the bonus must affect actual damage');
  assert(hit.indexOf('if (!inflictDamage(')<hit.indexOf('target.scoutStrikeClaimed=true'),
    'a missed or invulnerable hit cannot consume the earned opening');
  assert.match(hit,/先手成功！/,'the earned early hit must show immediate feedback');
});

test('shrine guardian cannot be repeatedly grabbed while recovering from a throw',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const helper=html.match(/function canGrabEnemy\(f, other\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'the combat and button hint must share one grabbability rule');
  const canGrab=require('node:vm').runInNewContext('('+helper[0]+')');
  const hero={team:0};
  const guardian=state=>({team:1,name:'苔祠の番人',state});
  assert.equal(canGrab(hero,guardian('IDLE')),true,'a standing guardian is grabbable');
  assert.equal(canGrab(hero,guardian('WALK')),true);
  assert.equal(canGrab(hero,guardian('HURT')),false,'hitstun must offer a recovery window');
  assert.equal(canGrab(hero,guardian('DOWN')),false,'a downed guardian cannot be chain-thrown');
  assert.equal(canGrab(hero,guardian('DEAD')),false);
  assert.equal(canGrab(hero,{team:1,name:'森のゴブリン',state:'DOWN'}),true,
    'normal enemy grapple behavior is unchanged');
  assert.equal(canGrab(hero,{team:0,name:'仲間',state:'IDLE'}),false);
  assert.match(html,/function findNearbyGrabbableEnemy\(f\) \{[\s\S]*?if \(!canGrabEnemy\(f, other\)\) continue;/,
    'the on-screen grab hint must not promise a disabled guardian throw');
  const input=html.slice(html.indexOf('function updateFighter(f, input, dt)'));
  assert.match(input,/if \(input\.grab\) \{[\s\S]*?for \(const other of state\.fighters\) \{\s*if \(!canGrabEnemy\(f, other\)\) continue;/,
    'the actual grab input must enforce the same rule');
});

test('victory return panel hints at remaining discoveries without spoiling them or altering the safe return',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const helper=html.match(/function forestReturnTeaser\(found,crafted=false\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'the result screen needs a discovery-aware but non-spoiling hint');
  const teaser=require('node:vm').runInNewContext('('+helper[0]+')');
  const unread=teaser(new Set());
  const tracksRead=teaser(new Set(['traces']));
  const shrineRead=teaser(new Set(['traces','shrine']));
  const equippedRead=teaser(new Set(['traces','shrine']),true);
  assert.match(unread,/湿った土/);
  assert.match(tracksRead,/苔の間/);
  assert.match(shrineRead,/茨の奥/);
  assert.match(shrineRead,/今調べるか、牙を持ち帰って装備を整えるか/,
    'an unequipped player should choose whether to inspect now or return and prepare');
  assert.match(equippedRead,/鍛えた剣を手に、何があるか確かめよう/,
    'equipped players should still inspect the unknown location themselves');
  assert.equal(teaser(new Set(['traces','shrine','hollow'])),'',
    'once all sites are examined the panel should not invent more discoveries');
  for(const hint of [unread,tracksRead,shrineRead,equippedRead]) {
    assert.doesNotMatch(hint,/獣の痕跡|苔むす祠|茨の石門|切り開ける|進めそう/,
      'undiscovered places must remain unnamed');
  }
  const resultPanel=html.slice(html.indexOf('function showRpgPanel() {'),
    html.indexOf("document.getElementById('rpgOpenResults').addEventListener"));
  assert.match(resultPanel,/const unexploredCue=result\?forestReturnTeaser\(state\.forestFinds,rpg\.crafted\):'';/);
  assert.match(resultPanel,/keepExploring\.textContent=unexploredCue\?/,
    'the existing explore action should invite deliberate investigation');
  assert.match(resultPanel,/unexploredCue\?' '\+unexploredCue\+' 気になるなら森を調べよう。'/,
    'the player should see the unexplored cue alongside the safe-return stakes');
  assert.match(resultPanel,/const safeTotal=rpg\.banked\+rpg\.unbanked;/);
  assert.match(resultPanel,/rpgRules\.COST-safeTotal/,
    'the smithing and provisional-loot decision remains intact');
  assert.match(html,/if \(!rpgRules\.returnAlive\(rpg, ginji && ginji\.hp\)\) return;/,
    'the living-return banking rule must remain the only safe-return path');
});

test('crafted camp remembers an earned track clue without exposing the hidden destination',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const helper=html.match(/function forestRevisitAction\(found,crafted\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'the camp action must derive only from the current expedition findings');
  const revisit=require('node:vm').runInNewContext('('+helper[0]+')');
  const ordinary='🗺 もう一度、森へ遠征';
  assert.equal(revisit(new Set(),true),ordinary,'unknown tracks cannot create an earned clue');
  assert.equal(revisit(new Set(['traces']),false),ordinary,'unforged gear must not imply new reach');
  const earned=revisit(new Set(['traces','shrine']),true);
  assert.match(earned,/足跡の先を確かめに再遠征/);
  assert.doesNotMatch(earned,/石門|隠し道|開通|切り開ける/,'no secret solution before discovery');
  assert.equal(revisit(new Set(['traces','hollow']),true),ordinary,
    'after examining the destination, the prompt must not pretend it is still unknown');
  assert.match(html,/depart\.textContent=forestRevisitAction\(state\.forestFinds,rpg\.crafted\)/);
});


test('scouted guardian opening waits until the player can act, not while stunned or down',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const source=html.match(/const scoutInStrikeLane=([^;]+);/)?.[1];
  assert.ok(source,'guardian approach must use the actual player action/depth condition');
  const canRespond=Function('ginji','enemy','return ('+source+');');
  const guardian={z:230};
  assert.equal(canRespond({state:'HURT',z:230},guardian),false,
    'hitstun must not spend a discovered 1.8s warning');
  assert.equal(canRespond({state:'DOWN',z:230},guardian),false,
    'knockdown must not spend the earned first-hit choice');
  assert.equal(canRespond({state:'GRAB',z:230},guardian),false,
    'a grapple cannot consume the earned first-hit choice before a normal attack is possible');
  assert.equal(canRespond({state:'WALK',z:230},guardian),true,
    'recovering into an actionable state arms the warning');
  assert.equal(canRespond({state:'IDLE',z:260},guardian),false,
    'the depth-lane restriction remains intact');
  assert.equal(canRespond({state:'IDLE',z:230},{...guardian,state:'DOWN'}),false,
    'an ally knockdown must not start the player strike window while ordinary attacks miss');
  const enemy={name:'苔祠の番人',scoutOpeningSeconds:1.8,nextStrikeAt:0,z:230};
  assert.equal(D.armGuardianOpening(enemy,35,100,canRespond({state:'HURT',z:230},enemy)),false);
  assert.equal(D.armGuardianOpening(enemy,35,100.5,canRespond({state:'DOWN',z:230},enemy)),false);
  assert.equal(D.armGuardianOpening(enemy,35,101,canRespond({state:'IDLE',z:230},enemy)),true);
  assert.equal(enemy.scoutOpeningEndsAt,102.8,
    'the full reaction window starts after recovery instead of during helpless frames');
});

test('scouted guardian opening waits for a reachable attack-depth lane',()=>{
  const enemy={name:'苔祠の番人',scoutOpeningSeconds:1.8,nextStrikeAt:0};
  assert.equal(D.armGuardianOpening(enemy,50,100,false),false,
    'a nearby guardian on another depth lane must not consume the opening');
  assert.equal(enemy.scoutOpeningArmed,undefined);
  assert.equal(D.armGuardianOpening(enemy,50,100.5,true),true,
    'the full warning begins only when a real attack lane is reached');
  assert.equal(enemy.scoutOpeningEndsAt,102.3);
  assert.equal(D.guardianScoutStrikeBonus(enemy,101),12);
  assert.equal(D.armGuardianOpening(enemy,30,101,true),false,
    're-entering the lane cannot refresh the one-shot advantage');
  assert.equal(enemy.scoutOpeningEndsAt,102.3);
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/const scoutInStrikeLane=ginji && ginji\.state!=='HURT' && ginji\.state!=='DOWN' &&\s*ginji\.state!=='GRAB' && enemy\.state!=='DOWN' && Math\.abs\(ginji\.z-enemy\.z\)<=25;/,
    'the real combat scene must use the same depth limit as player hit detection');
  assert.match(html,/armGuardianOpening\(enemy,scoutDistance,nowSec,scoutInStrikeLane\)/,
    'the depth-lane check must gate the actual one-shot warning');
});

test('ally knockdown cannot spend the earned guardian strike window',()=>{
  const guardian={name:'苔祠の番人',state:'IDLE',scoutOpeningSeconds:1.8,nextStrikeAt:0};
  assert.equal(D.armGuardianOpening(guardian,40,100,true),true);
  assert.equal(guardian.scoutOpeningEndsAt,101.8);
  guardian.state='DOWN';
  for(let i=1;i<=20;i++) {
    const now=100+i*0.05;
    assert.equal(D.pauseGuardianOpening(guardian,0.05,now),true,
      'downed guardian cannot be struck normally, so preserve the remaining opening');
  }
  assert(Math.abs(guardian.scoutOpeningEndsAt-102.8)<0.00001);
  assert.equal(guardian.nextStrikeAt,guardian.scoutOpeningEndsAt,
    'guardian cannot counterattack before the delayed player opening closes');
  guardian.state='IDLE';
  assert.equal(D.pauseGuardianOpening(guardian,0.05,101.1),false,
    'a standing guardian consumes the warning normally');
  assert.equal(D.guardianScoutStrikeBonus(guardian,101.9),12,
    'a later player hit can still earn the one-time bonus');
  guardian.scoutStrikeClaimed=true;
  guardian.state='DOWN';
  assert.equal(D.pauseGuardianOpening(guardian,0.05,102),false,
    'a claimed bonus must not keep extending the timer');
  assert.equal(D.guardianScoutStrikeBonus(guardian,102),0);
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/pauseGuardianOpening\(f,dt,nowSec\)/,
    'the live frame loop must apply knockdown suspension before enemy update');
});

test('post-combat discovery pulse is once per unexamined clue and never navigation',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/forestCuePulsed: new Set\(\)/,
    'the cue history is per expedition, not part of the persisted save');
  assert.match(html,/state\.forestCuePulsed\.clear\(\)/,
    'revisiting on a new expedition can earn fresh sensory cues');
  assert.match(html,/rpg\.phase==='return' && cue && !state\.forestCuePulsed\.has\(cuePulseKey\)/,
    'only undiscovered sites after combat can pulse');
  assert.match(html,/state\.forestCuePulsed\.add\(cuePulseKey\);[\s\S]*?sfx\.haptic\(cue\.id==='hollow' && !near \? \[28,45,28\] : 34\)/,
    'mark the site once, with a distinct two-beat pulse only for the earned distant gate clue');
  assert.match(html,/document\.getElementById\('rpgPanel'\)\.classList\.contains\('hidden'\)/,
    'do not interrupt the return decision sheet');
  assert.match(html,/document\.getElementById\('forestShrineChoice'\)\.classList\.contains\('hidden'\)/,
    'do not interrupt a shrine decision');
  assert.equal(D.near({x:800,z:365},new Set(['traces'])),null,
    'a discovered clue must not be eligible for a new proximity cue');
  assert.equal(D.near({x:800,z:365},new Set())?.id,'traces');
});
