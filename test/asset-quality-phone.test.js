import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const { capturePhoneScreens }=require("../scripts/asset-quality-phone.cjs");
const playwrightReady=(()=>{try{require.resolve("playwright");return true;}catch{return false;}})();
test("real demo temporarily renders watchtower candidate at three phone widths",{
 skip:!playwrightReady?"Playwright installed only in mobile-browser CI":false,
 timeout:120000
},async()=>{
 const manifest=JSON.parse(await readFile(new URL("../docs/visual/quality-gate-pilot-watchtower.json",import.meta.url),"utf8"));
 const root=new URL("../",import.meta.url);
 const tmp=await mkdtemp(join(tmpdir(),"crownless-art-qa-"));
 try{
  const image=new URL("../"+manifest.candidate,import.meta.url);
  const result=await capturePhoneScreens({manifest,candidate:image.pathname,output:tmp});
  assert.deepEqual(result.checks.widths,[360,390,430]);
  assert.deepEqual(result.checks.issues,[]);
  assert.equal(result.screenshots.length,3);
  for(const file of result.screenshots)assert.ok((await stat(file)).size>1000);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
