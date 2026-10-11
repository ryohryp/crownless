const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/slice-app.js', 'utf8');
const css = fs.readFileSync('slice.css', 'utf8');
const phoneCss = fs.readFileSync('phone-density.css', 'utf8');
const rebuiltCss = fs.readFileSync('combat-decision-scene.css', 'utf8');

test('mobile combat renders player vitals with the action panel', () => {
  assert.match(app, /<section class="combat-situation"><div class="combat-enemy-summary">/);
  assert.match(app, /<div class="combat-vitals">\$\{vitals\(x\)\}<\/div><div class="intent"/);
  assert.match(rebuiltCss, /combat-situation \.combat-vitals/);
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
  assert.match(rebuiltCss, /\.battle-layout\.game-layout \{[\s\S]*?grid-template-rows:minmax\(108px,20dvh\) minmax\(0,1fr\)/);
  assert.match(rebuiltCss, /\.combat-panel \{[\s\S]*?display:grid[\s\S]*?overflow:hidden/);
  assert.match(rebuiltCss, /\.combat-choice-grid \.choice\{min-height:58px\}/);
  assert.match(rebuiltCss, /\.combat-support \.combat-foot \{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(app, /class="combat-support"><summary>薬草・撤退・戦闘記録/);
  assert.match(rebuiltCss, /\.combat-panel:has\(\.combat-support\[open\]\) > \.combat-decision/);
});
