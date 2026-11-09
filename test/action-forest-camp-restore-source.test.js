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
  const restore = body.indexOf('showRpgPanel()');
  assert.ok(init >= 0, 'stage initializes');
  assert.ok(restore > init, 'camp UI restores after stage initialization');
});

test('camp panel and departure action remain reachable', () => {
  assert.match(html, /const camp = rpg\.phase === 'camp';/);
  assert.match(html, /panel\.classList\.toggle\('hidden', !\(result \|\| camp\)\)/);
  assert.match(html, /getElementById\('rpgDepart'\)\.addEventListener\('click'/);
  assert.match(html, /if \(!rpgRules\.depart\(rpg\)\) return;/);
});

test('camp reload preserves an earned exploration teaser without exposing a hidden route', () => {
  const panelStart = html.indexOf('  function showRpgPanel()');
  const panelEnd = html.indexOf("  document.getElementById('rpgOpenResults')", panelStart);
  assert.ok(panelStart >= 0 && panelEnd > panelStart);
  const panel = html.slice(panelStart, panelEnd);
  assert.match(panel, /const unexploredCue=\(result \|\| \(camp && state\.forestFinds\.has\('traces'\)\)\)\?forestReturnTeaser\(state\.forestFinds,rpg\.crafted\):'';/,
    'camp must not reveal an unearned trail clue before traces are discovered');
  assert.match(panel, /\(camp && unexploredCue \? ' '\+unexploredCue : ''\)/,
    'the teaser must remain visible in camp info, not only in a hidden return action');
  assert.match(panel, /depart\.textContent=forestRevisitAction\(state\.forestFinds\);/,
    'departure is still a deliberate player action, not automatic discovery');
  assert.doesNotMatch(panel, /(?:depart|unexploredCue)\.dataset\.(?:x|z|target)/,
    'the teaser must not create a route marker for an undiscovered site');
});
