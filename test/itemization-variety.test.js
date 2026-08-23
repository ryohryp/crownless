const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/game-core.js");

function neutralModifier() {
  return { id: "neutral", name: "", tag: "", description: "", effect: {} };
}

function itemFromBase(base, overrides = {}) {
  return {
    id: overrides.id || `test-${base.baseId}`,
    itemKind: "ordinary",
    baseId: base.baseId,
    baseName: base.name,
    type: base.type,
    style: base.style,
    styleLabel: base.styleLabel,
    playstyle: base.playstyle,
    name: base.name,
    rarity: "uncommon",
    power: overrides.power == null ? 8 : overrides.power,
    description: base.description,
    baseCombat: { ...(base.baseCombat || {}) },
    regionTags: [...(base.regionTags || [])],
    modifier: overrides.modifier || neutralModifier(),
    ...overrides
  };
}

test("ordinary equipment has four bases for each existing combat family", () => {
  assert.equal(Core.ITEM_BASES.length, 12);
  assert.equal(new Set(Core.ITEM_BASES.map((base) => base.baseId)).size, 12);

  const counts = Core.ITEM_BASES.reduce((result, base) => {
    result[base.type] = (result[base.type] || 0) + 1;
    return result;
  }, {});

  assert.deepEqual(counts, { handwraps: 4, dagger: 4, sword: 4 });
  assert.ok(Core.ITEM_BASES.every((base) => Array.isArray(base.regionTags) && base.regionTags.length > 0));
});

test("modifier pool expands while preserving style and type compatibility", () => {
  assert.equal(Core.MODIFIERS.length, 10);
  const fists = Core.ITEM_BASES.find((base) => base.baseId === "grave-wraps");
  const sword = Core.ITEM_BASES.find((base) => base.baseId === "chipped-arming-sword");
  const knuckleSaint = Core.MODIFIERS.find((modifier) => modifier.id === "knuckle-saint");
  const turningEdge = Core.MODIFIERS.find((modifier) => modifier.id === "turning-edge");
  const oneBreath = Core.MODIFIERS.find((modifier) => modifier.id === "one-breath");

  assert.equal(Core.isModifierCompatible(knuckleSaint, fists), true);
  assert.equal(Core.isModifierCompatible(knuckleSaint, sword), false);
  assert.equal(Core.isModifierCompatible(turningEdge, fists), false);
  assert.equal(Core.isModifierCompatible(turningEdge, sword), true);
  assert.equal(Core.isModifierCompatible(oneBreath, sword), false);
});

test("loot generation remains deterministic and reaches the expanded pools", () => {
  assert.deepEqual(Core.rollLoot(168, 3, 2, 4), Core.rollLoot(168, 3, 2, 4));

  const bases = new Set();
  const modifiers = new Set();
  for (let seed = 1; seed <= 400; seed += 1) {
    for (let index = 0; index < 3; index += 1) {
      const loot = Core.rollLoot(seed, seed % 5, index, seed % 6);
      bases.add(loot.baseId);
      modifiers.add(loot.modifier.id);
      const base = Core.ITEM_BASES.find((candidate) => candidate.baseId === loot.baseId);
      assert.ok(base);
      assert.equal(Core.isModifierCompatible(loot.modifier, base), true);
      assert.equal(loot.itemKind, "ordinary");
      assert.equal(loot.collectionEligible, false);
      assert.ok(Array.isArray(loot.regionTags));
    }
  }

  assert.equal(bases.size, Core.ITEM_BASES.length);
  assert.equal(modifiers.size, Core.MODIFIERS.length);
});

