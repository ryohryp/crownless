const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const rendererPath = path.join(root, 'src', 'combat-manuscript-render.js');
const compatibilityPath = path.join(root, 'src', 'combat-shadow-contact.js');
const renderer = fs.readFileSync(rendererPath, 'utf8');
const compatibility = fs.readFileSync(compatibilityPath, 'utf8');

test('actor shadow contact is owned directly by the manuscript renderer', () => {
  assert.match(renderer, /function drawGroundShadow\(target, footY\)/);
  assert.match(renderer, /target\.ellipse\(0, footY - 30, 16, 5\.5/);
});

test('legacy contact shim no longer patches CanvasRenderingContext2D', () => {
  assert.doesNotMatch(compatibility, /CanvasRenderingContext2D\.prototype\.ellipse/);
  assert.doesNotMatch(compatibility, /CONTACT_LIFT/);
});

test('shadow renderer and compatibility shim are valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', rendererPath]);
  execFileSync(process.execPath, ['--check', compatibilityPath]);
});
