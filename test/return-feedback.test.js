const test = require('node:test');
const assert = require('node:assert/strict');
const { fromReportPanel } = require('../src/return-feedback.js');

test('celebrates bringing a new weapon home', () => {
  assert.match(fromReportPanel('SAFE RETURN 新しい一本を、火へ。 +8 鉄片を確保'), /新しい武具を生還確定/);
});

test('calls out a valuable haul as a deliberate return decision', () => {
  const text = fromReportPanel('SAFE RETURN 欲張らずに、帰る強さ。 +17 鉄片を確保');
  assert.match(text, /鉄片 17 個/);
  assert.match(text, /帰る判断/);
});

test('does not praise a failed expedition', () => {
  assert.equal(fromReportPanel('EXPEDITION LOST 命だけを、持ち帰った。 −12 鉄片を失った'), '');
});
