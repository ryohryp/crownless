const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');

test('normal departure immediately opens the path and advances to first combat', () => {
  const s={...E.initial(),mode:'demo'};
  const departed=E.start(s,'wood');
  assert.equal(departed.expedition?.stage,'path');
  assert.equal(departed.expedition.room,0);
  assert.deepEqual(E.parse(E.serialize(departed)),departed);
  const fighting=E.act(departed,'careful');
  assert.equal(fighting.expedition.stage,'fight');
  assert.equal(fighting.expedition.enemy.kind,'wolf');
  assert.deepEqual(E.parse(E.serialize(fighting)),fighting);
});

test('the mobile runtime cannot intercept departure with an invisible mandatory supplies chooser', () => {
  const html=fs.readFileSync('expedition.html','utf8');
  assert.doesNotMatch(html,/src\/expedition-supplies-ui\.js/);
  assert.doesNotMatch(html,/src\/expedition-supplies\.js/);
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/action === 'depart'[\s\S]*?E\.start\(state,value\)/);
  const n=N.initial();
  assert.equal(N.pointOfInterest(N.get(n)).family,'event');
});
