const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const depth = require('../src/hd2d-bridge-depth.js');

function heightAt(x, z) {
  if (z < 235 || z > 345 || x < 430 || x > 730) return 0;
  return Math.max(0, Math.cos((x - 580) / 150 * Math.PI * .5) * 46);
}

test('bridge geometry uses the live world camera and converges with distance', () => {
  const far = depth.project(580, 235, 0, 320, 390);
  const near = depth.project(580, 345, 0, 320, 390);
  assert.ok(far.scale < near.scale);
  assert.ok(far.y < near.y);
  assert.ok(depth.project(580, 300, 46, 320, 390).y < depth.project(580, 300, 0, 320, 390).y);
  assert.notEqual(depth.project(580, 300, 0, 0, 390).x,
    depth.project(580, 300, 0, 200, 390).x);
});

test('site tap uses the same projection as its rendered sprite', () => {
  const site = {id:'shrine', x:660, z:230};
  const viewportWidth = 390, cameraX = 460;
  const p = depth.project(site.x, site.z, heightAt(site.x, site.z), cameraX, viewportWidth);
  const rect = {left:20,top:40,width:390,height:420};
  assert.equal(depth.hitTestSite({x:20+p.x,y:40+p.y-42},rect,viewportWidth,
    cameraX,heightAt,[site])?.id,'shrine');
  assert.equal(depth.hitTestSite({x:20+p.x+120,y:40+p.y},rect,viewportWidth,
    cameraX,heightAt,[site]),null);
});

test('near parapet is depth sorted with people, and old forest remains default', () => {
  const html = fs.readFileSync(path.join(__dirname, '../gemini-feel-lab.html'), 'utf8');
  assert.match(html, /depthPreview = fxParams\.get\('art'\) === 'depth'/);
  assert.match(html, /depthArt\.ground\(ctx,state\.cameraX,virtualW,getGroundHeightAt\)/);
  assert.match(html, /depthArt\.nearScenery/);
  assert.match(html, /drawList\.sort\(\(a, b\) => a\.z - b\.z\)/);
  assert.match(html, /depthArt\.entity\(ctx,obj\.x,obj\.z,height/);
  assert.match(html, /depthArt\.hitTestSite/);
  assert.match(html, /else forestArt\.foreground/);
  assert.ok(depth.nearScenery.some(o => o.type === 'frontRail' && o.z === depth.BRIDGE.front));
});

test('stone texture maps to both triangles of a skewed bridge face without bounding-box stretch', () => {
  const source=[[10,20],[110,20],[110,70],[10,70]];
  const projected=[[30,40],[210,58],[195,137],[19,120]];
  const point=(matrix,p)=>[matrix[0]*p[0]+matrix[2]*p[1]+matrix[4],
    matrix[1]*p[0]+matrix[3]*p[1]+matrix[5]];
  for(const indices of [[0,1,2],[0,2,3]]) {
    const matrix=depth.affineTriangle(indices.map(i=>source[i]),indices.map(i=>projected[i]));
    assert.ok(matrix?.every(Number.isFinite));
    indices.forEach(i=>{
      const actual=point(matrix,source[i]);
      assert.ok(Math.abs(actual[0]-projected[i][0])<1e-7);
      assert.ok(Math.abs(actual[1]-projected[i][1])<1e-7);
    });
  }
  assert.equal(depth.affineTriangle([[0,0],[0,0],[1,1]],[[0,0],[1,0],[0,1]]),null);
});
