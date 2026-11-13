'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const R=require('../src/hd2d-bridge-reprise.js');

test('portrait and landscape panorama always fill the WHOLE viewport with one aspect ratio',()=>{
  for(const width of [200,241,288,390,700,900]){
    for(const cam of [0,120,360,700,1050]){
      const p=R.composition(cam,width).panorama;
      assert.equal(p.y,0);
      assert.equal(p.height,R.HEIGHT);
      assert.ok(Math.abs(p.width/p.height-R.ART_WIDTH/R.ART_HEIGHT)<1e-9);
      assert.ok(p.x<=0,JSON.stringify({width,cam,p}));
      assert.ok(p.x+p.width>=width-1e-6,JSON.stringify({width,cam,p}));
    }
  }
  assert.notEqual(R.composition(120,241).panorama.x,R.composition(600,241).panorama.x);
});

test('no pasted ground, parapet overlay or flat vector props in rebuilt renderer',()=>{
  const source=fs.readFileSync('src/hd2d-bridge-reprise.js','utf8');
  assert.match(source,/ONE image in ONE projection/);
  assert.doesNotMatch(source,/ctx\.clip\(/);
  assert.doesNotMatch(source,/ctx\.transform\(/);
  assert.doesNotMatch(source,/ctx\.fillRect\(430/);
  // Only the background draws the panorama. Foreground cannot erase actors.
  assert.equal((source.match(/ctx\.drawImage\(/g)||[]).length,1);
  const fakeCtx={
    createLinearGradient(){return {addColorStop(){}};},
    createRadialGradient(){return {addColorStop(){}};},
    save(){},restore(){},translate(){},beginPath(){},ellipse(){},fill(){},fillRect(){},
  };
  const scene=R.create();
  // Node has no Image; this verifies the fog layer does not require the art.
  scene.foreground(fakeCtx,120,241,0);
  assert.equal(scene.ready(),false);
});

test('player and tap coordinates stay aligned and inside stone-deck region',()=>{
  const w=241,cam=118,hero=R.project(210,310,0,cam,w);
  assert(hero.x>25&&hero.x<w-25);
  assert(hero.y>210&&hero.y<265,'hero feet must be on bridge level, not the gulf');
  const site={id:'traces',x:290,z:310};
  const p=R.project(site.x,site.z,0,cam,w);
  const tap={x:p.x,y:p.y/420*800};
  assert.equal(R.hitTestSite(tap,{left:0,top:0,width:w,height:800},w,cam,()=>0,[site]),site);
  assert.equal(R.hitTestSite({x:-5,y:10},{left:0,top:0,width:w,height:800},w,cam,()=>0,[site]),null);
});

test('reprise mode keeps real gestures, discoveries, HUD controls and default game isolated',()=>{
  const html=fs.readFileSync('gemini-feel-lab.html','utf8');
  assert.match(html,/const reprisePreview = fxParams\.get\('art'\) === 'reprise'/);
  assert.match(html,/const drawReprise=drawPixelArt && reprisePreview && repriseArt\.ready\(\)/);
  assert.match(html,/activeDepthArt\.shadow\(ctx,obj\.x/);
  assert.match(html,/activeDepthArt\.entity\(ctx,obj\.x/);
  assert.match(html,/repriseArt\.hitTestSite/);
  assert.match(html,/id="gestureActionArea"/);
  assert.match(html,/id="visualSettingsToggle"/);
  assert.match(html,/id="forestGateChoice"/);
  assert.doesNotMatch(fs.readFileSync('expedition.html','utf8'),/CrownlessBridgeReprise/);
});
