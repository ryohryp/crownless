'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const server=spawn(process.execPath,['scripts/serve-slice.cjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});let browser;
  try{
    const port=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',data=>{out+=data;const match=out.match(/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});server.once('error',reject);});
    const base='http://127.0.0.1:'+port;
    const output=path.join(root,'.qa/compact-hero');await fs.mkdir(output,{recursive:true});
    browser=await chromium.launch({headless:true});
    for(const width of [360,390,430]){
      const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/compact-hero-review.html',{waitUntil:'networkidle'});
      await page.waitForFunction(()=>current.ready()&&candidate.ready());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'comparison fits phone');
      await page.screenshot({path:path.join(output,'comparison-'+width+'.png'),fullPage:true});
      for(const factor of [2,6,4]){
        await page.locator('[data-zoom="'+factor+'"]').click();
        assert.equal(await page.locator('[data-zoom="'+factor+'"]').getAttribute('aria-pressed'),'true');
        assert(await page.evaluate(()=>{const c=document.querySelector('#zoom'),g=c.getContext('2d');const p=g.getImageData(0,0,c.width,c.height).data;let opaque=0;for(let n=3;n<p.length;n+=4)if(p[n]>200)opaque++;return opaque>100;}),'sprite visible after zoom');
      }
      await page.locator('a[href$="actor=compact"]').click();
      await page.waitForFunction(()=>{const s=window.CrownlessForestReadout?.();return s?.player&&s.assetsReady&&s.heroAnimation.stillReady;});
      let state=await page.evaluate(()=>CrownlessForestReadout());
      assert.equal(state.heroAnimation.compact,true);assert.equal(state.heroAnimation.walkReady,false);
      assert.equal(state.heroAnimation.reviewOnly,true);assert.equal(state.heroAnimation.presentationHeight,48);
      assert(await page.locator('#heroStillReviewNote').isVisible());
      const x=state.player.x;await page.keyboard.down('a');await page.waitForTimeout(250);await page.keyboard.up('a');
      state=await page.evaluate(()=>CrownlessForestReadout());assert(state.player.x<x-10,'actual keyboard still moves protagonist');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'scene fits phone');
      await page.screenshot({path:path.join(output,'forest-'+width+'.png')});
      await page.goto(base+'/gemini-feel-lab.html?actor=compact-walk',{waitUntil:'networkidle'});
      await page.waitForFunction(()=>{const s=window.CrownlessForestReadout?.();return s?.player&&s.assetsReady&&s.heroAnimation.walkReady;});
      const cells=new Set();await page.keyboard.down('a');
      for(let i=0;i<12;i++){cells.add((await page.evaluate(()=>CrownlessForestReadout())).heroAnimation.lastFrame);await page.waitForTimeout(60);}
      await page.keyboard.up('a');cells.delete(null);assert.equal(cells.size,4,'real input reaches all four new walking frames');
      await page.waitForFunction(()=>CrownlessForestReadout().heroAnimation.lastFrame===null);
      await page.screenshot({path:path.join(output,'walk-'+width+'.png')});
      await page.goto(base+'/gemini-feel-lab.html',{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.CrownlessForestReadout?.().heroAnimation.walkReady);
      assert.notEqual((await page.evaluate(()=>CrownlessForestReadout())).heroAnimation.compact,true,'normal route keeps approved art');
      assert.deepEqual(errors,[]);await context.close();
    }
    console.log('PASS:360/390/430px comparison/zoom, opt-in static sprite and real movement, unchanged normal approved walk, no errors/overflow');
  }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
