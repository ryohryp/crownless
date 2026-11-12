'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('local playable server serves the opt-in castle layers and bridge texture only',async()=>{
  const server=spawn(process.execPath,['scripts/serve-slice.cjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  try{
    const port=await new Promise((resolve,reject)=>{
      let buffer='';
      const timer=setTimeout(()=>reject(Error('server start timeout')),10000);
      server.stdout.on('data',chunk=>{buffer+=String(chunk);const m=buffer.match(/localhost:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
      server.once('error',reject);
      server.once('exit',code=>reject(Error('server exit '+code)));
    });
    const get=async file=>fetch('http://127.0.0.1:'+port+'/'+file);
    for(const asset of ['vista-castle.svg','vista-canyon.svg','vista-canopy.svg']){
      const r=await get('assets/action-forest/'+asset);
      assert.equal(r.status,200,asset+' must load on a phone preview');
      assert.match(r.headers.get('content-type')||'',/^image\/svg\+xml/);
      assert.match(await r.text(),/^<svg /);
    }
    const webp=await get('assets/action-forest/bridge-hd2d-candidate-v1.webp');
    assert.equal(webp.status,200,'depth geometry uses the existing bridge candidate');
    assert.match(webp.headers.get('content-type')||'',/^image\/webp/);
    const bytes=new Uint8Array(await webp.arrayBuffer());
    assert.equal(String.fromCharCode(...bytes.slice(0,4)),'RIFF');
    for(const unsafe of ['assets/action-forest/unreviewed.svg','../../AGENTS.md']){
      const r=await get(unsafe);
      assert.notEqual(r.status,200,'server must not expose '+unsafe);
    }
  }finally{server.kill();}
});
