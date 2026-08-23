const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');
const metadataPath = path.join(root, 'assets', 'combat', 'minimal-v0.1', 'player-unarmed-animation.json');
const sheetPath = path.join(root, 'assets', 'combat', 'minimal-v0.1', 'actors', 'player-unarmed-combat-sprite-sheet-v0.1.png');
const rendererPath = path.join(root, 'src', 'combat-manuscript-render.js');
const appPath = path.join(root, 'src', 'app.js');

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodeIndexedPng(filePath) {
  const png = fs.readFileSync(filePath);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  const interlace = png[28];
  assert.equal(bitDepth, 8);
  assert.equal(colorType, 3, 'the accepted sheet is expected to remain indexed');
  assert.equal(interlace, 0);

  const idat = [];
  let transparency = null;
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') idat.push(data);
    if (type === 'tRNS') transparency = data;
    offset += 12 + length;
    if (type === 'IEND') break;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Array.from({ length: height }, () => new Uint8Array(width));
  const previous = Buffer.alloc(width);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor++];
    const row = Buffer.alloc(width);
    for (let x = 0; x < width; x += 1) {
      const value = raw[cursor++];
      const left = x > 0 ? row[x - 1] : 0;
      const up = previous[x];
      const upLeft = x > 0 ? previous[x - 1] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
        : filter === 2 ? up
        : filter === 3 ? Math.floor((left + up) / 2)
        : filter === 4 ? paeth(left, up, upLeft)
        : (() => { throw new Error(`unsupported PNG filter ${filter}`); })();
      row[x] = (value + predictor) & 255;
      pixels[y][x] = transparency && row[x] < transparency.length ? transparency[row[x]] : 255;
    }
    row.copy(previous);
  }
  return { width, height, pixels };
}

function visibleBounds(image, region, threshold) {
  let minX = region.sx + region.sw;
  let minY = region.sy + region.sh;
  let maxX = -1;
  let maxY = -1;
  for (let y = region.sy; y < region.sy + region.sh; y += 1) {
    for (let x = region.sx; x < region.sx + region.sw; x += 1) {
      if (image.pixels[y][x] < threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX ? null : {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function rowFrames(row) {
  return row.xEdges.slice(0, -1).map((x, column) => ({
    sx: x,
    sy: row.y,
    sw: row.xEdges[column + 1] - x,
    sh: row.height
  }));
}

test('accepted protagonist sheet has measured MVP frame rectangles and complete alpha bounds', () => {
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const image = decodeIndexedPng(sheetPath);
  assert.deepEqual({ width: image.width, height: image.height }, metadata.sheetSize);
  assert.deepEqual(metadata.rows.map((row) => row.action), ['idle', 'walk', 'jab', 'hurt', 'down']);
  assert.deepEqual(Object.keys(metadata.animations), ['idle', 'walk', 'jab', 'hurt']);

  metadata.rows.forEach((row) => {
    assert.equal(row.xEdges.at(-1), image.width);
    assert.equal(row.visibleBounds.length, row.xEdges.length - 1);
    rowFrames(row).forEach((frame, index) => {
      const actual = visibleBounds(image, frame, metadata.analysis.alphaThreshold);
      assert.deepEqual(actual, row.visibleBounds[index], `${row.action} frame ${index} alpha bounds changed`);
      assert.ok(actual.x >= frame.sx && actual.x + actual.width <= frame.sx + frame.sw);
      assert.ok(actual.y >= frame.sy && actual.y + actual.height <= frame.sy + frame.sh);
    });
  });

  assert.deepEqual(metadata.animations.idle.frames, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(metadata.animations.walk.frames, [8, 9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual(metadata.animations.jab.frames, [16, 17, 18, 19, 20, 21, 22, 23]);
  assert.deepEqual(metadata.animations.hurt.frames, [24, 25, 26, 27, 28, 29, 30, 31]);
  assert.deepEqual(metadata.excluded.down, [32, 33, 34, 35]);
});

test('player animation uses the existing actor renderer and explicit combat state', () => {
  const renderer = fs.readFileSync(rendererPath, 'utf8');
  const app = fs.readFileSync(appPath, 'utf8');
  assert.match(renderer, /playerSheet:\s*`\$\{ASSET_ROOT\}\/actors\/player-unarmed-combat-sprite-sheet-v0\.1\.png`/);
  assert.match(renderer, /record\.frameBounds = playerAnimationFrames\.map/);
  assert.match(renderer, /function drawPlayerActorBillboard/);
  assert.match(renderer, /footY - height/);
  assert.match(renderer, /setPlayerAnimation/);
  assert.match(app, /p\.flash > 0/);
  assert.match(app, /p\.attack && p\.attack\.kind === "light"/);
  assert.match(app, /assets\.setPlayerAnimation\("walk"/);
  assert.match(app, /assets\.setPlayerAnimation\("idle"/);
});
