'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('red-scarf atlas is a four-pose transparent PNG published with the game',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../assets/action-forest/hero-red-scarf-atlas.png'));
  assert.equal(b.subarray(1,4).toString(),'PNG');
  assert.equal(b.readUInt32BE(16),384,'four 96px cells');
  assert.equal(b.readUInt32BE(20),132);
  assert.equal(b.includes(Buffer.from('tRNS')),true,'sprite sheet must keep transparency');
  const code=fs.readFileSync(path.join(__dirname,'../src/hero-still-review.js'),'utf8');
  assert.ok(code.includes('hero-red-scarf-atlas.png'));
  assert.match(code,/FRAME_W=96, FRAME_H=132/);
  const server=fs.readFileSync(path.join(__dirname,'../scripts/serve-slice.cjs'),'utf8');
  assert.ok(server.includes("'assets/action-forest/hero-red-scarf-atlas.png'"),'development and browser smoke server must publish the new art');
});
