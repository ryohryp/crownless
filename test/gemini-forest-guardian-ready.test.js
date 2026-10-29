'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const D=require('../src/gemini-forest-discoveries.js');

test('earned scouting warning waits for a controllable hero and a hittable guardian',()=>{
  const hero={state:'IDLE',z:230};
  const guardian={name:'苔祠の番人',state:'IDLE',z:230,scoutOpeningSeconds:1.8};
  assert.equal(D.guardianReadyForOpening(hero,guardian),true);
  for(const state of ['DEAD','HURT','DOWN','GRAB','ATTACK','SPECIAL','JUMP']){
    hero.state=state;
    assert.equal(D.guardianReadyForOpening(hero,guardian),false,
      'player '+state+' must not waste the earned window');
  }
  hero.state='WALK';
  assert.equal(D.guardianReadyForOpening(hero,guardian),true);
  hero.state='RUN';
  assert.equal(D.guardianReadyForOpening(hero,guardian),true);
  hero.state='IDLE';
  for(const state of ['DEAD','HURT','DOWN','GRAB']){
    guardian.state=state;
    assert.equal(D.guardianReadyForOpening(hero,guardian),false,
      'guardian '+state+' cannot receive the opening strike');
  }
  guardian.state='IDLE';
  hero.z=260;
  assert.equal(D.guardianReadyForOpening(hero,guardian),false,
    'being near in X but outside the attack depth lane must not arm');
  hero.z=255;
  assert.equal(D.guardianReadyForOpening(hero,guardian),true,
    'the lane edge remains valid');
  assert.equal(D.guardianReadyForOpening(null,guardian),false);
  assert.equal(D.guardianReadyForOpening(hero,null),false);
});

test('scouting warning waits until the hero faces the approaching guardian',()=>{
  const hero={state:'IDLE',x:0,z:230,facing:-1};
  const guardian={name:'苔祠の番人',state:'IDLE',x:35,z:230,scoutOpeningSeconds:1.8,nextStrikeAt:0};
  assert.equal(D.guardianReadyForOpening(hero,guardian),false,
    'being in attack range while facing away cannot spend the earned warning');
  assert.equal(D.armGuardianOpening(guardian,35,100,D.guardianReadyForOpening(hero,guardian)),false);
  assert.equal(guardian.scoutOpeningArmed,undefined);
  hero.facing=1;
  assert.equal(D.guardianReadyForOpening(hero,guardian),true,
    'turning to face the guardian makes the opening actionable');
  assert.equal(D.armGuardianOpening(guardian,35,101,D.guardianReadyForOpening(hero,guardian)),true);
  assert.equal(guardian.scoutOpeningEndsAt,102.8);
  guardian.x=-35;
  assert.equal(D.guardianReadyForOpening(hero,guardian),false,
    'facing right cannot start a fresh left-side warning');
  hero.facing=-1;
  assert.equal(D.guardianReadyForOpening(hero,guardian),true);
  guardian.x=hero.x;
  assert.equal(D.guardianReadyForOpening(hero,guardian),true,
    'overlapping fighters are close enough to strike regardless of facing');
});

test('deferred warning remains a one-shot opportunity once both fighters recover',()=>{
  const hero={state:'JUMP',z:230};
  const guardian={name:'苔祠の番人',state:'IDLE',z:230,scoutOpeningSeconds:1.8,nextStrikeAt:0};
  assert.equal(D.armGuardianOpening(guardian,40,100,D.guardianReadyForOpening(hero,guardian)),false);
  assert.equal(guardian.scoutOpeningArmed,undefined,'jumping must not consume scouting');
  hero.state='IDLE';
  guardian.state='HURT';
  assert.equal(D.armGuardianOpening(guardian,40,101,D.guardianReadyForOpening(hero,guardian)),false);
  assert.equal(guardian.scoutOpeningArmed,undefined,'recovering target must not consume scouting');
  guardian.state='IDLE';
  assert.equal(D.armGuardianOpening(guardian,40,102,D.guardianReadyForOpening(hero,guardian)),true);
  assert.equal(guardian.scoutOpeningEndsAt,103.8);
  assert.equal(D.armGuardianOpening(guardian,40,103,D.guardianReadyForOpening(hero,guardian)),false,
    'a second approach cannot refresh the window');
  assert.equal(D.guardianScoutStrikeBonus(guardian,102.5),12);
  assert.equal(D.guardianScoutStrikeBonus(guardian,103.8),0);
});

