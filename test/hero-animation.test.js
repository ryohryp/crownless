'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fixture(search=''){
  const images=[],calls=[];let depth=0;
  const sandbox={location:{search},URLSearchParams,Image:class{constructor(){images.push(this);}},document:{body:{append(){}},createElement(){return {style:{},setAttribute(){}};}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/hero-still-review.js'),'utf8'),sandbox);
  const actor=sandbox.CrownlessHeroStill.create();
  const ctx={save(){depth++;},restore(){depth--;},drawImage(...args){calls.push(args);}};
  for(const image of images){image.complete=true;image.naturalWidth=384;image.naturalHeight=132;}
  return {images,calls,actor,ctx,depth:()=>depth};
}
test('walking advances only with simulation time and uses four distinct red-scarf poses',()=>{
  const f=fixture(),frames=new Set();
  for(const animTime of [0,1.25,2.5,3.75]){
    assert.equal(f.actor.draw(f.ctx,{state:'WALK',animTime}),true);
    frames.add(f.calls.at(-1)[1]);
  }
  assert.deepEqual([...frames].sort((a,b)=>a-b),[0,96,192,288]);
  assert.equal(f.calls.at(-1)[3],96);
  assert.equal(f.calls.at(-1)[4],132);
  f.actor.draw(f.ctx,{state:'WALK',animTime:2.5});const held=f.calls.at(-1)[1];
  f.actor.draw(f.ctx,{state:'WALK',animTime:2.5});assert.equal(f.calls.at(-1)[1],held);
  f.actor.draw(f.ctx,{state:'IDLE',animTime:99});assert.equal(f.calls.at(-1)[1],288);
  assert.equal(f.actor.status().lastFrame,null);
  const walk=f.images[1];walk.complete=false;
  f.actor.draw(f.ctx,{state:'RUN',animTime:10});assert.equal(f.calls.at(-1)[1],288,'walk load failure keeps the same-identity idle');
  assert.equal(f.depth(),0);
});
test('classic actor uses legacy code drawing; still comparison never cycles animation',()=>{
  const classic=fixture('?actor=classic');assert.equal(classic.images.length,0);assert.equal(classic.actor.draw(classic.ctx),false);
  const still=fixture('?actor=still');assert.equal(still.images.length,1);
  still.actor.draw(still.ctx,{state:'WALK',animTime:99});assert.equal(still.calls.at(-1)[1],288);
  assert.equal(still.actor.status().walkReady,false);
  const invalid=fixture();invalid.images[0].naturalWidth=0;
  assert.equal(invalid.actor.draw(invalid.ctx),false,'invalid atlas falls back to original pixel actor');
});
