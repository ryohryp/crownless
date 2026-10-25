const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

const game = import(pathToFileURL(resolve(__dirname, '../experiments/renderer-lab/src/gameplay.js')).href);

test('renderer spike is reversible and contains a full two-expedition return-and-craft slice', async () => {
  const { createState, pointTo, step, interact, fight, returnAlive, craft, depart, nearestSite } = await game;
  const state = createState();
  assert.equal(state.equipped, false);
  pointTo(state, 260);
  for (let i = 0; i < 90; i++) step(state, 0, 40);
  assert.equal(nearestSite(state)?.id, 'herbs');
  assert.equal(interact(state), true);
  assert.equal(state.heldHerbs, 1);
  pointTo(state, 535);
  for (let i = 0; i < 90; i++) step(state, 0, 40);
  assert.equal(interact(state), true);
  assert.equal(state.mode, 'encounter');
  assert.equal(fight(state, 'guard'), true);
  assert.equal(state.heldIron, 1);
  pointTo(state, 98);
  for (let i = 0; i < 160; i++) step(state, 0, 40);
  assert.equal(returnAlive(state), true);
  assert.equal(state.mode, 'camp');
  assert.equal(state.herbs, 1); assert.equal(state.iron, 1);
  assert.equal(craft(state), true); assert.equal(state.equipped, true);
  assert.equal(depart(state), true); assert.equal(state.run, 2);
  pointTo(state, 850);
  for (let i = 0; i < 170; i++) step(state, 0, 40);
  assert.equal(interact(state), false, 'the guardian must be cleared each run');
  pointTo(state, 535);
  for (let i = 0; i < 90; i++) step(state, 0, 40);
  assert.equal(interact(state), true);
  assert.equal(fight(state, 'strike'), true);
  assert.equal(state.hp, 3, 'crafted sword reduces the strong-attack damage');
  pointTo(state, 850);
  for (let i = 0; i < 100; i++) step(state, 0, 40);
  assert.equal(interact(state), true);
  assert.equal(state.heldRelic, 1);
  pointTo(state, 98);
  for (let i = 0; i < 180; i++) step(state, 0, 40);
  assert.equal(returnAlive(state), true);
  assert.equal(state.relics, 1);
});

test('renderer spike respects bounded movement and loses only unbanked loot on defeat', async () => {
  const { createState, step, fight, interact } = await game;
  const state = createState();
  for (let i = 0; i < 500; i++) step(state, -1, 60);
  assert.equal(state.x, 58);
  state.x = 260; interact(state);
  state.x = 535; interact(state);
  state.hp = 1;
  fight(state, 'strike');
  assert.equal(state.mode, 'camp'); assert.equal(state.heldHerbs, 0);
  assert.equal(state.herbs, 0); assert.equal(state.equipped, false);
});

test('Pixi-only FX toggles reversibly and emits gathering feedback without changing gameplay', () => {
  const { readFileSync } = require('node:fs');
  const vm = require('node:vm');
  const root = resolve(__dirname, '../experiments/renderer-lab');
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const pixiBundle = readFileSync(resolve(root, 'dist/pixi.js'), 'utf8');
  assert.match(html, /src="effects\.js"/);
  assert.match(pixiBundle, /__rendererLabAttachEffects/);
  class Graphics {
    constructor() { this.visible = true; this.x = 0; }
    clear() { return this; }
    circle() { return this; }
    ellipse() { return this; }
    poly() { return this; }
    roundRect() { return this; }
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
  }
  class Container {
    constructor() { this.children = []; this.visible = true; this.x = 0; }
    addChild(...children) { this.children.push(...children); return children[0]; }
    addChildAt(child, index) { this.children.splice(index, 0, child); return child; }
  }
  const button = { hidden: true, attributes: {}, events: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(name, handler) { this.events[name] = handler; },
    click() { this.events.click(); } };
  const window = {};
  const document = { getElementById: id => id === 'fx-toggle' ? button : null };
  vm.runInNewContext(readFileSync(resolve(root, 'effects.js'), 'utf8'), { window, document });
  const state = { mode: 'exploring', x: 98, equipped: false,
    heldHerbs: 0, heldIron: 0, heldRelic: 0, guardianDefeated: false, shrineOpened: false };
  const stage = new Container(), world = new Container(), ticks = [];
  stage.addChild(new Graphics(), world);
  window.__rendererLabAttachEffects({
    app: { stage, screen: { width: 390, height: 520 }, ticker: { add: fn => ticks.push(fn) } },
    world, Graphics, Container, controller: { state }
  });
  ticks[0]({ deltaMS: 32 });
  assert.equal(window.__rendererLabEffectsReady, true);
  assert.equal(button.hidden, false);
  assert.equal(window.__rendererLabEffectsDebug.enabled, true);
  button.click();
  ticks[0]({ deltaMS: 32 });
  assert.equal(window.__rendererLabEffectsDebug.enabled, false);
  assert.equal(button.attributes['aria-pressed'], 'false');
  button.click();
  state.x = 260;
  state.heldHerbs = 1;
  ticks[0]({ deltaMS: 32 });
  assert.equal(window.__rendererLabEffectsDebug.enabled, true);
  assert.equal(window.__rendererLabEffectsDebug.particleCount, 17);
  assert.equal(state.heldHerbs, 1);
  assert.equal(button.attributes['aria-pressed'], 'true');
});
