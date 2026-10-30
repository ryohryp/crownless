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
  const shrineApproach={x:730,z:260};
  assert.equal(D.near(shrineApproach,tracked),null,'distant shrine wind cannot allow an early tap');
  assert.equal(D.cueNear(shrineApproach,unread),null,'unread tracks do not grant distant shrine wind');
  assert.equal(D.cueNear(shrineApproach,tracked)?.id,'shrine',
    'reading tracks also earns a subtle cold-air cue for the other fork lead');
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
  assert.equal(pulseKey({id:'shrine'},null),'shrine:far');
  assert.equal(pulseKey({id:'hollow'},{id:'hollow'}),'hollow');
  assert.equal(pulseKey({id:'shrine'},{id:'shrine'}),'shrine');
  assert.equal(pulseKey(null,null),undefined);
  const pulseSource=html.match(/const pulsePattern=([\s\S]*?);/)?.[1];
  assert.ok(pulseSource,'the actual phone cue must distinguish shrine from tracks and gate');
  const pulse=Function('cue','near','return ('+pulseSource+');');
  assert.deepEqual(pulse({id:'shrine'},null),[12,80,18],
    'distant shrine breeze has its own quiet two-beat cue');
  assert.deepEqual(pulse({id:'shrine'},{id:'shrine'}),[18,65,36],
    'the cool shrine has a distinct soft two-beat cue before inspection');
  assert.deepEqual(pulse({id:'hollow'},null),[28,45,28],
    'the earned distant gate cue stays distinct');
  assert.equal(pulse({id:'hollow'},{id:'hollow'}),34,
    'the close gate confirmation stays a single pulse');
  assert.equal(pulse({id:'traces'},{id:'traces'}),34,
    'ordinary tracks retain their quiet single pulse');
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
  assert.equal(once({id:'shrine'},null),true,'the other branch gets its own earned cue');
  assert.equal(once({id:'shrine'},null),false,'distant shrine wind cannot spam');
  assert.equal(once({id:'shrine'},{id:'shrine'}),true,'close shrine confirmation is separate');
  assert.equal(D.cueNear({x:910,z:235},new Set())?.id,'hollow',
    'without tracks the player receives only the ordinary near-site cue');
  assert.match(html,/const near=window\.CrownlessForestDiscoveries\.near\(ginji,state\.forestFinds\)/,
    'normal contextual hints still use the original interaction radius');
});

test('earned far gate cue is perceivable without haptics, once only, and reveals no route',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const hintStart=html.indexOf('  function updateForestExploreHint()');
  const start=html.indexOf('    const near=window.CrownlessForestDiscoveries.near(ginji,state.forestFinds);',hintStart);
  const end=html.indexOf("    if (near?.id!=='shrine')",start);
  assert(hintStart>=0 && start>hintStart && end>start,'use the actual live cue block');
  const tick=new Function('window','ginji','state','rpg','document','sfx','spawnPopup',html.slice(start,end));
  const player={x:850,z:260,y:0};
  const state={forestFinds:new Set(['traces']),forestCuePulsed:new Set()};
  const popups=[],haptics=[];
  const doc={getElementById:()=>({classList:{contains:()=>true}})};
  const window={CrownlessForestDiscoveries:D};
  const sfx={haptic:pattern=>haptics.push(pattern)};
  const run=(phase='return')=>tick(window,player,state,{phase},doc,sfx,(...args)=>popups.push(args));
  run('fight');
  assert.equal(popups.length,0,'combat cannot disclose the earned clue');
  run();
  assert.equal(popups.length,1,'non-haptic devices still get one perceptible clue');
  assert.equal(popups[0][0],'遠くで、何かが軋む音がした');
  assert.equal(popups[0][1],player.x,'feedback is anchored to the hero, not the hidden gate');
  assert.equal(popups[0][2],player.z);
  assert.deepEqual(haptics,[[28,45,28]],'haptic cue is retained where supported');
  assert.equal(state.forestCuePulsed.has('hollow:far'),true);
  assert.deepEqual([...state.forestFinds],['traces'],'cue cannot discover the gate or award loot');
  run();
  assert.equal(popups.length,1,'standing inside the far radius must not spam');
  player.x=910;player.z=235;
  run();
  assert.equal(popups.length,1,'close-range confirmation must not repeat the distant popup');
  assert.equal(haptics.length,2,'the close-range tactile confirmation remains independent');
  assert.equal(state.forestCuePulsed.has('hollow'),true);
  assert.equal(state.forestFinds.has('hollow'),false,'approach still requires a deliberate tap');
  state.forestFinds=new Set();state.forestCuePulsed.clear();
  run();
  assert.equal(popups.length,1,'an unscouted nearby gate must not receive the earned far cue');
});

