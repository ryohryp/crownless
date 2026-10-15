#!/usr/bin/env node
"use strict";
// Manual-only trusted GitHub Action. A successful run means evaluation completed,
// NEVER that the art is approved for production.
const {run}=require("./asset-quality-gate.cjs");
async function main(){
  const manifest=process.env.ASSET_QA_MANIFEST||"";
  if(!/^docs\/visual\/quality-gate-[a-z0-9-]+\.json$/.test(manifest)){
    throw Error("invalid_review_manifest_path");
  }
  if(!process.env.TYPESAFE_API_KEY)throw Error("missing_typesafe_api_key");
  const result=await run(manifest,{stage:"all",force:true});
  const asset=result.asset||{},phone=result.phone||{};
  const summary={
    candidate:result.candidate,sha256:result.sha256,kind:result.kind,
    geometry:result.geometry,
    asset:{status:asset.status,issues:asset.issues||[],error:asset.error||null,
      verdict:asset.answers?.verdict?.choice||null,
      confidence:asset.answers?.verdict?.confidence??null,
      style:asset.answers?.style?.score??null,quality:asset.answers?.quality?.score??null},
    phone:{status:phone.status||"not_run",issues:phone.issues||[],
      error:phone.error||null,checks:phone.checks||null,
      verdict:phone.answers?.verdict?.choice||null,
      confidence:phone.answers?.verdict?.confidence??null,
      readability:phone.answers?.readability?.score??null},
    api:result.api,approved:false
  };
  console.log("JEV_IMAGE_REVIEW "+JSON.stringify(summary));
  // Fail for missing live model evidence and technical faults, not for
  // ordinary advisory artistic findings such as needs_review or revise.
  if(!result.api?.requests ||asset.status==="evaluation_unavailable"||
    !asset.status||result.geometry?.problems?.length){
    throw Error("semantic_asset_review_unavailable");
  }
  if(!["revise","reject_candidate"].includes(asset.status)){
    if(!phone.status||phone.status==="evaluation_unavailable"||phone.checks?.issues?.length){
      throw Error("phone_review_unavailable_or_broken");
    }
  }
  if(asset.status!=="accept_candidate"||phone.status!=="accept_candidate")
    console.log("::warning::Image candidate is NOT approved. Review report manually.");
  else
    console.log("Image advisory checks passed; human approval STILL REQUIRED.");
}
main().catch(e=>{console.error("JEV_IMAGE_REVIEW_BLOCKED "+e.message);process.exitCode=1;});
