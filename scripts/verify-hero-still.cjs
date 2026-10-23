'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const server=spawn(process.execPath,['scripts/serve-slice.cjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  let browser;
  try {
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Server timeout')),10000);
      server.stdout.on('data',data=>{const match=String(data).match(/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
      server.on('error',reject);
    });
    browser=await chromium.launch({headless:true});
    const folder=path.join(root,'.qa/browser');await fs.mkdir(folder,{recursive:true});
    for(const width of [360,390,430]) {
      const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{
        window.__heroReviewDraws=0;
        const original=CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
          if(image.src?.includes('hero-still-v1/hero-review.png'))window.__heroReviewDraws++;
          return original.call(this,image,...args);
        };
      });
      const base='http://127.0.0.1:'+port+'/gemini-feel-lab.html';
      await page.goto('http://127.0.0.1:'+port+'/hero-art-review.html',{waitUntil:'networkidle'});
      assert.equal(await page.locator('img').count(),2);
      assert(await page.evaluate(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0)));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'review page fits phone');
      await page.screenshot({path:path.join(folder,'hero-review-page-'+width+'.png'),fullPage:true});
      await page.goto(base,{waitUntil:'networkidle'});
      assert.equal(await page.locator('#heroStillReviewNote').count(),0,'candidate stays opt-in');
      assert.equal(await page.evaluate(()=>__heroReviewDraws),0,'default renderer never uses candidate');
      await page.goto(base+'?actor=still',{waitUntil:'networkidle'});
      await page.waitForFunction(()=>__heroReviewDraws>0);
      assert(await page.locator('#heroStillReviewNote').isVisible());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
      assert.equal(errors.length,0,errors.join(';'));
      await page.screenshot({path:path.join(folder,'hero-still-'+width+'.png')});
      await context.close();
    }
    console.log('PASS: opt-in actual-canvas still draw, normal-mode exclusion, 360/390/430px, no page errors/overflow');
  } finally {if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
