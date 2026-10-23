# Crownless development environment re-evaluation — 2026-10-23

Status: **provisional decision backed by a reversible browser spike**. This document does not authorize a whole-game migration or modify live player data.

Starting `main`: `f753c6878f7d97a0a4e9bbf83f3db281689ea6be` (PR #1046).

## Player outcome to optimize

1. Visit a real landmark safely, stop, and discover a distinctive fantasy place.
2. Enter an optional, enjoyable short expedition; return alive with material.
3. Ask the smith to make a visibly useful item; revisit the **same discovered place** and experience a new possibility.
4. Eventually leave an asynchronous, privacy-preserving trace that affects someone else.

The current action forest validates only part of this chain. `src/slice-app.js` launches `gemini-feel-lab.html` from a discovered wood, but `src/gemini-action-save.js` intentionally stores independent `crownless-action-forest-v1-*` material/gear state. The main account's equipment and action-forest equipment are **not** the same authority. The action lab is not yet proof of a geographically meaningful, persistent main-game loop.

## Inspected state

- `AGENTS.md`, ADR 0003/0005/0010/0011/0013/0014/0015, the 2026-10-11 architecture review, recent action PRs #1040/#1042/#1043/#1046, current code and tests.
- Main web slice: `expedition.html`, plain deferred JS and CSS, `src/slice-engine.js` for pure game rules, `src/slice-app.js` (1,025 lines, ~121 kB) for the central UI controller, and additional scene/presentation scripts.
- Action forest: `gemini-feel-lab.html` (2,790 lines, ~115 kB) with inline combat loop/rendering, `src/pixel-forest.js` for Canvas 2D scenery and separate small rule/save/input modules. Art and game rules are still entangled in one large HTML module, but the layered pixel scene itself is cheap to render in this limited test.
- Persistence: main `crownless-expedition-v1-*` mode saves with conflict detection; separate action-lab saves and private landmark records. Migration must never silently overwrite/mix those namespaces.
- CI: Node 22 unit tests plus pinned Playwright Chromium at 360/390/430px; Pages deploy follows a successful `main` push test; Vercel Production deployment is manual, with the geography API served separately. `vercel.json` disables automatic Git deployments.
- At inspection, latest main `test` run #39875075641 had a **successful unit-test job but canceled mobile-browser job**, so `deploy-pages` #39876175044 was skipped. The previous successful Pages deployment was at `acf41ae`. Do not presume the newest pixel forest is live merely because it was merged.
- Geography-health run #39859273067 failed: `/api/geography` returned 502 twice. Its three Overpass attempts included HTTP 406, HTTP 504, and 15 s timeouts. This is an actual core-product dependency risk, separate from the client renderer. The user-facing simulated fallback must remain explicit and playable.

## Reversible spike: eliminate runtime CSS CDN dependence in the action scene

Before: the action lab loaded Tailwind via `https://cdn.tailwindcss.com/3.4.17` at runtime. In headless Chromium where that request failed with `ERR_CERT_AUTHORITY_INVALID` (a test environment trust issue, **not** proof the public CDN is down), the 360px page rendered a 554px-wide canvas, the touch-action area began at Y=860px, and an actual touch produced no attack. The optional Google Fonts request failed too.

Trial: compile Tailwind 3.4.17 from `src/action-lab-tailwind.css` and commit the approximately 22 kB local `action-lab-utilities.css`. Leave input, combat, location, save namespaces, and source imagery unchanged. Add a lockfile, `npm ci`, and a CI check that regenerated CSS matches the committed file. The remote font remains optional; missing Japanese fonts in the local Linux runner limit screenshot typography judgments.

After: at 360/390/430 CSS pixels, the canvas fits the viewport, the right-hand touch area remains visible, and actual Chromium touch maps to `punch` at all three widths. The existing `playtest:pixel-forest` then completed **real-input combat → tracks → locked stone gate → safe return → craft sword → second combat → tracks → gate → return → save reload**, without mutating the main expedition save. The source-pixel aspect test was adjusted for unavoidable half-pixel integer Canvas dimension rounding, not disabled.

Rendering callback measurements (headless Chromium 141, about 3.5 s per variant/width; **not phone GPU or battery metrics**):

| Scene | Widths | 95th-percentile update+render callback | RAF interval |
| --- | --- | --- | --- |
| Pixel forest | 360/390/430 | 1.2–1.5 ms | ~16.7 ms |
| Earlier classic Canvas view | 360/390/430 | 0.5–0.8 ms | ~16.7 ms |

Inference: no measured Canvas 2D bottleneck currently justifies an engine migration. This comparison cannot assess artistic appeal, outdoor visibility, touch latency on a real phone, thermal throttling, iOS Safari, or desire for a second run.

## Options reconsidered

| Option | Potential gain | Cost/risk | Decision now |
| --- | --- | --- | --- |
| Keep everything as-is | No migration effort | Runtime CDN/layout fragility, large inline action module, repeated state/scene ownership mistakes | **No** |
| Selectively modernize the Web client; keep pure rules and Canvas | Low-risk offline assets, deterministic builds, clearer scene ownership, retains Pages and location integration | Some incremental dual-path work | **Yes — preferred** |
| Phaser only for the forest action scene | Spritesheets, cameras, animation tools, built-in scene/input primitives | Rebuild rendering/input, prove hardware performance, avoid duplicating game state | **Conditional isolated trial** |
| PixiJS in an isolated rendering layer | GPU composition, sprite/layer effects | Adds renderer and asset integration but not RPG/world rules | **Conditional visual trial** |
| Rebuild everything in Godot/Unity or native | Rich authoring/editor ecosystems, potentially advanced HD-2D effects | High porting cost, separate GPS/save/deployment, broad regression surface | **No** without a failed narrow trial and proven player benefit |

Phaser is Web-first and 2D; Godot Web export adds WebAssembly/WebGL2 platform requirements. Neither fixes a missing geographic-to-gear loop by itself. Actual physical-device and development-effort measurements must determine whether the selective Web approach remains best.

## Process corrections, in priority order

1. **Trustworthy release gate:** get the latest main phone job and Pages deployment green; forbid treating canceled checks as acceptance. Keep one canonical playable Pages URL. Reproduce offline/blocked external resource behavior in smoke checks.
2. **Geography reliability:** investigate the 502/406/timeouts; separate upstream incidents from application regressions. Keep simulated discovery clearly labeled and functional when upstreams fail. Do not add background tracking to compensate.
3. **One vertical slice:** safely bridge a specific discovered real landmark to the optional forest, then craft/equip and revisit that same place. Introduce a versioned, reversible adapter only after testing the current save contracts; avoid copying action-lab inventory directly into production saves.
4. **Developer iteration speed:** move the 2,790-line action scene toward one owned renderer/update module with a pinned local asset build. Trial Vite/TypeScript on that one scene if it reduces actual edit-to-browser time or regressions. Do not convert the 452 JS files all at once.
5. **Physical playtest:** measure launch/render/touch and 15-minute voluntary replay on Android (Pixel 9 is one useful target) and iOS Safari. Have a person record one enjoyable loop, one confusion, and whether they voluntarily start another expedition. CI is a precondition, not a fun verdict.

## Decision boundaries

- Preserve real-world location safety, explicit foreground checks, separate saved data and existing game availability.
- ADR 0005 explicitly rejected real-time action, whereas recent PRs and human feedback have revived a **scoped action-forest experiment**. Record a new human-backed product decision before elevating this into the main combat Canon. A merged experiment alone does not supersede the ADR.
- Consider Phaser/Pixi only if the same actual action forest on real phones demonstrates a sustained visual/animation limitation or lower engineering cost than Canvas. Compare the **same** gameplay actions, art, frame pacing, load time, input response, battery, debugging/edit cycle, and save correctness before switching.
- Keep any trial behind a reversible route/flag; do not overwrite production saved records. A successful synthetic benchmark never proves replay desire.

### Immediate recommendation

Review and merge the small local-CSS/lockfile/CI spike after checks and visual review, then make the geography-to-action-to-craft-to-revisit vertical slice the next single player-facing experiment. Do not schedule an engine rewrite now.
