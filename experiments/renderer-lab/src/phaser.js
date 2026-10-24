import Phaser from 'phaser';
import { createController } from './controller.js';
import { cameraX, SITES, WORLD_WIDTH } from './gameplay.js';
import { ASSET_ROOT, FRAMES, SCENERY, makeGroundCanvas } from './scene-data.js';

const mount = document.getElementById('stage');
const controller = createController('Phaser 4');

function drawHero(scene, sword) {
  const g = scene.add.graphics();
  g.fillStyle(0x151e17, .4).fillEllipse(0, 0, 34, 10);
  g.fillStyle(0x322d26).fillTriangle(-15, -7, 15, -7, 0, -56);
  g.fillStyle(sword ? 0x87908a : 0x716c58).fillRoundedRect(-12, -52, 24, 30, 6);
  g.fillStyle(0xc9b696).fillCircle(0, -61, 10);
  g.fillStyle(0x39352d).fillRect(-12, -24, 9, 23).fillRect(3, -24, 9, 23);
  if (sword) {
    g.lineStyle(6, 0xc6c9c0).lineBetween(15, -27, 28, -72);
    g.lineStyle(4, 0x69543c).lineBetween(10, -31, 20, -20);
  }
  g.setDepth(20);
  return g;
}

class ForestScene extends Phaser.Scene {
  constructor() { super('Forest'); }

  preload() {
    this.load.image('forestBackdrop', `${ASSET_ROOT}forest-hd2d-v0.2.png`);
    this.load.image('forestAtlas', `${ASSET_ROOT}forest-objects-v1.png`);
    this.load.on('loaderror', file => {
      document.getElementById('scene-prompt').textContent = `画像を読み込めません: ${file.key}`;
    });
  }

  create() {
    const width = this.scale.width, height = this.scale.height;
    const backdrop = this.add.image(0, -20, 'forestBackdrop').setOrigin(0, 0).setDisplaySize(WORLD_WIDTH, Math.max(height + 30, 470)).setScrollFactor(.24, 0).setDepth(-4);
    this.cameras.main.setBackgroundColor('#bfc3a5');
    const floor = makeGroundCanvas();
    this.textures.addCanvas('forestFloor', floor);
    this.add.image(0, Math.max(180, height - 266), 'forestFloor').setOrigin(0, 0).setDepth(0);

    const atlas = this.textures.get('forestAtlas');
    for (const [name, frame] of Object.entries(FRAMES)) atlas.add(name, 0, ...frame);
    for (const item of SCENERY) {
      const frame = FRAMES[item.type], w = item.h * frame[2] / frame[3];
      this.add.image(item.x, height - 75 + (item.y - 335), 'forestAtlas', item.type)
        .setOrigin(.5, 1).setDisplaySize(w, item.h).setDepth(item.type === 'shrine' ? 8 : 2);
    }

    const markers = SITES.map((site, index) => {
      const marker = this.add.graphics().setDepth(11);
      marker.fillStyle(index === 1 ? 0xae7458 : 0xe7d29c, .93);
      marker.fillCircle(0, -5, 7);
      marker.lineStyle(2, 0x2a3728).strokeCircle(0, -5, 10);
      marker.x = site.x; marker.y = height - 75;
      return marker;
    });
    const unarmed = drawHero(this, false), sword = drawHero(this, true);
    const playerY = height - 75;
    this.scale.on('resize', size => {
      backdrop.setDisplaySize(WORLD_WIDTH, Math.max(size.height + 30, 470));
      this.children.each(child => {
        if (child === unarmed || child === sword) return;
      });
      // Portrait resize repositions the hero and context markers without resetting state.
      markers.forEach(marker => { marker.y = size.height - 75; });
    });
    controller.renderWith(state => {
      const h = this.scale.height - 75;
      unarmed.setPosition(state.x, h).setVisible(!state.equipped);
      sword.setPosition(state.x, h).setVisible(state.equipped);
      this.cameras.main.scrollX = cameraX(state, this.scale.width);
      markers[0].setAlpha(state.gathered ? .18 : 1);
      markers[1].setAlpha(state.guardianDefeated ? .18 : 1);
      markers[2].setAlpha(state.shrineOpened ? .18 : 1);
    });
    this.input.on('pointerdown', pointer => {
      const x = pointer.x + this.cameras.main.scrollX;
      controller.pointAt(x);
    });
    controller.ready = true;
  }

  update(_time, delta) { controller.tick(delta); }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: mount,
  width: Math.max(mount.clientWidth, 1), height: Math.max(mount.clientHeight, 1),
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { pixelArt: true, antialias: false },
  scene: [ForestScene],
  backgroundColor: '#bfc3a5',
  audio: { noAudio: true }
});
