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
