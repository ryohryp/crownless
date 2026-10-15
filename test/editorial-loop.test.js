const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('editorial control layer is loaded after existing fantasy field styles', () => {
  const html = read('expedition.html');
  assert.match(html, /href="editorial-loop\.css"/);
  assert.ok(html.indexOf('href="editorial-loop.css"') > html.indexOf('href="expedition-field.css"'));
  const css = read('editorial-loop.css');
  assert.match(css, /\.editorial-return-loop/);
  assert.match(css, /\.editorial-forge-cue/);
  assert.match(css, /\[data-action="return"\]/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /safe-return action finishes/);
});

test('return guidance distinguishes secured goods, missing ingredients, and loss', () => {
  const app = read('src/slice-app.js');
  assert.match(app, /const returnLoop = r\.died/);
  assert.match(app, /aria-label="敗走後の次の行動"/);
  assert.match(app, /aria-label="生還から次の遠征まで"/);
  assert.match(app, /readyToCraft \? '製作可能' : '製作準備'/);
  assert.match(app, /持ち帰れなかった素材は製作に使えません/);
  assert.match(app, /\$\{returnLoop\}<div class='result-number'>/);
});

test('real crafting and expedition actions remain the only source of progression', () => {
  const app = read('src/slice-app.js');
  assert.match(app, /const forgeCue = state\.activeCharacter !== 1/);
  assert.match(app, /Object\.keys\(E\.RECIPES\)\.some\(id => canCraft\(state,id\)\)/);
  assert.match(app, /鍛冶師へ交代すると武具を製作できます/);
  assert.match(app, /action === 'craft-item'/);
  assert.match(app, /state = E\.craftItem\(state,recipeId\)/);
  assert.match(app, /state = E\.act\(state, action\)/);
  assert.match(app, /navigator\.geolocation\.getCurrentPosition/);
});
