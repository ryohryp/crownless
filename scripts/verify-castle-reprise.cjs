'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.qa/browser');
(async()=>{
  const server=spawn(process.execPath,['scripts/serve-slice.cjs'],{
    cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  let browser;
  try{
    const port=await new Promise((resolve,reject)=>{
      let buf='';const timer=setTimeout(()=>reject(Error('server timeout')),10000);
      server.stdout.on('data',d=>{buf+=d;const m=buf.match(/localhost:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
      server.once('error',reject);
    });
    browser=await chromium.launch({headless:true});await fs.mkdir(out,{recursive:true});
    for(const [width,height] of [[360,800],[390,844],[430,932],[844,390]]){
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        window.__paintedLayerDraws=0;
        const original=CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
          if(image?.src?.includes('/bridge-hd2d-candidate-v1.webp'))window.__paintedLayerDraws++;
          return original.call(this,image,...args);
        };
      });
      await page.goto('http://127.0.0.1:'+port+'/gemini-feel-lab.html?art=reprise',
        {waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.CrownlessForestReadout?.()?.player &&
        window.__paintedLayerDraws>2,null,{timeout:15000});
      const before=await page.evaluate(()=>window.CrownlessForestReadout());
      const proof=await page.evaluate(()=>{
        const c=document.querySelector('#gameCanvas'),r=c.getBoundingClientRect();
        const b=document.querySelector('body'),h=document.querySelector('header').getBoundingClientRect();
        const img=c.getContext('2d').getImageData(0,0,c.width,c.height);
        const coords=[[.2,.1],[.72,.1],[.5,.5],[.25,.75],[.7,.75]];
        const samples=coords.map(([x,y])=>{
          const i=(Math.floor(y*c.height)*c.width+Math.floor(x*c.width))*4;
          return Array.from(img.data.slice(i,i+3)).join(',');
        });
        return {headerHeight:h.height,sceneTop:r.top,sceneHeight:r.height,stageWidth:r.width,
          overflow:document.documentElement.scrollWidth-innerWidth,
          ready:document.querySelector('body').classList.contains('reprise-layout'),
          samples,colors:new Set(samples).size,
          text:document.getElementById('btnToggleArtPreview').textContent,
          paintDraws:window.__paintedLayerDraws,
          noFlatSvg:!performance.getEntriesByType('resource')
            .some(e=>e.name.includes('vista-castle.svg'))};
      });
      assert(proof.ready && proof.paintDraws>2,'the rebuilt painterly world must render');
      assert(proof.headerHeight<=52,'compact top HUD must expose the environment: '+JSON.stringify(proof));
      assert(proof.colors>=4,'scene must not be a blank gradient: '+JSON.stringify(proof));
      assert(proof.noFlatSvg,'vector castle must not load in the rebuilt mode');
      assert(proof.overflow<=2,'no page-wide horizontal scroll');
      assert.match(proof.text,/石橋・再構築/);
      await page.screenshot({path:path.join(out,'reprise-'+width+'x'+height+'-start.png')});
      // Tiny QA thumbnail in CI logs: inspect the ACTUAL rendered pixels,
      // not only test result counters. Synthetic test session, no GPS/user data.
      if(width===390){
        const preview=await page.evaluate(()=>{
          const source=document.getElementById('gameCanvas');
          const c=document.createElement('canvas');c.width=180;c.height=320;
          c.getContext('2d').drawImage(source,0,0,c.width,c.height);
          return c.toDataURL('image/jpeg',.32).split(',')[1];
        });
        console.log('REPRISE_CANVAS_THUMB_BASE64 '+preview);
      }
      const menu=page.locator('#visualSettingsToggle');
      await menu.click();
      assert.equal(await menu.getAttribute('aria-expanded'),'true');
      assert(await page.locator('#btnToggleAI').isVisible(),'secondary debug options remain reachable');
      await menu.click();
      if(height>=width){
        await page.keyboard.down('d');await page.waitForTimeout(850);await page.keyboard.up('d');
        await page.waitForTimeout(120);
        const after=await page.evaluate(()=>window.CrownlessForestReadout());
        assert(after.player.x>before.player.x+12,'real movement must work in painted stage');
        assert(after.cameraX>before.cameraX+1,'camera follows world');
        await page.screenshot({path:path.join(out,'reprise-'+width+'x'+height+'-walk.png')});
      }
      assert.deepEqual(errors,[],'zero browser exceptions');
      console.log('REPRISE_PASS',width+'x'+height,JSON.stringify(proof));
      await context.close();
    }
  }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
