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
