'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../src/gemini-forest-discoveries.js');

test('downed, stunned, grabbed and dead explorers cannot consume a find',()=>{
  for(const state of ['HURT','DOWN','GRAB','DEAD']){
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
  player.state='HURT';
  finds.add('shrine');
  assert.equal(tap(200,200,false),false,'already-spent site cannot prompt a new interaction');
  assert.equal(popups.length,1,'only the valid blocked nearby touch gives feedback');
});