test('scouted distant shrine breeze is visible without haptics, but never discovers the site',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const hintStart=html.indexOf('  function updateForestExploreHint()');
  const start=html.indexOf('    const near=window.CrownlessForestDiscoveries.near(ginji,state.forestFinds);',hintStart);
  const end=html.indexOf("    if (near?.id!=='shrine')",start);
  assert(start>hintStart && end>start,'run the live phone cue block');
  const tick=new Function('window','ginji','state','rpg','document','sfx','spawnPopup',html.slice(start,end));
  const player={x:730,z:260,y:0},popups=[],haptics=[];
  const state={forestFinds:new Set(['traces']),forestCuePulsed:new Set()};
  const doc={getElementById:()=>({classList:{contains:()=>true}})};
  const run=(phase='return')=>tick({CrownlessForestDiscoveries:D},player,state,{phase},doc,
    {haptic:p=>haptics.push(p)},(...args)=>popups.push(args));
  assert.equal(D.near(player,state.forestFinds),null,'wind is not an interaction');
  run('fight');
  assert.equal(popups.length,0,'do not interrupt combat with a distant discovery');
  run();
  assert.equal(popups.length,1,'a phone without haptics still sees the earned breeze');
  assert.equal(popups[0][0],'頬を冷たい風がかすめた');
  assert.equal(popups[0][1],player.x,'do not expose the undiscovered shrine coordinates');
  assert.deepEqual(haptics,[[12,80,18]]);
  assert.equal(state.forestCuePulsed.has('shrine:far'),true);
  assert.deepEqual([...state.forestFinds],['traces'],'wind is not an automatic discovery');
  run();
  assert.equal(popups.length,1,'standing in the breeze cannot spam a popup');
  player.x=660;player.z=230;
  run();
  assert.equal(haptics.length,2,'walking close earns an independent inspection cue');
  assert.equal(state.forestCuePulsed.has('shrine'),true);
  assert.equal(state.forestFinds.has('shrine'),false,'only deliberate inspection can claim the site');
  player.x=730;player.z=260;
  state.forestFinds=new Set();state.forestCuePulsed.clear();
  run();
  assert.equal(popups.length,1,'without tracks there is no distant shrine hint');
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
  assert.match(html,/魔物を倒してから／奥に気配がある/,
    'the unavailable option explains when and why it becomes available');
  assert.ok(html.includes("奥に気配がある｜HP -'+riskCost+'・未帰還素材 +2／追加戦闘"),
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

test('tempered sword reduces optional shrine wounds but still requires a guarded return',()=>{
  const shrine={x:660,z:230};
  for(const [scouted,expected] of [[false,4],[true,1]]){
    const found=scouted?new Set(['traces']):new Set();
    assert.equal(D.shrineRiskDamage(found,true,true),expected,
      'tempering must reduce the real injury by two HP');
    assert.equal(D.shrineRiskDamage(found,true,false),expected+2,
      'ordinary forged sword retains the old injury');
    const weak=D.uncover(shrine,new Set(found),'return',expected,140,true,'risk',true);
    assert.equal(weak.reason,'weak','never spend a site on an unsurvivable risk');
    const result=D.uncover(shrine,new Set(found),'return',expected+1,140,true,'risk',true);
    assert.equal(result.ok,true);
    assert.equal(result.damage,expected);
    assert.equal(result.material,2,'sharpening does not mint extra fangs');
    assert.equal(result.heal,0);
  }
  assert.equal(D.shrineRiskDamage(new Set(['traces']),false,true),9,
    'no sword cannot claim a sharpening bonus');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.ok(html.includes('CrownlessForestDiscoveries.shrineRiskDamage(state.forestFinds,rpg.crafted,rpg.tempered)'),
    'the phone preview must use the exact same tempered rule as the reward');
  assert.match(html,/研ぎ直した剣で負傷 -2/,
    'the player must see the new equipment advantage before choosing the guarded route');
  assert.match(html,/追加戦闘あり・撃退まで帰還不可/,
    'the extra guardian remains an explicit consequence of deep searching');
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
  assert.ok(html.includes('足跡は二手に分かれ、途切れた。どちらを追う？（調査負傷 -3）'),
    'the discovered tracks should explain their benefit without naming the hidden shrine');
  assert.ok(html.includes('CrownlessForestDiscoveries.shrineRiskDamage(state.forestFinds,rpg.crafted,rpg.tempered)'),
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
test('unforged explorers can choose costly one-fang salvage or healing, but not forceful salvage',()=>{
  const gate={x:910,z:235};
  const unread=new Set();
  assert.equal(D.uncover(gate,unread,'return',50,140,false,'heal').reason,'trail',
    'the player must still discover the tracks before inspecting the gate');
  assert.equal(unread.size,0);
  const found=new Set(['traces']);
  assert.equal(D.uncover(gate,found,'return',50,140,false,'material').reason,'thorns');
  assert.equal(D.uncover(gate,found,'return',50,140,false).reason,'thorns');
  const barehand=D.uncover(gate,new Set(['traces']),'return',50,140,false,'cautious');
  assert.equal(barehand.material,1,'the swordless detour earns one provisional fang');
  assert.equal(barehand.damage,D.GATE_BAREHAND_DAMAGE,'bare hands pay a real thorn injury');
  assert.equal(barehand.heal,0,'salvage sacrifices the herbs');
  assert.equal(found.has('hollow'),false,'blocked salvage must not consume the site');
  const healed=D.uncover(gate,found,'return',50,140,false,'heal');
  assert.equal(healed.ok,true);
  assert.equal(healed.heal,45);
  assert.equal(healed.material,0);
  assert.equal(healed.damage,0);
  assert.equal(D.uncover(gate,found,'return',50,140,true,'material').ok,false,
    'using herbs must consume the one visit even after crafting');
  const full=new Set(['traces']);
  assert.equal(D.uncover(gate,full,'return',140,140,false,'heal').reason,'full');
  assert.equal(full.has('hollow'),false,'a useless heal cannot consume the gate');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/if \(site\?\.id==='hollow' && state\.forestFinds\.has\('traces'\)\) \{/);
  assert.match(html,/salvage\.disabled=!rpg\.crafted \|\| ginji\.hp<salvageCost\+1/);
  assert.match(html,/cautious\.disabled=ginji\.hp<cautiousCost\+1/);
  assert.match(html,/gateSalvageDamage\('cautious',rpg\.tempered,rpg\.crafted\)/,
    'phone previews barehand injury from the same rule as the reward');
  assert.match(html,/素手で牙 \+1（HP -/);
  assert.match(html,/rpg\.crafted\?'／牙 \+2は見送った':'／牙 \+1は見送った'/,
    'herbs sacrifice only the one fang the unarmed explorer could have earned');
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
  assert.match(html,/rpg\.tempered && shrineChoice==='material'\?'研ぎ直した剣で茨を払った！ ':!rpg\.crafted\?'素手で茨をかき分けて':'石門の茨を払って'/,
    'only the upgraded risky salvage should celebrate the sharpened blade');
  assert.match(html,/\+'牙 \+'\+discovery\.material\+'（未帰還）／HP -'\+discovery\.damage\+'・薬草は見送った'/,
    'all salvage choices must describe provisional fangs, actual injury and foregoing herbs');
  assert.match(html,/石門の薬草.*?牙 \+2は見送った/s,
    'healing must explicitly acknowledge the two provisional fangs forgone');
  assert.match(html,/tryExploreForest\(ginji,choice\)/,
    'phone choices must invoke the same authoritative reward rules');
  assert.match(html,/salvage\.disabled=!rpg\.crafted \|\| ginji\.hp<salvageCost\+1/,
    'phone material choice must not be clickable at lethal HP');
  assert.match(html,/Math\.floor\(ginji\.hp-salvageCost\)/,
    'the phone decision previews surviving HP before taking the fangs');
  assert.match(html,/!document\.getElementById\('forestGateChoice'\)\.classList\.contains\('hidden'\)/,
    'combat and projectiles must pause while the gate decision is open');
});
test('cautious gate salvage trades one fang for a smaller nonlethal wound',()=>{
  const gate={x:910,z:235};
  for(const hp of [4,4.5,8,140]){
    const found=new Set(['traces']);
    const reward=D.uncover(gate,found,'return',hp,140,true,'cautious');
    assert.equal(reward.ok,true);
    assert.equal(reward.material,1,'the safer route must not award the two-fang reward');
    assert.equal(reward.damage,D.GATE_CAUTIOUS_DAMAGE);
    assert.equal(reward.heal,0);
    assert.equal(found.has('hollow'),true);
    assert.equal(D.uncover(gate,found,'return',hp,140,true,'material').ok,false,
      'cautious salvage consumes the gate and prevents duplicate loot');
  }
  for(const hp of [1,3,3.5]){
    const found=new Set(['traces']);
    assert.equal(D.uncover(gate,found,'return',hp,140,true,'cautious').reason,'weak');
    assert.equal(found.has('hollow'),false);
    assert.equal(D.uncover(gate,found,'return',hp,140,true,'heal').ok,true,
      'a critically wounded explorer may still take the healing option');
  }
  assert.equal(D.uncover(gate,new Set(['traces']),'return',4,140,false,'cautious').reason,'weak');
  assert.equal(D.uncover(gate,new Set(),'return',4,140,true,'cautious').reason,'trail');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/id="forestGateCautious"/);
  assert.match(html,/cautious\.disabled=ginji\.hp<cautiousCost\+1/);
  assert.match(html,/\['forestGateCautious','cautious'\]/);
});
test('barehand salvage is nonlethal, one-time, and cannot bypass living-return banking',()=>{
  const gate={x:910,z:235};
  assert.equal(D.gateSalvageDamage('cautious',false,false),6);
  assert.equal(D.gateSalvageDamage('cautious',true,false),6,
    'a non-existent tempered sword cannot protect bare hands');
  for(const hp of [1,6,6.5]){
    const found=new Set(['traces']);
    assert.equal(D.uncover(gate,found,'return',hp,140,false,'cautious').reason,'weak');
    assert.equal(found.has('hollow'),false,'an impossible attempt does not spend the site');
  }
  const found=new Set(['traces']);
  const reward=D.uncover(gate,found,'return',7,140,false,'cautious');
  assert.equal(reward.ok,true);
  assert.equal(reward.material,1);
  assert.equal(reward.damage,6);
  assert.equal(reward.heal,0);
  assert.equal(D.uncover(gate,found,'return',7,140,false,'heal').ok,false);
  const run=R.create();
  assert.equal(R.claimMaterial(run),true);
  assert.equal(run.unbanked,1);
  assert.equal(run.banked,0);
  R.loseExpedition(run);
  assert.equal(run.unbanked,0);
  assert.equal(run.banked,0,'defeat still loses the barehand reward');
  const survived=R.create();
  R.claimMaterial(survived);
  R.clearWave(survived);
  assert.equal(R.returnAlive(survived,1),true);
  assert.equal(survived.banked,1,'only living return banks the single fang');
  assert.equal(survived.unbanked,0);
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
  assert.match(hint,/🍃 冷たい風。牙を拾うか、回復の機会を残すか/,'shrine is sensed before it is named');
  assert.match(hint,/回復の機会を残すか/,
    'healthy players see the irreversible shrine trade-off before tapping');
  assert.match(hint,/near\.id==='shrine' && ginji\.hp>=ginji\.maxHp/,
    'full-health shrine hint is chosen only when healthy');
  assert.match(hint,/near\.id==='shrine'\s*\? '🍃 冷たい風。牙か回復か、一度だけ選べる/,
    'injured players see healing versus lost material before a one-time tap');
  assert.match(hint,/茨の向こうで何かが軋む/,'gate is sensed before it is named');
  assert.match(hint,/足跡は二手に分かれ、途切れた/,'discovered tracks invite a visual choice without giving a compass direction');
  assert.doesNotMatch(hint,/足跡は右奥へ続いている/,'the HUD must not give away the trail direction before the player follows it');
  const pixel=fs.readFileSync('src/pixel-forest.js','utf8');
  assert.match(pixel,/function trail\(ctx,found\) \{\s*if\(!found.has\('traces'\)\) return;/,'the visible trail is earned by reading the tracks');
  assert.match(html,/forestArt\.trail\(ctx,state\.forestFinds\)/,'the live pixel forest draws the earned trail in the world');
  assert.match(hint,/足元のかすかな筋を辿ろう/,'unread tracks are suggested without naming the gate');
  assert.match(hint,/茨の奥で何かが軋む/,'locked gate invites an actual inspection before revealing equipment requirements');
  assert.doesNotMatch(hint,/奥の茨を調べてみよう|新しい剣で奥を調べよう/,'tracks must not prescribe the gate or a crafted-sword route');
  assert.doesNotMatch(hint,/石門の手前に獣の痕跡|茨の石門：風裂きの剣|鍛冶した剣があれば先へ/,'uninspected gate cannot reveal its name or answer');
  assert.match(hint,/気になる地点を直接タップ/,'the player must deliberately inspect');
  assert.doesNotMatch(hint,/near\.label/,'the hint must not automatically reveal an undiscovered name');
  assert.doesNotMatch(hint,/獣の痕跡や古い祠へ近づき/,'generic hint must not spoil specific locations');
});

test('nearby shrine stays readable on phone while preserving the one-time choice',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf('    const label=guardian' + String.fromCharCode(10));
  const end=html.indexOf('    if(hint.textContent!==label)',start);
  assert(start>=0 && end>start,'execute the actual forest HUD expression');
  const labelFor=new Function('guardian','near','state','rpg','ginji',
    html.slice(start,end)+'\\nreturn label;'.replace('\\n',String.fromCharCode(10)));
  for(const hp of [140,80]){
    const label=labelFor(null,{id:'shrine'},{forestFinds:new Set()},
      {phase:'return',unbanked:1,crafted:false},{hp,maxHp:140});
    assert(label.length<=40,'shrine hint must leave room to inspect the forest on a 360px phone');
    assert.match(label,/冷たい風/,'the first cue stays sensory');
    assert.match(label,hp===140?/回復の機会を残すか/:/牙か回復か/,
      'full and wounded explorers see the appropriate reversible decision');
    assert.match(label,/タップで調査/,'finding the site still requires deliberate inspection');
    assert.doesNotMatch(label,/苔むす祠|石門|右|左/,'do not spoil a site or draw a route');
  }
});

test('touching the locked gate before reading tracks preserves the mystery and spends nothing',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf('  function tryExploreForest(f,shrineChoice=');
  const end=html.indexOf('  // Read-only gameplay probe',start);
  assert(start>=0 && end>start,'exercise the actual forest reward handler');
  const player={x:910,z:235,y:0,hp:100,maxHp:140,state:'IDLE'};
  const state={forestFinds:new Set()};
  const rpg={phase:'return',crafted:false,tempered:false,unbanked:0};
  const popups=[];
  const handler=new Function('window','ginji','rpg','state','spawnPopup',
    'return ('+html.slice(start,end).trim()+');')(
      {CrownlessForestDiscoveries:D},player,rpg,state,(...args)=>popups.push(args));
  assert.equal(D.uncover(player,state.forestFinds,'return',100,140,false).reason,'trail');
  assert.equal(handler(player),true,'a real nearby tap gives a clue rather than punching');
  assert.equal(popups.length,1);
  assert.match(popups[0][0],/周囲の足元を調べよう/);
  assert.doesNotMatch(popups[0][0],/獣の痕跡|茨の石門|道の手がかり|隠し道/,
    'an undiscovered clue or secret route must not be named');
  assert.equal(state.forestFinds.size,0,'the hint cannot consume either discovery');
  assert.equal(rpg.unbanked,0,'the hint cannot award materials');
  state.forestFinds.add('traces');
  assert.equal(handler(player),true,'reading tracks changes the gate response');
  assert.match(popups[1][0],/鍛冶した剣なら切り開けそう/,
    'only after the tracks are read may the forged-sword solution be hinted');
  assert.equal(state.forestFinds.has('hollow'),false,'the locked gate remains available');
  assert.equal(rpg.unbanked,0);
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
  assert.match(hint,/forestGuardianHint\(guardian,state\.forestFinds,rpg\.unbanked,performance\.now\(\)\/1000,ginji\)/,
    'the guardian hint must use live scouting state, time and unsecured loot');
  const guardianHint=html.match(/function forestGuardianHint\([^)]*\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(guardianHint,'the live guardian hint helper must exist');
  assert.match(guardianHint,/Math\.ceil\(guardian\.hp\).*guardian\.maxHp/,
    'the current guardian HP must be visible during the fight');
  assert.match(guardianHint,/倒すまで帰還不可｜未帰還の牙/,
    'the active threat must show the actual unsecured materials at stake');
});

test('unscouted successful guardian counter explains the missed fang and invites scouting next run',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const helper=html.match(/function forestGuardianHint\([^)]*\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(helper,'live guardian HUD helper exists');
  const hint=Function('window','return ('+helper+');')({
    CrownlessForestDiscoveries:{
      guardianBehindWarning:()=>false,
      guardianDodgeCueActive:()=>false
    }
  });
  const guardian={
    hp:100,maxHp:180,guardianCounterUntil:12,guardianCounterTargetId:3,
    guardianCounterClaimed:true,guardianCounterFangClaimed:false,
    scoutOpeningEndsAt:0
  };
  const hero={id:3};
  const unscouted=hint(guardian,new Set(),4,10,hero);
  assert.match(unscouted,/反撃成功！痕跡未調査：牙の追加なし／追撃はタップ/,
    'after a real unscouted counter, HUD must explain why no extra fang appeared');
  assert.doesNotMatch(unscouted,/牙は獲得済み/,
    'a missed scouting reward must not be presented as already collected');
  const scouted=hint({...guardian,guardianCounterFangClaimed:true},
    new Set(['traces']),5,10,hero);
  assert.match(scouted,/反撃成功！牙は獲得済み／追撃はタップ/,
    'scouted successful counter keeps the existing collected-fang feedback');
  assert.doesNotMatch(scouted,/痕跡未調査/,
    'scouted play must never be labeled as missing tracks');
  assert.match(html,/earnedFang\?'／牙 \+1（未帰還）':!state\.forestFinds\.has\('traces'\)\?'／痕跡未調査：牙の追加なし'/,
    'the actual hit popup must explain the unscouted missed reward too');
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
  assert.match(html,/rpg\.crafted,shrineChoice,rpg\.tempered\)/);
});

test('unavailable deep shrine search still previews its cost, reward and guardian',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const expression=html.match(/risk\.textContent=([\s\S]*?);\s*heal\.textContent=/)?.[1];
  assert.ok(expression,'the actual risk button label expression must exist');
  assert.doesNotMatch(expression,/番人|苔祠/,
    'the pre-choice hint must warn of a fight without spoiling the guardian identity');
  const label=Function('risk','rpg','riskCost','ginji','state','return ('+expression+');');
  const state={forestFinds:new Set()};
  const weak=label({disabled:true},{phase:'return',crafted:false},12,{hp:12},state);
  assert.match(weak,/HP -12.*未帰還素材 \+2.*追加戦闘・撃退まで帰還不可.*HP 13以上必要/,
    'even at low HP, show the real risk and possible reward before a safe return');
  const fighting=label({disabled:true},{phase:'fight',crafted:false},12,{hp:140},state);
  assert.match(fighting,/魔物を倒してから.*HP -12.*未帰還素材 \+2/,
    'the existing combat lockout and reward preview remain intact');
  const ready=label({disabled:false},{phase:'return',crafted:false},12,{hp:14},state);
  assert.match(ready,/HP -12.*→残り2.*未帰還素材 \+2.*追加戦闘あり・撃退まで帰還不可/,
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
  assert.match(html,/rpg\.phase==='return'\?'／奥に気配・追加戦闘あり・撃退まで帰還不可'/,
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
  assert.match(html,/足跡を読んで負傷 -3・接近する物音を早く察知/);
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

test('thorn-first investigation earns a longer guardian warning without free loot',()=>{
  const tracks=new Set(['traces']);
  const gateFirst=new Set(['traces','hollow']);
  assert.equal(D.guardianOpeningSeconds(tracks),1.8,'tracks alone retain the warning');
  assert.equal(D.guardianOpeningSeconds(gateFirst),2.4,'the other fork earns 0.6s');
  assert.equal(D.guardianOpeningSeconds(new Set(['hollow'])),0,
    'a gate flag without earned tracks must not grant a warning');
  assert.equal(D.guardianOpeningSeconds(new Set()),0,'unscouted fights are unchanged');
  const guardian={name:'苔祠の番人',scoutOpeningSeconds:D.guardianOpeningSeconds(gateFirst),nextStrikeAt:0};
  assert.equal(D.armGuardianOpening(guardian,40,100,true),true);
  assert.equal(guardian.scoutOpeningEndsAt,102.4);
  assert.equal(D.guardianScoutStrikeBonus(guardian,102.3),12);
  assert.equal(D.guardianScoutStrikeBonus(guardian,102.4),0,
    'the longer warning still expires, without repeatable rewards');
  assert.deepEqual([...gateFirst],['traces','hollow'],
    'calculating the advantage cannot auto-discover the shrine');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.ok(html.includes("state.forestFinds.has('hollow')") &&
    html.includes('奥まで探るなら、石門の茨の手がかりで先手の猶予 +0.6秒。'),
    'the advantage is explained before choosing the optional fight');
  assert.ok(html.includes('石門の茨で番人の動きを読んだ！先手の猶予 +0.6秒'),
    'the encounter confirms the scouting advantage');
  assert.ok(html.includes('guardianOpeningSeconds(state.forestFinds)'),
    'the live encounter must derive warning time from the investigated route');
  assert.ok(html.includes('spawnEnemyWave(state.waveCount,1,true)'),
    'the advantage cannot bypass the guardian');
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
  assert.match(html,/guardianReadyForOpening\(ginji,enemy\)/,
    'the live enemy AI must use the shared actionable scouting rule');
  const inLane=state=>D.guardianReadyForOpening(
    {x:0,z:0,state},{x:30,z:0,state:'IDLE'});
  for(const state of ['HURT','DOWN','GRAB'])
    assert.equal(inLane(state),false,state+' must not spend the earned 1.8 seconds');
  assert.equal(inLane('IDLE'),true,'a recovered player can earn the full window');
  assert.equal(D.guardianReadyForOpening(
    {x:0,z:0,state:'IDLE'},{x:30,z:0,state:'DOWN'}),false,
    'a knocked-down guardian cannot be struck with the normal scouting attack');
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
  // Evaluate the live browser function with its actual discovery helpers, not
  // an undefined Node global. The HUD now shares the targeted dodge guard.
  const hint=Function('window','return ('+source+')')({CrownlessForestDiscoveries:D});
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
  assert.match(hit,/attacker===ginji[\s\S]*?guardianScoutStrikeBonus\(target,hitNowSec\)/,
    'only the player can claim the scouting bonus using the hit timestamp');
  assert.match(hit,/inflictDamage\(target, finalDmg\+scoutBonus/,
    'the bonus must affect actual damage');
  assert(hit.indexOf('if (!inflictDamage(')<hit.indexOf('target.scoutStrikeClaimed=true'),
    'a missed or invulnerable hit cannot consume the earned opening');
  assert.match(hit,/先手成功！/,'the earned early hit must show immediate feedback');
});

test('companion defends before scouting activates, then yields the earned strike window',()=>{
  const guardian={name:'苔祠の番人',scoutOpeningSeconds:1.8};
  assert.equal(D.companionYieldsGuardianOpening(guardian,100),false,
    'the ally must not idle indefinitely if the player stays away');
  assert.equal(D.armGuardianOpening(guardian,80,100),false,
    'a distant player has not earned the short first-strike window');
  assert.equal(D.companionYieldsGuardianOpening(guardian,100.2),false,
    'the companion can still fight while the player has not approached');
  assert.equal(D.armGuardianOpening(guardian,55,100),true);
  assert.equal(D.companionYieldsGuardianOpening(guardian,100.5),true,
    'the ally should not consume the active player strike window');
  guardian.scoutStrikeClaimed=true;
  assert.equal(D.companionYieldsGuardianOpening(guardian,100.5),false,
    'the companion can help after the player lands the earned strike');
  guardian.scoutStrikeClaimed=false;
  assert.equal(D.companionYieldsGuardianOpening(guardian,101.8),false,
    'the companion resumes after the opening expires even if the player evades');
  assert.equal(D.companionYieldsGuardianOpening({...guardian,scoutOpeningSeconds:0},100.5),false,
    'unscouted guardian fights retain normal companion support');
  assert.equal(D.companionYieldsGuardianOpening({...guardian,name:'森のゴブリン'},100.5),false,
    'ordinary enemies retain normal companion support');
  assert.equal(D.companionYieldsGuardianOpening(guardian,NaN),false);
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const ai=html.slice(html.indexOf('function sampleCompanionAI('),html.indexOf('function sampleEnemyAI('));
  assert.match(ai,/companionYieldsGuardianOpening\(\s*scoutedGuardian,guardianNow\)/,
    'the real companion AI must honor the earned opening');
  assert.match(ai,/companionYieldsGuardianFootsteps\(\s*ginji,scoutedGuardian,state\.forestFinds,selfFighter\)/,
    'the real companion AI must still honor the footsteps cue');
  assert.match(ai,/!\['HURT','DOWN','GRAB'\]\.includes\(ginji\.state\)/,
    'the ally must still protect an incapacitated explorer');
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
  const gateRead=teaser(new Set(['traces','hollow']));
  const equippedRead=teaser(new Set(['traces','shrine']),true);
  assert.match(unread,/湿った土/);
  assert.match(tracksRead,/二手に分かれ/,
    'with both branches unexplored, the result panel must invite a choice, not prescribe the shrine');
  assert.match(tracksRead,/苔の湿りと折れた茨/,
    'the result prompt reflects the two earned physical signs');
  assert.doesNotMatch(tracksRead,/祠|石門|右|左|先に苔/,
    'the first branch and hidden destinations remain the player\'s discovery');
  assert.match(gateRead,/苔の間/,
    'inspecting the gate first leaves the other branch available');
  assert.match(shrineRead,/茨の奥/);
  assert.match(shrineRead,/今の装備では奥へ踏み込めない。手前を調べる余地はありそうだ/,
    'without a forged blade, the result must not promise an immediately accessible route');
  assert.doesNotMatch(shrineRead,/今調べるか|今確かめよう/,
    'an inaccessible discovery must not be presented as an available immediate choice');
  assert.match(equippedRead,/鍛えた剣を手に、何があるか確かめよう/,
    'equipped players should still inspect the unknown location themselves');
  assert.equal(teaser(new Set(['traces','shrine','hollow'])),'',
    'once all sites are examined the panel should not invent more discoveries');
  for(const hint of [unread,tracksRead,shrineRead,gateRead,equippedRead]) {
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

test('camp remembers both earned fork leads in either inspection order without promising a hidden route',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const helper=html.match(/function forestRevisitAction\(found\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'the camp action must derive from current expedition findings');
  const revisit=require('node:vm').runInNewContext('('+helper[0]+')');
  const ordinary='🗺 もう一度、森へ遠征';
  assert.equal(revisit(new Set()),ordinary,'unread tracks cannot create an earned clue');
  assert.equal(revisit(new Set(['hollow'])),ordinary,'unread tracks cannot advertise a fork');
  const fork=revisit(new Set(['traces']));
  assert.match(fork,/二手の踏み跡を確かめに再遠征/,
    'before either site is inspected, the camp must not prefer the gate');
  assert.doesNotMatch(fork,/祠|石門|右|左|剣|開通/,
    'the earned fork must not reveal its destinations or demand equipment');
  const shrineFirst=revisit(new Set(['traces','shrine']));
  assert.match(shrineFirst,/茨の軋みを確かめに再遠征/,
    'inspecting the moss side first preserves the unvisited thorn side');
  assert.doesNotMatch(shrineFirst,/祠|石門|隠し道|開通|切り開ける|右|左|剣が必要/,
    'the still-unvisited gate and its solution must not be disclosed');
  const gateFirst=revisit(new Set(['traces','hollow']));
  assert.match(gateFirst,/苔の湿りを確かめに再遠征/,
    'inspecting the thorn side first preserves the unvisited moss side');
  assert.doesNotMatch(gateFirst,/祠|石門|隠し道|開通|切り開ける|右|左/,
    'the still-unvisited shrine and secret routes remain concealed');
  assert.equal(revisit(new Set(['traces','shrine','hollow'])),ordinary,
    'when both branches have been inspected, no new clue is invented');
  assert.match(html,/depart\.textContent=forestRevisitAction\(state\.forestFinds\)/,
    'the actual camp button must use the earned clue, not the forged-gear state');
});


test('scouted guardian opening waits until the player can act, not while stunned or down',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/guardianReadyForOpening\(ginji,enemy\)/,
    'guardian approach must use the shared player action/depth condition');
  const canRespond=(ginji,enemy)=>D.guardianReadyForOpening(ginji,enemy);
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
  assert.match(html,/const scoutInStrikeLane=window\.CrownlessForestDiscoveries\.guardianReadyForOpening\(ginji,enemy\);/,
    'the real combat scene must use the tested depth limit and action readiness rule');
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
  assert.match(html,/guardian\.state==='DOWN'\s*\? '👁 番人転倒中｜先手の機会を温存｜'/,
    'the phone HUD must not promise a hittable strike while the ally has knocked the guardian down');
});

test('guardian knockdown cannot waste the earned dodge counter or duplicate a fang',()=>{
  const guardian={name:'苔祠の番人',state:'DOWN',hp:80,x:20,z:0,
    guardianCounterUntil:101.2,guardianCounterTargetId:3,
    guardianCounterClaimed:false,nextStrikeAt:101.2};
  const hero={id:3,x:0,z:0,state:'IDLE'};
  for(let i=1;i<=30;i++) assert.equal(
    D.pauseGuardianCounter(guardian,hero,0.05,100+i*0.05),true);
  assert(Math.abs(guardian.guardianCounterUntil-102.7)<0.00001);
  assert.equal(guardian.nextStrikeAt,guardian.guardianCounterUntil);
  guardian.state='IDLE';
  assert.equal(D.pauseGuardianCounter(guardian,hero,0.05,101.6),false);
  assert.equal(D.guardianCounterStrikeBonus(guardian,101.6,3),8);
  assert.equal(D.claimGuardianCounter(guardian,101.6,3),true);
  const run=R.create();
  assert.equal(D.claimGuardianCounterFang(guardian,()=>R.claimMaterial(run),true),true);
  assert.equal(D.claimGuardianCounterFang(guardian,()=>R.claimMaterial(run),true),false);
  assert.equal(run.unbanked,1);
  assert.equal(R.clearWave(run),true);
  assert.equal(R.returnAlive(run,80),true);
  assert.equal(run.banked,1,'earned loot is banked only on living return');
  guardian.state='DOWN';
  assert.equal(D.pauseGuardianCounter(guardian,hero,0.05,101.7),false,
    'claimed counters cannot be extended');
  const fresh={...guardian,guardianCounterClaimed:false,guardianCounterUntil:104};
  assert.equal(D.pauseGuardianCounter(fresh,{...hero,id:4},0.05,102),false);
  assert.equal(D.pauseGuardianCounter(fresh,{...hero,state:'HURT'},0.05,102),false);
  assert.equal(D.pauseGuardianCounter(fresh,{...hero,x:500},0.05,102),false);
  assert.equal(D.pauseGuardianCounter({...fresh,guardianCounterUntil:101},hero,0.05,102),false);
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.ok(html.includes('pauseGuardianCounter(f,ginji,dt,nowSec)'));
  assert.ok(html.includes("guardian.state==='DOWN' ? '🍃 番人転倒中｜反撃の機会を温存｜'"));
});

test('post-combat discovery pulse is once per unexamined clue and never navigation',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/forestCuePulsed: new Set\(\)/,
    'the cue history is per expedition, not part of the persisted save');
  assert.match(html,/state\.forestCuePulsed\.clear\(\)/,
    'revisiting on a new expedition can earn fresh sensory cues');
  assert.match(html,/rpg\.phase==='return' && cue && !state\.forestCuePulsed\.has\(cuePulseKey\)/,
    'only undiscovered sites after combat can pulse');
  assert.match(html,/state\.forestCuePulsed\.add\(cuePulseKey\);[\s\S]*?const pulsePattern=cue\.id==='hollow' && !near \? \[28,45,28\] :[\s\S]*?cue\.id==='shrine' \? \[18,65,36\] : 34;[\s\S]*?sfx\.haptic\(pulsePattern\)/,
    'mark each site once, keeping the earned distant gate cue and the shrine tactile signature distinct');
  assert.match(html,/document\.getElementById\('rpgPanel'\)\.classList\.contains\('hidden'\)/,
    'do not interrupt the return decision sheet');
  assert.match(html,/document\.getElementById\('forestShrineChoice'\)\.classList\.contains\('hidden'\)/,
    'do not interrupt a shrine decision');
  assert.equal(D.near({x:800,z:365},new Set(['traces'])),null,
    'a discovered clue must not be eligible for a new proximity cue');
  assert.equal(D.near({x:800,z:365},new Set())?.id,'traces');
});

test('tempered smith sword makes forceful gate salvage safer without granting extra loot',()=>{
  const gate={x:910,z:235};
  assert.equal(D.gateSalvageDamage('material',false),8);
  assert.equal(D.gateSalvageDamage('material',true),4);
  assert.equal(D.gateSalvageDamage('cautious',false),3);
  assert.equal(D.gateSalvageDamage('cautious',true),0,
    'a tempered blade makes careful salvage safe, not more lucrative');
  for(const [tempered,hp,damage] of [[false,4,3],[true,1,0]]){
    const found=new Set(['traces']);
    const reward=D.uncover(gate,found,'return',hp,140,true,'cautious',tempered);
    assert.equal(reward.ok,true);
    assert.equal(reward.damage,damage);
    assert.equal(reward.material,1);
    assert.equal(reward.heal,0);
    assert.equal(found.has('hollow'),true);
    assert.equal(D.uncover(gate,found,'return',hp,140,true,'material',tempered).ok,false,
      'careful salvage cannot also claim the risky two-fang reward');
  }
  assert.equal(D.uncover(gate,new Set(['traces']),'return',1,140,true,'material',true).reason,'weak',
    'the forceful route must remain dangerous even when cautious salvage is safe');
  for(const [tempered,damage] of [[false,8],[true,4]]){
    const found=new Set(['traces']);
    const reward=D.uncover(gate,found,'return',20,140,true,'material',tempered);
    assert.equal(reward.ok,true);
    assert.equal(reward.material,2,'sharpening never mints extra fangs');
    assert.equal(reward.damage,damage);
    assert.equal(reward.heal,0);
    assert.equal(D.uncover(gate,found,'return',20,140,true,'heal',tempered).ok,false,
      'the gate remains once per expedition');
  }
  const weak=new Set(['traces']);
  assert.equal(D.uncover(gate,weak,'return',4.5,140,true,'material',true).reason,'weak');
  assert.equal(weak.has('hollow'),false,'a lethal salvage cannot consume the gate');
  assert.equal(D.uncover(gate,weak,'return',5,140,true,'material',true).damage,4);
  assert.equal(D.uncover(gate,new Set(['traces']),'return',20,140,false,'material',true).reason,'thorns',
    'tempering never unlocks salvage without the forged sword');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/gateSalvageDamage\('material',rpg\.tempered\)/,
    'phone preview must derive the actual equipment-dependent wound');
  assert.match(html,/gateSalvageDamage\('cautious',rpg\.tempered,rpg\.crafted\)/,
    'careful salvage preview must use the same tempered rule as the reward');
  assert.match(html,/cautiousCost===0\?'負傷なし'/,
    'zero-risk choice must be legible instead of advertising HP -0');
  assert.match(html,/shrineChoice==='cautious' && discovery\.damage===0\?'研ぎ直した剣で慎重に茨を払い、無傷で牙 \+'\+discovery\.material/,
    'a wound-free actual gate reward must not falsely announce HP -0');
  assert.match(html,/rpg\.crafted,shrineChoice,rpg\.tempered\)/,
    'the live tap applies the same tempered state as the preview');
  assert.match(html,/研ぎ直した剣で負傷軽減/,
    'the reason for a changed risk must be visible before choosing');
});


test('a landed guardian strike acknowledges the gate-first detour, not merely the warning',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const expression=html.match(/const scoutHitMessage=([\s\S]*?);\s*spawnPopup\(scoutHitMessage\+scoutBonus/);
  assert.ok(expression,'the actual landed-hit popup must use the earned scouting variant');
  const message=Function('target','return ('+expression[1]+');');
  assert.match(message({scoutOpeningSeconds:2.4}),/石門の観察が効いた！先手 \+/,
    'gate-first players see how their earlier choice paid off');
  assert.match(message({scoutOpeningSeconds:1.8}),/先手成功！\+/,
    'tracks-only players still see the ordinary earned first strike');
  assert.doesNotMatch(message({scoutOpeningSeconds:1.8}),/石門/,
    'do not credit a detour that was not taken');
  const hit=html.indexOf('if (scoutBonus) {');
  const popup=html.indexOf('spawnPopup(scoutHitMessage+scoutBonus',hit);
  assert.ok(hit>=0 && popup>hit && popup-hit<600,
    'the gate-specific success message is emitted only in the landed-bonus branch');
  assert.equal(D.guardianOpeningSeconds(new Set(['traces','hollow'])),2.4);
  assert.equal(D.guardianOpeningSeconds(new Set(['traces'])),1.8);
  assert.equal(D.guardianOpeningSeconds(new Set()),0);
});
