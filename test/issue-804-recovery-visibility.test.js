const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/slice-app.js', 'utf8');

test('defeat report exposes the existing rescue-cache recovery hook', () => {
  assert.match(app, /CrownlessRescueCache\?\.cacheFromReport/);
  assert.match(app, /敗走跡に/);
  assert.match(app, /次に同じ土地へ出れば/);
  assert.match(app, /敗走跡を回収する準備へ/);
});
