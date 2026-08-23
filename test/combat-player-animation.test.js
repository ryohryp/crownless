const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');
const animationMetadataPath = path.join(root, 'assets', 'combat', 'minimal-v0.1', 'player-unarmed-animation.json');
const animationSheetPath = path.join(root, 'assets', 'combat', 'minimal-v0.1', 'actors', 'player-unarmed-combat-sprite-sheet-v0.3.png');
const directionMetadataPath = path.join(root, 'assets', 'combat', 'minimal-v0.1', 'player-unarmed-direction-reference.json');
const directionSheetPath = path.join(root, 'assets', 'combat', 'minimal-v0.1', 'actors', 'player-unarmed-combat-sprite-sheet-v0.1.png');
const rendererPath = path.join(root, 'src', 'combat-manuscript-render.js');
const appPath = path.join(root, 'src', 'app.js');

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePngAlpha(filePath) {
  const png = fs.readFileSync(filePath);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  const interlace = png[28];
  assert.equal(bitDepth, 8);
  assert.ok(colorType === 3 || colorType === 6, `unsupported PNG color type ${colorType}`);
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

  const bytesPerPixel = colorType === 6 ? 4 : 1;
  const stride = width * bytesPerPixel;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Array.from({ length: height }, () => new Uint8Array(width));
  const previous = Buffer.alloc(stride);
  let cursor = 0;
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
      pixels[y][x] = colorType === 6
        ? row[x * 4 + 3]
        : transparency && row[x] < transparency.length ? transparency[row[x]] : 255;
    }
    row.copy(previous);
  }
  return { width, height, colorType, pixels };
}

function visibleBounds(image, region, threshold) {
  let minX = region.sx + region.sw;
  let minY = region.sy + region.sh;
  let maxX = -1;
  let maxY = -1;
  let visible = 0;
  for (let y = region.sy; y < region.sy + region.sh; y += 1) {
    for (let x = region.sx; x < region.sx + region.sw; x += 1) {
      if (image.pixels[y][x] < threshold) continue;
      visible += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX ? null : {
    x: minX - region.sx,
    y: minY - region.sy,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    visible
  };
}

function directionalRowFrames(row) {
  return row.xEdges.slice(0, -1).map((x, column) => ({
    sx: x,
    sy: row.y,
    sw: row.xEdges[column + 1] - x,
    sh: row.height
  }));
}

test('historical protagonist sheet remains measured directional source art and is not runtime eligible', () => {
  const metadata = JSON.parse(fs.readFileSync(directionMetadataPath, 'utf8'));
  const image = decodePngAlpha(directionSheetPath);
  assert.deepEqual({ width: image.width, height: image.height }, metadata.sheetSize);
  assert.equal(metadata.analysis.layout, 'directional pose families, not temporal animation sequences');
  assert.deepEqual(Object.keys(metadata.directionalPoseFamilies), ['idle', 'walk', 'jab', 'hurt']);

  metadata.rows.forEach((row) => {
    assert.equal(row.xEdges.at(-1), image.width);
    assert.equal(row.visibleBounds.length, row.xEdges.length - 1);
    directionalRowFrames(row).forEach((frame, index) => {
      const actual = visibleBounds(image, frame, metadata.analysis.alphaThreshold);
      const expected = row.visibleBounds[index];
      assert.deepEqual(
        { x: actual.x + frame.sx, y: actual.y + frame.sy, width: actual.width, height: actual.height },
        expected,
        `${row.action} direction ${index} alpha bounds changed`
      );
    });
  });

  assert.equal(metadata.runtime.eligible, false);
  assert.equal(metadata.runtime.fallback, 'actors/player-unarmed.png');
});

test('accepted v3 protagonist atlas has four temporal frames per action with stable authored ground points', () => {
  const metadata = JSON.parse(fs.readFileSync(animationMetadataPath, 'utf8'));
  const image = decodePngAlpha(animationSheetPath);
  assert.equal(metadata.schema, 'crownless.player-unarmed-animation.v1');
  assert.equal(metadata.sheet, 'actors/player-unarmed-combat-sprite-sheet-v0.3.png');
  assert.deepEqual({ width: image.width, height: image.height }, metadata.sheetSize);
  assert.deepEqual(metadata.grid, { columns: 4, rows: 4, frameWidth: 512, frameHeight: 512 });
  assert.equal(image.colorType, 6, 'runtime atlas must remain RGBA');
  assert.deepEqual(metadata.actions.map((action) => action.action), ['idle', 'walk', 'jab', 'hurt']);
  assert.equal(metadata.analysis.layout, 'temporal animation rows with one fixed oblique top-down facing');
  assert.equal(metadata.runtime.eligible, true);
  assert.deepEqual(metadata.runtime.states, ['idle', 'walk', 'jab', 'hurt']);
  assert.equal(metadata.runtime.fallback, 'actors/player-unarmed.png');

  metadata.actions.forEach((action) => {
    assert.equal(action.frameCount, 4);
    assert.equal(action.visibleBounds.length, 4);
    action.visibleBounds.forEach((expected, frame) => {
      const region = {
        sx: frame * metadata.grid.frameWidth,
        sy: action.row * metadata.grid.frameHeight,
        sw: metadata.grid.frameWidth,
        sh: metadata.grid.frameHeight
      };
      const actual = visibleBounds(image, region, metadata.analysis.alphaThreshold);
      assert.deepEqual(
        { x: actual.x, y: actual.y, width: actual.width, height: actual.height },
        expected,
        `${action.action} frame ${frame} alpha bounds changed`
      );
      const groundY = actual.y + actual.height - 1;
      assert.ok(Math.abs(groundY - metadata.pivot.y) <= 1, `${action.action} frame ${frame} ground drifted to ${groundY}`);
      assert.ok(actual.visible >= 25000, `${action.action} frame ${frame} visible coverage too small: ${actual.visible}`);
    });
  });

  const digest = crypto.createHash('sha256').update(fs.readFileSync(animationSheetPath)).digest('hex');
  assert.equal(digest, metadata.analysis.acceptedCandidateSha256);
});

test('runtime uses the accepted temporal atlas while preserving the static identity fallback', () => {
  const renderer = fs.readFileSync(rendererPath, 'utf8');
  const app = fs.readFileSync(appPath, 'utf8');
  assert.match(renderer, /playerAnimation:\s*`\$\{ASSET_ROOT\}\/actors\/player-unarmed-combat-sprite-sheet-v0\.3\.png`/);
  assert.match(renderer, /player:\s*`\$\{ASSET_ROOT\}\/actors\/player-unarmed\.png`/);
  assert.doesNotMatch(renderer, /player-unarmed-combat-sprite-sheet-v0\.1\.png/);
  assert.match(renderer, /function playerFrame\(\)/);
  assert.match(renderer, /function drawPlayerActorBillboard\(target, record, logicalHeight/);
  assert.match(renderer, /mode:\s*"temporal-atlas"/);
  assert.match(renderer, /pivot:\s*\{ x: playerAnimationConfig\.pivotX, y: playerAnimationConfig\.pivotY \}/);
  assert.match(app, /p\.flash > 0/);
  assert.match(app, /p\.attack && p\.attack\.kind === "light"/);
  assert.match(app, /assets\.setPlayerAnimation\("walk"/);
  assert.match(app, /assets\.setPlayerAnimation\("idle"/);
});
