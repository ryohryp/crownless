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
