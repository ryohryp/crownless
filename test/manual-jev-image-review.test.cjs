const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
test("manual Jev image review runs only against tracked candidate manifests",()=>{
 const flow=fs.readFileSync(".github/workflows/jev-image-review.yml","utf8");
 const runner=fs.readFileSync("scripts/run-image-review-ci.cjs","utf8");
 assert.match(flow,/workflow_dispatch:/);
 assert.match(flow,/contents: read/);
 assert.match(flow,/TYPESAFE_API_KEY: \$\{\{ secrets\.TYPESAFE_API_KEY \}\}/);
 assert.match(flow,/retention-days: 2/);
 assert.match(runner,/quality-gate-/);
 assert.match(runner,/force:true/);
 assert.match(runner,/approved:false/);
 assert.match(runner,/semantic_asset_review_unavailable/);
 assert.doesNotMatch(flow,/pull_request:/);
 assert.doesNotMatch(flow,/^  push:/m,"Image QA must never run on push");
});
