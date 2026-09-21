const test = require('node:test');
const assert = require('node:assert/strict');
const { fragmentFor } = require('../src/treasure-map-fragment');

test('qualifying safe return can reveal a next-expedition clue without exact reward', () => {
  const clue = fragmentFor({ place: '囁きの森', died: false, scrap: 2, gear: [] });
  assert.ok(clue);
  assert.equal(clue.direction, '北東');
  assert.match(clue.hint, /鐘のない高み/);
  assert.doesNotMatch(clue.hint, /鉄片|短剣|盾|弓/);
});

test('fragment is rare rather than guaranteed', () => {
  assert.equal(fragmentFor({ place: '囁きの森', died: false, scrap: 3, gear: [] }), null);
});

test('defeat never awards a map fragment', () => {
  assert.equal(fragmentFor({ place: '囁きの森', died: true, scrap: 2, gear: [] }), null);
});

test('every known land points toward another unresolved direction', () => {
  for (const place of ['囁きの森', '鐘なき塔', '星沈みの湿原', '灰冠の廟']) {
    let clue = null;
    for (let scrap = 0; scrap < 3 && !clue; scrap++) clue = fragmentFor({ place, died: false, scrap, gear: [] });
    assert.ok(clue, place);
    assert.ok(clue.direction);
    assert.ok(clue.hint);
  }
});
