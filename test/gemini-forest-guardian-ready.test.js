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
  assert.match(hint,/guardianTellUntil>nowSec/,'the phone HUD must show the warning while active');
  assert.match(hint,/跳ぶか離れよう/,'the warning must name a real player response');
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

test('real combat and phone HUD wire the earned counter to a landed player hit',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const attack=html.slice(html.indexOf('function performAttackHitbox('),html.indexOf('function inflictDamage('));
  assert.match(attack,/guardianCounterStrikeBonus\(target,performance\.now\(\)\/1000,attacker\.id\)/);
  assert.match(attack,/finalDmg\+scoutBonus\+counterBonus/);
  assert.match(attack,/if \(!inflictDamage\([\s\S]*?continue;[\s\S]*?if \(counterBonus\) \{\s*target\.guardianCounterClaimed=true;/);
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
