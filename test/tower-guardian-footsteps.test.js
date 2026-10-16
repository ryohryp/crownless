'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

test('tower guardian footsteps offer a safe-return choice before combat', () => {
  let s = E.start(E.discover({...E.initial(), mode:'demo'}, 'tower'), 'tower');
  for (const tile of [21, 22, 23, 18, 13]) s = E.act(s, 'tower-step:' + tile);
  s = E.act(s, 'tower-cache-iron');
  assert.equal(s.expedition.materials.watchIron, 1);
  s = E.act(s, 'tower-step:14');
  assert.equal(s.expedition.tower.pos, 14);
  assert.equal(s.expedition.stage, 'path', 'footsteps are a warning, not forced combat');
  assert.equal(s.expedition.tower.guard, false);
  assert.match(s.expedition.log[0], /鎧が石床を打つ足音/);
  assert.match(s.expedition.log[0], /生還するか/);
  assert.match(s.expedition.log[0], /背嚢の鐘鉄 1・鉄片 0 を守って/,
    'guardian warning names the material that can be lost');
  const resumed = E.parse(E.serialize(s));
  assert.match(resumed.expedition.log[0], /鎧が石床を打つ足音/, 'warning survives reload');
  const challenge = E.act(resumed, 'tower-step:9');
  assert.equal(challenge.expedition.stage, 'fight', 'stepping toward the guardian remains a deliberate risk');
  const retreated = E.act(resumed, 'return');
  assert.equal(retreated.expedition, null, 'safe return closes the expedition');
  assert.equal(retreated.materials.watchIron, 1, 'retreat banks the carried material');
});

test('tower guardian warns without inventing carried loot when the bag is empty', () => {
  let s = E.start(E.discover({...E.initial(), mode:'demo'}, 'tower'), 'tower');
  for (const tile of [21, 22, 23, 18, 19, 14]) s = E.act(s, 'tower-step:' + tile);
  assert.equal(s.expedition.stage, 'path');
  assert.equal(s.expedition.materials.watchIron, 0);
  assert.equal(s.expedition.scrap, 0);
  assert.match(s.expedition.log[0], /背嚢はまだ空だ。生還するか/);
  assert.doesNotMatch(s.expedition.log[0], /初手は強撃/,
    'players who did not investigate should not receive the tactical clue');
  assert.doesNotMatch(s.expedition.log[0], /鐘鉄 1/);
  assert.deepEqual(E.parse(E.serialize(s)), s, 'empty-bag warning survives resume');
});

test('listening does not start combat or grant loot', () => {
  let s=E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  for(const tile of [21,22,23,18,19])s=E.act(s,'tower-step:'+tile);
  assert.match(s.expedition.log[0],/金属が石をこする音/);
  const after=E.act(s,'tower-listen');
  assert.equal(after.expedition.stage,'path');
  assert.equal(after.expedition.tower.pos,19);
  assert.equal(after.expedition.tower.listened,true,'one investigation is recorded');
  assert.deepEqual(after.expedition.materials,s.expedition.materials);
  assert.equal(after.expedition.focus,s.expedition.focus,'clue is knowledge, not a free buff');
  assert.match(after.expedition.log[0],/盾を据える音/);
  assert.match(after.expedition.log[0],/強撃で攻めるか/);
  assert.strictEqual(E.act(after,'tower-listen'),after,'repeated listening cannot farm a new result');
  const resumed=E.parse(E.serialize(after));
  assert.equal(resumed.expedition.tower.listened,true,'listening persists across reload');
  assert.match(resumed.expedition.log[0],/戦利品を持ち帰るか/);
  const threshold=E.act(resumed,'tower-step:14');
  assert.match(threshold.expedition.log[0],/耳に残る盾の音。初手は強撃が効きそうだ。/,
    'earned clue is recalled at the actual retreat-or-fight decision');
  assert.equal(threshold.expedition.tower.pos,14);
  assert.equal(threshold.expedition.stage,'path','recalling a clue never forces combat');
  assert.deepEqual(threshold.expedition.materials,resumed.expedition.materials);
  assert.match(E.parse(E.serialize(threshold)).expedition.log[0],/初手は強撃/,
    'clue remains visible after reloading at the guardian threshold');
  const challenge=E.act(threshold,'tower-step:9');
  assert.equal(challenge.expedition.stage,'fight');
  assert.equal(E.intent(challenge.expedition.enemy).id,'guard','heard shield matches first enemy intent');
  assert(E.attackPreview(challenge,'heavy')>E.attackPreview(challenge,'strike'),
    'the earned clue informs a meaningful first attack choice');
  assert.equal(E.act(after,'return').expedition,null);
});

