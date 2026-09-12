const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const presentationPath = path.join(root, 'src', 'region-mission-map-presentation.js');

test('revealed regional target is a schematic map marker that points combat back to Grey Hearth', () => {
  const source = fs.readFileSync(presentationPath, 'utf8');

  assert.match(source, /getRegionMissionBoard/);
  assert.match(source, /region-mission-map-point/);
  assert.match(source, /攻略は灰炉で/);
  assert.match(source, /marker\.style\.left = "76%"/);
  assert.match(source, /marker\.style\.top = "31%"/);
  assert.doesNotMatch(source, /getCurrentPosition|latitude|longitude|coordinates|representativeCoordinate|mapOrigin/);
});

test('regional mission map presentation is valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', presentationPath]);
});
