const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");
const assetPath = path.join(root, "assets", "hearth", "actors", "player-unarmed-hearth-v0.1.png");

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function inspectPng(filePath) {
  const png = fs.readFileSync(filePath);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(png[24], 8, "Hearth avatar must use 8-bit channels");
  assert.equal(png[25], 6, "Hearth avatar must be RGBA");
  assert.equal(png[28], 0, "Hearth avatar must not be interlaced");

  const idat = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (type === "IEND") break;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
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
      const left = x >= 4 ? row[x - 4] : 0;
      const up = previous[x];
      const upLeft = x >= 4 ? previous[x - 4] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : paeth(left, up, upLeft);
      row[x] = (raw[cursor++] + predictor) & 255;
    }
    for (let x = 0; x < width; x += 1) {
      const alpha = row[x * 4 + 3];
      if (alpha < 18) continue;
      visible += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    row.copy(previous);
  }

  return { width, height, visible, minX, minY, maxX, maxY };
}

test("Grey Hearth avatar is a high-resolution transparent runtime asset", () => {
  const image = inspectPng(assetPath);
  assert.equal(image.width, 1024);
  assert.equal(image.height, 1536);
  assert.ok(image.visible >= image.width * image.height * 0.1);
  assert.ok(image.minX > 0 && image.minY > 0);
  assert.ok(image.maxX < image.width - 1 && image.maxY < image.height - 1);
  assert.ok(image.maxX - image.minX + 1 >= image.width * 0.5);
  assert.ok(image.maxY - image.minY + 1 >= image.height * 0.7);
});