test('in-progress tower saves without the new listen flag remain loadable', () => {
  let s=E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  for(const tile of [21,22,23,18,19])s=E.act(s,'tower-step:'+tile);
  delete s.expedition.tower.listened;
  const loaded=E.parse(E.serialize(s));
  assert(loaded,'pre-existing tower saves must still resume');
  assert.equal(loaded.expedition.tower.pos,19);
  const listened=E.act(loaded,'tower-listen');
  assert.equal(listened.expedition.tower.listened,true);
  assert(E.parse(E.serialize(listened)));
});

test('guardian victory hints at unexplored bell echoes without spoiling the hidden room', () => {
  const defeat = steps => {
    let s = E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
    for (const to of steps) s = E.act(s,'tower-step:'+to);
    assert.equal(s.expedition.stage,'fight');
    s = structuredClone(s);
    s.expedition.enemy.hp = 1;
    const won = E.act(s,'heavy');
    assert.equal(won.expedition.stage,'path','defeating the guardian resumes the map');
    assert.equal(won.expedition.tower.guard,true);
    return won;
  };
  const direct = defeat([21,22,23,18,19,14,9]);
  assert.match(direct.expedition.log[0],/鐘に似た音/);
  assert.doesNotMatch(direct.expedition.log[0],/隠し部屋|隠し階段/,
    'undiscovered rooms must remain a surprise after the fight');
  const heard = defeat([21,22,17,22,23,18,19,14,9]);
  assert.match(heard.expedition.log[0],/鐘の反響は、まだ石壁の向こう/);
  assert.doesNotMatch(heard.expedition.log[0],/隠し部屋|隠し階段/);
  const opened = defeat([21,22,17,12,22,23,18,19,14,9]);
  assert.match(opened.expedition.log[0],/見つけた隠し階段の奥/);
  const explored = defeat([21,22,17,12,12,7,12,17,22,23,18,19,14,9]);
  assert.equal(explored.expedition.tower.relic,true);
  assert.match(explored.expedition.log[0],/背嚢の素材を持ち帰るか/);
  assert.doesNotMatch(explored.expedition.log[0],/まだ調べられる/);
  const resumed = E.parse(E.serialize(explored));
  assert.equal(resumed.expedition.tower.guard,true);
  assert.equal(resumed.expedition.tower.relic,true);
  const returned = E.act(resumed,'return');
  assert.equal(returned.expedition,null);
  assert.equal(returned.materials.watchIron,explored.expedition.materials.watchIron,
    'discovered bell iron remains banked only on safe return');
});

test('guardian backtracking offers a new bell lead without revealing the secret or losing loot', () => {
  let s = E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  for (const to of [21,22,23,18,19,14,9]) s=E.act(s,'tower-step:'+to);
  assert.equal(s.expedition.stage,'fight');
  s=structuredClone(s);
  s.expedition.enemy.hp=1;
  s=E.act(s,'heavy');
  assert.equal(s.expedition.stage,'path','guardian victory returns to exploration');
  for (const to of [14,19,18]) s=E.act(s,'tower-step:'+to);
  assert.equal(s.expedition.tower.pos,18,'return trip uses ordinary adjacent steps');
  assert.match(s.expedition.log[0],/上階とは逆の石壁から、鐘の余韻/);
  assert.doesNotMatch(s.expedition.log[0],/隠し部屋|隠し階段/,
    'a new lead is not a secret-room spoiler');
  assert.equal(s.expedition.tower.echo,false);
  assert.equal(s.expedition.tower.open,false);
  const resumed=E.parse(E.serialize(s));
  assert.match(resumed.expedition.log[0],/上階とは逆の石壁から/);
  s=E.act(resumed,'tower-step:17');
  assert.equal(s.expedition.tower.echo,true,'player discovers the echo by moving');
  s=E.act(s,'tower-step:12');
  assert.equal(s.expedition.tower.open,true,'hidden stairs require deliberate investigation');
  assert.equal(s.expedition.tower.pos,17,'uncovering is not teleportation');
  for(const to of [12,7])s=E.act(s,'tower-step:'+to);
  assert.equal(s.expedition.tower.relic,true);
  assert.equal(s.expedition.materials.watchIron,1);
  const returned=E.act(E.parse(E.serialize(s)),'return');
  assert.equal(returned.expedition,null);
  assert.equal(returned.materials.watchIron,1,'newly discovered material banks only on safe return');
});
