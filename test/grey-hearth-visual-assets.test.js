import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'assets', 'hearth', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

function readPngSize(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('Grey Hearth visual handoff keeps three concepts and a selected direction', async () => {
  assert.equal(manifest.project_id, 'crownless');
  assert.equal(manifest.status, 'candidate');
  assert.equal(manifest.approval.approved_visual_anchor, false);
  assert.equal(manifest.selected_concept, 'concepts/grey-hearth-b-gate-centered.png');
  assert.equal(manifest.concepts.length, 3);
  assert.equal(manifest.approval.approved_for_grey_hearth_runtime, true);
  assert.equal(manifest.policy.must_not_chain_from_candidate, true);
  assert.equal(manifest.policy.must_review_after_generation, true);

  for (const relativePath of [...manifest.concepts, ...manifest.supporting_candidates]) {
    const bytes = await readFile(join(root, 'assets', 'hearth', relativePath));
    const size = readPngSize(bytes);
    assert.deepEqual(size, { width: 1280, height: 720 });
    assert.ok(bytes.length > 1000, `${relativePath} should contain a real image`);
  }
});

test('Grey Hearth avatar baseline remains the valid unarmed player source', async () => {
  const avatar = await readFile(join(root, 'assets', 'hearth', manifest.avatar_baseline));
  assert.deepEqual([...avatar.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(avatar.length > 1000);
});
