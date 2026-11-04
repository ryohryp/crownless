const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { inspectAtlas } = require('../scripts/adventurer-a-walk/pixel-atlas-review.js');

function atlas(frames = 4, paint = (frame, x, y) => frame === x && y === 0) {
  const width = frames * 128;
  const height = 192;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let frame = 0; frame < frames; frame++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < 128; x++) {
        if (!paint(frame, x, y)) continue;
        const offset = (y * width + frame * 128 + x) * 4;
        data.set([32, 56, 88, 255], offset);
      }
    }
  }
  return { data, width, height };
}

test('accepts four distinct native transparent frames without claiming art approval', () => {
  const a = atlas();
  assert.deepEqual(inspectAtlas(a.data, a.width, a.height), {
    frames: 4, colors: 1, uniqueFrames: 4, emptyFrames: 0, problems: []
  });
});

test('accepts eight distinct animation frames', () => {
  const a = atlas(8);
  assert.deepEqual(inspectAtlas(a.data, a.width, a.height).problems, []);
});

test('rejects identical copied idle poses and blank cels', () => {
  const duplicate = atlas(4, (_, x, y) => x === 4 && y === 7);
  assert.ok(inspectAtlas(duplicate.data, duplicate.width, duplicate.height).problems.includes('REPEATED_FRAME'));
  const blank = atlas(4, (frame, x, y) => frame !== 3 && x === frame && y === 0);
  assert.ok(inspectAtlas(blank.data, blank.width, blank.height).problems.includes('EMPTY_FRAME'));
});

test('rejects partial alpha and an expanded palette', () => {
  const a = atlas();
  a.data[3] = 128;
  assert.ok(inspectAtlas(a.data, a.width, a.height).problems.includes('PARTIAL_ALPHA'));
  const b = atlas(4, (_, x, y) => y === 0 && x < 70);
  for (let x = 0; x < 70; x++) b.data[x * 4] = x;
  assert.ok(inspectAtlas(b.data, b.width, b.height).problems.includes('TOO_MANY_COLORS'));
});

test('rejects resized and unsupported frame-count exports', () => {
  const a = atlas();
  assert.ok(inspectAtlas(a.data, a.width, 191).problems.includes('INVALID_IMAGE_DATA'));
  const b = atlas(3);
  assert.ok(inspectAtlas(b.data, b.width, b.height).problems.includes('INVALID_FRAME_COUNT'));
  assert.ok(inspectAtlas(null, 512, 192).problems.includes('INVALID_IMAGE_DATA'));
});

test('review page points to the current idle study, not the rejected puppet GIF', () => {
  const page = fs.readFileSync(path.join(__dirname, '../docs/visual/adventurer-a-walk-review.html'), 'utf8');
  assert.match(page, /adventurer-a-idle-native-128-v1\.png/);
  assert.match(page, /pixel-atlas-review\.js/);
  assert.doesNotMatch(page, /ik-masked-review\.gif|adventurer-a-handcluster-v1\.gif/);
  assert.match(page, /自動承認しない/);
  const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(inline.length, 1);
  assert.doesNotThrow(() => new vm.Script(inline[0][1]));
});
