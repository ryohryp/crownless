'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('stone gate previews whether provisional fangs still advance the forged sword',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const helper=html.match(/function forestGateTemperHint\(run,rules\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'the gate should compute a real smithing goal before offering HP-costly loot');
  const hint=vm.runInNewContext('('+helper[0]+')');
  const rules={TEMPER_COST:5};
  assert.match(hint({tempered:false,banked:0,unbanked:1},rules),
    /あと4個（\+1なら残り3、\+2なら残り2）/,
    'each risky gate choice must show how far it advances the next upgrade');
  assert.match(hint({tempered:false,banked:3,unbanked:2},rules),
    /素材は揃っている/,
    'provisional loot may complete a goal but is not banked until a living return');
  assert.match(hint({tempered:false,banked:5,unbanked:1},rules),
    /素材は揃っている/,
    'a full warehouse does not imply an imaginary further requirement');
  assert.match(hint({tempered:true,banked:0,unbanked:0},rules),
    /追加強化はまだない/,
    'once tempered, the gate must not promise an endless upgrade loop');
  assert.match(html,/forestGateTemperHint\(rpg,rpgRules\)/,
    'the real gate panel must use the tested progress hint');
  assert.match(html,/素材は生還時だけ倉庫に残り、敗北すると失う/,
    'the new progress hint must retain the unbanked-material warning');
});
