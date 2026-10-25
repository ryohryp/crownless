import { Application, Assets, Container, Graphics, Sprite, Texture, Rectangle } from 'pixi.js';
import { createController } from './controller.js';
import { cameraX, SITES } from './gameplay.js';
import { ASSET_ROOT, FRAMES, SCENERY, makeGroundCanvas } from './scene-data.js';

const mount = document.getElementById('stage');
const controller = createController('PixiJS 8');

function drawHero(sword) {
  const g = new Graphics();
  g.ellipse(0, 0, 17, 5).fill({ color: 0x151e17, alpha: .4 });
  g.poly([-15, -7, 15, -7, 0, -56]).fill(0x322d26);
  g.roundRect(-12, -52, 24, 30, 6).fill(sword ? 0x87908a : 0x716c58);
  g.circle(0, -61, 10).fill(0xc9b696);
  g.rect(-12, -24, 9, 23).rect(3, -24, 9, 23).fill(0x39352d);
  if (sword) {
    g.moveTo(15, -27).lineTo(28, -72).stroke({ color: 0xc6c9c0, width: 6 });
    g.moveTo(10, -31).lineTo(20, -20).stroke({ color: 0x69543c, width: 4 });
  }
  return g;
}

async function boot() {
  const app = new Application();
  await app.init({
    resizeTo: mount, background: 0xbfc3a5, antialias: false,
    resolution: Math.min(devicePixelRatio || 1, 2), preference: 'webgl'
  });
  mount.appendChild(app.canvas);
  const [backdropTexture, atlasTexture] = await Promise.all([
    Assets.load(`${ASSET_ROOT}forest-hd2d-v0.2.png`),
    Assets.load(`${ASSET_ROOT}forest-objects-v1.png`)
  ]);
  const backdrop = new Sprite(backdropTexture);
  backdrop.width = 1050;
  backdrop.height = Math.max(app.screen.height + 30, 470);
  backdrop.y = -20;
  app.stage.addChild(backdrop);

  const world = new Container();
  app.stage.addChild(world);
  const ground = new Sprite(Texture.from(makeGroundCanvas()));
  ground.x = 0; ground.y = Math.max(180, app.screen.height - 266);
  world.addChild(ground);

  for (const item of SCENERY) {
    const [x, y, w, h] = FRAMES[item.type];
    const cropped = new Texture({ source: atlasTexture.source, frame: new Rectangle(x, y, w, h) });
    const sprite = new Sprite(cropped);
    sprite.anchor.set(.5, 1); sprite.x = item.x;
    sprite.y = app.screen.height - 75 + (item.y - 335);
    sprite.height = item.h; sprite.width = item.h * w / h;
    world.addChild(sprite);
  }

  const markers = SITES.map((site, i) => {
    const marker = new Graphics().circle(0, -5, 7).fill(i === 1 ? 0xae7458 : 0xe7d29c)
      .circle(0, -5, 10).stroke({ color: 0x2a3728, width: 2 });
    marker.x = site.x; marker.y = app.screen.height - 75;
    world.addChild(marker);
    return marker;
  });
  const heroUnarmed = drawHero(false), heroSword = drawHero(true);
  world.addChild(heroUnarmed, heroSword);

  const renderState = state => {
    const scroll = cameraX(state, app.screen.width);
    world.x = -scroll;
    backdrop.x = -scroll * .24;
    heroUnarmed.x = heroSword.x = state.x;
    heroUnarmed.y = heroSword.y = app.screen.height - 75;
    heroUnarmed.visible = !state.equipped; heroSword.visible = state.equipped;
    markers[0].alpha = state.gathered ? .18 : 1;
    markers[1].alpha = state.guardianDefeated ? .18 : 1;
    markers[2].alpha = state.shrineOpened ? .18 : 1;
  };
  controller.renderWith(renderState);
  app.stage.eventMode = 'static'; app.stage.hitArea = app.screen;
  app.stage.on('pointerdown', event => controller.pointAt(event.global.x + cameraX(controller.state, app.screen.width)));
  app.ticker.add(ticker => controller.tick(ticker.deltaMS));
  // Small, reversible FX layer; Phaser uses the same game without this hook.
  window.__rendererLabAttachEffects?.({ app, world, Graphics, Container, controller });
  controller.ready = true;
}

boot().catch(error => {
  document.getElementById('scene-prompt').textContent = `PixiJS起動に失敗: ${error.message}`;
  console.error(error);
});
