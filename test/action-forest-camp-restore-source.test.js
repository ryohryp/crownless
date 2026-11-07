// Guard the camp reload entry point until the browser flow is exercised in CI.
// This is a source-level regression check, not a substitute for a mobile playtest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../gemini-feel-lab.html', import.meta.url), 'utf8');

test('restored camp reopens the RPG actions after stage initialization', () => {
  const onload = html.match(/window\.onload\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n  \};/);
  assert.ok(onload, 'game initialization must remain present');
  const body = onload[1];
  const init = body.indexOf('initStage()');
  const restore = body.indexOf("if (rpg.phase === 'camp') showRpgPanel()");
  assert.ok(init >= 0, 'stage initializes');
  assert.ok(restore > init, 'camp UI restores after stage initialization');
});

test('camp panel and departure action remain reachable', () => {
  assert.match(html, /const camp = rpg\.phase === 'camp';/);
  assert.match(html, /panel\.classList\.toggle\('hidden', !\(result \|\| camp\)\)/);
  assert.match(html, /getElementById\('rpgDepart'\)\.addEventListener\('click'/);
  assert.match(html, /if \(!rpgRules\.depart\(rpg\)\) return;/);
});
