'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/slice-engine.js');

const fresh = () => ({ ...E.initial(), mode: 'demo' });

test('combat log generates tangible feedback when sharpened maintenance connects', () => {
  let s = { ...fresh(), maintenance: 'sharp' };
  s = E.start(s, 'wood');
  s = E.act(s, 'careful');
  assert.equal(s.expedition.stage, 'fight');
  s = E.act(s, 'strike');
  assert.ok(s.expedition.log.some(line => line.includes('研ぎ澄まされた刃が走る！')));
});

test('combat log generates tangible feedback when reinforced heavy attack connects', () => {
  let s = fresh();
  s.upgrades.rust = 2; // heavyBonus is 4 + 2 = 6 (> 4)
  s = E.start(s, 'wood');
  s = E.act(s, 'careful');
  assert.equal(s.expedition.stage, 'fight');
  s = E.act(s, 'heavy');
  assert.ok(s.expedition.log.some(line => line.includes('補強の重み！')));
});

test('slice-app source exposes reinforcement level and power preview in gearPanel and combat', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '../src/slice-app.js'), 'utf8');

  // gearPanel exposes nextPower preview before upgrading
  assert.match(appSrc, /powerPreview/);
  assert.match(appSrc, /reinforcement-preview/);

  // camp stat-strip displays reinforcement level
  assert.match(appSrc, /補強 \$\{level\}\/4/);

  // fight screen displays reinforcement in kicker header
  assert.match(appSrc, /level > 0 \? ` · 補強 \+\$\{level\}` : ''/);

  // fight action buttons expose reinforcement annotation
  assert.match(appSrc, /strongHelp/);
  assert.match(appSrc, /guardHelp/);
  assert.match(appSrc, /strikeHelp/);
});
