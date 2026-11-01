"use strict";

// Deterministic pixel-data checks. Visual appeal and animation quality still require review.
function validatePixelArtSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw Error("invalid_pixel_art_spec");
  if (!Array.isArray(spec.nativeSize) || spec.nativeSize.length !== 2 ||
    spec.nativeSize.some(value => !Number.isInteger(value) || value < 1 || value > 8192)) {
    throw Error("invalid_pixel_native_size");
  }
  if (spec.maxColors !== undefined &&
    (!Number.isInteger(spec.maxColors) || spec.maxColors < 1 || spec.maxColors > 65536)) {
    throw Error("invalid_pixel_color_limit");
  }
  if (spec.alphaMode !== undefined && !["binary", "any"].includes(spec.alphaMode)) {
    throw Error("invalid_pixel_alpha_mode");
  }
  if (Object.keys(spec).some(key => !["nativeSize", "maxColors", "alphaMode"].includes(key))) {
    throw Error("unknown_pixel_art_option");
  }
  return spec;
}

function inspectPixelArt(rgba, width, height, spec) {
  validatePixelArtSpec(spec);
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
    rgba.length !== width * height * 4) throw Error("invalid_rgba_buffer");

  const [nativeWidth, nativeHeight] = spec.nativeSize;
  const scaleX = width / nativeWidth;
  const scaleY = height / nativeHeight;
  const scale = Number.isInteger(scaleX) && scaleX > 0 && scaleX === scaleY ? scaleX : null;
  const problems = [];
  if (scale === null) problems.push("pixel_canvas_scale_mismatch");

  let partialAlphaPixels = 0;
  const colors = new Set();
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const alpha = rgba[offset + 3];
    if (alpha !== 0 && alpha !== 255) partialAlphaPixels++;
    if (alpha > 0 && (spec.maxColors === undefined || colors.size <= spec.maxColors)) {
      colors.add(`${rgba[offset]},${rgba[offset + 1]},${rgba[offset + 2]},${alpha}`);
    }
  }
  if (spec.alphaMode === "binary" && partialAlphaPixels) problems.push("pixel_partial_alpha");
  if (spec.maxColors !== undefined && colors.size > spec.maxColors) problems.push("pixel_palette_limit_exceeded");

  if (scale !== null && scale > 1) {
    let mismatch = false;
    outer: for (let y = 0; y < height; y += scale) {
      for (let x = 0; x < width; x += scale) {
        const origin = (y * width + x) * 4;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const offset = ((y + dy) * width + x + dx) * 4;
            for (let channel = 0; channel < 4; channel++) {
              if (rgba[offset + channel] !== rgba[origin + channel]) {
                mismatch = true;
                break outer;
              }
            }
          }
        }
      }
    }
    if (mismatch) problems.push("pixel_grid_interpolation_or_misalignment");
  }

  return {
    nativeSize: [nativeWidth, nativeHeight],
    actualSize: [width, height],
    integerScale: scale,
    visibleColors: colors.size,
    colorCountTruncated: spec.maxColors !== undefined && colors.size > spec.maxColors,
    partialAlphaPixels,
    problems,
  };
}

module.exports = { validatePixelArtSpec, inspectPixelArt };
