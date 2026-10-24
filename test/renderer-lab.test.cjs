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
