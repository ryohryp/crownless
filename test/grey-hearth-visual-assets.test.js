import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

test('Grey Hearth visual handoff keeps the selected empty-room Approved Visual Anchor and prior directions', async () => {
  assert.equal(manifest.project_id, 'crownless');
  assert.equal(manifest.status, 'approved');
  assert.equal(manifest.approval.approved_visual_anchor, true);
  assert.equal(manifest.selected_concept, 'concepts/grey-hearth-empty-room-v0.2.png');
  assert.equal(manifest.previous_selected_concept, 'concepts/grey-hearth-b-gate-centered.png');
  assert.equal(manifest.concepts.length, 4);
  assert.equal(manifest.approval.approved_for_grey_hearth_runtime, true);
  assert.equal(manifest.policy.must_not_chain_from_candidate, true);
  assert.equal(manifest.policy.must_review_after_generation, true);
  const approvalManifest = JSON.parse(await readFile(join(root, 'assets', 'hearth', manifest.approval.approved_candidate_manifest), 'utf8'));
  assert.equal(approvalManifest.status, 'approved_candidate');
  assert.equal(approvalManifest.source.path, join('assets', 'hearth', manifest.selected_concept).replaceAll('\\', '/'));
  assert.equal(approvalManifest.source.sha256, 'db8ad9f47fcdf818ac902710d092857a690a79e7e0ccbf84cf99f682d8207856');
  assert.deepEqual(approvalManifest.source.dimensions, [1672, 941]);

  for (const relativePath of [...manifest.concepts, ...manifest.supporting_candidates]) {
    const bytes = await readFile(join(root, 'assets', 'hearth', relativePath));
    const size = readPngSize(bytes);
    assert.ok(Math.abs(size.width / size.height - 16 / 9) < 0.01);
    assert.ok(bytes.length > 1000, `${relativePath} should contain a real image`);
  }
});

test('Grey Hearth avatar baseline remains the valid unarmed player source', async () => {
  const avatar = await readFile(join(root, 'assets', 'hearth', manifest.avatar_baseline));
  assert.deepEqual([...avatar.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(avatar.length > 1000);
});

test('approved Grey Hearth avatar stays separate from the combat source and Canon Anchor', async () => {
  assert.equal(manifest.avatar_runtime_status, 'approved');
  assert.equal(manifest.avatar_runtime_approval.approved_by, 'user');
  assert.equal(manifest.avatar_runtime_anchor, '../../docs/assets/player-unarmed-approved-anchor-v0.4.png');
  assert.equal(manifest.avatar_runtime_policy.global_character_canon_changed, false);

  const runtimeAvatar = await readFile(join(root, 'assets', 'hearth', manifest.avatar_runtime_candidate));
  assert.deepEqual(readPngSize(runtimeAvatar), { width: 1024, height: 1536 });
  assert.equal(createHash('sha256').update(runtimeAvatar).digest('hex'), manifest.avatar_runtime_approval.sha256);
  assert.notEqual(manifest.avatar_runtime_candidate, manifest.avatar_baseline);
});

test('Issue 166 runtime background is the approved 16:9 PNG without a baked runtime layer', async () => {
  assert.equal(manifest.runtime_candidate, 'concepts/grey-hearth-empty-room-v0.2.png');
  const bytes = await readFile(join(root, 'assets', 'hearth', manifest.runtime_candidate));
  const size = readPngSize(bytes);
  assert.ok(Math.abs(size.width / size.height - 16 / 9) < 0.01);
  assert.ok(bytes.length > 1000);
});
