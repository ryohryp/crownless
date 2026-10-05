'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createInitialChronicle,
  recordVisitAndStamp,
  recordExpeditionCard,
  recordCollectedRelic,
  getChronicleStats,
} = require('../src/travel-chronicle.js');

test('Travel Chronicle: stamps passport upon visiting landmarks', () => {
  let chronicle = createInitialChronicle();
  chronicle = recordVisitAndStamp(chronicle, '鎌倉鶴岡八幡宮', 'sacred', { lat: 35.32, lng: 139.55 });

  assert.equal(chronicle.stamps.length, 1);
  const stamp = chronicle.stamps[0];
  assert.equal(stamp.landmarkName, '鎌倉鶴岡八幡宮');
  assert.equal(stamp.signal, 'sacred');
  assert.equal(stamp.icon, '⛩️');
  assert.equal(stamp.sealName, '天満の神印');
  assert.equal(stamp.visitCount, 1);

  // Visiting again increments count without duplicating stamp
  chronicle = recordVisitAndStamp(chronicle, '鎌倉鶴岡八幡宮', 'sacred');
  assert.equal(chronicle.stamps.length, 1);
  assert.equal(chronicle.stamps[0].visitCount, 2);
});

test('Travel Chronicle: records memorable expedition cards', () => {
  let chronicle = createInitialChronicle();
  chronicle = recordExpeditionCard(chronicle, {
    landmarkName: '隅田川・霧裂きの古橋',
    signal: 'water',
    summary: '川霧の奥で水妖を退け、古橋を開拓拠点とした。',
    relicName: '霧裂きの刺剣',
    facilityBuilt: '見張り塔 Lv1',
  });

  assert.equal(chronicle.cards.length, 1);
  const card = chronicle.cards[0];
  assert.equal(card.landmarkName, '隅田川・霧裂きの古橋');
  assert.equal(card.relicName, '霧裂きの刺剣');
  assert.equal(card.facilityBuilt, '見張り塔 Lv1');
  assert.ok(card.summary.includes('水妖を退け'));
});

test('Travel Chronicle: stores collected regional relics and provides stats', () => {
  let chronicle = createInitialChronicle();
  chronicle = recordVisitAndStamp(chronicle, '高尾山頂', 'height');
  chronicle = recordVisitAndStamp(chronicle, '代々木公園', 'woods');

  chronicle = recordCollectedRelic(chronicle, {
    relicId: 'relic_height_gale_greatsword',
    name: '風切りの大剣',
    type: 'dagger',
    signal: 'height',
    originPlace: '高尾山頂',
    trait: '高峰の突風',
  });

  const stats = getChronicleStats(chronicle);
  assert.equal(stats.totalStamps, 2);
  assert.equal(stats.totalRelics, 1);
  assert.equal(stats.signalsCount.height, 1);
  assert.equal(stats.signalsCount.woods, 1);
});
