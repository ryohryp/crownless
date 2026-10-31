'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../src/gemini-forest-discoveries.js');

test('swordless gate previews the achievable first craft, never an inaccessible +2 route',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf('  function forestGateTemperHint(run,rules) {');
  const end=html.indexOf('  function forestShrineCraftHint(run,rules) {',start);
  assert(start>=0 && end>start,'evaluate the live gate craft-hint functions');
  const hint=vm.runInNewContext(html.slice(start,end)+'\nforestGateCraftHint');
  const rules={COST:5,TEMPER_COST:5};
  const swordless=(banked,unbanked)=>({crafted:false,tempered:false,banked,unbanked});
  assert.equal(hint(swordless(0,4),rules),
    'ここで牙を1個拾って生還すれば、鍛冶剣を作れる。',
    'a first-run +1 fang must clearly enable the next smithing decision');
  assert.equal(hint(swordless(0,1),rules),
    '鍛冶剣まで牙あと4個。ここで牙+1なら残り3個。',
    'an insufficient bag must not promise immediate crafting');
  assert.equal(hint(swordless(3,2),rules),
    '生還すれば鍛冶剣の素材が揃う（今は未帰還）。',
    'unbanked loot is never described as spendable before returning');
  assert.equal(hint(swordless(5,0),rules),
    '倉庫の牙だけで鍛冶剣を作れる。');
  assert.equal(hint({crafted:true,tempered:false,banked:0,unbanked:4},rules),
    '剣の研ぎ直しまで牙あと1個（+1なら残り0、+2なら残り0）。',
    'forged sword keeps its existing two-choice sharpening guidance');
  assert.equal(hint({crafted:true,tempered:true,banked:0,unbanked:4},rules),
    '剣は研ぎ直し済み。牙の追加強化はまだない。');
  assert.match(html,/個。'\+forestGateCraftHint\(rpg,rpgRules\)/,
    'the actual stone-gate decision sheet must display the new guidance');
});

test('the first-craft hint describes a real swordless injury-versus-herbs choice',()=>{
  const gate={x:910,z:235};
  const bare=D.uncover(gate,new Set(['traces']),'return',131,140,false,'cautious');
  const herbs=D.uncover(gate,new Set(['traces']),'return',131,140,false,'heal');
  assert.equal(bare.ok,true);
  assert.equal(bare.material,1);
  assert.equal(bare.damage,6);
  assert.equal(bare.heal,0);
  assert.equal(herbs.ok,true);
  assert.equal(herbs.material,0);
  assert.equal(herbs.heal,9);
  assert.equal(herbs.damage,0);
});

test('stone-gate choice previews the earned later opening without spoiling an unvisited site',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf("document.getElementById('forestGateStakes').textContent=");
  const end=html.indexOf(';',start);
  assert(start>=0 && end>start,'evaluate the live gate decision sheet');
  const assignment=html.slice(start,end+1);
  const render=(ids,cautiousDisabled=false)=>{
    const node={textContent:''};
    vm.runInNewContext(assignment,{
      document:{getElementById:()=>node},
      state:{forestFinds:new Set(ids)},
      ginji:{hp:90,maxHp:140},
      rpg:{crafted:false,tempered:false,unbanked:4},
      rpgRules:{},
      cautious:{disabled:cautiousDisabled},
      cautiousCost:6,cautiousWound:'HP -6',salvageCost:8,
      forestGateCraftHint:()=> '鍛冶剣まで牙あと1個。'
    });
    return node.textContent;
  };
  const gateFirst=render(['traces']);
  assert.match(gateFirst,/慎重な回収だけ先手の猶予 \+0\.6秒/,
    'only cautious salvage earns the later tactical advantage');
  assert.match(gateFirst,/強引な回収・薬草なら効果なし/,
    'the higher-loot and healing routes must not promise the cautious bonus');
  assert(gateFirst.includes('先手の猶予 +0.6秒'),
    'the player can weigh the later encounter benefit before committing to a gate reward');
  assert.match(gateFirst,/薬草なら効果なし/,
    'the phone preview must disclose that choosing healing forfeits the tactical bonus');
  assert.doesNotMatch(gateFirst,/苔祠|番人|右|左/,
    'a tactical clue must not reveal the uninspected destination or route');
  assert.match(gateFirst,/未帰還の牙 4個/);
  assert.match(gateFirst,/敗北すると失う/,
    'the new preview must not conceal safe-return stakes');
  assert.match(gateFirst,/生還時だけ倉庫に残り/,
    'short phone copy must still explain when the provisional loot is banked');
  assert.doesNotMatch(gateFirst,/素手で牙 \+1（HP|慎重に牙 \+1（HP|または薬草で回復/,
    'HP costs and recovery are already visible on the actual choice buttons');
  assert.match(gateFirst,/鍛冶剣まで牙あと1個/,
    'compact stakes must retain the next-craft motivation');
  assert(!render(['traces','shrine']).includes('先手の猶予 +0.6秒'),
    'visiting the shrine first cannot promise a retrospective bonus');
  assert(!render(['traces'],true).includes('先手の猶予 +0.6秒'),
    'low-HP explorers must not be promised scouting from a disabled salvage choice');
  assert.match(render(['traces'],false),/先手の猶予 \+0\.6秒/,
    'a usable cautious salvage choice retains its earned scouting preview');
  assert.equal(D.guardianOpeningSeconds(new Set(['traces'])),1.8);
  assert.equal(D.guardianOpeningSeconds(new Set(['traces','hollow'])),1.8,
    'healing at the gate cannot silently grant the salvage scouting bonus');
  assert.equal(D.guardianOpeningSeconds(new Set(['traces','hollow','hollow-scout'])),2.4);
  const found=new Set(['traces']);
  const result=D.uncover({x:910,z:235},found,'return',90,140,false,'cautious');
  assert.equal(result.ok,true);
  assert.equal(result.material,1);
  assert.equal(result.damage,6);
  assert.equal(found.has('hollow'),true);
  assert.equal(found.has('hollow-scout'),true,'the hands-on salvage earns the scouting marker');
  assert.equal(D.guardianOpeningSeconds(found),2.4,
    'the visible advantage corresponds to an earned, costly detour');
});

