import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const agents = await readFile(new URL('../AGENTS.md', import.meta.url), 'utf8');
const skill = await readFile(new URL('../skills/crownless-visual-design/SKILL.md', import.meta.url), 'utf8');
const handoff = await readFile(new URL('../docs/visual/IMAGE_GENERATION_HANDOFF.md', import.meta.url), 'utf8');

test('production image generation requires an asset-only preflight', () => {
  assert.match(agents, /IMAGE_GENERATION_HANDOFF\.md/);
  assert.match(skill, /asset-only handoff/i);
  assert.match(skill, /meta-output/i);
  assert.match(handoff, /Issue numbers, PRs, task status, progress percentages, dashboards, reports/i);
  assert.match(handoff, /not a Candidate/i);
});

test('meta-output retries rebuild from Canon instead of reusing contaminated context', () => {
  assert.match(handoff, /Do not blindly retry the same contaminated request/i);
  assert.match(handoff, /Rebuild the handoff from the repository Canon/i);
  assert.match(handoff, /must_not_chain_from_candidate/);
  assert.match(handoff, /repeats twice, stop generation/i);
});
