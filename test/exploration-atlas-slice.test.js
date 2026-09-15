const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '../src/slice-app.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, '../src/slice-engine.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../exploration-atlas.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../expedition.html'), 'utf8');

test('canonical slice renders the map as a fog-of-war exploration gameboard', () => {
  assert.match(app, /class="exploration-atlas"/);
  assert.match(app, /THE UNWRITTEN LANDS/);
  assert.match(app, /atlas-marker .*unknown/);
  assert.match(app, /未知の気配/);
  assert.match(app, /予兆あり/);
  assert.match(app, /SIGN IN THE MIST/);
  assert.match(app, /霧の向こう/);
  assert.match(app, /state\.unlocked\.includes/);
  assert.match(app, /state\.cleared\.includes/);
  assert.match(app, /atlas-shroud/);
  assert.match(app, /known \? 'revealed' : 'unrevealed'/);
  assert.match(app, /data-action="select"/);
  assert.match(app, /移動軌跡は保存しません/);
});

test('map records place memory without adding precise geography to the save model', () => {
  assert.match(app, /この土地の記録/);
  assert.match(app, /を持ち帰った。さらに深層には/);
  assert.doesNotMatch(app, /routeHistory|exact address|google\.maps|mapbox|leaflet/i);
});

test('exploration atlas is phone-sized manuscript UI and loaded by the canonical page', () => {
  assert.match(html, /exploration-atlas\.css/);
  assert.match(css, /\.atlas-field/);
  assert.match(css, /\.atlas-fog/);
  assert.match(css, /\.atlas-shroud\.revealed/);
  assert.match(css, /\.atlas-shroud\.unrevealed/);
  assert.match(css, /\.atlas-marker\.unknown/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /min-height: 54px/);
});


test('unknown places expose sensory teasers without leaking identity or loot', () => {
  assert.match(engine, /teaser: '霧の中に、折れた枝と獣の足跡が続いている。'/);
  assert.match(engine, /teaser: '霧の向こうから、鳴るはずのない鐘の音がする。'/);
  assert.match(engine, /teaser: '水辺の霧の奥で、青い光がゆっくり揺れている。'/);
  assert.match(engine, /teaser: '石の下から、乾いた金属音がかすかに響く。'/);
  assert.match(app, /unlocked \? p\.subtitle : esc\(p\.teaser\)/);
  assert.match(app, /selectedPlace\.teaser/);
  assert.match(app, /known \? status : '予兆あり'/);
  assert.match(css, /\.atlas-memory\.teaser/);
});
