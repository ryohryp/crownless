'use strict';
// Real Chromium proof for the opt-in castle/bridge visual stage.
// Uses the existing player controls; does not mutate HP, GPS or save state.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'.qa/browser');
async function portOf(server){
  return new Promise((resolve,reject)=>{
    let text='';
    const timer=setTimeout(()=>reject(Error('server timed out')),10000);
    server.stdout.on('data',chunk=>{text+=String(chunk);const found=text.match(/localhost:(\d+)/);if(found){clearTimeout(timer);resolve(found[1]);}});
    server.once('error',reject);
    server.once('exit',code=>reject(Error('server exited: '+code)));
  });
}
(async()=>{
  const server=spawn(process.execPath,['scripts/serve-slice.cjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  let browser;
  try{
    const port=await portOf(server);
    const url='http://127.0.0.1:'+port+'/gemini-feel-lab.html?art=vista';
    browser=await chromium.launch({headless:true});
    await fs.mkdir(output,{recursive:true});
    for(const [width,height] of [[360,800],[390,844],[430,932],[844,390]]){
      const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{
        window.__vistaLayers={castle:0,canyon:0,canopy:0};
        const original=CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
          if(typeof image?.src==='string'){
            for(const layer of Object.keys(window.__vistaLayers)){
              if(image.src.includes('/vista-'+layer+'.svg'))window.__vistaLayers[layer]++;
            }
          }
          return original.call(this,image,...args);
        };
      });
      await page.goto(url,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.CrownlessForestReadout?.().player &&
        window.__vistaLayers.castle>0 && window.__vistaLayers.canyon>0 && window.__vistaLayers.canopy>0,{timeout:20000});
      const before=await page.evaluate(()=>window.CrownlessForestReadout());
      const first=await page.evaluate(()=>window.CrownlessBridgeVista.placement(0,390));
      const second=await page.evaluate(()=>window.CrownlessBridgeVista.placement(200,390));
      assert(first.castle.x-second.castle.x < first.canyon.x-second.canyon.x);
      assert(first.canyon.x-second.canyon.x < first.canopy.x-second.canopy.x);
      assert(await page.locator('#gameCanvas').isVisible());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,
        'vista mode must fit width '+width);
      if(height>width){
        await page.keyboard.down('d');await page.waitForTimeout(680);await page.keyboard.up('d');
        await page.waitForTimeout(180);
        const after=await page.evaluate(()=>window.CrownlessForestReadout());
        assert(after.player.x>before.player.x+12,
          'real keyboard movement still moves the hero: '+JSON.stringify({before:before.player.x,after:after.player.x}));
        assert(after.cameraX>before.cameraX+1,
          'camera must follow and expose independent parallax: '+JSON.stringify({before:before.cameraX,after:after.cameraX}));
      }
      const layers=await page.evaluate(()=>window.__vistaLayers);
      assert(Object.values(layers).every(count=>count>=1),
        'all separate vista layers must actually render: '+JSON.stringify(layers));
      assert.deepEqual(errors,[],'no browser errors at '+width+'px');
      await page.screenshot({path:path.join(output,'vista-'+width+'x'+height+'.png')});
      await ctx.close();
    }
    console.log('PASS: 360/390/430 portrait + 844 landscape, 3 actual image layers, independent parallax, real actor movement, no page errors.');
  }finally{
    if(browser)await browser.close();
    server.kill();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
