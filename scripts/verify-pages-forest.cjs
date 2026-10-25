'use strict';
// Build the same static payload as Pages (without docs), then enter gameplay
// through its normal map button. This catches local-only asset references.
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const excluded=new Set(['.git','.github','.visual-director','.vscode','art-source','docs','scripts','skills','test','tests','test-support','tools']);
(async()=>{
  const stage=await fs.mkdtemp(path.join(root,'.qa/pages-game-'));
  const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  for(const name of await fs.readdir(path.join(root,'assets/action-forest')))files.push('assets/action-forest/'+name);
  for(const file of new Set(files)){
    if(excluded.has(file.split('/')[0]))continue;
    const dest=path.join(stage,file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,file),dest);
  }
  const version=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim().slice(0,12);
  for(const name of ['index.html','expedition.html','reboot.html','gemini-feel-lab.html','hero-art-review.html','compact-hero-review.html']){
    try{const file=path.join(stage,name);let html=await fs.readFile(file,'utf8');html=html.replace(/((?:href|src)=["'])(?!https?:|\/\/|#|data:)([^"'?]+\.(?:css|js))(?:\?[^"']*)?(["'])/g,`$1$2?v=${version}$3`);await fs.writeFile(file,html);}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  assert.equal(await fs.stat(path.join(stage,'docs')).then(()=>true,()=>false),false,'docs must be absent from published payload');
  const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
  const server=http.createServer(async(req,res)=>{
    const file=path.resolve(stage,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
    if(!file.startsWith(stage+path.sep)){res.writeHead(404);return res.end();}
    try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({headless:true});
    const base='http://127.0.0.1:'+server.address().port;
    for(const width of [360,390,430]){
      const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[],missing=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)missing.push(r.url());});
      await page.goto(base+'/',{waitUntil:'networkidle'});
      await page.locator('[data-action="mode"][data-value="demo"]').click();
      await page.locator('[data-action="action-forest-lab"]').first().click();
      await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady&&window.CrownlessForestReadout().heroAnimation.walkReady);
      assert(!new URL(page.url()).searchParams.has('actor'),'normal game needs no preview flag');
      await page.keyboard.down('a');await page.waitForTimeout(200);await page.screenshot({path:path.join(root,'.qa/browser/pages-game-'+width+'.png')});await page.keyboard.up('a');
      assert.equal(missing.length,0,'all published dependencies must load: '+missing.join(','));assert.equal(errors.length,0,errors.join(';'));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
    }
    console.log('PASS: Pages payload without docs, normal game entry → forest + approved hero + walking, 360/390/430px; no missing files/errors/overflow');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
