const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../src/slice-engine.js');
const F = require('../src/travel-footprints.js');
const code = fs.readFileSync(require('node:path').join(__dirname,'../src/slice-app.js'),'utf8');
function browser(seed = {}, storageFails = false, realChronicle = false) {
  const store = new Map(Object.entries(seed)), callbacks = {}, elements = {};
  const chronicleContainer = {innerHTML:'',querySelectorAll:()=>[]};
  for (const id of ['#game','#save-status','#save-label','#help-toggle','#help','#home-name']) elements[id] = {innerHTML:'',hidden:true,textContent:'',value:'',addEventListener(type,fn){this[type]=fn;},setAttribute(){}};
  const context = {CrownlessSlice:E,CrownlessNeighborhood:require('../src/neighborhood.js'),CrownlessArt:{scene:()=>'<svg></svg>',icon:()=>'<svg></svg>'},isSecureContext:true,
    document:{querySelector:selector=>elements[selector] || null},
    localStorage:{getItem:k=>{if(storageFails)throw Error('blocked');return store.get(k)??null;},setItem:(k,v)=>{if(storageFails)throw Error('blocked');store.set(k,v);}},
    navigator:{geolocation:{getCurrentPosition(ok,error){callbacks.ok=ok;callbacks.error=error;}}},
    addEventListener:(name,fn)=>{callbacks[name]=fn;},location:{reload(){callbacks.reloaded=true;}}};
  context.window=context;
  context.CrownlessTravelFootprints=F;
  context.CrownlessTravelChronicleUI={
    getFootprints(mode='walk'){
      return F.parse(context.localStorage.getItem('crownless-travel-footprints-v1-'+mode));
    },
    recordFootprint(coords,mode='walk',day=F.dayString()){
      const k='crownless-travel-footprints-v1-'+mode;
      try {
        const data=F.parse(context.localStorage.getItem(k)), result=F.record(data,coords,day);
        if (result.journal!==data) context.localStorage.setItem(k,JSON.stringify(result.journal));
        return result;
      } catch { return {status:'save-failed'}; }
    },
    showFootprints(){callbacks.showFootprints=true;}
  };
  if (realChronicle) {
    elements['#game'].querySelector=selector=>
      selector==='.chronicle-panel' && elements['#game'].innerHTML.includes('class="chronicle-panel"')
        ? chronicleContainer : null;
    vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/travel-chronicle-ui.js'),'utf8'),context);
  }
  vm.runInNewContext(code,context);
  return {store,elements,callbacks,chronicleHTML:()=>chronicleContainer.innerHTML,click(action,value){elements['#game'].click({target:{closest:()=>({dataset:{action,value},disabled:false})}});},html:()=>elements['#game'].innerHTML};
}

test('a saved combat opening exposes the actual follow-up damage and disappears after guarding', () => {
  let s = E.act(E.start({...E.initial(),mode:'demo'},'wood'),'careful');
  s = E.act(E.act(s,'guard'),'dodge');
  const damage = E.attackPreview(s,'strike');
  const seed = {'crownless-expedition-mode':'demo','crownless-expedition-v1-demo':E.serialize(s)};
  const b = browser(seed);
  assert.match(b.html(),/体勢を崩した！/);
  assert.match(b.html(),new RegExp(`崩し追撃 <span class="cost">${damage}</span>`));
  assert.match(b.html(),/今の一手だけ/);
  assert.match(b.html(),/敵は攻撃してこない。<\/span>/);
  b.click('guard');
  assert.doesNotMatch(b.html(),/class="combat-opening"/);
  assert.doesNotMatch(b.html(),/崩し追撃 <span/);
});

