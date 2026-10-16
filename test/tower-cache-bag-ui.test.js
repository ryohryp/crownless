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
    click(action,value){elements['#game'].click({target:{closest:()=>({dataset:{action,value},disabled:false})}});}};
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
  b.click('tower-step','18');
  assert.equal(E.parse(b.store.get(key)).expedition.tower.pos,18);
  assert.match(b.html(),/鐘鉄を持って生還/,'carried loot remains visible away from the cache');
  const resumed=browser(E.parse(b.store.get(key)));
  assert.match(resumed.html(),/鐘鉄 1 · 鉄片 0/);
  assert.match(resumed.html(),/鐘鉄を持って生還/,'return label survives save/resume');
  resumed.click('return');
  assert.equal(E.parse(resumed.store.get(key)).materials.watchIron,1);
  assert.match(resumed.html(),/持ち帰った素材/);
});

test('tower return choice reflects scrap-only loot without overriding guardian warning',()=>{
  let s=atCache();
  assert.match(browser(s).html(),/ここで生還する/);
  s.expedition.scrap=2;
  assert.match(browser(s).html(),/鉄片を持って生還/);
  s=E.act(s,'tower-step:14');
  assert.equal(s.expedition.tower.pos,14);
  assert.match(browser(s).html(),/戦利品を守って生還/);
});

test('tower navigation never marks fog, walls, or undiscovered secret stairs',()=>{
  let state=E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  for(const to of [21,22,T.ECHO]) state=E.act(state,'tower-step:'+to);
  assert.equal(state.expedition.tower.open,false);
  assert.equal(T.visible(state.expedition.tower,T.SECRET),false);
  const html=browser(state).html();
  assert.doesNotMatch(html,/<button\b[^>]*class="field-cell[^"]*"[^>]*data-action="tower-step" data-value="12"/,
    'hidden stair must not be a clickable fog tile before discovery');
  const steps=[...html.matchAll(/<button\b[^>]*class="([^"]*)"[^>]*data-action="tower-step" data-value="(\d+)"/g)];
  assert.ok(steps.length>0);
  for(const [,classes,id] of steps){
    if(!classes.includes('walk-nav')) continue;
    const to=Number(id);
    assert.equal(T.visible(state.expedition.tower,to),true);
    assert.equal(T.canMove(state.expedition.tower,to),true);
    assert.notEqual(T.kind(to),'wall');
    assert.notEqual(T.kind(to),'secret');
  }
});

test('tower waypoint markers stay adjacent through discovery and guardian return',()=>{
  const start=()=>E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  const check=(state,phase)=>{
    const f=state.expedition.tower;
    const steps=[...browser(state).html().matchAll(/<button\b[^>]*class="([^"]*)"[^>]*data-action="tower-step" data-value="(\d+)"/g)]
      .filter(([,classes])=>classes.split(' ').includes('walk-nav'));
    assert(steps.length>0,'ordinary guidance exists at '+phase);
    for(const [,classes,id] of steps){
      const to=Number(id);
      const distance=Math.abs(to%T.SIZE-f.pos%T.SIZE)+
        Math.abs(Math.floor(to/T.SIZE)-Math.floor(f.pos/T.SIZE));
      assert.equal(distance,1,'only adjacent cells are marked at '+phase);
      assert(T.visible(f,to),'fog is never marked at '+phase);
      assert(T.canMove(f,to),'blocked cells are never marked at '+phase);
      assert(!['wall','secret'].includes(T.kind(to)),'walls and secrets stay unmarked at '+phase);
      assert(classes.includes('revealed')&&!classes.includes('veiled'));
    }
  };
  let s=start();check(s,'entrance');
  for(const to of [21,22,T.ECHO])s=E.act(s,'tower-step:'+to);
  check(s,'bell echo');
  s=E.act(s,'tower-step:'+T.SECRET);
  assert(s.expedition.tower.open,'investigation opens the concealed passage');
  check(s,'secret discovered');
  s=E.act(s,'tower-step:'+T.SECRET);
  check(s,'inside secret stair');
  let guardian=start();
  for(const to of [21,22,23,18,19,14,T.GUARD])guardian=E.act(guardian,'tower-step:'+to);
  assert.equal(guardian.expedition.stage,'fight');
  guardian=structuredClone(guardian);
  guardian.expedition.enemy.hp=1;
  guardian=E.act(guardian,'heavy');
  assert.equal(guardian.expedition.stage,'path','guardian defeat resumes exploration');
  check(E.parse(E.serialize(guardian)),'after guardian and save/resume');
});

test('tower echo investigation is a deliberate choice, not hidden-route navigation',()=>{
  let state=E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  assert.doesNotMatch(browser(state).html(),/鐘の反響を確かめる/);
  for(const to of [21,22,T.ECHO]) state=E.act(state,'tower-step:'+to);
  assert.equal(T.visible(state.expedition.tower,T.SECRET),false);
  const b=browser(state);
  assert.match(b.html(),/鐘の反響を確かめる/);
  assert.doesNotMatch(b.html(),/<button\b[^>]*class="field-cell[^"]*"[^>]*data-action="tower-step" data-value="12"/,
    'investigation remains a panel choice, not a fog marker');
  b.click('tower-step',String(T.SECRET));
  const saved=E.parse(b.store.get(key));
  assert.equal(saved.expedition.tower.pos,T.ECHO,'investigating does not teleport');
  assert.equal(saved.expedition.tower.open,true);
  assert.equal(T.visible(saved.expedition.tower,T.SECRET),true);
  const revealedSecret=b.html().match(/<button\b[^>]*data-action="tower-step" data-value="12"[^>]*>/)?.[0];
  assert.ok(revealedSecret,'discovered secret stair remains an explicit tile');
  assert.doesNotMatch(revealedSecret,/walk-nav/,'secret stair must not become ordinary navigation after discovery');
  assert.doesNotMatch(b.html(),/鐘の反響を確かめる/);
  const resumed=browser(saved);
  assert.doesNotMatch(resumed.html(),/鐘の反響を確かめる/);
  assert.match(resumed.html(),/隠し階段を発見/);
});


