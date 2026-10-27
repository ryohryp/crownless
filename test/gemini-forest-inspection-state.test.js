'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
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
  assert.match(html,/function tryTapForestSite\(clientX,clientY,allowNearby\) \{\s*if \(!window\.CrownlessForestDiscoveries\.canInspect\(ginji,rpg\.phase\)\) return false;/);
  assert.match(html,/function tryExploreForest\(f,shrineChoice='auto'\) \{\s*if \(f !== ginji \|\| !window\.CrownlessForestDiscoveries\.canInspect\(f,rpg\.phase\)\) return false;/);
  assert.match(html,/if \(!document\.getElementById\('forestShrineChoice'\)\.classList\.contains\('hidden'\) \|\|\s*!document\.getElementById\('forestGateChoice'\)\.classList\.contains\('hidden'\)\)/,
    'the decision sheet still pauses combat only after a valid interaction');
});
