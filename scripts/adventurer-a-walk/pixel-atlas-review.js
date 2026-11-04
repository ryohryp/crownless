/* Shared browser/Node checks for review-only, native-pixel walk atlases. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessPixelAtlasReview = api;
})(typeof globalThis === 'object' ? globalThis : undefined, function () {
  'use strict';

  function inspectAtlas(data, width, height, options = {}) {
    const frameWidth = options.frameWidth ?? 128;
    const frameHeight = options.frameHeight ?? 192;
    const maxColors = options.maxColors ?? 64;
    const allowedFrames = options.allowedFrames ?? [4, 8];
    const problems = [];
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        width <= 0 || height <= 0 || !data || data.length !== width * height * 4) {
      return { frames: 0, colors: 0, problems: ['INVALID_IMAGE_DATA'] };
    }
    if (height !== frameHeight || width % frameWidth !== 0) {
      problems.push('INVALID_NATIVE_SIZE');
      return { frames: 0, colors: 0, problems };
    }
    const frames = width / frameWidth;
    if (!allowedFrames.includes(frames)) problems.push('INVALID_FRAME_COUNT');

    const colors = new Set();
    const hashes = new Set();
    let emptyFrames = 0;
    let partialAlpha = false;
    for (let frame = 0; frame < frames; frame++) {
      let visible = 0;
      // FNV-1a keeps the memory use bounded at native sprite-sheet sizes.
      let hash = 2166136261;
      for (let y = 0; y < frameHeight; y++) {
        for (let x = 0; x < frameWidth; x++) {
          const at = (y * width + frame * frameWidth + x) * 4;
          const alpha = data[at + 3];
          if (alpha > 0 && alpha < 255) partialAlpha = true;
          if (alpha) {
            visible++;
            colors.add(`${data[at]},${data[at + 1]},${data[at + 2]},${alpha}`);
          }
          // Include all four channels. Equal poses with different hidden RGB
          // values are still caught by the visible-pixel fingerprint below.
          const rgba = alpha ? [data[at], data[at + 1], data[at + 2], alpha] : [0, 0, 0, 0];
          for (const value of rgba) {
            hash = Math.imul(hash ^ value, 16777619) >>> 0;
          }
        }
      }
      if (!visible) emptyFrames++;
      hashes.add(hash);
    }
    if (partialAlpha) problems.push('PARTIAL_ALPHA');
    if (colors.size > maxColors) problems.push('TOO_MANY_COLORS');
    if (emptyFrames) problems.push('EMPTY_FRAME');
    if (hashes.size < frames) problems.push('REPEATED_FRAME');
    return { frames, colors: colors.size, uniqueFrames: hashes.size, emptyFrames, problems };
  }

  return { inspectAtlas };
});
