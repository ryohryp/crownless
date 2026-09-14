const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../src/slice-engine.js');
const code = fs.readFileSync(require('node:path').join(__dirname,'../src/slice-app.js'),'utf8');

function renderClearedExpedition() {
  const state = {...E.initial(),mode:'demo',runs:1,expedition:{place:'wood',depth:1,room:4,hp:30,stamina:3,focus:0,potions:2,scrap:9,gear:['fang'],seals:['wood'],enemy:null,stage:'cleared',log:[]}};
  const key='crownless-expedition-v1-demo';
  const store=new Map([[key,E.serialize(state)],['crownless-expedition-mode','demo']]);
  const elements={};
  for (const id of ['#game','#save-status','#save-label','#help-toggle','#help']) elements[id]={innerHTML:'',hidden:true,textContent:'',addEventListener(type,fn){this[type]=fn;},setAttribute(){}};
  const context={CrownlessSlice:E,CrownlessArt:{scene:()=>'<svg></svg>',icon:()=>'<svg></svg>'},isSecureContext:true,
    document:{querySelector:selector=>elements[selector]||null},
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
    navigator:{geolocation:{getCurrentPosition(){}}},
    addEventListener(){},location:{reload(){}}};
  context.window=context;
  vm.runInNewContext(code,context);
  return elements['#game'].innerHTML;
}

test('return-or-deeper choice names the carried loot at stake', () => {
  const html=renderClearedExpedition();
  assert.match(html,/鉄片 9・牙の短剣を確定/);
  assert.match(html,/鉄片 9・牙の短剣を持ったまま進む/);
});
