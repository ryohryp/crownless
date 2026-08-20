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
  assert.ok(grandDesign.fixed_avoid.includes('painterly rendering'));
  assert.ok(grandDesign.asset_types.background.forbidden.some((rule) => rule.includes('rejected or unrelated generated candidate')));
});

test('compiled Canon exposes the subjectless background policy', () => {
  assert.deepEqual(compiledCanon.asset_type_rules.background, {
    must_not_chain_from_candidate: true,
    must_review_after_generation: true,
    must_use_approved_anchor: false,
  });
  assert.equal(compiledCanon.grand_design.asset_types.background.source_reference_required, false);
  assert.match(compiledCanon.source_revision, /^[a-f0-9]{64}$/);
  assert.equal(compiledCanon.global_reference_path, 'docs/assets/crownless-visual-design-reference-v0.1.jpg');
});
