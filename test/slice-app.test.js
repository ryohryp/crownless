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
test('individual weapon reinforcement is shown and variants expose their distinct traits', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',scrap:100,owned:['rust','fang','fang_moon','shield','bow'],equipped:'fang_moon'};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  b.click('tab','gear');
  assert.match(b.html(),/月影の短剣を補強する/);
  assert.match(b.html(),/月影の短剣 · 装備中 · 補強 0\/4/);
  assert.match(b.html(),/回避の気力消費 0/);
  b.click('upgrade');
  assert.match(b.html(),/月影の短剣 · 装備中 · 補強 1\/4/);
  b.click('equip','fang');
  assert.match(b.html(),/牙の短剣 · 装備中 · 補強 0\/4/);
  b.click('equip','shield');
  assert.match(b.html(),/番人の盾 · 装備中 · 補強 0\/4/);
});
test('new variant gear is shown at reinforcement zero despite a maxed legacy journey level', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',level:4,owned:['rust','shield','shield_oath'],equipped:'shield_oath'};
  state.upgrades.shield=4;
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  b.click('tab','gear');
  assert.match(b.html(),/番人の盾 · 補強 4\/4/);
  assert.match(b.html(),/誓壁の盾 · 装備中 · 補強 0\/4/);
  assert.match(b.html(),/誓壁の盾を補強する/);
});

test('deeper choice renders a specific but non-spoiling weapon cue', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',runs:1,expedition:{place:'wood',depth:1,room:4,hp:30,stamina:3,focus:0,potions:2,scrap:9,gear:['fang'],seals:['wood'],enemy:null,stage:'cleared',log:[]}};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  assert.match(b.html(),/細身の刃/);
  assert.match(b.html(),/深層 2 へ踏み込む/);
  assert.match(b.html(),/珍しい武具の可能性/);
  assert.doesNotMatch(b.html(),/血染めの短剣|月影の短剣/);
});
test('forest mid-run encounter surfaces a different enemy and archetype', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',runs:1,expedition:{place:'wood',depth:1,room:2,hp:27,stamina:3,focus:0,potions:2,scrap:4,gear:[],seals:[],enemy:{kind:'forest_hunter',hp:18,maxHp:18,turn:0,depth:1,elite:false,risky:false},stage:'fight',log:['別の足音が近づく。']}};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  assert.match(b.html(),/苔鎧の狩人/);
  assert.match(b.html(),/狩人型/);
  assert.doesNotMatch(b.html(),/主・茨牙の狼/);
});

test('forest guardian announces its unique pounce intent', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',runs:1,expedition:{place:'wood',depth:1,room:4,hp:25,stamina:3,focus:0,potions:2,scrap:6,gear:[],seals:[],enemy:{kind:'wolf',hp:24,maxHp:24,turn:0,depth:1,elite:true,risky:false},stage:'fight',log:['土地の主が、帰り道を塞いだ。']}};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  assert.match(b.html(),/主・茨牙の狼/);
  assert.match(b.html(),/飛びかかり/);
  assert.match(b.html(),/主だけの鋭い踏み込み/);
});

test('deep combat surfaces archetype, elite trait, changed action costs and loot stakes', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',runs:2,owned:['rust','fang_moon'],equipped:'fang_moon',expedition:{place:'wood',depth:2,room:4,hp:30,stamina:3,focus:0,potions:2,scrap:12,gear:[],seals:[],enemy:{kind:'wolf',hp:28,maxHp:28,turn:0,depth:2,elite:true,risky:false},stage:'fight',log:['土地の主が、帰り道を塞いだ。《猛攻》の気配。']}};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  assert.match(b.html(),/速攻型/);
  assert.match(b.html(),/《猛攻》/);
  assert.match(b.html(),/回避/);
  assert.match(b.html(),/気力 −0/);
  assert.match(b.html(),/背嚢：鉄片 12/);
});
test('at-risk loot compares found weapon traits with the equipped weapon before extraction', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',owned:['rust','shield'],equipped:'shield',expedition:{place:'wood',depth:2,room:2,hp:26,stamina:3,focus:0,potions:2,scrap:13,gear:['fang_moon'],seals:[],enemy:null,stage:'path',log:['月影の短剣を発見した。']}};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  assert.match(b.html(),/AT RISK · 生還で確定/);
  assert.match(b.html(),/現在装備：番人の盾/);
  assert.match(b.html(),/防御で 12 軽減/);
  assert.match(b.html(),/＋ 月影の短剣/);
  assert.match(b.html(),/未帰還 · .*回避の気力消費 0/);
});

test('return report compares newly banked variants and sends player to gear tab', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',owned:['rust','fang_blood'],report:{died:false,place:'wood',depth:2,scrap:14,gear:['fang_blood'],newGear:['fang_blood'],hp:18,cleared:['wood']}};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  assert.match(b.html(),/新しい一本を、火へ/);
  assert.match(b.html(),/血染めの短剣/);
  assert.match(b.html(),/体力半分以下で攻撃 \+2/);
  assert.match(b.html(),/持ち帰った装備を比べる/);
});


test('camp home presents the atlas as a living map with a compact trace action', () => {
  const b=browser(); b.click('mode','demo');
  assert.match(b.html(),/living-map-home/);
  assert.match(b.html(),/CROWNLESS/);
  assert.match(b.html(),/旅の地図/);
  assert.match(b.html(),/新しい痕跡/);
  assert.match(b.html(),/遠征に出る/);
  assert.match(b.html(),/別の道を探す/);
  b.click('scout','tower');
  assert.match(b.html(),/鐘なき塔/);
  assert.match(b.html(),/昨日までは、なかった。/);
  b.click('depart','tower');
  assert.match(b.html(),/最初の足跡/);
});