test('tower approach whispers before the echo without revealing a secret route',()=>{
  let state=E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  state=E.act(state,'tower-step:21');
  assert.doesNotMatch(state.expedition.log[0],/鐘の余韻/);
  state=E.act(state,'tower-step:22');
  assert.match(state.expedition.log[0],/鐘の余韻/);
  assert.equal(state.expedition.tower.pos,22);
  assert.equal(state.expedition.tower.echo,false);
  assert.equal(T.visible(state.expedition.tower,T.SECRET),false);
  assert.doesNotMatch(browser(state).html(),/鐘の反響を確かめる/);
  state=E.act(state,'tower-step:17');
  assert.equal(state.expedition.tower.echo,true);
  assert.match(state.expedition.log[0],/壁の向こう/);
  state=E.act(state,'tower-step:22');
  assert.doesNotMatch(state.expedition.log[0],/鐘の余韻/,
    'the approach clue must not repeat after the echo has been found');
});

test('earned shield clue appears only for the investigated guardian opening',()=>{
  const approach=()=>{
    let s=E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
    for(const to of [21,22,23,18,19])s=E.act(s,'tower-step:'+to);
    return s;
  };
  const uninvestigated=approach();
  const enter=s=>E.act(E.act(s,'tower-step:14'),'tower-step:9');
  const ordinary=enter(uninvestigated);
  assert.equal(ordinary.expedition.stage,'fight');
  assert.doesNotMatch(browser(ordinary).html(),/耳に残る盾の音/,
    'a player who skipped listening must not get the tactic');
  const investigated=enter(E.act(approach(),'tower-listen'));
  assert.equal(E.intent(investigated.expedition.enemy).id,'guard');
  assert.match(browser(investigated).html(),/耳に残る盾の音。初手は強撃が効きそうだ。/,
    'the earned hint must survive the transition to the attack screen');
  const resumedFight=E.parse(E.serialize(investigated));
  assert.match(browser(resumedFight).html(),/耳に残る盾の音。初手は強撃が効きそうだ。/,
    'earned tactic must remain visible when the player resumes in combat');
  const afterGuardian=E.parse(E.serialize(investigated));
  afterGuardian.expedition.tower.guard=true;
  assert.doesNotMatch(browser(afterGuardian).html(),/耳に残る盾の音/,
    'the defeated guardian must not leak its clue to later knights');
  const laterTurn=E.parse(E.serialize(investigated));
  laterTurn.expedition.enemy.turn=1;
  assert.doesNotMatch(browser(laterTurn).html(),/耳に残る盾の音/,
    'the opening clue must not clutter subsequent attack choices');
});

test('tower sound indicator grows with investigation without revealing a hidden route',()=>{
  let s=E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  const footer=state=>browser(state).html().split('class="forest-field-footer">')[1]?.split('<strong>')[1]?.split('</strong>')[0];
  assert.equal(footer(s),'鐘の残響を探す');
  for(const to of [21,22])s=E.act(s,'tower-step:'+to);
  assert.equal(footer(s),'かすかな鐘の余韻');
  for(const to of [23,18])s=E.act(s,'tower-step:'+to);
  assert.equal(footer(s),'鐘の余韻が近い');
  assert.equal(s.expedition.tower.echo,false);
  assert.equal(T.visible(s.expedition.tower,T.SECRET),false);
  for(const to of [23,22,T.ECHO])s=E.act(s,'tower-step:'+to);
  assert.equal(footer(s),'✦ 鐘の反響を発見');
  assert.equal(s.expedition.tower.open,false,'sound alone never opens the stair');
  assert.equal(T.visible(s.expedition.tower,T.SECRET),false);
  assert.match(browser(s).html(),/鐘の反響を確かめる/,'earned clue offers an intentional choice');
  s=E.parse(E.serialize(s));
  assert.equal(footer(s),'✦ 鐘の反響を発見','discovery survives reload');
  s=E.act(s,'tower-step:'+T.SECRET);
  assert.equal(footer(s),'隠し階段を発見');
  assert.equal(s.expedition.tower.pos,T.ECHO,'investigation does not teleport');
  assert.equal(T.visible(s.expedition.tower,T.SECRET),true);
  s=E.act(s,'tower-step:'+T.SECRET);
  s=E.act(s,'tower-step:'+T.RELIC);
  assert.equal(footer(s),'✦ 秘密の納骨室を発見');
  const loot=s.expedition.materials.watchIron;
  assert.equal(E.act(E.parse(E.serialize(s)),'return').materials.watchIron,loot,
    'sound guidance never changes the safe-return material contract');
});