test('follow-up finish is marked for feedback and banks loot only on return', () => {
  let s = E.act(E.start({...E.initial(),mode:'demo'},'wood'),'careful');
  s = E.act(E.act(s,'guard'),'dodge');
  s.expedition.enemy.hp = E.attackPreview(s,'strike');
  const b = browser({'crownless-expedition-mode':'demo','crownless-expedition-v1-demo':E.serialize(s)});
  b.click('strike');
  assert.match(b.html(),/data-combat-result="follow-up"/);
  const key = 'crownless-expedition-v1-demo';
  assert.equal(JSON.parse(b.store.get(key)).scrap,0);
  b.click('return');
  assert.equal(JSON.parse(b.store.get(key)).scrap,2);
  assert.doesNotMatch(b.html(),/data-combat-result="follow-up"/);
});

test('settings opens above camp without changing its save or current screen', () => {
  const b = browser(); b.click('mode','demo');
  const html = b.html(), saved = b.store.get('crownless-expedition-v1-demo');
  b.click('settings');
  assert.equal(b.elements['#help'].hidden,false);
  assert.equal(b.html(),html);
  assert.equal(b.store.get('crownless-expedition-v1-demo'),saved);
});

test('banked crown epilogue can be revisited without restarting or advancing the journey', () => {
  const s = {...E.initial(),mode:'demo',runs:4,victories:3,owned:['rust','crown'],cleared:['wood','tower','crypt']};
  const key = 'crownless-expedition-v1-demo';
  const b = browser({'crownless-expedition-mode':'demo',[key]:E.serialize(s)});
  b.click('tab','gear');
  assert.match(b.html(),/最初の物語を振り返る/);
  const saved = b.store.get(key);
  b.click('ending-open');
  assert.match(b.html(),/EPILOGUE/);
  assert.match(b.html(),/3 <small>回の生還 \/ 遠征 4 回/);
  b.click('ending-continue');
  assert.match(b.html(),/neighborhood-atlas/);
  assert.equal(b.store.get(key),saved);
  const unearned = browser(); unearned.click('mode','demo'); unearned.click('ending-open');
  assert.doesNotMatch(unearned.html(),/EPILOGUE/);
});
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

