const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '../src/slice-app.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, '../src/slice-engine.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../exploration-atlas.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../expedition.html'), 'utf8');

test('canonical slice projects discovered districts and individual claims without unknown POIs', () => {
  assert.match(app, /class="exploration-atlas neighborhood-atlas"/);
  assert.match(app, /\[\.\.\.n\.districts\]/);
  assert.match(app, /d\.claimed/);
  assert.match(app, /未開拓/);
  assert.match(app, /あなたの領域/);
  assert.match(app, /data-action="district"/);
  assert.doesNotMatch(app, /未知の気配|予兆あり|atlas-marker .*unknown/);
});

test('map records abstract place maturity without adding precise geography to the save model', () => {
  assert.match(app, /state\.neighborhood/);
  assert.match(app, /開拓/);
  assert.doesNotMatch(app, /routeHistory|exact address|google\.maps|mapbox|leaflet/i);
});

test('exploration atlas is phone-sized parchment UI and loaded by the canonical page', () => {
  assert.match(html, /exploration-atlas\.css/);
  assert.match(css, /\.atlas-field/);
  assert.match(css, /\.atlas-fog/);
  assert.match(css, /\.atlas-shroud/);
  assert.match(css, /\.stage-unknown/);
  assert.match(css, /\.stage-surveyed/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test('unknown places retain sensory source copy without exposing it as a POI marker', () => {
  assert.match(engine, /teaser: '霧の中に、折れた枝と獣の足跡が続いている。'/);
  assert.match(engine, /teaser: '霧の向こうから、鳴るはずのない鐘の音がする。'/);
  assert.match(engine, /teaser: '水辺の霧の奥で、青い光がゆっくり揺れている。'/);
  assert.match(engine, /teaser: '石の下から、乾いた金属音がかすかに響く。'/);
  assert.doesNotMatch(app, /予兆あり/);
});
