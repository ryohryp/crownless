# Crownless Renderer Lab — Phaser 4 / PixiJS 8

**2026-10-23 experimental branch only.** This is not a migration of Crownless, an alteration to the active canvas forest, or a new source of player data.

## Purpose

Compare two actively maintained WebGL renderers using the **same** Crownless assets, deterministic forest scene, controls, and single game-state authority. A reversible test matters more than a promotional engine demo.

- Phaser **4.2.1**: more complete game framework (scene, camera, asset loader, resize, input).
- PixiJS **8.22.0**: rendering-oriented library (the app supplies camera, game-state, controls).
- Current Canvas 2D forest remains the baseline. Neither alternative replaces it in this branch.

## Try it

From repository root:

```bash
cd experiments/renderer-lab
npm ci
npm run build
cd ../..
npm start
```

Open `http://127.0.0.1:4173/experiments/renderer-lab/index.html?engine=phaser` or `?engine=pixi`. The `dist/` bundles are committed on this test branch for standalone preview without runtime npm/CDN dependency; regenerate them whenever source changes. The same existing PNG backgrounds and sprite frames are used by both.

On a phone, use held ◀/▶ or tap inside the world to approach a site and press 「調べる」. Pick a fight tactic, walk back to the left entrance, return with iron and herbs, craft a sword, revisit the forest and unlock the distant shrine. Keyboard arrows/A/D work on desktop.

## Human feedback and optional visual FX (2026-10-25)

On Pixel 9 the first Phaser and Pixi versions both displayed correctly after the mobile height fix, but the user **felt no difference**. That is evidence against migrating on engine choice alone; it is not an engine benchmark.

The new Pixi-only `effects.js` layer deliberately keeps the **same** gameplay and art while adding:
- slow parallax silhouettes, moon shafts, ground fog, fireflies and foreground framing;
- a guardian emerging near the bridge, glimmering unopened shrine and site hints;
- short bursts on gathering, defeating the guardian and opening the shrine, plus light camera shake;
- a 44px-or-better **演出 ON/OFF** button on the same Pixi route for a direct perceptual comparison.

FX are generated through PixiJS Graphics and Containers (no new image assets, network services, shader postprocessing or filters), throttled to about 30Hz while game input runs normally. The optional layer does not write game state. The Phaser version is an unchanged same-rules visual baseline. Toggle the effect off and compare in the same spot.

Browser CI smoke `node scripts/verify-renderer-lab-phone.cjs` checks that both renderers load at 360 / 390 / 430 CSS px, actions remain visible and clickable, FX can be disabled/re-enabled, and gathering still works. Real-device feeling, load cost and GPU memory remain a **human** acceptance gate; an emulator cannot certify fun.

## Comparison conditions

| Condition | Both engines |
| --- | --- |
| Scene assets | Existing `forest-hd2d-v0.2.png` and `forest-objects-v1.png`; same reviewed crop rectangles |
| Gameplay | One `src/gameplay.js` model; one `src/controller.js` HUD/input contract |
| Interaction | Touch, keyboard, click-to-move, contextual inspect, return, craft and revisit |
| Viewport | 360, 390 and 430 CSS px, safe-area-aware bottom controls |
| Rendering | WebGL where available; Phaser auto fallback, Pixi configured WebGL |
| Persistence | **None**. No GPS read, no API request, no account, no localStorage mutation |

Automated simulation asserts the two-expedition craft-and-revisit path; it does not prove either renderer feels fun. The page displays a rolling frame interval, which measures **ticker timing**, not pure GPU render time. Do not interpret 60 fps in a desktop automated browser as proof of actual phone performance or equal asset-load cost.

## Decision gate

Only choose an engine if hands-on phone testing establishes clearly better rendering clarity, tactile control or production speed than the existing Canvas 2D scene. Record loading time, frame pacing, memory, landscape/portrait resize, asset correctness, touch precision and maintainability. A renderer POC cannot justify reimplementing location privacy, inventory, saves, navigation or the rest of the app.

Official sources: [Phaser 4 releases](https://phaser.io/download/phaser4), [PixiJS 8 Application](https://pixijs.com/8.x/guides/components/application), [PixiJS 8 Graphics](https://pixijs.com/8.x/guides/components/scene-objects/graphics).
