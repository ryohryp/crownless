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
