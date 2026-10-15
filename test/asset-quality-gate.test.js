import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {validateManifest,validateGeometry,questions,interpret,cli}=require("../scripts/asset-quality-gate.cjs");
const sample={schemaVersion:1,kind:"background",candidate:"assets/locations/ruined-watchtower.png",
 subject:"fictional watchtower",usage:"discovered-place illustration",
 generationPrompt:"Ink a ruined tower on washi",targetSize:[1280,720],transparent:false,references:[],attempt:0};
test("manifest contracts and retry safety",()=>{
 assert.equal(validateManifest(sample).kind,"background");
 assert.throws(()=>validateManifest({...sample,attempt:3}),/retry_limit/);
 assert.throws(()=>validateManifest({...sample,generationPrompt:"latitude: 35.12345"}),/private_metadata/);
 assert.throws(()=>validateManifest({...sample,kind:"text"}),/invalid_asset_kind/);
});
test("geometry is checked independently of Jev",()=>{
 assert.deepEqual(validateGeometry({format:"png",width:32,height:32,hasAlpha:false,pages:1},sample),[]);
 assert.deepEqual(validateGeometry({format:"webp",width:120,height:120,hasAlpha:false,pages:2},{...sample,transparent:true}),
 ["invalid_format","animation_not_allowed","missing_alpha"]);
});
test("API outage cannot masquerade as rejected art",()=>{
 assert.equal(interpret({available:false,error:"timeout"}).status,"evaluation_unavailable");
});
test("Jev advisory result identifies concrete revision",()=>{
 const x=interpret({available:true,answers:{verdict:{choice:"accept_candidate",confidence:.99},
  main_issue:{choice:"anatomy"},artifacts:{noul:.8},quality:{score:4}}});
 assert.equal(x.status,"revise");
 assert.deepEqual(x.issues,["anatomy","artifacts"]);
 assert.match(x.correction,/Repair malformed/);
});
test("Choice Score Noul are batched for image and screen QA",()=>{
 assert.equal(questions().verdict.type,"choice");
 assert.equal(questions().quality.type,"score");
 assert.equal(questions().identity_mismatch.type,"noul");
 assert.equal(questions(true).ui_obstruction.type,"noul");
 assert.equal(cli(["--manifest","test.json","--stage","all"]).stage,"all");
});

test("end-to-end orchestration caches unchanged candidate and collects two assessments with mocked transport",async()=>{
 const {run}=require("../scripts/asset-quality-gate.cjs");
 const {copyFile,mkdir,rm}=await import("node:fs/promises");
 const {dirname,join}=await import("node:path");
 const {fileURLToPath}=await import("node:url");
 const root=join(dirname(fileURLToPath(import.meta.url)),"..");
 const sha=()=>({format:"png",width:1280,height:720,hasAlpha:false,pages:1});
 const mockSharp=(input)=>({
  metadata:async()=>sha(),
  rotate(){return this;},resize(){return this;},flatten(){return this;},extend(){return this;},png(){return this;},
  async toFile(dest){await mkdir(dirname(dest),{recursive:true});await copyFile(input,dest);}
 });
 let reviews=0, captures=0;
 const dependencies={
  sharp:mockSharp,
  evaluate:async()=>{reviews++;return {available:true,calls:1,usage:{input_tokens:15,output_tokens:2},
   answers:{verdict:{choice:"accept_candidate",confidence:.99},main_issue:{choice:"none"}}};},
  capture:async({candidate})=>{captures++;return {screenshots:[candidate,candidate,candidate],checks:{widths:[360,390,430],issues:[]}};}
 };
 const args={stage:"all",force:true,dependencies};
 const result=await run("docs/visual/quality-gate-pilot-watchtower.json",args);
 try{
  assert.equal(result.asset.status,"accept_candidate");
  assert.equal(result.phone.status,"accept_candidate");
  assert.equal(result.api.requests,2);
  assert.equal(result.api.inputTokens,30);
  assert.equal(reviews,2);assert.equal(captures,1);
  const cached=await run("docs/visual/quality-gate-pilot-watchtower.json",{stage:"all",dependencies});
  assert.equal(cached.cacheHit,true);
  assert.equal(reviews,2);assert.equal(captures,1);
 }finally{
  await rm(join(root,".qa/asset-quality",result.key+".json"),{force:true});
  await rm(join(root,".qa/asset-quality",result.key),{recursive:true,force:true});
 }
});