test('deeper choice hints at regional crafting material without awarding a weapon', () => {
  const k='crownless-expedition-v1-demo';
  const state={...E.initial(),mode:'demo',runs:1,expedition:{place:'wood',depth:1,room:4,hp:30,stamina:3,focus:0,potions:2,scrap:9,gear:['fang'],seals:['wood'],enemy:null,stage:'cleared',log:[]}};
  const b=browser({[k]:E.serialize(state),'crownless-expedition-mode':'demo'});
  assert.match(b.html(),/鋭い牙/);
  assert.match(b.html(),/深層 2 へ踏み込む/);
  assert.match(b.html(),/追加素材の可能性/);
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


test('camp home presents a persistent neighborhood and local expedition action', () => {
  const b=browser(); b.click('mode','demo');
  assert.match(b.html(),/living-map-home/);
  assert.match(b.html(),/最後の焚き火/);
  assert.match(b.html(),/西の木立/);
  assert.match(b.html(),/未開拓/);
  assert.match(b.html(),/data-action="district"/);
  assert.match(b.html(),/district-landmark-svg/);
  assert.match(b.html(),/district-frontier-fog/);
  assert.match(b.html(),/<\/section><nav class="camp-tabs bottom-navigation"/);
  assert.match(b.html(),/この土地へ遠征/);
  assert.match(b.html(),/近所を歩く/);
  b.click('scout','tower');
  assert.match(b.html(),/鐘なき塔/);
  assert.match(b.html(),/北の見張り跡/);
  b.click('depart','tower');
  assert.match(b.html(),/最初の足跡/);
});

test('core camp nav owns six stable buttons and journal views are reversible', () => {
  const b=browser(); b.click('mode','demo');
  const nav=b.html().match(/<nav class="camp-tabs bottom-navigation"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav,'dock must be included in initial camp markup');
  const buttons=[...nav[1].matchAll(/<button\b[^>]*>/g)].map(m=>m[0]);
  assert.equal(buttons.length,6);
  for(const button of buttons) assert.match(button,/class="[^"]*bottom-navigation-item/);
  assert.deepEqual(buttons.map(v=>(v.match(/data-action="([^"]+)"/)||[])[1]),['tab','tab','tab','tab','tab','settings']);
  assert.deepEqual(buttons.slice(0,5).map(v=>(v.match(/aria-current="([^"]+)"/)||[])[1]),['page','false','false','false','false']);
  assert.deepEqual(buttons.slice(0,5).map(v=>(v.match(/data-value="([^"]+)"/)||[])[1]),
    ['explore','home','gear','codex','chronicle']);
  b.click('tab','gear');
  const gear=b.html().match(/<nav class="camp-tabs bottom-navigation"[^>]*>([\s\S]*?)<\/nav>/)[1];
  assert.match(gear,/data-value="gear" aria-current="page"/);
  b.click('tab','codex');
  assert.match(b.html(),/class="codex-panel"/);
  assert.match(b.html(),/data-value="codex" aria-current="page"/);
  b.click('tab','chronicle');
  assert.match(b.html(),/class="chronicle-panel"/);
  assert.match(b.html(),/data-value="chronicle" aria-current="page"/);
  b.click('tab','explore');
  assert.match(b.html(),/class="atlas-field neighborhood-field"/);
  assert.match(b.html(),/この土地へ遠征/);
  b.click('tab','home');
  assert.match(b.html(),/class="home-portrait"/);
  b.click('tab','gear');
  assert.match(b.html(),/class="gear-list"/);
});

test('home UI builds from banked materials, changes the map picture and safely renames the saved home', () => {
  const s={...E.initial(),mode:'demo'}; s.neighborhood.wood=2; s.neighborhood.stone=1;
  const key='crownless-expedition-v1-demo';
  const b=browser({'crownless-expedition-mode':'demo',[key]:E.serialize(s)});
  b.click('tab','home'); b.click('home-build','forge');
  const built=E.parse(b.store.get(key));
  assert.deepEqual(built.neighborhood.buildings,['forge']);
  assert.equal(built.neighborhood.wood,0);
  assert.match(b.html(),/焚き火に鍛冶小屋が建った拠点/);
  b.elements['#home-name'].value='<旅人の村>';
  b.click('home-name');
  assert.match(b.html(),/&lt;旅人の村&gt;/);
  assert.equal(E.parse(b.store.get(key)).neighborhood.name,'<旅人の村>');
  b.click('tab','explore');
  assert.match(b.html(),/建物 1/);
  b.click('tab','gear');
  assert.match(b.html(),/鉄片 2 で補強する/);
});

test('walk district identity survives reload using the same rounded origin, with no precise fix saved', () => {
  const b=browser(); b.click('mode','walk'); b.click('gps');
  b.callbacks.ok({coords:{latitude:35.00041,longitude:139.00047,accuracy:10,speed:0}});
  b.click('gps'); b.callbacks.ok({coords:{latitude:35.0004,longitude:139.005,accuracy:10,speed:0}});
  const first=E.parse(b.store.get('crownless-expedition-v1-walk')).neighborhood;
  const anchor=b.store.get('crownless-expedition-v1-walk-anchor');
  assert.doesNotMatch(anchor,/35\.00041|139\.00047/);
  const reloaded=browser(Object.fromEntries(b.store));
  reloaded.click('gps'); reloaded.callbacks.ok({coords:{latitude:35.0004,longitude:139.005,accuracy:10,speed:0}});
  const again=E.parse(reloaded.store.get('crownless-expedition-v1-walk')).neighborhood;
  assert.equal(again.selected,first.selected);
  assert.equal(again.districts.length,first.districts.length);
  assert.equal(reloaded.store.get('crownless-expedition-v1-walk-anchor'),anchor);
});

test('smith recipes show exact missing materials, source and ready-to-craft next action', () => {
  const key='crownless-expedition-v1-demo';
  const base={...E.initial(),mode:'demo',scrap:2};
  base.materials.wolfFang=1;
  const missing=browser({'crownless-expedition-mode':'demo',[key]:E.serialize(base)});
  missing.click('tab','gear');
  assert.match(missing.html(),/data-recipe-progress="forged_fang">不足：狼牙 あと1個（囁きの森） · 鉄片 あと2個/);
  base.materials.wolfFang=2; base.scrap=4;
  const ready=browser({'crownless-expedition-mode':'demo',[key]:E.serialize(base)});
  ready.click('tab','gear');
  assert.match(ready.html(),/素材が揃った。鍛冶師に交代して製作しよう。/);
  ready.click('character','1');
  assert.match(ready.html(),/素材が揃った。製作できる。/);
  ready.click('craft-item','forged_fang');
  assert.match(ready.html(),/製作済み · 倉庫から装備できる/);
});

test('smith commission is accessible in the gear UI and saves as a single pending NPC job', () => {
  const k='crownless-expedition-v1-demo';
  const s={...E.initial(),mode:'demo',scrap:10};
  s.materials.wolfFang=2;
  const b=browser({[k]:E.serialize(s),'crownless-expedition-mode':'demo'});
  b.click('tab','gear');
  assert.match(b.html(),/工房への依頼 · 架空のNPC/);
  assert.match(b.html(),/森の斥候に装備を納品/);
  b.click('character','1');
  b.click('commission','wood');
  let saved=JSON.parse(b.store.get(k));
  assert.equal(saved.commission.pending,'wood');
  assert.equal(saved.materials.wolfFang,0);
  assert.equal(saved.scrap,6);
  assert.deepEqual(saved.owned,['rust']);
  const prev=b.store.get(k);
  b.click('commission','wood');
  assert.equal(b.store.get(k),prev,'same commission cannot drain twice');
  assert.match(b.html(),/納品は完了/);
  b.click('character','0');
  b.click('depart','wood');
  saved=JSON.parse(b.store.get(k));
  assert.equal(saved.expedition.place,'wood');
});

test('combat offers one prominent resolution choice with manual controls optional', () => {
  const b=browser();
  b.click('mode','demo');
  b.click('depart','wood');
  b.click('careful');
  assert.match(b.html(),/data-action="auto-fight"/);
  assert.match(b.html(),/決着まで任せる/);
  assert.match(b.html(),/<details class="combat-manual"><summary>一手ずつ戦う（任意）<\/summary>/);
  assert.match(b.html(),/data-action="flee"/,'retreat remains available without opening manual controls');
  b.click('auto-fight');
  assert.match(b.html(),/戦闘をまとめて決着/);
  assert.doesNotMatch(b.html(),/data-action="auto-fight"/);
  const saved=JSON.parse(b.store.get('crownless-expedition-v1-demo'));
  assert.equal(saved.expedition.room,1);
  assert.equal(saved.expedition.materials.wolfFang,1);
  assert.equal(saved.materials.wolfFang,0);
  assert.deepEqual(E.parse(E.serialize(saved)),saved);
});

test('revisited district reveals a named persistent NPC trace in its main detail', () => {
  const state={...E.initial(),mode:'demo'};
  state.neighborhood.districts[0].aided=true;
  const seed={'crownless-expedition-mode':'demo','crownless-expedition-v1-demo':E.serialize(state)};
  const b=browser(seed);
  assert.match(b.html(),/district-trace/);
  assert.match(b.html(),/この土地に残った変化：斥候の道標/);
  assert.match(b.html(),/最初に倒した敵から狼牙 \+1/);
  assert.match(b.html(),/data-action="depart"/);
  assert.match(b.html(),/✦ 斥候の道標/);
  const before=b.store.get('crownless-expedition-v1-demo');
  assert.deepEqual(E.parse(before),state);
});

test('fictional traveler supplies appear on selected district and vanish when used once',()=>{
  const s={...E.initial(),mode:'demo'};
  s.neighborhood.districts[0].visitor='supplies';
  const key='crownless-expedition-v1-demo';
  const b=browser({'crownless-expedition-mode':'demo',[key]:E.serialize(s)});
  assert.match(b.html(),/架空NPCが残したもの：薬師の補給袋/);
  assert.match(b.html(),/この地点から出発すると受け取れる/);
  assert.match(b.html(),/NPC 薬師の補給袋/);
  b.click('depart','wood');
  const departed=JSON.parse(b.store.get(key));
  assert.equal(departed.expedition.potions,3);
  assert.equal(departed.neighborhood.districts[0].visitor,'used');
  assert.match(departed.expedition.log.join(' '),/架空NPC/);
  assert.deepEqual(E.parse(E.serialize(departed)),departed);
  b.click('return');
  b.click('continue');
  b.click('tab','explore');
  assert.doesNotMatch(b.html(),/架空NPCが残したもの：薬師の補給袋/);
  assert.match(b.html(),/補給袋は受け取った/);
});

test('real GPS discovers a landmark and exposes its fantasy entry even when far from home',()=>{
  const b=browser(); b.click('mode','walk');
  b.click('gps'); b.callbacks.ok({coords:{latitude:35.658656,longitude:139.745364,accuracy:8,speed:0}});
  const key='crownless-travel-footprints-v1-walk';
  assert.equal(F.parse(b.store.get(key)).places[0].id,'tokyo-tower');
  assert.ok(b.callbacks.showFootprints);
  assert.match(b.html(),/chronicle-panel/);
  assert.ok(E.parse(b.store.get('crownless-expedition-v1-walk')).unlocked.includes('tower'));
  b.click('tab','explore'); b.click('gps'); b.callbacks.ok({coords:{latitude:34.68734,longitude:135.526,accuracy:8,speed:0}});
  assert.equal(F.parse(b.store.get(key)).places.length,2);
  assert.match(b.html(),/chronicle-panel/);
  assert.equal(F.parse(browser(Object.fromEntries(b.store)).store.get(key)).places.length,2);
});
test('simulated landmark tour and later return require no text input',()=>{
  const b=browser(); b.click('mode','demo');
  b.click('travel-demo','home');
  const key='crownless-travel-footprints-v1-demo';
  assert.equal(F.parse(b.store.get(key)).places[0].id,'tokyo-tower');
  b.click('tab','explore'); b.click('travel-demo','skytree');
  b.click('tab','explore'); b.click('travel-demo','far');
  assert.equal(F.parse(b.store.get(key)).places.length,3);
  b.click('tab','explore'); b.click('travel-demo','return');
  const tower=F.parse(b.store.get(key)).places.find(p=>p.id==='tokyo-tower');
  assert.equal(tower.visits.length,2);
  assert.equal(b.store.get('crownless-travel-footprints-v1-walk'),undefined);
});
test('an unregistered GPS area does not create a fake landmark',()=>{
  const b=browser(); b.click('mode','walk'); b.click('gps');
  b.callbacks.ok({coords:{latitude:35.7521,longitude:139.8623,accuracy:8,speed:0}});
  assert.equal(b.store.get('crownless-travel-footprints-v1-walk'),undefined);
  assert.match(b.html(),/まだ登録済みの名所がない/);
});


test('discovering Tokyo Tower enables entering its own named siege after returning home',()=>{
  const b=browser();b.click('mode','demo');b.click('travel-demo','home');
  b.click('landmark-siege','tokyo-tower');
  const saved=E.parse(b.store.get('crownless-expedition-v1-demo'));
  assert.equal(saved.expedition.landmarkId,'tokyo-tower');
  assert.equal(saved.expedition.place,'tower');
  assert.match(b.html(),/最初の足跡/);
  // Entered siege is not captured yet.
  assert.deepEqual(saved.claimedLandmarks,[]);
});
test('landmark conquest feedback is displayed after real boss victory and safe return',()=>{
  const key='crownless-expedition-v1-demo';
  let s=E.startLandmark(E.discover({...E.initial(),mode:'demo'},'tower'),'tower','tokyo-tower');
  s.expedition.stage='cleared';
  s.expedition.room=4;
  s.expedition.seals=['tower'];
  const b=browser({'crownless-expedition-mode':'demo',[key]:E.serialize(s)});
  b.click('return');
  assert.deepEqual(E.parse(b.store.get(key)).claimedLandmarks,['tokyo-tower']);
  assert.match(b.html(),/紅蓮の望楼を支配！/);
  assert.match(b.html(),/あなたの旗が旅の地図に刻まれた/);
  assert.match(b.html(),/この名所からの次の遠征で薬草 \+1/);
});

test('opening the travel atlas never silently rewrites the active demo game save',()=>{
  const b=browser({},false,true);
  b.click('mode','demo');
  b.click('travel-demo','home');
  const key='crownless-expedition-v1-demo';
  const before=b.store.get(key);
  assert.ok(before);
  assert.match(b.chronicleHTML(),/紅蓮の望楼/);
  assert.equal(b.store.get(key),before,'travel map rendering must be read-only');
  b.click('landmark-siege','tokyo-tower');
  const saved=E.parse(b.store.get(key));
  assert.equal(saved.expedition.landmarkId,'tokyo-tower');
  assert.doesNotMatch(b.html(),/別のタブで旅が進んでいます/);
});

test('boss victory -> return -> continue automatically reveals the visible flag on the real atlas',()=>{
  const key='crownless-expedition-v1-demo', landmark='tokyo-tower';
  let saved=E.startLandmark(E.discover({...E.initial(),mode:'demo'},'tower'),'tower',landmark);
  saved.expedition.stage='cleared';saved.expedition.room=4;saved.expedition.seals=['tower'];
  saved=E.act(saved,'return');
  const footprint=F.record(F.initial(),{latitude:35.658656,longitude:139.745364,accuracy:8,speed:0},'2026-10-10').journal;
  const b=browser({'crownless-expedition-mode':'demo',[key]:E.serialize(saved),
    'crownless-travel-footprints-v1-demo':JSON.stringify(footprint)},false,true);
  assert.match(b.html(),/紅蓮の望楼を支配！/);
  b.click('continue');
  assert.match(b.html(),/class="chronicle-panel"/);
  assert.match(b.chronicleHTML(),/紅蓮の望楼/);
  assert.match(b.chronicleHTML(),/⚑ あなたの支配拠点/);
  assert.match(b.chronicleHTML(),/⚑ 紅蓮の望楼に支配の旗が立った！/);
  assert.deepEqual(E.parse(b.store.get(key)).claimedLandmarks,[landmark]);
  const reload=browser(Object.fromEntries(b.store),false,true);
  assert.match(reload.html(),/class="landmark-status-strip"/);
  assert.match(reload.html(),/⚑ 紅蓮の望楼/);
  reload.click('landmark-map',landmark);
  assert.match(reload.chronicleHTML(),/⚑ あなたの支配拠点/);
});

test('a landmark retreat visibly keeps the flag down and explains the remaining condition',()=>{
  const key='crownless-expedition-v1-demo',landmark='tokyo-tower';
  const unfinished=E.act(E.startLandmark(E.discover({...E.initial(),mode:'demo'},'tower'),'tower',landmark),'return');
  const footprint=F.record(F.initial(),{latitude:35.658656,longitude:139.745364,accuracy:8,speed:0},'2026-10-10').journal;
  const b=browser({'crownless-expedition-mode':'demo',[key]:E.serialize(unfinished),
    'crownless-travel-footprints-v1-demo':JSON.stringify(footprint)},false,true);
  b.click('continue');
  assert.match(b.chronicleHTML(),/まだ未支配/);
  assert.match(b.chronicleHTML(),/土地の主を倒して生還/);
  assert.doesNotMatch(b.chronicleHTML(),/⚑ あなたの支配拠点/);
});
