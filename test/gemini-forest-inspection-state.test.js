'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../src/gemini-forest-discoveries.js');

test('busy, airborne, downed and dead explorers cannot consume a find',()=>{
  for(const state of ['HURT','DOWN','GRAB','DEAD','ATTACK','SPECIAL','JUMP']){
    const found=new Set(['traces']);
    const player={x:910,z:235,state};
    assert.equal(D.canInspect(player,'return'),false);
    const blocked=D.uncover(player,found,'return',80,140,true,'heal');
    assert.equal(blocked.ok,false);
    assert.equal(blocked.reason,'busy');
    assert.equal(found.has('hollow'),false,'a blocked tap must not spend the gate');
    player.state='IDLE';
    assert.equal(D.canInspect(player,'return'),true);
    const healed=D.uncover(player,found,'return',80,140,true,'heal');
    assert.equal(healed.ok,true,'the same gate can be used after recovery');
    assert.equal(healed.heal,45);
    assert.equal(healed.material,0);
  }
});

test('combat, clue and provisional loot remain available after recovery',()=>{
  const found=new Set();
  const player={x:800,z:365,state:'DOWN'};
  assert.equal(D.uncover(player,found,'fight',100,140).ok,false);
  assert.equal(found.size,0);
  player.state='WALK';
  const clue=D.uncover(player,found,'fight',100,140);
  assert.equal(clue.ok,true);
  assert.equal(clue.material,1);
  assert.equal(D.canInspect(player,'camp'),false);
  assert.equal(D.canInspect(null,'return'),false);
});

test('both phone tap and reward application check the same recoverable action state',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/function tryTapForestSite\(clientX,clientY,allowNearby\) \{\s*if \(!ginji \|\| !window\.CrownlessForestDiscoveries\.available\(rpg\.phase\)\) return false;/);
  assert.match(html,/if \(!window\.CrownlessForestDiscoveries\.canInspect\(ginji,rpg\.phase\)\) \{/);
  assert.match(html,/function tryExploreForest\(f,shrineChoice='auto'\) \{\s*if \(f !== ginji \|\| !window\.CrownlessForestDiscoveries\.canInspect\(f,rpg\.phase\)\) return false;/);
  assert.match(html,/if \(!document\.getElementById\('forestShrineChoice'\)\.classList\.contains\('hidden'\) \|\|\s*!document\.getElementById\('forestGateChoice'\)\.classList\.contains\('hidden'\)\)/,
    'the decision sheet still pauses combat only after a valid interaction');
});

test('blocked real-site tap shows recovery cue but never spends a find or becomes a punch',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf('  function tryTapForestSite(clientX,clientY,allowNearby) {');
  const end=html.indexOf('\n  for (const [id,choice] of',start);
  assert(start>=0 && end>start,'the live tap handler must be present');
  const site={id:'shrine',x:660,z:230};
  const player={x:660,z:230,y:0,state:'DOWN'};
  const finds=new Set();
  const popups=[];
  let target=site;
  const sandbox={
    ginji:player,rpg:{phase:'fight'},state:{cameraX:0,forestFinds:finds},
    canvas:{getBoundingClientRect:()=>({left:0,top:0,width:390,height:420})},
    virtualW:390,VIRTUAL_H:420,getGroundHeightAt:()=>0,
    spawnPopup:(...args)=>popups.push(args),
    window:{CrownlessForestDiscoveries:{
      available:D.available,canInspect:D.canInspect,RANGE:D.RANGE,
      spotAtTap:()=>target,
    }},
  };
  const tap=vm.runInNewContext(html.slice(start,end)+'\ntryTapForestSite',sandbox);
  assert.equal(tap(200,200,false),true,'nearby downed site touch is handled, not passed to punch');
  assert.match(popups[0][0],/体勢を立て直してから調べよう/);
  assert.equal(finds.size,0,'blocked tap does not consume the shrine');
  assert.equal(popups[0][1],player.x,'feedback appears at player, not as a hidden site label');
  target=null;
  assert.equal(tap(200,200,false),false,'ordinary non-site tap still reaches combat');
  assert.equal(popups.length,1,'ordinary combat does not produce an exploration popup');
  target=site;
  player.x=0;
  assert.equal(tap(200,200,false),false,'distant or obscured sites cannot reveal themselves');
  player.x=660;
  player.state='DEAD';
  assert.equal(tap(200,200,false),false,'dead explorer receives no false recovery prompt');
  player.state='ATTACK';
  assert.equal(tap(200,200,false),true,'an attacking explorer cannot pause combat by inspecting');
  assert.match(popups.at(-1)[0],/動作を終えてから調べよう/);
  assert.equal(finds.size,0,'an interrupted attack cannot claim a reward');
  player.state='JUMP';
  assert.equal(tap(200,200,false),true,'jumping cannot open a choice sheet midair');
  assert.match(popups.at(-1)[0],/動作を終えてから調べよう/);
  player.state='SPECIAL';
  assert.equal(tap(200,200,false),true,'special attack cannot pause combat');
  assert.match(popups.at(-1)[0],/動作を終えてから調べよう/);
  player.state='HURT';
  finds.add('shrine');
  assert.equal(tap(200,200,false),false,'already-spent site cannot prompt a new interaction');
  assert.equal(popups.length,4,'only unspent nearby blocked touches give feedback');
});


test('unread tracks offer a reversible shrine detour without spoiling the guardian',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  const start=html.indexOf("document.getElementById('forestShrineStakes').textContent=");
  const end=html.indexOf(';',start);
  assert(start>=0 && end>start,'the live shrine choice stakes must be present');
  const assignment=html.slice(start,end+1);
  const render=(tracks)=>{
    const label={textContent:''};
    vm.runInNewContext(assignment,{
      document:{getElementById:()=>label},
      state:{forestFinds:new Set(tracks)},
      ginji:{hp:60,maxHp:140},
      rpg:{unbanked:3},
      forgeChoice:''
    });
    return label.textContent;
  };
  const unscouted=render([]);
  assert.match(unscouted,/足元の筋は未調査。今は引き返して探す手もある。/,
    'the player can defer the dangerous choice and deliberately seek a clue');
  assert.match(unscouted,/素材は生還時だけ倉庫に残る/,
    'the detour cannot hide the existing unsecured-loot stakes');
  assert.doesNotMatch(unscouted,/苔祠の番人/,
    'the decision cannot spoil the guardian before the risk is chosen');
  const scouted=render(['traces']);
  assert.doesNotMatch(scouted,/足元の筋は未調査/,
    'the warning disappears after an actual clue inspection');
  assert.match(scouted,/現在 HP 60\/140、未帰還の牙 3個/,
    'the existing HP and provisional material counts remain correct');
});