test('phone gate choice itself shows the earned scouting payoff only when usable',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf('      const cautiousVerb=');
  const end=html.indexOf('      const missing=',start);
  assert(start>=0 && end>start,'evaluate the actual gate button formatter');
  const render=(ids,hp=90,crafted=false)=>{
    const cautious={disabled:false,textContent:''};
    const salvage={disabled:false,textContent:''};
    vm.runInNewContext(html.slice(start,end),{
      cautious,salvage,ginji:{hp},rpg:{crafted,tempered:false},
      state:{forestFinds:new Set(ids)},
      cautiousCost:6,cautiousWound:'HP -6',salvageCost:8
    });
    return cautious;
  };
  const gateFirst=render(['traces']);
  assert.equal(gateFirst.disabled,false);
  assert.match(gateFirst.textContent,/未帰還素材 \+1・先手猶予 \+0\.6秒/,
    'the benefit must be visible on the tappable choice, not buried in a paragraph');
  assert.doesNotMatch(gateFirst.textContent,/祠|番人|右|左/,
    'the gate must not spoil the unvisited threat or its direction');
  assert.match(render(['traces'],90,true).textContent,/先手猶予 \+0\.6秒/,
    'the forged-sword cautious route earns the same scouting benefit');
  assert.doesNotMatch(render(['traces','shrine']).textContent,/先手猶予/,
    'shrine-first cannot gain a retroactive combat bonus');
  const weak=render(['traces'],6);
  assert.equal(weak.disabled,true);
  assert.doesNotMatch(weak.textContent,/先手猶予/,
    'a disabled choice must not advertise an unavailable reward');
});

test('earned gate scouting stays visible after the choice without naming an unvisited threat',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf('    const label=guardian\n');
  const end=html.indexOf('    if(hint.textContent!==label)',start);
  assert(start>=0 && end>start,'evaluate the actual persistent forest exploration hint');
  const render=(ids,phase='return')=>vm.runInNewContext(
    html.slice(start,end)+'\nlabel',
    {guardian:null,near:null,state:{forestFinds:new Set(ids)},
      rpg:{phase,unbanked:3},ginji:{},forestGuardianHint:()=>''}
  );
  const earned=render(['traces','hollow','hollow-scout']);
  assert.match(earned,/苔の湿りが残る/,'the careful detour has a lasting visible consequence');
  assert.match(earned,/先手猶予 \+0\.6秒/,'the player can still weigh a deeper search against returning alive');
  assert.doesNotMatch(earned,/苔むす祠|苔祠の番人|右|左/,
    'the hint cannot disclose the identity or direction of the uninspected threat');
  assert.doesNotMatch(render(['traces','hollow']),/先手猶予/,
    'forceful salvage or herbs cannot inherit cautious scouting');
  assert.doesNotMatch(render(['traces','hollow','hollow-scout','shrine']),/先手猶予/,
    'visiting the shrine first cannot receive a retroactive bonus');
  assert.doesNotMatch(render(['traces','hollow','hollow-scout'],'fight'),/先手猶予/,
    'ordinary active combat must not promise a guardian-only opening');
});
