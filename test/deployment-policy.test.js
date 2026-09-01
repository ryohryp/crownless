const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Vercel automatic Git deployments stay disabled', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.git?.deploymentEnabled, false);
});

test('GitHub Pages automatically publishes only a successful tested main commit', () => {
  const workflow = read('.github/workflows/pages.yml');

  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows:\s*\["test"\]/);
  assert.match(workflow, /types:\s*\[completed\]/);
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /ref:\s*\$\{\{ github\.event_name == 'workflow_run' && github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}/);
  assert.doesNotMatch(workflow, /\n\s*push:/);
  assert.doesNotMatch(workflow, /enablement:\s*true/);
});

test('GitHub Pages keeps manual recovery and latest-deploy-wins safeguards', () => {
  const workflow = read('.github/workflows/pages.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /group:\s*github-pages/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});

test('Vercel Production stays manual-only while retaining production smoke checks', () => {
  const workflow = read('.github/workflows/vercel-production.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s*push:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /environment:\s*production/);
  assert.match(workflow, /VERCEL_TOKEN:\s*\$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.match(workflow, /vercel@latest build --prod/);
  assert.match(workflow, /deploy --prebuilt --prod/);
  assert.match(workflow, /PRODUCTION_URL:\s*https:\/\/crownless-iota\.vercel\.app/);
  assert.match(workflow, /\$PRODUCTION_URL\/api\/geography/);
  assert.match(workflow, /--max-time 18/);
  assert.match(workflow, /Geography enrichment API smoke budget: <= 18s/);
  assert.match(workflow, /Gameplay geography wait: non-blocking/);
  assert.match(workflow, /DEFAULT_TIMEOUT_MS.*require\("\.\/src\/geography-proxy\.js"\)/);
  assert.match(workflow, /payload\.timeoutMs\) > DEFAULT_TIMEOUT_MS/);
});

test('scheduled geography health retries one transient failure without weakening validation', () => {
  const workflow = read('.github/workflows/geography-health.yml');
  assert.match(workflow, /for attempt in 1 2/);
  assert.match(workflow, /--max-time 18/);
  assert.match(workflow, /sleep 2/);
  assert.match(workflow, /GEOGRAPHY_HEALTH_ATTEMPTS=\$attempt/);
  assert.match(workflow, /within two 18-second attempts/);
  assert.match(workflow, /payload\.attempts\.some\(\(attempt\) => attempt && attempt\.state === "success"\)/);
  assert.match(workflow, /Gameplay impact: non-blocking enrichment/);
});
