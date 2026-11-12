'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vista=require('../src/hd2d-bridge-vista.js');

test('castle, canyon and near canopy have real different camera parallax',()=>{
  const start=vista.placement(0,390),walk=vista.placement(200,390);
  assert.equal(start.castle.x-walk.castle.x,28);
  assert.equal(start.canyon.x-walk.canyon.x,64);
  assert.equal(start.canopy.x-walk.canopy.x,140);
  assert.ok(start.castle.y<start.canyon.y);
  assert.ok(start.canopy.height>300);
  assert.ok(vista.PARALLAX.castle < vista.PARALLAX.canyon);
  assert.ok(vista.PARALLAX.canyon < vista.PARALLAX.canopy);
});
test('castle vista retains exactly separate transparent scenic assets',()=>{
  const sources=Object.values(vista.SOURCE);
  assert.equal(sources.length,3);
  for(const asset of sources){
    const text=fs.readFileSync(path.join(__dirname,'..',asset),'utf8');
    assert.match(text,/^<svg /);
    assert.match(text,/viewBox="0 0 /);
    assert.doesNotMatch(text,/<script|<foreignObject|href="https?:/i);
    assert.doesNotMatch(text,/<image /i,'no flattened background may hide inside the SVG');
  }
});
test('vista is opt-in; the old depth bridge and live interaction remain available',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../gemini-feel-lab.html'),'utf8');
  assert.match(html,/src="src\/hd2d-bridge-vista\.js"/);
  assert.match(html,/const depthPreview = fxParams\.get\('art'\) === 'depth'/);
  assert.match(html,/const vistaPreview = fxParams\.get\('art'\) === 'vista'/);
  assert.match(html,/const drawDepth=drawPixelArt && \(depthPreview \|\| vistaPreview\) && depthArt\.ready\(\)/);
  assert.match(html,/if\(drawVista\) vistaArt\.background/);
  assert.match(html,/if\(drawVista\) vistaArt\.foreground/);
  assert.match(html,/depthArt\.entity\(ctx,obj\.x,obj\.z,height/);
  assert.match(html,/depthArt\.hitTestSite/);
  assert.match(html,/drawList\.sort\(\(a, b\) => a\.z - b\.z\)/);
});
test('scene painter preserves a complete background without required image fetch',()=>{
  const events=[];
  const g=()=>({addColorStop(){}});
  const ctx={fillRect(){events.push('fill');},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},save(){},restore(){},translate(){},
    createLinearGradient:g,createRadialGradient:g};
  const scene=vista.create();
  assert.equal(scene.ready('castle'),false);
  const result=scene.background(ctx,390,0,1,0);
  assert.deepEqual(result.layersReady,[]);
  assert.ok(events.includes('fill'));
  assert.ok(result.where.castle.x<390);
  scene.foreground(ctx,390,0,0);
});
