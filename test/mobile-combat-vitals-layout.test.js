const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/slice-app.js', 'utf8');
const css = fs.readFileSync('slice.css', 'utf8');

test('mobile combat renders player vitals with the action panel', () => {
  assert.match(app, /<div class="combat-vitals">\$\{vitals\(x\)\}<\/div><p class="kicker">/);
  assert.match(css, /\.combat-vitals\{display:none\}/);
  assert.match(css, /@media\(max-width:620px\)[\s\S]*?\.battle-layout \.visual-column>\.vitals\{display:none\}/);
  assert.match(css, /\.battle-layout \.combat-vitals\{display:block;position:sticky;top:0/);
});

test('open help no longer survives a game render', () => {
  assert.match(app, /if \(help && !help\.hidden\) \{ help\.hidden = true; helpToggle\?\.setAttribute\('aria-expanded', 'false'\); \}/);
  assert.match(css, /#help:not\(\[hidden\]\)\{position:fixed/);
});
