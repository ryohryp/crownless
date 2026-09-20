const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../src/safe-pause.js'), 'utf8');
const html = fs.readFileSync(require.resolve('../expedition.html'), 'utf8');

test('safe pause is available only outside combat and restores the current wager summary', () => {
  assert.match(source, /x\.stage === 'fight'/);
  assert.match(source, /未帰還：鉄片/);
  assert.match(source, /装備.*個/);
  assert.match(source, /深層/);
  assert.match(source, /次は、生還するか深層へ進むか/);
});

test('safe pause does not mutate game state or add a timer', () => {
  assert.doesNotMatch(source, /E\.act\(/);
  assert.doesNotMatch(source, /setTimeout|setInterval/);
  assert.match(source, /時間は進まない/);
});

test('safe pause is wired after the main app and has phone-safe styling', () => {
  assert.ok(html.indexOf('src/safe-pause.js') > html.indexOf('src/slice-app.js'));
  assert.match(html, /safe-pause\.css/);
  const css = fs.readFileSync(require.resolve('../safe-pause.css'), 'utf8');
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height: 44px/);
});
