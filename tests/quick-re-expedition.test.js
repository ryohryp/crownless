const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ui = fs.readFileSync('src/quick-re-expedition-ui.js', 'utf8');
const app = fs.readFileSync('src/slice-app.js', 'utf8');
const supplies = fs.readFileSync('src/expedition-supplies-ui.js', 'utf8');
const hunt = fs.readFileSync('src/hunt-target.js', 'utf8');
const html = fs.readFileSync('expedition.html', 'utf8');

test('safe return offers an explicit same-place re-expedition path', () => {
  assert.match(ui, /SAFE RETURN/);
  assert.match(ui, /同じ土地へ、もう一度/);
  assert.match(ui, /data-action=\\?\"depart/);
  assert.match(ui, /continueButton\.click\(\)/);
});

test('quick re-expedition adapter is loaded after the slice app', () => {
  const appIndex = html.indexOf('src/slice-app.js');
  const quick = html.indexOf('src/quick-re-expedition-ui.js');
  assert.ok(appIndex >= 0 && quick > appIndex);
});

test('return-to-gear flow remembers the just-returned place and offers a contextual retry CTA', () => {
  assert.match(app, /lastReturnedPlace = gearStep \? state\.report\.place : null/);
  assert.match(app, /この装備で\$\{retryPlace\.name\}へもう一度/);
  assert.match(app, /\$\{E\.GEAR\[id\]\.name\}を試す \/ 遠征準備へ/);
  assert.match(app, /button\('depart'/);
});

test('gear retry deliberately reuses the normal departure action so preparation choices are preserved', () => {
  assert.match(supplies, /data-action=\\?\"depart/);
  assert.match(hunt, /data-action=\\?\"depart/);
  assert.doesNotMatch(app, /data-action=[\"']redepart/);
  assert.doesNotMatch(app, /action === 'redepart'/);
});

test('reinforcement feedback names the concrete gain and invites the just-returned destination', () => {
  assert.match(app, /function reinforcementResult/);
  assert.match(app, /強撃 \$\{beforeHeavy\} → \$\{afterHeavy\}/);
  assert.match(app, /試してみよう/);
});

test('starting a new expedition consumes the contextual retry prompt', () => {
  assert.match(app, /action === 'depart'[^\n]*lastReturnedPlace = null/);
});