test('live forest enemy AI uses the same actionable scouting rule',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const ai=html.slice(html.indexOf('function sampleEnemyAI('),html.indexOf('function updateFighter('));
  assert.match(ai,/guardianReadyForOpening\(ginji,enemy\)/,
    'real guardian movement must use the tested readiness predicate');
  assert.match(ai,/armGuardianOpening\(enemy,scoutDistance,nowSec,scoutInStrikeLane\)/,
    'the predicate must gate the real one-shot warning');
});


test('ally yields only for an actionable, nearby scouted threat behind the hero',()=>{
  const found=new Set(['traces']);
  const hero={x:0,z:230,state:'IDLE',facing:-1};
  const guardian={name:'苔祠の番人',x:105,z:230,hp:140,
    state:'DOWN',scoutOpeningSeconds:1.8};
  assert.equal(D.companionYieldsGuardianFootsteps(hero,guardian,found),true,
    'the ally must let the downed guardian recover so the player can hear it approach');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,x:121},found),false,
    'the ally still protects the explorer before the threat comes near');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,x:49,state:'IDLE'},found),true,
    'just outside melee reach, the player can still hear and turn');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,x:48,state:'IDLE'},found),false,
    'at guardian melee reach the ally must protect a hero who ignores the cue');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,x:25,state:'IDLE'},found),false,
    'the companion must not remain idle while an enemy is already attacking');
  const ally={x:100,z:230,hp:90,maxHp:130};
  assert.equal(D.companionYieldsGuardianFootsteps(hero,guardian,found,ally),true,
    'a recovering guardian still leaves a chance to hear footsteps');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,state:'IDLE'},found,ally),false,
    'a guardian engaging the ally must not make the ally stand helpless');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,state:'IDLE'},found,{...ally,z:260}),true,
    'an ally in a different lane need not interrupt the earned footsteps');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,state:'IDLE'},found,{...ally,x:20}),true,
    'an ally outside the guardian strike range still yields to the hero');

  assert.equal(D.companionYieldsGuardianFootsteps({...hero,facing:1},guardian,found),false,
    'turning toward the threat resumes normal assistance');
  assert.equal(D.companionYieldsGuardianFootsteps({...hero,state:'HURT'},guardian,found),false,
    'the ally must protect an incapacitated hero');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,z:260},found),false,
    'another depth lane must not silence the ally');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,scoutOpeningArmed:true},found),false,
    'the armed first-hit window has its separate yield rule');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,guardian,new Set()),false,
    'unscouted fights must never pause the ally');
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,name:'苔牙ゴブリン'},found),false);
  assert.equal(D.companionYieldsGuardianFootsteps(hero,{...guardian,hp:0},found),false);
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const ai=html.slice(html.indexOf('function sampleCompanionAI('),html.indexOf('function sampleEnemyAI('));
  assert.match(ai,/companionYieldsGuardianFootsteps\(\s*ginji,scoutedGuardian,state\.forestFinds,selfFighter\)/,
    'the live companion must use the same bounded behind-cue yield rule');
});

test('ally allows a bounded first guardian tell after a scouted player hit',()=>{
  const hero={x:0,z:230,state:'IDLE'};
  const guardian={name:'苔祠の番人',x:35,z:230,scoutStrikeClaimed:true,
    scoutFirstHitYieldUntil:103.2};
  assert.equal(D.companionYieldsGuardianRecovery(hero,guardian,101),true,
    'the guardian must recover to telegraph instead of being finished by the ally');
  assert.equal(D.companionYieldsGuardianRecovery(hero,guardian,103.2),false,
    'the yield must expire if the guardian never reaches its first tell');
  assert.equal(D.companionYieldsGuardianRecovery(hero,{...guardian,x:120},101),false,
    'a distant hero must not leave the ally idle');
  assert.equal(D.companionYieldsGuardianRecovery(hero,{...guardian,z:260},101),false,
    'the ally must still defend in another depth lane');
  assert.equal(D.companionYieldsGuardianRecovery({...hero,state:'DOWN'},guardian,101),false,
    'a downed hero must receive normal companion protection');
  assert.equal(D.companionYieldsGuardianRecovery(hero,{...guardian,scoutStrikeClaimed:false},101),false);
  assert.equal(D.companionYieldsGuardianRecovery(hero,{...guardian,name:'苔牙ゴブリン'},101),false,
    'ordinary enemies are unaffected');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const ally=html.slice(html.indexOf('function sampleCompanionAI('),html.indexOf('function sampleEnemyAI('));
  assert.match(ally,/companionYieldsGuardianRecovery\(\s*ginji,scoutedGuardian,guardianNow\)/,
    'the live companion uses the bounded recovery rule');
  assert.match(html,/target\.scoutFirstHitYieldUntil=performance\.now\(\)\/1000\+3\.2/,
    'a landed scouted hit begins the short recovery yield');
  assert.match(html,/enemy\.scoutFirstHitYieldUntil=0/,
    'the first visible tell releases the recovery yield');
});

