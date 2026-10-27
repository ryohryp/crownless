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
