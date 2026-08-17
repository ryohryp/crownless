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

test('GitHub Pages publishes only after successful main CI', () => {
  const workflow = read('.github/workflows/pages.yml');

  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows:\s*\["test"\]/);
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.doesNotMatch(workflow, /enablement:\s*true/);
});

test('Vercel Production deploy remains manual, main-only, and prebuilt', () => {
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
});
