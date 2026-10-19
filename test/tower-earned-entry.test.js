'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../src/tower-field.js');

test('tower secret has a local earned-entry action and never becomes ordinary navigation', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/slice-app.js'), 'utf8');
  assert.match(app, /const echoChoice=x\.tower\?\.pos===window\.CrownlessTowerField\?\.ECHO/);
  assert.match(app, /x\.tower\.open\?'見つけた隠し階段へ進む':'鐘の反響を確かめる'/);
  assert.match(app, /value:String\(window\.CrownlessTowerField\.SECRET\),class:'tower-echo-investigate'/);
  assert.match(app, /kind!=='secret'&&!guardianThreat\?'walk-nav':''/);

  let field = T.initial();
  for (const id of [21, 22, T.ECHO]) field = T.move(field, id);
  assert.equal(T.canMove(field, T.SECRET), false, 'the stair cannot be entered before investigation');
  const opened = T.uncover(field, T.SECRET);
  assert.equal(opened.open, true);
  assert.equal(T.canMove(opened, T.SECRET), true, 'the stair opens from the echo floor');
  const restored = JSON.parse(JSON.stringify(opened));
  assert.equal(T.canMove(restored, T.SECRET), true, 'current save keeps the earned entry');
  assert.equal(T.move(restored, T.SECRET).pos, T.SECRET);
  assert.equal(T.canMove(T.move(restored, 22), T.SECRET), false,
    'the earned stair cannot be entered from another floor');
});
