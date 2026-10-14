'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../src/slice-engine.js');
const T = require('../src/tower-field.js');
const key = 'crownless-expedition-v1-demo';

function atCache() {
  let state = E.start(E.discover({...E.initial(), mode:'demo'}, 'tower'), 'tower');
  for (const to of [21,22,23,18,T.CACHE]) state = E.act(state, 'tower-step:'+to);
  assert.equal(state.expedition.tower.pos, T.CACHE);
  return state;
}

function browser(state) {
  const store = new Map([['crownless-expedition-mode','demo'],[key,E.serialize(state)]]);
  const elements = {};
  for (const id of ['#game','#save-status','#save-label','#help-toggle','#help','#home-name']) {
    elements[id] = {innerHTML:'',hidden:true,textContent:'',value:'',
      addEventListener(type,fn){this[type]=fn;},setAttribute(){}};
  }
  const context = {
    CrownlessSlice:E, CrownlessTowerField:T,
    CrownlessFenField:require('../src/fen-field.js'),
    CrownlessNearbyHome:require('../src/nearby-home-view.js'),
    CrownlessNeighborhood:require('../src/neighborhood.js'),
    CrownlessTravelFootprints:require('../src/travel-footprints.js'),
    CrownlessArt:{scene:()=>'<svg></svg>',icon:()=>'<svg></svg>'},
    document:{querySelector:selector=>elements[selector]||null},
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    navigator:{geolocation:{}},isSecureContext:true,
    addEventListener(){},confirm:()=>true,location:{reload(){}}
  };
  context.window=context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/slice-app.js'),'utf8'),context);
  return {store,html:()=>elements['#game'].innerHTML,
    click(action){elements['#game'].click({target:{closest:()=>({dataset:{action},disabled:false})}});}};
}

test('tower bag shows at-risk bell iron and scrap, including after save and safe return',()=>{
  const b=browser(atCache());
  assert.match(b.html(),/data-tower-bag="true"/);
  assert.match(b.html(),/鐘鉄 0 · 鉄片 0/);
  assert.match(b.html(),/生還で確定 · 倒れれば失う/);
  b.click('tower-cache-iron');
  assert.match(b.html(),/鐘鉄 1 · 鉄片 0/);
  assert.equal(E.parse(b.store.get(key)).materials.watchIron,0);
  assert.equal(E.parse(b.store.get(key)).expedition.materials.watchIron,1);
  const resumed=browser(E.parse(b.store.get(key)));
  assert.match(resumed.html(),/鐘鉄 1 · 鉄片 0/);
  resumed.click('return');
  assert.equal(E.parse(resumed.store.get(key)).materials.watchIron,1);
  assert.match(resumed.html(),/持ち帰った素材/);
});