test("same-family base items create meaningful combat differences", () => {
  const chipped = Core.ITEM_BASES.find((base) => base.baseId === "chipped-arming-sword");
  const oldSoldier = Core.ITEM_BASES.find((base) => base.baseId === "old-soldier-longsword");
  const executioner = Core.ITEM_BASES.find((base) => base.baseId === "fallen-road-execution-sword");
  const graveWraps = Core.ITEM_BASES.find((base) => base.baseId === "grave-wraps");
  const pilgrimWraps = Core.ITEM_BASES.find((base) => base.baseId === "pilgrim-leather-wraps");

  const baselineSword = Core.getItemCombatTuning(itemFromBase(chipped));
  const longSword = Core.getItemCombatTuning(itemFromBase(oldSoldier));
  const heavySword = Core.getItemCombatTuning(itemFromBase(executioner));
  const baselineFists = Core.getItemCombatTuning(itemFromBase(graveWraps));
  const mobileFists = Core.getItemCombatTuning(itemFromBase(pilgrimWraps));

  assert.ok(longSword.reach > baselineSword.reach);
  assert.ok(longSword.lightDamage < baselineSword.lightDamage);
  assert.ok(heavySword.heavyDamage > baselineSword.heavyDamage);
  assert.ok(heavySword.moveSpeed < baselineSword.moveSpeed);
  assert.ok(mobileFists.moveSpeed > baselineFists.moveSpeed);
  assert.equal(mobileFists.evadeEmpower, true);
});

test("new modifiers alter existing combat hooks instead of adding shallow stats", () => {
  const graveWraps = Core.ITEM_BASES.find((base) => base.baseId === "grave-wraps");
  const ambusher = Core.MODIFIERS.find((modifier) => modifier.id === "ambusher");
  const breaker = Core.MODIFIERS.find((modifier) => modifier.id === "breaker");

  const neutral = Core.getItemCombatTuning(itemFromBase(graveWraps));
  const ambushTuning = Core.getItemCombatTuning(itemFromBase(graveWraps, { modifier: ambusher }));
  const breakTuning = Core.getItemCombatTuning(itemFromBase(graveWraps, { modifier: breaker }));

  assert.ok(ambushTuning.lightDamage > neutral.lightDamage);
  assert.ok(ambushTuning.heavyDamage < neutral.heavyDamage);
  assert.ok(breakTuning.heavyStagger > neutral.heavyStagger);
});

test("comparison explains same-family tradeoffs, not only power delta", () => {
  const chipped = Core.ITEM_BASES.find((base) => base.baseId === "chipped-arming-sword");
  const oldSoldier = Core.ITEM_BASES.find((base) => base.baseId === "old-soldier-longsword");
  let state = Core.createInitialState();
  const equipped = { ...itemFromBase(chipped, { id: "equipped", power: 8 }), secured: true };
  const candidate = itemFromBase(oldSoldier, { id: "candidate", power: 8 });

  state.securedLoot.push(equipped);
  state = Core.equipItem(state, equipped.id);
  const comparison = Core.compareItem(state, candidate);

  assert.equal(comparison.verdict, "同等");
  assert.equal(comparison.styleChange, false);
  assert.ok(comparison.combatDifferences.includes("間合い↑"));
  assert.match(comparison.summary, /間合い/);
});

test("legacy saved equipment without new fields still uses the previous family defaults", () => {
  let state = Core.createInitialState();
  state.securedLoot.push({
    id: "legacy-dagger",
    type: "dagger",
    style: "blade",
    name: "古い短刀",
    power: 4,
    modifier: { effect: {} },
    secured: true
  });
  state = Core.equipItem(state, "legacy-dagger");
  const tuning = Core.getCombatTuning(state);

  assert.equal(tuning.reach, 62);
  assert.equal(tuning.moveSpeed, 218);
  assert.equal(tuning.heavyStagger, 1);

  state.securedLoot.push({ id: "legacy-no-modifier", type: "sword", style: "blade", power: 5, secured: true });
  state = Core.equipItem(state, "legacy-no-modifier");
  assert.doesNotThrow(() => Core.getCombatTuning(state));
});

test("item kind distinguishes ordinary drops from named and relic equipment", () => {
  const ordinary = Core.rollLoot(42, 1, 0, 2);
  assert.equal(Core.getItemKind(ordinary), "ordinary");
  assert.equal(Core.getItemKind({ collectionId: "named-001" }), "named");
  assert.equal(Core.getItemKind({ rarity: "relic", modifier: { tag: "HUNT RELIC / COMBO" } }), "relic");
});