test('the shrine guardian pursues a nearby active explorer, not a nearer companion',()=>{
  const hero={x:0,z:230,state:'IDLE'};
  const guardian={name:'苔祠の番人',x:170,z:230,state:'IDLE'};
  assert.equal(D.guardianTargetsExplorer(guardian,hero),true,
    'choosing the risky shrine search should make the guardian a personal threat');
  assert.equal(D.guardianTargetsExplorer({...guardian,x:201},hero),false,
    'a distant player must not strand the companion in an unwinnable chase');
  assert.equal(D.guardianTargetsExplorer({...guardian,x:200},hero),true);
  assert.equal(D.guardianTargetsExplorer(guardian,{...hero,state:'DOWN'}),false,
    'a downed player must not cause guardian AI to stall while an ally can defend');
  assert.equal(D.guardianTargetsExplorer(guardian,{...hero,state:'DEAD'}),false);
  assert.equal(D.guardianTargetsExplorer(guardian,{...hero,state:'GRAB'}),false);
  assert.equal(D.guardianTargetsExplorer({...guardian,name:'苔牙ゴブリン'},hero),false,
    'ordinary enemies still choose the nearest living target');
  assert.equal(D.guardianTargetsExplorer(guardian,null),false);
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const ai=html.slice(html.indexOf('function sampleEnemyAI('),html.indexOf('function updateFighter('));
  assert.match(ai,/guardianTargetsExplorer\(enemy,ginji\)/,
    'the live guardian must use the same proximity and recovery rule');
});

