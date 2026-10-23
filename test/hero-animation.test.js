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
  for(const image of images){image.complete=true;image.naturalWidth=image.src.includes('hero-walk')?2048:1024;image.naturalHeight=image.src.includes('hero-walk')?768:1536;}
  return {images,calls,actor,ctx,depth:()=>depth};
}
test('walking advances from simulation time; standing, pausing and fallback preserve approved identity',()=>{
  const f=fixture();
  const frames=new Set();
  for(const animTime of [0,1.25,2.5,3.75]){f.actor.draw(f.ctx,{state:'WALK',animTime});frames.add(f.calls.at(-1)[1]);}
  assert.equal(frames.size,4,'all temporal cells are reachable');
  f.actor.draw(f.ctx,{state:'WALK',animTime:2.5});const held=f.calls.at(-1)[1];
  f.actor.draw(f.ctx,{state:'WALK',animTime:2.5});assert.equal(f.calls.at(-1)[1],held,'frozen simulation freezes pose');
  f.actor.draw(f.ctx,{state:'IDLE',animTime:99});assert.match(f.calls.at(-1)[0].src,/action-forest\/hero-idle/);
  const walk=f.images.find(i=>i.src.includes('hero-walk'));walk.complete=false;
  f.actor.draw(f.ctx,{state:'RUN',animTime:10});assert.match(f.calls.at(-1)[0].src,/action-forest\/hero-idle/,'atlas load failure keeps approved idle');
  assert.equal(f.depth(),0);
});
test('classic comparison loads no new art; still comparison never loads or cycles walking',()=>{
  const classic=fixture('?actor=classic');assert.equal(classic.images.length,0);assert.equal(classic.actor.draw(classic.ctx),false);
  const still=fixture('?actor=still');assert.equal(still.images.length,1);
  still.actor.draw(still.ctx,{state:'WALK',animTime:99});assert.match(still.calls.at(-1)[0].src,/action-forest\/hero-idle/);
});
