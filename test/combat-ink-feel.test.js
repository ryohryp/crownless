const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const feelPath = path.join(root, 'src', 'combat-ink-feel-v3.js');
const tuningPath = path.join(root, 'src', 'combat-feel-tuning.js');
const feel = fs.readFileSync(feelPath, 'utf8');
const tuning = fs.readFileSync(tuningPath, 'utf8');

test('combat feel layer is loaded before render wrappers and arms after manuscript install', () => {
  assert.match(tuning, /combat-ink-feel-v3\.js/);
  assert.match(feel, /combat-manuscript-render\\\.js/);
  assert.match(feel, /MutationObserver/);
  assert.match(feel, /addEventListener\("load", install/);
});

test('ink sheet keeps authored slash impact recoil meanings', () => {
  assert.match(feel, /drawSlice\(t, 0, slash\.box, slash\.alpha\)/);
  assert.match(feel, /drawSlice\(t, 2, b\.back, \.42\)/);
  assert.match(feel, /drawSlice\(t, 1, b\.hit,/);
  assert.match(feel, /#e8d8b7/);
  assert.match(feel, /#ffd875/);
  assert.match(feel, /#f2c96f/);
});

test('enemy hit flash adds physical impact while telegraph alpha retains urgency', () => {
  assert.match(feel, /#f0b28c/);
  assert.match(feel, /function warningAlpha/);
  assert.match(feel, /t\.globalAlpha = old \* warning/);
  assert.doesNotMatch(feel, /enemy\.hp\s*=/);
  assert.doesNotMatch(feel, /hitStop\s*=/);
});

test('combat feel scripts remain valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', feelPath]);
  execFileSync(process.execPath, ['--check', tuningPath]);
});
