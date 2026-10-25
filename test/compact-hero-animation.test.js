'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
function setup(animated=true){
  const images=[],cells=[],draws=[];let depth=0;
  const sandbox={Image:class{constructor(){images.push(this);}},document:{createElement(){const c={width:0,height:0,getContext:()=>({drawImage(){},imageSmoothingEnabled:true})};cells.push(c);return c;}}};
  vm.runInNewContext(fs.readFileSync('src/compact-hero-preview.js','utf8'),sandbox);
  const actor=sandbox.CrownlessCompactHero.create({animated});
  for(const i of images){i.complete=true;i.naturalWidth=i.src.includes('walk')?1774:1254;i.naturalHeight=i.src.includes('walk')?887:1254;}
  const ctx={save(){depth++;},restore(){depth--;},drawImage(...args){draws.push(args);}};
  return {actor,ctx,draws,images,cells,depth:()=>depth};
}
test('compact walk uses four cached whole-body frames with fixed ground pivot and frozen simulation time',()=>{
  const s=setup(),used=new Set();
  for(const animTime of [0,1.25,2.5,3.75]){
    const f={state:'WALK',animTime};s.actor.draw(s.ctx,f);assert.deepEqual(f,{state:'WALK',animTime});
    const draw=s.draws.at(-1);used.add(draw[0]);assert.equal(draw[1],-16*44/48);assert.equal(draw[2],-52*44/48);
  }
  assert.equal(used.size,4);assert.equal(s.cells.length,5,'one still plus four reusable walking cells');
  const held=s.draws.at(-1)[0];s.actor.draw(s.ctx,{state:'WALK',animTime:3.75});assert.equal(s.draws.at(-1)[0],held);
  assert.equal(s.cells.length,5,'no per-frame canvas allocation');assert.equal(s.depth(),0);
  s.actor.draw(s.ctx,{state:'IDLE',animTime:99});assert.equal(s.actor.status().lastFrame,null);assert.equal(s.draws.at(-1)[0].height,48);
});
test('compact static review never loads walking; missing animation retains the selected still',()=>{
  const still=setup(false);assert.equal(still.images.length,1);still.actor.draw(still.ctx,{state:'RUN',animTime:99});assert.equal(still.actor.status().lastFrame,null);
  const s=setup();s.images.find(i=>i.src.includes('walk')).complete=false;s.actor.draw(s.ctx,{state:'WALK',animTime:2});
  assert.equal(s.draws.at(-1)[0].height,48);assert.equal(s.actor.status().walkReady,false);
});
