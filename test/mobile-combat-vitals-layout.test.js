const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/slice-app.js', 'utf8');
const css = fs.readFileSync('slice.css', 'utf8');
const phoneCss = fs.readFileSync('phone-density.css', 'utf8');

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


test('mobile combat keeps the whole turn decision surface in one viewport', () => {
  assert.match(app, /class="combat-enemy-summary"/);
  assert.match(app, /class="choice-grid combat-choice-grid"/);
  assert.match(app, /class="combat-turn-note"/);
  assert.match(app, /class="small combat-bagline"/);
  assert.match(phoneCss, /#game\s*>\s*\.battle-layout\s*\{[\s\S]*?grid-template-rows:\s*minmax\(7\.5rem, 21dvh\)\s+minmax\(0, 1fr\)/);
  assert.match(phoneCss, /\.combat-panel\s*\{[\s\S]*?display:\s*grid[\s\S]*?overflow:\s*hidden/);
  assert.match(phoneCss, /\.combat-choice-grid \.choice\s*\{[\s\S]*?min-height:\s*50px/);
  assert.match(phoneCss, /\.combat-foot\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(phoneCss, /\.combat-turn-note\s*\{[\s\S]*?max-height:\s*2\.25rem[\s\S]*?overflow:\s*hidden/);
});
