'use strict';
// Review actual runtime parts at integer zoom, without changing game state.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:720,height:680},deviceScaleFactor:1});
    await page.setContent('<style>body{margin:0}canvas{display:block}</style><canvas width="720" height="680"></canvas>');
    await page.addScriptTag({path:path.resolve(__dirname,'../src/pixel-actors.js')});
    await page.evaluate(()=>{
      const g=document.querySelector('canvas').getContext('2d');
      g.fillStyle='#394335';g.fillRect(0,0,720,680);
      const poses=[['IDLE','Idle'],['WALK','Walk'],['ATTACK','Forged sword']];
      poses.forEach(([,name],i)=>{g.fillStyle='#eee2c7';g.font='17px sans-serif';g.textAlign='center';g.fillText(name,120+i*240,30);});
      ['traveler','companion','enemy'].forEach((role,row)=>{
        g.fillStyle='#c2c7aa';g.font='15px sans-serif';g.textAlign='left';g.fillText(role,20,65+row*210);
        poses.forEach(([state],col)=>{
          const x=120+col*240,y=200+row*210;
          g.fillStyle='#28332a';g.fillRect(x-36,y-2,76,6);
          g.save();g.translate(x,y);g.scale(2,2);
          window.CrownlessPixelActors.draw(g,{state,animTime:1,heldWeapon:null},{role,crafted:state==='ATTACK'});
          g.restore();
        });
      });
    });
    const output=path.resolve(__dirname,'../.qa/browser/pixel-actors-sheet.png');
    await fs.mkdir(path.dirname(output),{recursive:true});
    await page.screenshot({path:output});
    console.log(output);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
