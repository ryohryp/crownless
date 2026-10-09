const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('phone-density.css', 'utf8');
const app = fs.readFileSync('src/slice-app.js', 'utf8');

test('optional manual combat can scroll inside a short phone scene without clipping retreat', () => {
  const mobile = css.slice(css.indexOf('/* #602 mobile combat follow-up'));
  assert.match(mobile, /\.combat-panel\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(mobile, /\.combat-panel:has\(\.combat-manual\[open\]\)\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain/);
  assert.match(app, /<div class="combat-fast-choice">\$\{button\('auto-fight'/);
  assert.match(app, /<details class="combat-manual"><summary>一手ずつ戦う（任意）<\/summary>/);
  assert.match(app, /<\/details>\$\{combatNote\}<div class="combat-foot">[\s\S]*?button\('flee'/,
    'retreat remains outside optional manual controls');
});
