const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/desperate-push.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../expedition.html'), 'utf8');

test('desperate push is wired before the app consumes actions', () => {
  assert.ok(html.indexOf('src/desperate-push.js') > -1);
  assert.ok(html.indexOf('src/desperate-push.js') < html.indexOf('src/slice-app.js'));
});

test('desperate push is only offered after a clear, below one-third HP, before max depth', () => {
  assert.match(source, /x\.stage === 'cleared'/);
  assert.match(source, /x\.depth < 3/);
  assert.match(source, /Math\.ceil\(E\.maxHp\(state\) \/ 3\)/);
});

test('desperate push has a concrete cost and does not replace normal deeper', () => {
  assert.match(source, /x\.potions = 0/);
  assert.match(source, /action !== 'desperate'.*originalAct/s);
  assert.match(source, /深層の戦利品を狙う/);
  assert.match(source, /残りの薬草を置いていく/);
});
