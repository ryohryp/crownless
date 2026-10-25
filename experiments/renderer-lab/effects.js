// Optional PixiJS-only forest FX. The same gameplay and input model runs with FX off.
// Loaded before dist/pixi.js; Pixi constructors are handed in by the renderer on boot.
(function () {
  "use strict";
  window.__rendererLabAttachEffects = function attach({ app, world, Graphics, Container, controller }) {
    const state = controller.state;
    const stage = app.stage;
    const far = new Container();
    const haze = new Container();
    const fireflies = new Graphics();
    const foreground = new Graphics();
    const particles = new Graphics();
    const eventGlow = new Graphics();
    const guardian = new Graphics();
    const shrineGlow = new Graphics();
    const guide = new Graphics();
    const moonlight = new Graphics();
    stage.addChildAt(far, 1); // backdrop / distant haze / world
    stage.addChild(haze, foreground, fireflies);
    world.addChild(guardian, shrineGlow, guide, particles, eventGlow);
    far.addChild(moonlight);

    let enabled = true;
    let time = 0;
    let flash = 0;
    let shake = 0;
    let lastMode = state.mode;
    let lastHerb = state.heldHerbs;
    let lastIron = state.heldIron;
    let lastRelic = state.heldRelic;
    let lastDefeated = state.guardianDefeated;
    let lastOpened = state.shrineOpened;
    let motes = [];
    const colors = { gather: 0xc7dfa1, battle: 0xf2c78c, shrine: 0xf2e1a0 };

    function burst(x, y, kind) {
      const color = colors[kind] || colors.gather;
      motes = Array.from({ length: 17 }, (_, i) => ({
        x, y, vx: Math.cos(i * 2.399) * (35 + (i % 5) * 19),
        vy: Math.sin(i * 2.399) * (38 + (i % 4) * 15) - 29,
        age: 0, life: 480 + (i % 4) * 125, color,
        size: 2 + (i % 3)
      }));
      flash = 240;
      if (kind === "battle") shake = 185;
    }

    function enable(next) {
      enabled = Boolean(next);
      far.visible = enabled;
      haze.visible = enabled;
      foreground.visible = enabled;
      fireflies.visible = enabled;
      guardian.visible = enabled;
      shrineGlow.visible = enabled;
      guide.visible = enabled;
      particles.visible = enabled;
      eventGlow.visible = enabled;
      const button = document.getElementById("fx-toggle");
      if (button) {
        button.hidden = false;
        button.setAttribute("aria-pressed", String(enabled));
        button.textContent = enabled ? "演出 ON" : "演出 OFF";
      }
      if (!enabled) { shake = 0; world.x = -Math.max(0, camera()); }
    }
    function camera() {
      const width = app.screen.width;
      return Math.max(0, Math.min(1050 - width, state.x - width * 0.42));
    }

    const button = document.getElementById("fx-toggle");
    if (button) button.addEventListener("click", () => enable(!enabled));

    function render(dt) {
      const width = app.screen.width;
      const height = app.screen.height;
      if (!width || !height) return;
      time += dt;
      const scroll = camera();

      // A second, slower parallax layer with pale moonbeams and distant pine silhouettes.
      moonlight.clear();
      moonlight.poly([
        -100, height * .14, 140, height * .1, 300, height * .8, 115, height * .8
      ]).fill({ color: 0xf7eecf, alpha: .105 });
      moonlight.poly([
        300, height * .0, 420, height * .0, 690, height * .8, 515, height * .8
      ]).fill({ color: 0xffedd1, alpha: .075 });
      for (let i = 0; i < 13; i++) {
        const x = i * 108 - 50;
        const y = height * (.70 + (i % 3) * .025);
        moonlight.poly([x-30,y, x,y-145-(i%4)*14, x+30,y]).fill({ color: 0x172c2b, alpha: .19 });
      }
      far.x = -scroll * .12;

      // Slow, translucent ground mist. No blur filters or new textures / assets.
      haze.removeChildren();
      const fog = new Graphics();
      const drift = Math.sin(time / 2600) * 22;
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 4; i++) {
          const x = (i * width / 3) - 75 + drift * (row % 2 ? -1 : 1);
          const y = height * (.62 + row * .115);
          fog.ellipse(x, y, width * .27, 19 + row * 14)
            .fill({ color: 0xc7dfc2, alpha: .045 + row * .014 });
        }
      }
      haze.addChild(fog);

      // Dark branches at the near edge, with gentle camera counter-motion.
      foreground.clear();
      const wave = Math.sin(time / 2400) * 4;
      foreground.poly([0,0, 36+wave,0, 11,86, 0,102])
        .fill({ color: 0x14201b, alpha: .52 });
      foreground.poly([width,0, width-34+wave,0, width-8,108, width,142])
        .fill({ color: 0x15231d, alpha: .46 });
      for (let i = 0; i < 9; i++) {
        const x = i * (width / 8);
        const y = height - (i % 3) * 13;
        foreground.ellipse(x, y+5, 38, 18).fill({ color: 0x233829, alpha: .25 });
      }

      const ground = height - 75;
      // A low glowing trail marks the nearest actionable site.
      guide.clear();
      const sites = [{ x:260, used:state.gathered }, { x:535, used:state.guardianDefeated }, { x:850, used:state.shrineOpened }];
      for (const site of sites) {
        if (site.used) continue;
        const near = Math.abs(site.x - state.x) < 160;
        guide.ellipse(site.x, ground - 4, near ? 34 : 21, near ? 9 : 5)
          .fill({ color: 0xf1d595, alpha: near ? .19 + Math.sin(time/360) * .06 : .11 });
      }

      // The bridge guardian appears from shadow as the player approaches.
      guardian.clear();
      const guarding = !state.guardianDefeated && (state.mode === "encounter" || Math.abs(state.x - 535) < 220);
      if (guarding) {
        const distanceAlpha = state.mode === "encounter" ? 1 : Math.max(.15, 1 - Math.abs(state.x - 535) / 300);
        guardian.ellipse(535, ground - 3, 28, 9).fill({ color: 0x080e0d, alpha: .43 * distanceAlpha });
        guardian.poly([513,ground-7, 518,ground-75, 535,ground-92, 552,ground-75, 560,ground-7])
          .fill({ color: 0x121c1b, alpha: .86 * distanceAlpha });
        guardian.roundRect(520,ground-100,30,33,12).fill({ color: 0x22312d, alpha: distanceAlpha });
        guardian.rect(526,ground-84,6,2).rect(540,ground-84,6,2)
          .fill({ color: 0xf4aa74, alpha: (.7 + .3 * Math.sin(time/270)) * distanceAlpha });
      }

      // Shrine signal is brighter only after the player creates a sword.
      shrineGlow.clear();
      if (!state.shrineOpened) {
        const glow = state.equipped ? .31 : .09;
        shrineGlow.circle(850,ground-72,34+Math.sin(time/420)*5)
          .fill({ color: 0xf3db91, alpha: glow * .3 });
        shrineGlow.circle(850,ground-72,9)
          .fill({ color: 0xffecc1, alpha: glow });
      }

      // Fireflies and the hero's visible warmth make the return journey feel alive.
      fireflies.clear();
      for (let i = 0; i < 12; i++) {
        const x = (i * 89 + Math.sin(time / (700 + i * 55) + i) * 19 - scroll * .33) % (width + 90);
        const y = height * (.25 + (i % 6) * .11) + Math.sin(time / 570 + i) * 8;
        const alpha = .11 + Math.max(0, Math.sin(time/370 + i * 1.9)) * .24;
        fireflies.circle(x,y,1.2 + i%2).fill({ color: 0xe8e7a3, alpha });
      }
      const heroX = state.x - scroll;
      fireflies.circle(heroX, ground-42, 35).fill({ color: 0xf4ce8b, alpha: .035 });
      fireflies.circle(heroX, ground-42, 16).fill({ color: 0xffe2a1, alpha: .035 });

      if (state.heldHerbs > lastHerb) burst(260, ground-36, "gather");
      if (state.heldIron > lastIron || (!lastDefeated && state.guardianDefeated)) burst(535, ground-64, "battle");
      if (state.heldRelic > lastRelic || (!lastOpened && state.shrineOpened)) burst(850, ground-85, "shrine");
      if (state.mode === "encounter" && lastMode !== "encounter") { flash = 165; shake = 45; }
      lastMode = state.mode; lastHerb = state.heldHerbs; lastIron = state.heldIron;
      lastRelic = state.heldRelic; lastDefeated = state.guardianDefeated; lastOpened = state.shrineOpened;

      particles.clear();
      for (const mote of motes) {
        mote.age += dt;
        mote.x += mote.vx * dt / 1000;
        mote.y += mote.vy * dt / 1000;
        mote.vy += 80 * dt / 1000;
        const life = Math.max(0, 1 - mote.age / mote.life);
        if (life > 0) particles.circle(mote.x, mote.y, mote.size * life).fill({ color: mote.color, alpha: life * .95 });
      }
      motes = motes.filter(mote => mote.age < mote.life);
      eventGlow.clear();
      if (flash > 0) {
        eventGlow.circle(state.x, ground-40, 58 + (240-flash) / 3)
          .stroke({ color: 0xf8d39b, width: 6, alpha: Math.min(.45, flash / 320) });
        flash = Math.max(0, flash - dt);
      }
      world.x = -scroll + (shake > 0 ? Math.sin(time * .16) * shake / 35 : 0);
      shake = Math.max(0, shake - dt);
    }

    let previous = 0;
    app.ticker.add(ticker => {
      const dt = Math.min(55, ticker.deltaMS || 16);
      if (enabled) {
        // ~30Hz FX update; base Pixi scene continues at native framerate.
        previous += dt;
        if (previous >= 30) { render(previous); previous = 0; }
      }
    });
    enable(true);
    window.__rendererLabEffectsReady = true;
    window.__rendererLabSetEffects = enable;
  };
})();
