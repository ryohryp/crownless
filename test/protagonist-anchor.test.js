const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const anchorPath = path.join(root, 'assets', 'combat', 'minimal-v0.1', 'actors', 'player-unarmed-approved-anchor-v0.4.png');
const approvalCopyPath = path.join(root, 'docs', 'assets', 'player-unarmed-approved-anchor-v0.4.png');
const manifestPath = path.join(root, 'docs', 'assets', 'player-unarmed-approved-anchor-v0.4.json');
const canonPath = path.join(root, 'docs', 'visual', 'CHARACTER_VISUAL_CANON.md');
const compiledCanonPath = path.join(root, '.visual-director', 'compiled-canon.json');

test('protagonist Anchor is a readable approved PNG and matches its integrity record', () => {
  const bytes = fs.readFileSync(anchorPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes.readUInt32BE(16), 1024);
  assert.equal(bytes.readUInt32BE(20), 1536);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.source.sha256);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(approvalCopyPath)).digest('hex'), manifest.source.sha256);
  assert.deepEqual(manifest.source.dimensions, [1024, 1536]);
  assert.equal(manifest.status, 'approved_candidate');
  assert.equal(manifest.approval.approved_by, 'user');
});

test('Visual Director and character Canon point at the replacement protagonist Anchor', () => {
  const canon = fs.readFileSync(canonPath, 'utf8');
  const compiled = JSON.parse(fs.readFileSync(compiledCanonPath, 'utf8'));

  assert.match(canon, /player-unarmed-approved-anchor-v0\.4\.png/);
  assert.doesNotMatch(canon, /player-unarmed-approved-anchor-v0\.2\.webp/);
  assert.equal(
    compiled.subjects.find((subject) => subject.subject_id === 'player-unarmed').approved_anchor_path,
    'assets/combat/minimal-v0.1/actors/player-unarmed-approved-anchor-v0.4.png'
  );
  assert.doesNotMatch(JSON.stringify(compiled), /player-unarmed-approved-anchor-v0\.2\.webp/);
});
