const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '../living-map-home.css'), 'utf8');

test('desktop living-map home uses the phone-preview composition', () => {
  assert.match(css, /@media\(min-width:481px\)/);
  assert.match(css, /#game>\.living-map-home\{[^}]*width:min\(430px,100%\)/);
  assert.match(css, /\.visual-column>\.mode-strip,[^\n]*\.visual-column>\.scene,[^\n]*\.visual-column>\.stat-strip\{display:none\}/);
  assert.match(css, /\.exploration-atlas\{[^}]*height:100%/);
});
