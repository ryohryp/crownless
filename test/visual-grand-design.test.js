import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = JSON.parse(await readFile(new URL('../.visual-director/manifest.json', import.meta.url), 'utf8'));
const grandDesign = JSON.parse(await readFile(new URL('../.visual-director/grand-design.json', import.meta.url), 'utf8'));
const compiledCanon = JSON.parse(await readFile(new URL('../.visual-director/compiled-canon.json', import.meta.url), 'utf8'));

test('exploration location visuals are explicit subjectless Grand Design assets', () => {
  assert.equal(manifest.documents.grandDesign, '.visual-director/grand-design.json');
  assert.equal(grandDesign.project_id, 'crownless');
  assert.equal(grandDesign.asset_types.background.source_reference_required, false);
  assert.equal(grandDesign.asset_types.background.composition.primary_aspect_ratio, '16:9');
  assert.equal(grandDesign.asset_types.background.composition.baked_ui_or_text, false);
  assert.ok(grandDesign.fixed_avoid.includes('photorealism'));
  assert.ok(grandDesign.fixed_avoid.some((term) => term.includes('painterly')));
  assert.ok(grandDesign.asset_types.background.forbidden.some((rule) => rule.includes('rejected or unrelated')));
});

test('compiled Canon exposes the subjectless background policy', () => {
  assert.deepEqual(compiledCanon.asset_type_rules.background, {
    must_not_chain_from_candidate: true,
    must_review_after_generation: true,
    must_use_approved_anchor: false,
  });
  assert.equal(compiledCanon.grand_design.asset_types.background.source_reference_required, false);
  assert.match(compiledCanon.source_revision, /^[a-f0-9]{64}$/);
  assert.equal(manifest.documents.globalReference, 'docs/assets/player-unarmed-approved-compact-anchor-v1.png', 'use the newly selected compact design, never silently reuse the rejected older design');
  assert.deepEqual(Object.keys(manifest.subjects).sort(), ['player-unarmed','player-unarmed-compact','player-unarmed-pixel'], 'keep prior approved variants as provenance beside the selected compact design');
  assert.equal(compiledCanon.global_reference_path, manifest.documents.globalReference);
  assert.match(compiledCanon.global_style_lock, /Japanese sumi-e.*washi/i);
  assert.deepEqual(compiledCanon.grand_design, grandDesign);
  assert.equal(grandDesign.shared_rules.never_use_historical_board_as_current_global_reference, true);
});

test('approved pixel anchor is byte-identical to the still presented to the user',async()=>{
  const approved=await readFile(new URL('../docs/assets/player-unarmed-approved-pixel-anchor-v1.png',import.meta.url));
  const presented=await readFile(new URL('../docs/assets/candidates/hero-still-v1/hero-review.png',import.meta.url));
  assert(approved.equals(presented),'approval must not silently substitute a different generation');
  assert((await readFile(new URL('../docs/assets/player-unarmed-approved-anchor-v0.4.png',import.meta.url))).length>0,'historical identity source remains preserved');
});

test('new compact design acceptance preserves the exact image the human selected',async()=>{
  const approved=await readFile(new URL('../docs/assets/player-unarmed-approved-compact-anchor-v1.png',import.meta.url));
  const presented=await readFile(new URL('../docs/assets/candidates/compact-hero-v1/attempt-1.png',import.meta.url));
  const preview=await readFile(new URL('../assets/action-forest/hero-compact-candidate-v1.png',import.meta.url));
  assert(approved.equals(presented));assert(preview.equals(approved));
});
