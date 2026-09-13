const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../src/slice-engine.js');
const code = fs.readFileSync(require('node:path').join(__dirname,'../src/slice-app.js'),'utf8');
function browser(seed = {}, storageFails = false) {
  const store = new Map(Object.entries(seed)), callbacks = {}, elements = {};
  for (const id of ['#game','#save-status','#save-label','#help-toggle','#help']) elements[id] = {innerHTML:'',hidden:true,textContent:'',addEventListener(type,fn){this[type]=fn;},setAttribute(){}};
  const context = {CrownlessSlice:E,CrownlessArt:{scene:()=>'<svg></svg>',icon:()=>'<svg></svg>'},isSecureContext:true,
    document:{querySelector:selector=>elements[selector] || null},
    localStorage:{getItem:k=>{if(storageFails)throw Error('blocked');return store.get(k)??null;},setItem:(k,v)=>{if(storageFails)throw Error('blocked');store.set(k,v);}},
    navigator:{geolocation:{getCurrentPosition(ok,error){callbacks.ok=ok;callbacks.error=error;}}},
    addEventListener:(name,fn)=>{callbacks[name]=fn;},location:{reload(){callbacks.reloaded=true;}}};
  context.window=context; vm.runInNewContext(code,context);
  return {store,elements,callbacks,click(action,value){elements['#game'].click({target:{closest:()=>({dataset:{action,value},disabled:false})}});},html:()=>elements['#game'].innerHTML};
}
test('late GPS completion cannot mutate the other mode or a started expedition', () => {
  const b=browser(); b.click('mode','walk'); b.click('gps'); const late=b.callbacks.ok;
  b.click('switch-mode'); late({coords:{latitude:35,longitude:139,accuracy:10,speed:0}});
  assert.match(b.html(),/散策体験モード/); assert.doesNotMatch(b.html(),/ここを今回の起点/);
  b.click('switch-mode'); b.click('gps'); const afterStart=b.callbacks.ok;
  b.click('depart','wood'); afterStart({coords:{latitude:35,longitude:139,accuracy:10,speed:0}});
  assert.match(b.html(),/最初の足跡/); assert.doesNotMatch(b.html(),/ここを今回の起点/);
});
test('denied and timed-out location requests leave a playable fallback', () => {
  const b=browser(); b.click('mode','walk'); b.click('gps'); b.callbacks.error({code:1});
  assert.match(b.html(),/位置情報は許可されませんでした/);
  b.click('gps'); b.callbacks.error({code:3}); assert.match(b.html(),/現在地を取得できません/);
  b.click('switch-mode'); b.click('depart','wood'); assert.match(b.html(),/最初の足跡/);
});
test('corrupt save is retained verbatim and play remains available without overwriting it', () => {
  const k='crownless-expedition-v1-demo', b=browser({[k]:'{broken'});
  b.click('mode','demo'); b.click('depart','wood'); b.click('careful');
  assert.equal(b.store.get(k),'{broken'); assert.equal(b.elements['#save-status'].hidden,false);
  assert.match(b.html(),/茨牙の狼/);
});
test('unavailable storage does not prevent starting or playing', () => {
  const b=browser({},true); b.click('mode','demo'); b.click('depart','wood'); b.click('careful');
  assert.match(b.html(),/茨牙の狼/); assert.equal(b.elements['#save-status'].hidden,false);
});
test('mode progression is isolated and concurrent updates cannot be overwritten', () => {
  const b=browser(); b.click('mode','demo'); b.click('scout','tower');
  const demo=b.store.get('crownless-expedition-v1-demo'); assert.ok(JSON.parse(demo).unlocked.includes('tower'));
  b.click('switch-mode'); assert.deepEqual(JSON.parse(b.store.get('crownless-expedition-v1-walk')).unlocked,['wood']);
  b.click('switch-mode'); assert.ok(JSON.parse(b.store.get('crownless-expedition-v1-demo')).unlocked.includes('tower'));
  const other={...E.initial(),mode:'demo',scrap:123}; b.store.set('crownless-expedition-v1-demo',JSON.stringify(other));
  b.click('depart','wood'); assert.match(b.html(),/別のタブで旅が進んで/);
  assert.equal(JSON.parse(b.store.get('crownless-expedition-v1-demo')).scrap,123);
});
test('upgraded loadout strengths are visible before and during combat', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',scrap:100,level:1,owned:['rust','fang','shield','bow'],equipped:'shield'};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  b.click('tab','gear');
  assert.match(b.html(),/防御で 13 軽減し、3 ダメージ/);
  b.click('equip','bow');
  assert.match(b.html(),/強撃 10 が敵の守りを貫通/);
  b.click('depart','wood'); b.click('careful');
  assert.match(b.html(),/強撃 <span class="cost">10<\/span>/);
});
