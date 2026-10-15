"use strict";
// A disposable demo-only placement; not persisted, never opens geolocation.
const {spawn}=require("node:child_process");
const fs=require("node:fs/promises");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
function ready(proc){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error("server_timeout")),10000);
  proc.stdout.on("data",chunk=>{
   const m=chunk.toString().match(/localhost:(\d+)/);
   if(m){clearTimeout(timer);resolve(Number(m[1]));}
  });
  proc.on("exit",()=>{clearTimeout(timer);reject(Error("server_exited"));});
 });
}
async function capturePhoneScreens({manifest,candidate,output}){
 const target=manifest.integration;
 if(!target||!["img","background","insert"].includes(target.mode)||typeof target.selector!=="string"||
  !/^[.#][\w-]+(?:[\w\s.#>[\]="':-]+)?$/.test(target.selector))throw Error("invalid_integration_selector");
 if(target.view!==undefined&&!["map","detail"].includes(target.view))throw Error("invalid_integration_view");
 const {chromium}=require("playwright");
 const server=spawn(process.execPath,["scripts/serve-slice.cjs"],{cwd:ROOT,env:{...process.env,PORT:"0"},stdio:["ignore","pipe","pipe"]});
 let browser;
 try{
  const port=await ready(server);
  browser=await chromium.launch({headless:true});
  const screenshots=[],issues=[],visibility={};
  for(const width of [360,390,430]){
   const context=await browser.newContext({viewport:{width,height:width===360?800:width===390?844:932},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const page=await context.newPage();
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   const assetUrl="http://127.0.0.1:"+port+"/__candidate_art";
   await page.route("**/__candidate_art",route=>route.fulfill({status:200,
    contentType:candidate.endsWith(".png")?"image/png":"image/jpeg",
    body:require("node:fs").readFileSync(candidate)}));
   await page.goto("http://127.0.0.1:"+port+"/expedition.html",{waitUntil:"domcontentloaded"});
   await page.locator('[data-action="mode"][data-value="demo"]').click();
   if(target.view==="detail")await page.locator('[data-action="nearby-view"][data-value="detail"]').first().click();
   await page.locator(target.selector).first().waitFor({state:"visible"});
   const metrics=await page.evaluate(async({selector,mode,url})=>{
    const element=document.querySelector(selector);
    if(!element)return {loaded:false};
    if(mode==="img"&&element.tagName!=="IMG")return {loaded:false};
    let previewElement=element;
    if(mode==="img")element.src=url;
    else if(mode==="insert"){
     const preview=document.createElement("img");
     preview.src=url;
     preview.alt="未承認の候補画像（仮配置）";
     preview.style.cssText="display:block;width:100%;height:auto;max-height:180px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;margin-bottom:12px";
     element.prepend(preview);
     previewElement=preview;
    }else {element.style.backgroundImage='url("'+url+'")';element.style.backgroundSize="cover";element.style.backgroundPosition="center";}
    const probe=new Image();probe.src=url;await probe.decode().catch(()=>{});
    const box=previewElement.getBoundingClientRect();
    // Sampling the actual painted element catches images technically loaded
    // beneath opaque child tiles. A background under a filled grid is NOT a
    // visible candidate regardless of its naturalWidth.
    const clipped={left:Math.max(0,box.left),top:Math.max(0,box.top),
      right:Math.min(innerWidth,box.right),bottom:Math.min(innerHeight,box.bottom)};
    let visibleSamples=0;
    const totalSamples=9;
    if(clipped.right>clipped.left&&clipped.bottom>clipped.top){
     for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      const x=clipped.left+(col+.5)*(clipped.right-clipped.left)/3;
      const y=clipped.top+(row+.5)*(clipped.bottom-clipped.top)/3;
      if(document.elementFromPoint(x,y)===previewElement)visibleSamples++;
     }
    }
    const blocked=[...document.querySelectorAll("button:not([disabled])")].filter(button=>{
     const r=button.getBoundingClientRect();if(r.width<1||r.height<1||r.top<0||r.bottom>innerHeight)return false;
     const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
     return !top||!(top===button||button.contains(top));
    }).length;
    return {loaded:probe.naturalWidth>0,box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height},
     visibleFraction:visibleSamples/totalSamples,
     overflow:document.documentElement.scrollWidth-innerWidth,blocked};
   },{selector:target.selector,mode:target.mode,url:assetUrl});
   visibility[width]=metrics.visibleFraction??0;
   if(!metrics.loaded)issues.push("image_failed_to_load_"+width);
   if(metrics.box&&(metrics.box.width<60||metrics.box.height<60||metrics.box.left<-1||metrics.box.right>width+2))issues.push("placement_outside_viewport_"+width);
   if(metrics.loaded&&metrics.visibleFraction<.22)issues.push("candidate_obscured_"+width);
   if(metrics.overflow>2)issues.push("horizontal_overflow_"+width);
   if(metrics.blocked)issues.push("blocked_tap_"+width);
   if(errors.length)issues.push("page_error_"+width);
   await fs.mkdir(output,{recursive:true});
   const screenshot=path.join(output,"phone-"+width+".png");
   await page.screenshot({path:screenshot});screenshots.push(screenshot);
   await context.close();
  }
  return {screenshots,checks:{widths:[360,390,430],issues,visibility}};
 }finally{if(browser)await browser.close().catch(()=>{});server.kill();}
}
module.exports={capturePhoneScreens};
