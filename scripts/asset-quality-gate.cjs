#!/usr/bin/env node
"use strict";
// Advisory candidate QA, never automatic adoption or Canon modification.
const fs=require("node:fs");
const fsp=require("node:fs/promises");
const path=require("node:path");
const crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"..");
const VERSION="visual-gate-1";
const CANON=["AGENTS.md","docs/visual-canon.md","docs/visual/GLOBAL_VISUAL_STYLE.md","docs/visual/CHARACTER_VISUAL_CANON.md","docs/visual/WORLD_DIRECTION.md"];
const KINDS=new Set(["character","enemy","background","map","building","equipment","item","event"]);
const FIX={
 none:null,
 wrong_subject:"Depict the specified subject and setting instead of a substitute.",
 missing_or_extra:"Restore missing required objects and remove unintended figures, text or props.",
 identity:"Restore the approved character identity, silhouette, clothes and camera from an approved anchor.",
 anatomy:"Repair malformed anatomy, weapon joints and architecture without identity drift.",
 artifacts:"Remove accidental lettering, logos, doubled limbs and image-generation artifacts.",
 crop:"Restore full required silhouette, equipment and usable negative space.",
 readability:"Increase small-screen silhouette separation, UI contrast and clean visual hierarchy.",
 style:"Restore charcoal sumi-e on warm washi, keeping vermilion rare and meaningful.",
 uncertain:"Hold for human review before regeneration."
};
function localPath(p){
 if(typeof p!=="string"||!p||path.isAbsolute(p))throw Error("invalid_repo_relative_path");
 const full=path.resolve(ROOT,p);
 if(!full.startsWith(ROOT+path.sep))throw Error("path_outside_repo");
 const real=fs.realpathSync(full);
 if(!real.startsWith(ROOT+path.sep))throw Error("symlink_outside_repo");
 return real;
}
function hash(value){return crypto.createHash("sha256").update(value).digest("hex");}
function validateManifest(m){
 if(!m||m.schemaVersion!==1||!KINDS.has(m.kind))throw Error("invalid_asset_kind");
 for(const key of ["candidate","subject","usage","generationPrompt"])
   if(typeof m[key]!=="string"||!m[key].trim())throw Error("missing_"+key);
 if(!Array.isArray(m.targetSize)||m.targetSize.length!==2||m.targetSize.some(v=>!Number.isInteger(v)||v<1))throw Error("invalid_target_size");
 if(typeof m.transparent!=="boolean")throw Error("missing_transparency");
 if(!Array.isArray(m.references)||m.references.length>2||m.references.some(r=>typeof r!=="string"))throw Error("invalid_references");
 if(!Number.isInteger(m.attempt)||m.attempt<0||m.attempt>2)throw Error("retry_limit_exceeded");
 if(/api[_ -]?key|bearer |password|https?:\/\/|(?:latitude|longitude|緯度|経度)\s*[:=]|-?\d{2,3}\.\d{5,}\s*[,/]\s*-?\d{2,3}\.\d{5,}/i.test([m.subject,m.usage,m.generationPrompt].join(" ")))throw Error("private_metadata");
 return m;
}
function validateGeometry(meta,m){
 const errors=[];
 if(!["png","jpeg"].includes(meta.format))errors.push("invalid_format");
 if(!meta.width||!meta.height||meta.width>8192||meta.height>8192||meta.width*meta.height>24000000)errors.push("invalid_dimensions");
 if((meta.pages||1)>1)errors.push("animation_not_allowed");
 if(m.transparent&&!meta.hasAlpha)errors.push("missing_alpha");
 return errors;
}
async function preview(input,dest,sharp){
 const meta=await sharp(input,{failOn:"error",animated:false}).metadata();
 const k=Math.min(1,1568/Math.max(meta.width,meta.height));
 const w=Math.max(1,Math.round(meta.width*k)),h=Math.max(1,Math.round(meta.height*k));
 const cw=Math.max(w,280),ch=Math.max(h,280),left=Math.floor((cw-w)/2),top=Math.floor((ch-h)/2);
 await fsp.mkdir(path.dirname(dest),{recursive:true});
 await sharp(input,{failOn:"error",animated:false}).rotate().resize(w,h,{fit:"fill"})
  .flatten({background:"#f5efe0"})
  .extend({left,top,right:cw-w-left,bottom:ch-h-top,background:"#f5efe0"})
  .png().toFile(dest);
 const bytes=(await fsp.stat(dest)).size;
 if(bytes>16*1024*1024)throw Error("jev_preview_over_16_mib");
 return {width:cw,height:ch,bytes};
}
function questions(screen=false){
 if(screen)return {
  verdict:{type:"choice",instructions:"Check three real Crownless phone screenshots (360,390,430 CSS pixels) after temporary image placement.",criteria:{
   accept_candidate:"Composition readable, faithful and UI usable",revise:"Visible fixable placement, crop, legibility or style problem",reject_candidate:"Fundamentally wrong presentation",needs_review:"Insufficient visual evidence"}},
  main_issue:{type:"choice",instructions:"Select most important phone problem.",criteria:{
   none:"No clear issue",crop:"Clipping or poor scale",readability:"Text or UI contrast problem",style:"Visual style drift",missing_or_extra:"Wrong visible subject",uncertain:"Cannot judge"}},
  readability:{type:"score",instructions:"Rate phone subject and UI readability.",criteria:["Unusable","Severely limited","Mixed","Mostly clear","Clearly readable"]},
  ui_obstruction:{type:"noul",instructions:"Does this image visibly obscure controls or essential text?"}
 };
 return {
  verdict:{type:"choice",instructions:"Judge the candidate image against the brief, approved visual Canon and optional approved identity reference. Do not approve Canon.",criteria:{
   accept_candidate:"No serious problem; still requires human/runtime review",revise:"Specific fixable visual defect",reject_candidate:"Wrong asset or major departure",needs_review:"Evidence too uncertain"}},
  main_issue:{type:"choice",instructions:"Select the single clearest defect.",criteria:{
   none:"No clear issue",wrong_subject:"Wrong subject",missing_or_extra:"Missing or extra subject",identity:"Identity or clothing mismatch",
   anatomy:"Malformed character, weapon or building",artifacts:"Accidental letters or AI artifacts",crop:"Bad crop",
   readability:"Indistinct at phone scale",style:"Contradicts current visual Canon",uncertain:"Insufficient evidence"}},
  style:{type:"score",instructions:"Rate match with current Crownless Canon, using newer map-specific rules for maps.",criteria:["Opposite style","Major drift","Mixed","Mostly matched","Fully matched"]},
  quality:{type:"score",instructions:"Rate anatomy, outlines, cropping and absence of image defects.",criteria:["Broken","Major flaws","Some flaws","Minor flaws","Clean"]},
  identity_mismatch:{type:"noul",instructions:"Is the required subject identity or costume visibly wrong compared with the brief and approved reference?"},
  artifacts:{type:"noul",instructions:"Is there unintended writing, malformed anatomy or another clear generation artifact?"}
 };
}
function interpret(e){
 if(!e.available)return {status:"evaluation_unavailable",issues:[],correction:null};
 const a=e.answers||{},allowed=new Set(["accept_candidate","revise","reject_candidate","needs_review"]);
 let status=a.verdict?.choice;
 if(!allowed.has(status))return {status:"evaluation_unavailable",issues:[],correction:null};
 const issues=[];
 if(FIX[a.main_issue?.choice])issues.push(a.main_issue.choice);
 if((a.artifacts?.noul||0)>=0.75&&!issues.includes("artifacts"))issues.push("artifacts");
 if((a.identity_mismatch?.noul||0)>=0.75&&!issues.includes("identity"))issues.push("identity");
 if((a.ui_obstruction?.noul||0)>=0.75&&!issues.includes("readability"))issues.push("readability");
 if(a.quality?.score<=2&&!issues.includes("anatomy"))issues.push("anatomy");
 if(a.style?.score<=2&&!issues.includes("style"))issues.push("style");
 if(a.readability?.score<=2&&!issues.includes("readability"))issues.push("readability");
 if(status==="accept_candidate"&&issues.length)status="revise";
 if((a.verdict?.confidence??1)<0.6)status="needs_review";
 return {status,issues,correction:(status==="revise"||status==="reject_candidate")&&issues.length?issues.map(x=>FIX[x]).join(" "):null};
}
async function evaluate({images,manifest,screen=false},sdk){
 if(!process.env.TYPESAFE_API_KEY)return {available:false,error:"missing_api_key",calls:0};
 try{
  const {TypeSafeClient,image}=sdk||require("@typesafe-ai/sdk");
  const {openAsBlob}=require("node:fs");
  const files=await Promise.all(images.map(async p=>image(await openAsBlob(p))));
  const state=screen
    ?{game:"Crownless demo, fictional map, no actual GPS",phoneScreens:{width360:files[0],width390:files[1],width430:files[2]}}
    :{candidate:files[0],...(files[1]?{approvedReference:files[1]}:{}),contract:{
      type:manifest.kind,subject:manifest.subject,usage:manifest.usage,prompt:manifest.generationPrompt.slice(0,2400),
      targetSize:manifest.targetSize,transparent:manifest.transparent,
      style:manifest.kind==="map"?"ADR-0014 connected tile paths override older map prescriptions":"medieval sumi-e on washi; existing actor identity/camera anchors remain binding"}};
  const client=new TypeSafeClient();
  const r=await client.systemOne({state,questions:questions(screen),model:"jev-latest"},
   {headers:{"TypeSafe-Danger-Zone-Images":"true"},timeout:20000});
  return {available:true,answers:r.answers,usage:r.usage,model:r.model,calls:1};
 }catch(error){return {available:false,error:"jev_api_or_sdk_failure",errorClass:error?.name,calls:1};}
}
async function run(manifestPath,{stage="asset",force=false,dependencies={}}={}){
 const m=validateManifest(JSON.parse(await fsp.readFile(localPath(manifestPath),"utf8")));
 const candidate=localPath(m.candidate),refs=m.references.map(localPath);
 const contents=await Promise.all([candidate,...refs,...CANON.map(localPath)].map(x=>fsp.readFile(x)));
 const sha256=hash(contents[0]);
 const key=hash(JSON.stringify({VERSION,m,hashes:contents.map(hash)}));
 const dir=path.join(ROOT,".qa/asset-quality",key);
 const outfile=path.join(ROOT,".qa/asset-quality",key+".json");
 if(!force){
  try{const prior=JSON.parse(await fsp.readFile(outfile,"utf8"));
   if(prior.asset?.status!=="evaluation_unavailable"&&(stage!=="all"||prior.phone?.status!=="evaluation_unavailable")&&
      (stage!=="all"||prior.phone))return {...prior,cacheHit:true};
  }catch{}
 }
 const report={schemaVersion:1,key,candidate:m.candidate,sha256,kind:m.kind,attempt:m.attempt,
  maxRegenerations:2,asset:null,phone:null,api:{requests:0,inputTokens:0,outputTokens:0}};
 const tally=e=>{report.api.requests+=e.calls||0;report.api.inputTokens+=e.usage?.input_tokens||0;report.api.outputTokens+=e.usage?.output_tokens||0;};
 try{
  const sharp=dependencies.sharp||require("sharp");
  const metadata=await sharp(candidate,{animated:false,failOn:"error"}).metadata();
  const problems=validateGeometry(metadata,m);
  report.geometry={width:metadata.width,height:metadata.height,format:metadata.format,hasAlpha:metadata.hasAlpha,problems};
  if(problems.length)report.asset={status:"reject_candidate",issues:problems,deterministic:true};
  else{
   const img=path.join(dir,"candidate.png");
   report.preview=await preview(candidate,img,sharp);
   const prepared=[img];
   if(refs.length){const reference=path.join(dir,"approved-reference.png");await preview(refs[0],reference,sharp);prepared.push(reference);}
   const evaluation=dependencies.evaluate?await dependencies.evaluate({images:prepared,manifest:m,screen:false}):await evaluate({images:prepared,manifest:m});
   tally(evaluation);
   report.asset={...interpret(evaluation),...(evaluation.available?{answers:evaluation.answers,model:evaluation.model}:{error:evaluation.error})};
  }
  if(stage==="all"&&!problems.length){
   try{
    const capture=dependencies.capture||require("./asset-quality-phone.cjs").capturePhoneScreens;
    const images=await capture({manifest:m,candidate,output:dir});
    report.phone={checks:images.checks,screenshots:images.screenshots.map(x=>path.relative(ROOT,x))};
    if(images.checks.issues.length)Object.assign(report.phone,{status:"revise",issues:images.checks.issues});
    else{
     const assessment=dependencies.evaluate?await dependencies.evaluate({images:images.screenshots,manifest:m,screen:true}):await evaluate({images:images.screenshots,manifest:m,screen:true});
     tally(assessment);
     Object.assign(report.phone,interpret(assessment));
     if(assessment.available){report.phone.answers=assessment.answers;report.phone.model=assessment.model;}
     else report.phone.error=assessment.error;
    }
   }catch(e){report.phone={status:"evaluation_unavailable",error:"phone_capture_failed",detail:e.message};}
  }
 }catch(e){report.asset={status:"evaluation_unavailable",error:"image_preparation_failed",detail:e.message};}
 await fsp.mkdir(path.dirname(outfile),{recursive:true});
 await fsp.writeFile(outfile,JSON.stringify(report,null,2)+"\n");
 return report;
}
function cli(argv){
 const val=k=>{const i=argv.indexOf(k);return i<0?null:argv[i+1];};
 const manifest=val("--manifest"),stage=val("--stage")||"asset";
 if(!manifest||!["asset","all"].includes(stage))throw Error("usage: --manifest path [--stage asset|all] [--force]");
 return {manifest,stage,force:argv.includes("--force")};
}
if(require.main===module)(async()=>{
 try{
  const args=cli(process.argv.slice(2));const r=await run(args.manifest,args);
  console.log(JSON.stringify(r,null,2));
  if(r.asset?.status!=="accept_candidate"||(args.stage==="all"&&r.phone?.status!=="accept_candidate"))process.exitCode=2;
 }catch(e){console.error("image_gate: "+e.message);process.exitCode=2;}
})();
module.exports={validateManifest,validateGeometry,questions,interpret,run,cli};
