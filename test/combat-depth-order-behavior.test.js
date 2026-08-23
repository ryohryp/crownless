const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'combat-depth-order-v1.js'), 'utf8');

class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = true;
    this.globalCompositeOperation = 'source-over';
    this.filter = 'none';
    this.draws = [];
    this.stack = [];
    this.matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  getTransform() {
    return { ...this.matrix };
  }

  setTransform(a, b, c, d, e, f) {
    this.matrix = { a, b, c, d, e, f };
  }

  save() {
    this.stack.push({
      matrix: { ...this.matrix },
      globalAlpha: this.globalAlpha,
      imageSmoothingEnabled: this.imageSmoothingEnabled,
      globalCompositeOperation: this.globalCompositeOperation,
      filter: this.filter
    });
  }

  restore() {
    const state = this.stack.pop();
    if (!state) return;
    this.matrix = state.matrix;
    this.globalAlpha = state.globalAlpha;
    this.imageSmoothingEnabled = state.imageSmoothingEnabled;
    this.globalCompositeOperation = state.globalCompositeOperation;
    this.filter = state.filter;
  }

  drawImage(image, ...args) {
    this.draws.push({
      source: String(image.currentSrc || image.src || ''),
      args,
      matrix: { ...this.matrix }
    });
  }

  clearRect() {}
}

class FakeCanvas {
  constructor() {
    this.id = 'arena';
    this.rawContext = new FakeContext(this);
  }

  getContext(type) {
    return type === '2d' ? this.rawContext : null;
  }
}

function actorImage(pathname) {
  return { src: pathname, currentSrc: '' };
}

function drawAt(ctx, image, x, y) {
  ctx.setTransform(1, 0, 0, 1, x, y);
  ctx.drawImage(image, -10, -20, 20, 20);
}

test('player is depth-sorted between enemies by projected foot Y while ground weapons stay below actors', () => {
  let hudFlushes = 0;
  let hudResets = 0;
  const window = {
    CrownlessEnemyHud: {
      flush() { hudFlushes += 1; },
      reset() { hudResets += 1; }
    }
  };

  vm.runInNewContext(source, {
    HTMLCanvasElement: FakeCanvas,
    window,
    console
  }, { filename: 'combat-depth-order-v1.js' });

  const canvas = new FakeCanvas();
  const ctx = canvas.getContext('2d');
  const farEnemy = actorImage('assets/combat/minimal-v0.1/actors/enemy-rusher.png');
  const nearEnemy = actorImage('assets/combat/minimal-v0.1/actors/enemy-guard.png');
  const player = actorImage('assets/combat/minimal-v0.1/actors/player-unarmed.png');
  const weapon = actorImage('assets/combat/minimal-v0.1/weapons/dropped-sword.png');

  drawAt(ctx, farEnemy, 180, 120);
  drawAt(ctx, nearEnemy, 220, 320);
  drawAt(ctx, weapon, 200, 230);
  drawAt(ctx, player, 200, 220);

  assert.deepEqual(
    canvas.rawContext.draws.map((draw) => draw.source),
    [weapon.src, farEnemy.src, player.src, nearEnemy.src]
  );
  assert.deepEqual(
    { ...window.CrownlessCombatDepth.playerFoot },
    { x: 200, y: 220 }
  );
  assert.deepEqual(
    Array.from(window.CrownlessCombatDepth.enemyBounds, (entry) => entry.role),
    ['rusher', 'guard']
  );
  assert.equal(hudFlushes, 1);

  ctx.clearRect(0, 0, 960, 540);
  assert.equal(hudResets, 1);
  assert.equal(window.CrownlessCombatDepth.playerFoot, null);
  assert.equal(window.CrownlessCombatDepth.enemyBounds.length, 0);

  window.CrownlessCombatAssets = {
    status() { return { player: 'loading' }; }
  };
  const drawCountBeforeFallback = canvas.rawContext.draws.length;
  drawAt(ctx, farEnemy, 180, 140);
  assert.equal(canvas.rawContext.draws.length, drawCountBeforeFallback + 1);
  assert.equal(canvas.rawContext.draws.at(-1).source, farEnemy.src);
});