test('scouted footsteps behind the hero invite a turn without spending the strike timer',()=>{
  const tracks=new Set(['traces']);
  const hero={x:0,z:230,state:'IDLE',facing:-1};
  const guardian={name:'苔祠の番人',x:80,z:230,hp:180,maxHp:180,
    state:'IDLE',scoutOpeningSeconds:1.8,nextStrikeAt:0};
  assert.equal(D.guardianBehindWarning(hero,guardian,tracks),true);
  assert.equal(D.guardianReadyForOpening(hero,guardian),false);
  assert.equal(D.armGuardianOpening(guardian,80,100,D.guardianReadyForOpening(hero,guardian)),false);
  assert.equal(guardian.scoutOpeningArmed,undefined,'the sensory clue cannot consume the bonus');

  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const source=html.match(/function forestGuardianHint\([^)]*\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(source,'the live phone HUD must contain the guardian hint');
  const hint=Function('window','return ('+source+')')({CrownlessForestDiscoveries:D});
  assert.match(hint(guardian,tracks,3,100,hero),/背後に足音。振り向けば先手の機会/);
  assert.doesNotMatch(hint(guardian,tracks,3,100,hero),/残り1\.8秒/,
    'do not show a countdown before the earned window actually starts');
  assert.match(hint(guardian,tracks,3,100,hero),/未帰還の牙 3個/,
    'the unsecured materials remain visible during the warning');

  assert.equal(D.guardianBehindWarning(hero,guardian,new Set()),false,'no tracks, no cue');
  assert.equal(D.guardianBehindWarning(hero,{...guardian,name:'苔牙ゴブリン'},tracks),false);
  assert.equal(D.guardianBehindWarning(hero,{...guardian,x:96},tracks),false,'distant threats stay quiet');
  assert.equal(D.guardianBehindWarning(hero,{...guardian,z:256},tracks),false,'different depth lane');
  assert.equal(D.guardianBehindWarning({...hero,state:'DOWN'},guardian,tracks),false);
  assert.equal(D.guardianBehindWarning(hero,{...guardian,state:'DOWN'},tracks),false);
  hero.facing=1;
  assert.equal(D.guardianBehindWarning(hero,guardian,tracks),false,'turning clears the behind cue');
  assert.doesNotMatch(hint(guardian,tracks,3,100,hero),/背後に足音/);
  assert.equal(D.guardianReadyForOpening(hero,guardian),true);
  assert.equal(D.armGuardianOpening(guardian,50,101,D.guardianReadyForOpening(hero,guardian)),true);
  assert.equal(D.guardianBehindWarning(hero,guardian,tracks),false,'armed cue never repeats');
  assert.match(hint(guardian,tracks,3,101.2,hero),/足跡の先読み 残り1\.6秒/);
});

test('guardian warns before striking, and stepping away earns a counterattack window',()=>{
  const guardian={name:'苔祠の番人',nextStrikeAt:0};
  assert.equal(D.guardianStrikeTell(guardian,100,true,true,true,'hero'),'start');
  assert.equal(guardian.guardianTellUntil,100.65);
  assert.equal(D.guardianStrikeTell(guardian,100.3,true,true,true,'hero'),'warning');
  assert.equal(D.guardianStrikeTell(guardian,100.66,false,true,true,'hero'),'evaded');
  assert.equal(guardian.nextStrikeAt,101.86);
  assert.equal(D.guardianStrikeTell(guardian,100.7,true,true,false,'hero'),'none');
  assert.equal(D.guardianStrikeTell(guardian,101.5,true,true,true,'hero'),'start');
  assert.equal(D.guardianStrikeTell(guardian,102.2,true,true,true,'hero'),'strike');
  assert.equal(D.guardianStrikeTell(guardian,103,true,true,true,'hero'),'start');
  assert.equal(D.guardianStrikeTell(guardian,103.2,true,false,true,'hero'),'none',
    'stunning the guardian must cancel its committed attack');
  assert.equal(guardian.guardianTellUntil,0);
  assert.equal(D.guardianStrikeTell(guardian,104,true,true,true,'hero'),'start');
  assert.equal(D.guardianStrikeTell(guardian,104.2,true,true,true,'ally'),'none',
    'switching targets must not turn a hero warning into an ally strike');
  assert.equal(D.guardianStrikeTell({...guardian,name:'苔牙ゴブリン'},105,true,true,true,'hero'),'none');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const ai=html.slice(html.indexOf('function sampleEnemyAI('),html.indexOf('function updateFighter('));
  assert.match(ai,/guardianStrikeTell\(/,'the live enemy AI must use the warning');
  assert.match(ai,/guardianAttack==='strike'/,'the actual strike must wait for the warning');
  assert.match(ai,/!\['DOWN','JUMP'\]\.includes\(target\.state\)/,
    'a genuine airborne jump must evade the guardian tell instead of being treated as a landed strike');
  assert.match(ai,/enemy\.name!=='苔祠の番人' &&/,'the old random attack must exclude the guardian');
  const ally=html.slice(html.indexOf('function sampleCompanionAI('),html.indexOf('function sampleEnemyAI('));
  assert.match(ally,/guardianTellUntil>guardianNow[\s\S]*?guardianTellTargetId===ginji\.id/,
    'ally must not interrupt a telegraphed strike aimed at the player');
  assert.match(ally,/guardianCounterUntil>guardianNow[\s\S]*?guardianCounterTargetId===ginji\.id/,
    'ally must leave the earned counter to the same defender');
  assert.match(ai,/guardianCounterUntil>nowSec\)\{[\s\S]*?return out;/,
    'a dodged guardian must pause pursuit long enough for a landing counter');
  const hint=html.slice(html.indexOf('function forestGuardianHint('),html.indexOf('function updateForestExploreHint('));
  assert.match(hint,/guardianDodgeCueActive\(guardian,hero,nowSec\)/,
    'the phone HUD must use the same target-aware warning as the swipe control');
  assert.match(hint,/跳ぶか離れよう/,'the warning must name a real player response');
  const source=hint.match(/function forestGuardianHint\([^)]*\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(source,'the live guardian HUD function must remain executable');
  const liveHint=Function('window','return ('+source+')')({CrownlessForestDiscoveries:D});
  const hero={id:'hero',state:'IDLE',x:0,z:0,facing:1};
  const tell={name:'苔祠の番人',state:'IDLE',x:35,z:0,hp:180,maxHp:180,
    guardianTellUntil:100.65,guardianTellTargetId:'hero'};
  assert.match(liveHint(tell,new Set(),2,100.2,hero),/跳ぶか離れよう/,
    'an actionable hero-targeted tell shows the real dodge warning');
  assert.doesNotMatch(liveHint({...tell,guardianTellTargetId:'ally'},new Set(),2,100.2,hero),/跳ぶか離れよう/,
    'an ally-targeted lunge must not warn the player to dodge');
  assert.doesNotMatch(liveHint(tell,new Set(),2,100.65,hero),/跳ぶか離れよう/,
    'the warning must clear as soon as the tell expires');
  assert.doesNotMatch(liveHint(tell,new Set(),2,100.2,{...hero,state:'JUMP'}),/跳ぶか離れよう/,
    'an already-airborne hero must not see a stale jump instruction');
});

test('landed guardian counter shows a short reposition choice only to its defender',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const hint=html.slice(html.indexOf('function forestGuardianHint('),html.indexOf('function updateForestExploreHint('));
  const source=hint.match(/function forestGuardianHint\([^)]*\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(source,'the real phone HUD must contain an executable guardian hint');
  const liveHint=Function('window','return ('+source+')')({CrownlessForestDiscoveries:D});
  const hero={id:'hero',state:'IDLE',x:0,z:0,facing:1};
  const guardian={name:'苔祠の番人',hp:120,maxHp:180,state:'IDLE',x:35,z:0,nextStrikeAt:0};
  assert.equal(D.guardianStrikeTell(guardian,100,true,true,true,'hero'),'start');
  assert.equal(D.guardianStrikeTell(guardian,100.66,false,true,true,'hero'),'evaded');
  assert.match(liveHint(guardian,new Set(),2,100.8,hero),/空振り！反撃\+8/);
  assert.doesNotMatch(liveHint(guardian,new Set(),2,100.8,hero),/追撃はタップ／退避は左パッド/,
    'a missed or unclaimed counter must not promise recovery');
  assert.equal(D.claimGuardianCounter(guardian,101,'hero'),true);
  assert.match(liveHint(guardian,new Set(),2,101.1,hero),/反撃成功！追撃はタップ／退避は左パッド 残り[0-9]+\.[0-9]秒/,
    'a landed counter should communicate the remaining tactical choice');
  assert.doesNotMatch(liveHint(guardian,new Set(),2,101.1,hero),/反撃\+8/,
    'a spent counter must not promise a second damage bonus');
  assert.doesNotMatch(liveHint(guardian,new Set(),2,101.1,{...hero,id:'ally'}),/追撃はタップ／退避は左パッド/,
    'the cue belongs only to the player who earned it');
  assert.doesNotMatch(liveHint(guardian,new Set(),2,101.9,hero),/追撃はタップ／退避は左パッド/,
    'the cue must expire with the real off-balance timer');
});

test('a timed jump evades the guardian warning and leaves a landing-to-counter window',()=>{
  const guardian={name:'苔祠の番人',nextStrikeAt:0};
  assert.equal(D.guardianStrikeTell(guardian,100,true,true,true,'hero'),'start');
  // The live AI treats JUMP as outside the strike lane (asserted above).
  assert.equal(D.guardianStrikeTell(guardian,100.66,false,true,true,'hero'),'evaded');
  assert.equal(guardian.guardianCounterUntil,101.86);
  assert.equal(D.guardianCounterStrikeBonus(guardian,101.85,'hero'),8);
  assert.equal(D.guardianCounterStrikeBonus(guardian,101.86,'hero'),0);
});

test('dodging the guardian tell grants only the defender one landed +8 counter',()=>{
  const guardian={name:'苔祠の番人',nextStrikeAt:0};
  assert.equal(D.guardianStrikeTell(guardian,100,true,true,true,'hero'),'start');
  assert.equal(D.guardianStrikeTell(guardian,100.66,false,true,true,'hero'),'evaded');
  assert.equal(D.guardianCounterStrikeBonus(guardian,100.7,'hero'),8);
  assert.equal(D.guardianCounterStrikeBonus(guardian,100.7,'ally'),0,
    'the companion cannot steal the player-earned counter');
  assert.equal(D.guardianCounterStrikeBonus(guardian,100.7,null),0);
  guardian.guardianCounterClaimed=true;
  assert.equal(D.guardianCounterStrikeBonus(guardian,100.7,'hero'),0,
    'one successful counter cannot be farmed');
  guardian.guardianCounterClaimed=false;
  assert.equal(D.guardianCounterStrikeBonus(guardian,100.8,'hero'),8);
  assert.equal(D.guardianCounterStrikeBonus(guardian,101.85,'hero'),8,
    'landing after a jump still leaves a brief real counter opportunity');
  assert.equal(D.guardianCounterStrikeBonus(guardian,101.86,'hero'),0,
    'expired counter window never rewards late attacks');
  assert.equal(D.guardianCounterStrikeBonus({...guardian,name:'苔牙ゴブリン'},100.8,'hero'),0);
  const cancelled={name:'苔祠の番人',nextStrikeAt:0};
  assert.equal(D.guardianStrikeTell(cancelled,100,true,true,true,'hero'),'start');
  assert.equal(D.guardianStrikeTell(cancelled,100.66,true,true,false,'hero'),'none',
    'an unavailable attack is not a player dodge');
  assert.equal(D.guardianCounterStrikeBonus(cancelled,100.7,'hero'),0);
});

test('a landed counter briefly staggers only the guardian, once per dodge',()=>{
  const guardian={name:'苔祠の番人',hp:120,state:'IDLE',nextStrikeAt:0};
  assert.equal(D.guardianStrikeTell(guardian,100,true,true,true,'hero'),'start');
  assert.equal(D.guardianStrikeTell(guardian,100.66,false,true,true,'hero'),'evaded');
  assert.equal(D.claimGuardianCounter(guardian,101,'ally'),false,
    'the ally cannot claim a player-earned opening');
  assert.equal(D.claimGuardianCounter(guardian,101,'hero'),true);
  assert.equal(guardian.guardianCounterClaimed,true);
  assert.ok(Math.abs(guardian.guardianCounterUntil-101.9)<1e-9,
    'the guardian stays off balance for 0.9s after the landed counter');
  assert.ok(Math.abs(guardian.nextStrikeAt-102.4)<1e-9,
    'the next announced lunge is delayed, not deleted');
  assert.equal(D.guardianCounterStrikeBonus(guardian,101.1,'hero'),0);
  assert.equal(D.claimGuardianCounter(guardian,101.2,'hero'),false,
    'repeated hits cannot extend the reward');
  assert.ok(Math.abs(guardian.nextStrikeAt-102.4)<1e-9);
  assert.equal(D.guardianStrikeTell(guardian,101.9,true,true,false,'hero'),'none',
    'no lunge during earned recovery');
  assert.equal(D.guardianStrikeTell(guardian,102.4,true,true,true,'hero'),'start',
    'the guardian resumes attacking after the bounded respite');

  const expired={name:'苔祠の番人',hp:120,nextStrikeAt:0};
  D.guardianStrikeTell(expired,100,true,true,true,'hero');
  D.guardianStrikeTell(expired,100.66,false,true,true,'hero');
  assert.equal(D.claimGuardianCounter(expired,101.86,'hero'),false);
  assert.equal(expired.guardianCounterClaimed,false);
  const normal={...expired,name:'苔牙ゴブリン'};
  assert.equal(D.claimGuardianCounter(normal,101,'hero'),false);
  const dead={name:'苔祠の番人',hp:0,state:'DEAD',nextStrikeAt:0};
  D.guardianStrikeTell(dead,100,true,true,true,'hero');
  D.guardianStrikeTell(dead,100.66,false,true,true,'hero');
  assert.equal(D.claimGuardianCounter(dead,101,'hero'),true,
    'a lethal counter can still claim its damage bonus');
  assert.equal(dead.nextStrikeAt,101.86,
    'a dead guardian does not gain a new recovery cooldown');
});

test('real combat and phone HUD wire the earned counter to a landed player hit',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const attack=html.slice(html.indexOf('function performAttackHitbox('),html.indexOf('function inflictDamage('));
  assert.match(attack,/const hitNowSec=performance\.now\(\)\/1000/);
  assert.match(attack,/guardianCounterStrikeBonus\(target,hitNowSec,attacker\.id\)/);
  assert.match(attack,/claimGuardianCounter\(\s*target,hitNowSec,attacker\.id\)/,
    'bonus and recovery claim share the same hit timestamp');
  assert.match(attack,/finalDmg\+scoutBonus\+counterBonus/);
  assert.match(attack,/if \(!inflictDamage\([\s\S]*?continue;[\s\S]*?if \(counterBonus\) \{[\s\S]*?claimGuardianCounter\(/);
  assert.match(attack,/反撃成功！[\s\S]*?番人がよろめく/,
    'a landed counter explains its brief tactical opening');
  const hint=html.slice(html.indexOf('function forestGuardianHint('),html.indexOf('function updateForestExploreHint('));
  assert.match(hint,/guardianCounterTargetId===hero\.id/);
  assert.match(hint,/空振り！反撃\+8 残り/);
});

test('announced shrine lunge survives nonlethal button-mashing but not a killing hit',()=>{
  const guardian={name:'苔祠の番人',state:'IDLE',hp:120,nextStrikeAt:0};
  assert.equal(D.guardianStrikeTell(guardian,100,true,true,true,'hero'),'start');
  assert.equal(D.guardianKeepsTellOnHit(guardian,100.2),true);
  assert.equal(D.guardianStrikeTell(guardian,100.3,true,true,true,'hero'),'warning',
    'nonlethal hits cannot erase the readable attack cue');
  assert.equal(D.guardianKeepsTellOnHit(guardian,100.65),false,
    'armor ends with the tell');
  assert.equal(D.guardianKeepsTellOnHit({...guardian,hp:0},100.2),false,
    'lethal hits still defeat the guardian and grant normal loot');
  assert.equal(D.guardianKeepsTellOnHit({...guardian,state:'DEAD'},100.2),false);
  assert.equal(D.guardianKeepsTellOnHit({...guardian,name:'苔牙ゴブリン'},100.2),false,
    'ordinary enemies retain normal hitstun');
  assert.equal(D.guardianKeepsTellOnHit({...guardian,guardianTellUntil:0},100.2),false);
  assert.equal(D.guardianKeepsTellOnHit(null,100.2),false);
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const hit=html.slice(html.indexOf('function inflictDamage('),html.indexOf('function forestGateTemperHint('));
  assert.match(hit,/target\.hp = Math\.max\(0, target\.hp - dmg\)/,
    'the armor must not negate damage');
  assert.match(hit,/if \(target\.hp <= 0\)[\s\S]*?guardianKeepsTellOnHit\(target,performance\.now\(\)\/1000\)/,
    'lethal hit handling must precede windup armor');
  assert.match(hit,/guardianKeepsTellOnHit\([\s\S]*?return true;[\s\S]*?if \(knockdown\)/,
    'only nonlethal hitstun/knockdown is suppressed');
  assert.match(hit,/踏み込みは止まらない！跳んで避けよう/,
    'show the player why repeated attacks did not stop the lunge');
});

test('only a landed shrine-guardian blow tells the player the dodge failed',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const hit=html.slice(html.indexOf('function performAttackHitbox('),html.indexOf('function inflictDamage('));
  const success=hit.indexOf('if (!inflictDamage(');
  const failureCue=hit.indexOf('踏み込み直撃！次は跳んで避けよう');
  assert(success>=0 && failureCue>success,
    'a missed or rejected strike cannot display a false hit warning');
  assert.match(hit,/if \(attacker\.name==='苔祠の番人' && target===ginji\) \{[\s\S]*?踏み込み直撃！次は跳んで避けよう[\s\S]*?sfx\.haptic\(\[35,25,35\]\)/,
    'only a real guardian hit on the player gets distinct visual and phone feedback');
  const ai=html.slice(html.indexOf('function sampleEnemyAI('),html.indexOf('function updateFighter('));
  assert.match(ai,/if\(guardianAttack==='strike'\)\{[\s\S]*?out\.punch=true/,
    'the guarded attack remains the actual lunge, not a new passive damage source');
});


test('guardian dodge cue points to the real thumb control only when the hero is threatened',()=>{
  const hero={id:'traveler',state:'IDLE'};
  const guardian={name:'苔祠の番人',guardianTellUntil:100.65,guardianTellTargetId:'traveler'};
  assert.equal(D.guardianDodgeCueActive(guardian,hero,100.2),true);
  assert.equal(D.guardianDodgeCueActive(guardian,hero,100.65),false,'expired warning clears the cue');
  assert.equal(D.guardianDodgeCueActive({...guardian,guardianTellTargetId:'ally'},hero,100.2),false,
    'an ally-targeted strike must not mislead the player');
  for(const state of ['DEAD','DOWN','HURT','GRAB','JUMP'])
    assert.equal(D.guardianDodgeCueActive(guardian,{...hero,state},100.2),false,
      state+' cannot respond to the prompt');
  assert.equal(D.guardianDodgeCueActive({...guardian,name:'苔牙ゴブリン'},hero,100.2),false);
  assert.equal(D.guardianDodgeCueActive(null,hero,100.2),false);
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/guardianDodgeCueActive\(guardian,hero,nowSec\)/,
    'the live hint and controls must share the tested target guard');
  assert.match(html,/updateGuardianDodgeControls\(guardian,ginji,performance\.now\(\)\/1000\)/,
    'the real scene must refresh the cue while the guardian is active');
  assert.match(html,/updateGuardianDodgeControls\(null,ginji,performance\.now\(\)\/1000\)/,
    'returning to camp must clear the control cue');
  assert.match(html,/↑スワイプで跳躍回避/);
  assert.match(html,/btnJump'\)\.classList\.toggle\('guardian-dodge-cue',active\)/,
    'arcade button mode must receive the same cue');
});

test('landed guardian dodge-counter earns one provisional fang, once, until safe return',()=>{
  const R=require('../src/gemini-rpg-loop.js');
  const heroId='hero';
  const guardian={name:'苔祠の番人',hp:100,state:'IDLE',
    guardianCounterTargetId:heroId,guardianCounterUntil:103,
    guardianCounterClaimed:false,nextStrikeAt:0};
  const run=R.create();
  assert.equal(R.clearWave(run),true);
  assert.equal(R.pushDeeper(run),true);
  assert.equal(D.guardianCounterStrikeBonus(guardian,101,heroId),8);
  assert.equal(D.claimGuardianCounter(guardian,101,heroId),true);
  assert.equal(R.claimMaterial(run),true);
  assert.equal(run.unbanked,1);
  assert.equal(run.banked,0,'counter loot cannot enter the warehouse mid-fight');
  assert.equal(D.claimGuardianCounter(guardian,101.1,heroId),false,
    'a repeated hit must not award a second fang');
  assert.equal(D.guardianCounterStrikeBonus(guardian,101.1,heroId),0);
  assert.equal(D.claimGuardianCounter({...guardian,guardianCounterClaimed:false},103,heroId),false,
    'an expired counter cannot earn loot');
  assert.equal(D.claimGuardianCounter({...guardian,guardianCounterClaimed:false},101,'ally'),false,
    'the companion cannot claim the player-earned fang');
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const hit=html.slice(html.indexOf('const hitNowSec=performance.now()/1000;'),
    html.indexOf('if (scoutBonus) {',html.indexOf('const hitNowSec=performance.now()/1000;')));
  assert.match(hit,/if \(!inflictDamage\([\s\S]*?\) continue;/,
    'the reward must be downstream of a real landed hit');
  assert.match(hit,/const earnedFang=earnedCounter && rpgRules\.claimMaterial\(rpg\);/,
    'only a successful one-shot counter can add provisional loot');
  assert.match(hit,/牙 \+1（未帰還）/,
    'the real action scene must label the reward as unsecured');
  assert.equal(R.clearWave(run),true);
  assert.equal(R.returnAlive(run,100),true);
  assert.equal(run.unbanked,0);
  assert.equal(run.banked,1);
  const lost=R.create();
  assert.equal(R.claimMaterial(lost),true);
  assert.equal(R.loseExpedition(lost),true);
  assert.equal(lost.unbanked,0);
  assert.equal(lost.banked,0,'defeat must erase the unreturned counter loot');
});
