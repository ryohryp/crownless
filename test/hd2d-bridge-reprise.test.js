'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const R=require('../src/hd2d-bridge-reprise.js');
test('paint is split into natural-aspect castle and bridge layers, not stretched masonry',()=>{
  const a=R.composition(0,240),b=R.composition(180,240);
  assert.ok(Math.abs(a.sky.width/a.sky.height-1672/350)<.01);
  assert.ok(Math.abs(a.road.width/a.road.height-1672/320)<.02);
  assert.ok(Math.abs((a.sky.x-b.sky.x)-180*R.FAR_PARALLAX)<1e-6);
  assert.equal(a.road.width,1050);
  assert.equal(a.road.x,0,'the walkable surface stays in world coordinates');
  assert.ok(R.parapetY(0)>R.parapetY(1050));
});
test('player projection is viewport-safe and the bridge crest is visually restrained',()=>{
  const p=R.project(210,310,0,118,241);
  const crest=R.project(580,310,46,440,241);
  assert(p.x>0 && p.x<241);
  assert(p.y<R.parapetY(210),'player must stand above the near masonry, not in its wall');
  assert(Math.abs(crest.y-p.y)<14,'raised physics bridge cannot put the sprite high in the sky');
  assert(R.ACTOR_SCALE<.9);
});
test('rebuild tap uses the same actor projection and remains screen-relative',()=>{
  const w=390,rect={left:0,top:0,width:390,height:844};
  const site={id:'traces',x:290,z:310};
  const p=R.project(site.x,site.z,0,120,w);
  const tap={x:p.x,y:p.y/420*844};
  assert.equal(R.hitTestSite(tap,rect,w,120,()=>0,[site]),site);
  assert.equal(R.hitTestSite({x:-10,y:200},rect,w,120,()=>0,[site]),null);
});
test('new comparison mode is isolated from existing battle and GPS entry',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/const reprisePreview = fxParams\.get\('art'\) === 'reprise'/);
  assert.match(html,/src="src\/hd2d-bridge-reprise\.js"/);
  assert.match(html,/const drawReprise=drawPixelArt && reprisePreview && repriseArt\.ready\(\)/);
  assert.match(html,/activeDepthArt\.entity\(ctx,obj\.x/);
  assert.match(html,/activeDepthArt\.shadow\(ctx,obj\.x/);
  assert.match(html,/repriseArt\.hitTestSite/);
  assert.match(html,/id="visualSettingsToggle"/);
  assert.match(html,/id="forestGateChoice"/,'real discoverable options must remain');
  assert.doesNotMatch(fs.readFileSync('expedition.html','utf8'),/CrownlessBridgeReprise/,
    'main expedition remains unchanged');
});
