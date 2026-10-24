export const ASSET_ROOT = '../../docs/assets/candidates/';

// Crop rectangles are reviewed against the existing Crownless forest atlas.
export const FRAMES = Object.freeze({
  oak: [0, 0, 660, 610], pine: [685, 0, 325, 610],
  arch: [1000, 65, 536, 545], rocks: [0, 695, 550, 329],
  wall: [565, 680, 580, 344], shrine: [1180, 610, 356, 414]
});

export const SCENERY = Object.freeze([
  { type: 'oak', x: 65, y: 335, h: 242 },
  { type: 'pine', x: 365, y: 331, h: 218 },
  { type: 'wall', x: 438, y: 339, h: 80 },
  { type: 'arch', x: 535, y: 325, h: 188 },
  { type: 'pine', x: 713, y: 333, h: 229 },
  { type: 'shrine', x: 850, y: 353, h: 154 },
  { type: 'oak', x: 1002, y: 334, h: 225 }
]);

// This is a single authored ground texture, not an engine or physics system.
// Keeping it identical makes rendering and interaction differences comparable.
export function makeGroundCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1050; canvas.height = 242;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4b553f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 71;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let x = 0; x < canvas.width; x += 3) {
    const cy = 112 + 21 * Math.sin(x / 125);
    ctx.fillStyle = '#8e8265'; ctx.fillRect(x, cy - 43, 3, 92);
  }
  for (let i = 0; i < 6600; i++) {
    const x = Math.floor(rand() * 525) * 2, y = Math.floor(rand() * 121) * 2;
    const pathY = 112 + 21 * Math.sin(x / 125);
    const colors = Math.abs(y - pathY) < 43
      ? ['#b4a386', '#a9997b', '#746b51', '#94876a']
      : ['#384934', '#62714b', '#4d6040', '#687651'];
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(x, y, 2 + Math.floor(rand() * 3), 2);
  }
  return canvas;
}
