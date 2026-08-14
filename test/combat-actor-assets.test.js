const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function inspectActorPng(relativePath) {
  const file = path.join(root, relativePath);
  const png = fs.readFileSync(file);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${relativePath} must be a PNG`);

  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  const interlace = png[28];
  assert.equal(bitDepth, 8, 'actor PNG must use 8-bit channels');
  assert.ok(colorType === 6 || colorType === 3, `actor PNG must use RGBA or indexed color, got ${colorType}`);
  assert.equal(interlace, 0, 'actor PNG must not be interlaced');

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

  assert.ok(idat.length > 0, 'actor PNG must contain image data');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bytesPerPixel = colorType === 6 ? 4 : 1;
  const stride = width * bytesPerPixel;
  const previous = Buffer.alloc(stride);
  let cursor = 0;
  let visible = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor++];
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const value = raw[cursor++];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
        : filter === 2 ? up
        : filter === 3 ? Math.floor((left + up) / 2)
        : filter === 4 ? paeth(left, up, upLeft)
        : (() => { throw new Error(`unsupported PNG filter ${filter}`); })();
      row[x] = (value + predictor) & 255;
    }

    for (let x = 0; x < width; x += 1) {
      const alpha = colorType === 6
        ? row[x * 4 + 3]
        : transparency && row[x] < transparency.length ? transparency[row[x]] : 255;
      if (alpha < 18) continue;
      visible += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    row.copy(previous);
  }

  return {
    width,
    height,
    visible,
    boundsWidth: maxX >= minX ? maxX - minX + 1 : 0,
    boundsHeight: maxY >= minY ? maxY - minY + 1 : 0
  };
}

test('skirmisher combat sprite is a valid PNG with a readable non-transparent silhouette', () => {
  const image = inspectActorPng('assets/combat/minimal-v0.1/actors/enemy-skirmisher.png');
  assert.ok(image.width >= 72, `skirmisher width unexpectedly small: ${image.width}`);
  assert.ok(image.height >= 90, `skirmisher height unexpectedly small: ${image.height}`);
  assert.ok(image.visible >= image.width * image.height * 0.14, `skirmisher visible coverage too small: ${image.visible}`);
  assert.ok(image.boundsWidth >= image.width * 0.68, `skirmisher silhouette too narrow: ${image.boundsWidth}`);
  assert.ok(image.boundsHeight >= image.height * 0.82, `skirmisher silhouette too short: ${image.boundsHeight}`);
});
