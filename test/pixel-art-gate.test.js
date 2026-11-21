import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, writeFile, rm} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const require = createRequire(import.meta.url);
const {validatePixelArtSpec, inspectPixelArt} = require("../scripts/pixel-art-gate.cjs");
const {run} = require("../scripts/asset-quality-gate.cjs");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function rgbaPixels(pixels) { return Uint8Array.from(pixels.flat()); }
function nearestScale(pixels, width, height, scale) {
  const data = new Uint8Array(width * height * scale * scale * 4);
  for (let y = 0; y < height * scale; y++) for (let x = 0; x < width * scale; x++) {
    const source = (Math.floor(y / scale) * width + Math.floor(x / scale)) * 4;
    data.set(pixels.subarray(source, source + 4), (y * width * scale + x) * 4);
  }
  return data;
}

const pixels = rgbaPixels([
  [10, 20, 30, 255], [0, 0, 0, 0],
  [40, 50, 60, 255], [10, 20, 30, 255],
]);
const spec = {nativeSize: [2, 2], maxColors: 2, alphaMode: "binary"};

test("native grid and integer nearest-neighbor export pass deterministic pixel checks", () => {
  assert.deepEqual(inspectPixelArt(pixels, 2, 2, spec).problems, []);
  const result = inspectPixelArt(nearestScale(pixels, 2, 2, 4), 8, 8, spec);
  assert.deepEqual(result.problems, []);
  assert.equal(result.integerScale, 4);
  assert.equal(result.visibleColors, 2);
});

test("interpolated pixels, unexpected dimensions, excessive colors and partial alpha fail", () => {
  const blur = nearestScale(pixels, 2, 2, 4);
  blur[4] = 11;
  assert.ok(inspectPixelArt(blur, 8, 8, spec).problems.includes("pixel_grid_interpolation_or_misalignment"));
  assert.ok(inspectPixelArt(pixels, 4, 1, spec).problems.includes("pixel_canvas_scale_mismatch"));
  const colored = pixels.slice();
  colored.set([200, 100, 20, 255], 12);
  const colorResult = inspectPixelArt(colored, 2, 2, spec);
  assert.ok(colorResult.problems.includes("pixel_palette_limit_exceeded"));
  assert.equal(colorResult.colorCountTruncated, true);
  const transparentEdge = pixels.slice();
  transparentEdge[3] = 128;
  assert.ok(inspectPixelArt(transparentEdge, 2, 2, spec).problems.includes("pixel_partial_alpha"));
});

test("pixel specification rejects malformed or speculative options", () => {
  assert.deepEqual(validatePixelArtSpec(spec), spec);
  assert.throws(() => validatePixelArtSpec({nativeSize: [0, 2]}), /invalid_pixel_native_size/);
  assert.throws(() => validatePixelArtSpec({...spec, maxColors: 0}), /invalid_pixel_color_limit/);
  assert.throws(() => validatePixelArtSpec({...spec, alphaMode: "soft"}), /invalid_pixel_alpha_mode/);
  assert.throws(() => validatePixelArtSpec({...spec, magicAIQuality: true}), /unknown_pixel_art_option/);
});

test("existing asset quality workflow rejects a non-grid sprite before any advisory API call", async () => {
  const name = `pixel-art-gate-${process.pid}`;
  const dir = path.join(ROOT, ".qa", "candidates");
  const candidateRel = `.qa/candidates/${name}.png`;
  const manifestRel = `.qa/candidates/${name}.json`;
  await mkdir(dir, {recursive: true});
  await writeFile(path.join(ROOT, candidateRel), pixels);
  await writeFile(path.join(ROOT, manifestRel), JSON.stringify({
    schemaVersion: 1, kind: "character", candidate: candidateRel,
    subject: "Adventurer A test sprite", usage: "candidate only",
    generationPrompt: "One pixel character", targetSize: [8, 8], transparent: true,
    references: [], attempt: 0, pixelArt: spec,
  }));
  const fuzzy = nearestScale(pixels, 2, 2, 4);
  fuzzy[4] = 11;
  const mockSharp = () => ({
    metadata: async () => ({format: "png", width: 8, height: 8, hasAlpha: true, pages: 1}),
    ensureAlpha() {return this;}, raw() {return this;},
    toBuffer: async () => ({data: fuzzy, info: {width: 8, height: 8}}),
  });
  let advisoryCalls = 0;
  let report;
  try {
    report = await run(manifestRel, {force: true, dependencies: {
      sharp: mockSharp, evaluate: async () => {advisoryCalls++; return {available: true};},
    }});
    assert.equal(report.asset.status, "reject_candidate");
    assert.ok(report.asset.issues.includes("pixel_grid_interpolation_or_misalignment"));
    assert.equal(advisoryCalls, 0);
  } finally {
    await rm(path.join(ROOT, candidateRel), {force: true});
    await rm(path.join(ROOT, manifestRel), {force: true});
    if (report) await rm(path.join(ROOT, ".qa", "asset-quality", report.key + ".json"), {force: true});
  }
});
