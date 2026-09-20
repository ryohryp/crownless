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

test('CI validates pull requests once and Pages publishes merged main directly', () => {
  const testWorkflow = read('.github/workflows/test.yml');
  const pagesWorkflow = read('.github/workflows/pages.yml');

  assert.match(testWorkflow, /pull_request:/);
  assert.doesNotMatch(testWorkflow, /\n\s*push:/);

  assert.match(pagesWorkflow, /\n\s*push:/);
  assert.match(pagesWorkflow, /branches:\s*\[main\]/);
  assert.doesNotMatch(pagesWorkflow, /workflow_run:/);
  assert.doesNotMatch(pagesWorkflow, /enablement:\s*true/);
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

test('GitHub Pages fingerprints local CSS and JS assets with the deployed commit', () => {
  const workflow = read('.github/workflows/pages.yml');

  assert.match(workflow, /DEPLOY_SHA:/);
  assert.match(workflow, /DEPLOY_SHA:\s*\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /mkdir -p _site/);
  assert.match(workflow, /rsync -a --delete/);
  assert.match(workflow, /sha\.slice\(0, 12\)/);
  assert.match(workflow, /\(\?:css\|js\)/);
  assert.match(workflow, /\?v=\$\{version\}/);
  assert.match(workflow, /touch _site\/\.nojekyll/);
  assert.match(workflow, /path:\s*_site/);
  assert.doesNotMatch(workflow, /path:\s*\.\s*$/m);
});

test('GitHub Pages artifact excludes development-only sources', () => {
  const workflow = read('.github/workflows/pages.yml');

  for (const directory of [
    '.github',
    '.visual-director',
    '.vscode',
    'art-source',
    'docs',
    'scripts',
    'skills',
    'test',
    'tests',
    'test-support',
    'tools',
  ]) {
    const escaped = directory.replace(/[.*+?^${}()|[\]\\]/g, '\\test('Vercel Production stays manual-only while retaining production smoke checks', () => {');
    assert.match(workflow, new RegExp("--exclude ['\"]" + escaped + "['\"]"));
  }

  assert.doesNotMatch(workflow, /--exclude ['\"]assets['\"]/);
  assert.doesNotMatch(workflow, /--exclude ['\"]src['\"]/);
  assert.doesNotMatch(workflow, /--exclude ['\"]api['\"]/);
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

test('scheduled geography health retries transport failure and accepts explicit simulated fallback', () => {
  const workflow = read('.github/workflows/geography-health.yml');
  assert.match(workflow, /for attempt in 1 2/);
  assert.match(workflow, /--max-time 18/);
  assert.match(workflow, /sleep 2/);
  assert.match(workflow, /GEOGRAPHY_HEALTH_ATTEMPTS=\$attempt/);
  assert.match(workflow, /within two 18-second attempts/);
  assert.match(workflow, /const degraded = payload\.degraded === true/);
  assert.match(workflow, /payload\.fallback !== "simulated"/);
  assert.match(workflow, /successful\.length/);
  assert.match(workflow, /Gameplay impact:/);
});

test('scheduled geography health preserves structured upstream diagnostics on sustained failure', () => {
  const workflow = read('.github/workflows/geography-health.yml');
  assert.match(workflow, /GEOGRAPHY_FAILURE_RESPONSE/);
  assert.match(workflow, /Geography Production failure/);
  assert.match(workflow, /JSON\.parse\(fs\.readFileSync\(responsePath, "utf8"\)\)/);
  assert.match(workflow, /Array\.isArray\(payload\.attempts\)/);
  assert.match(workflow, /attempt\.failureKind/);
  assert.match(workflow, /Structured upstream diagnostics: unavailable/);
  assert.match(workflow, /fs\.appendFileSync\(process\.env\.GITHUB_STEP_SUMMARY/);
});