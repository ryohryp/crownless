'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('shrine choice never treats unreturned fangs as already spendable at the smith',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const source=html.match(/function forestShrineCraftHint\(run,rules\) \{[\s\S]*?\n  \}/);
  assert.ok(source,'shrine must distinguish banked fangs from provisional loot');
  const hint=vm.runInNewContext('('+source[0]+')');
  const rules={COST:3,TEMPER_COST:5};
  assert.match(hint({crafted:false,tempered:false,banked:0,unbanked:3},rules),
    /生還すれば鍛冶剣の素材が揃う.*未帰還/);
  assert.match(hint({crafted:false,tempered:false,banked:3,unbanked:0},rules),
    /倉庫の牙だけで鍛冶剣を作れる/);
  assert.match(hint({crafted:true,tempered:false,banked:1,unbanked:4},rules),
    /生還すれば剣の研ぎ直し素材が揃う.*未帰還/);
  assert.match(hint({crafted:true,tempered:false,banked:5,unbanked:0},rules),
    /倉庫の牙だけで剣を研ぎ直せる/);
  assert.match(hint({crafted:true,tempered:false,banked:0,unbanked:1},rules),
    /あと4個（\+1なら残り3、\+2なら残り2）/);
  assert.match(hint({crafted:true,tempered:true,banked:0,unbanked:5},rules),
    /追加強化はまだない/);
  assert.match(html,/const forgeChoice=forestShrineCraftHint\(rpg,rpgRules\)/);
  assert.match(html,/素材は生還時だけ倉庫に残る（敗北すると失う）/);
});

test('shrine only previews the gate-earned first strike when deep search is actionable',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf("document.getElementById('forestShrineStakes').textContent=");
  const end=html.indexOf(';',start);
  assert(start>=0 && end>start,'evaluate the live shrine choice stakes');
  const assignment=html.slice(start,end+1);
  const render=(hp,phase,ids)=>{
    const node={textContent:''};
    const riskCost=9;
    const risk={disabled:hp<riskCost+1 || phase!=='return'};
    vm.runInNewContext(assignment,{
      document:{getElementById:()=>node},
      state:{forestFinds:new Set(ids)},
      ginji:{hp,maxHp:140},
      rpg:{unbanked:2},
      forgeChoice:'鍛冶剣まで牙あと1個。',
      risk
    });
    return node.textContent;
  };
  const ready=render(100,'return',['traces','hollow-scout']);
  assert.match(ready,/先手の猶予 \+0\.6秒/,
    'a usable deep search keeps its earned tactical benefit visible');
  assert.match(ready,/素材は生還時だけ倉庫に残る/,
    'provisional loot and survival stakes remain visible');
  assert.doesNotMatch(ready,/苔祠の番人/,
    'do not reveal the guardian before the player chooses the risk');
  assert.doesNotMatch(render(9,'return',['traces','hollow-scout']),/先手の猶予/,
    'an HP-locked deep search must not promise an unusable combat advantage');
  assert.doesNotMatch(render(100,'fight',['traces','hollow-scout']),/先手の猶予/,
    'the first wave must be cleared before deep-search scouting is offered');
  assert.doesNotMatch(render(100,'return',['traces']),/先手の猶予/,
    'reading tracks alone cannot grant the gate-first extra window');
  assert.match(render(100,'return',[]),/足元の筋は未調査/,
    'unread clues still invite an optional investigation');
});
