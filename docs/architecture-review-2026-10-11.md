# Crownless — Full-stack technical architecture review (2026-10-11)

Status: **evidence-backed review / isolated spike**, not an approval to rewrite the game. Follow `AGENTS.md`, accepted ADR 0010, ADR 0003, and ADR 0011. Trigger: user-supplied screenshot showing stacked/overlapping map, district, NPC, trace, and navigation.

## Actual running system, not hypothetical modules

- Player URL `index.html` redirects to `expedition.html`. The production entrypoint explicitly loads **66 deferred JavaScript files and 15 CSS files**, about **331 KiB of uncompressed JS source and 107 KiB of uncompressed CSS** (source-file inventory, not payload, decoded transfer sizes or JS execution profile).
- `src/` contains 161 JS files; **95 are not direct script entries in expedition.html**. Some are useful to other tests or historical game prototypes (`game-core.js`, `world-atlas.js`, `expedition-system.js`, etc.). Treat these as **not loaded by this player entrypoint**, not proof they can be deleted.
- Active game rules live mainly in `src/slice-engine.js` (pure UMD exports compatible with Node and browser) and `src/neighborhood.js`. Multiple previous engines/prototypes also exist. Do not migrate or combine dormant systems blindly.
- The main UI owner `src/slice-app.js` builds long HTML strings and replaces `#game.innerHTML` each render. Numerous late-loaded scripts independently observe and patch the same subtree; e.g. `bottom-navigation.js`, `gear-selected-detail.js`, `return-feedback.js`, `combat-feedback.js`, `quick-re-expedition-ui.js`, `outdoor-usability.js`. A single view's ownership and layout invariants are not enforced.
- `living-map-home.css` overlays an absolute `#game>.living-map-home>.panel` above the map, with `max-height:420px;overflow:auto` for desktop, `max-height:min(36dvh,300px)` on phones. More state-dependent cards are appended by `explorePanel()`; the underlay map and nested panels also scroll. This code plausibly explains the *specific screenshot* without hypothesizing GPU/engine failure.
- `src/slice-app.js` reads/writes gameplay state under mode-specific `crownless-expedition-v1-*` localStorage keys. `slice-engine.parse` handles legacy migration and validates strong state constraints. Separate `travel-footprints.js` uses a versioned private journal; `travel-chronicle-ui.js` also performs storage mutations. UI framework changes must preserve these contracts and move writes behind one adapter rather than reset player saves.
- Foreground geolocation runs in the active UI on explicit player action. Future native support requires a replaceable provider; never add background tracking or precise movement histories without validated player value and privacy controls.
- GitHub Pages is the canonical player deployment. `test.yml` runs Node tests and pinned Playwright browser smoke at phone sizes. Screenshots are collected as artifacts, but uploading screenshots **is not an automated comparison of readability, overlap or visual quality**. Existing tests support rules and reachability, not fun.
- Shared multi-account economy remains conceptual: local saved state cannot be authoritative for other people's orders or equipment. Server authority becomes necessary only when cross-account commerce is implemented, per ADR 0011.

## Reversible boundary experiment — PR #967

An independent `architecture-lab.html` loads only `neighborhood.js`, `slice-engine.js`, and a tiny single-owner UI controller. It **reads the player's existing save**, never writes it, uses identical pure-engine transitions for selection/expedition/combat, and is not linked from the live game. It deliberately does **not** attempt to recreate all scenes or replace the production renderer.

The lab's phone viewport uses CSS Grid rows for **map → one selected-place card → footer** instead of overlaying a scrolling sheet above the map. No MutationObserver and no second app state authority. Real browser smoke verifies source-provenance player data, the resolved tower/NPC, choosing the signal, combat, strict map/card bounding-box separation, no viewport scroll, no JS errors, and **unchanged original localStorage bytes** at 360x800 and 390x844.

Verification for the isolated comparison: PR CI run `38113377086` (Node + Playwright) succeeded after the local dev server was taught to allowlist the lab files. This proves the *specific renderer/state boundary* is viable. It is not a frame-rate benchmark, an aesthetic human review, or proof that every other existing screen can migrate cheaply.

## Technology decision

| Choice | Assessment | Current action |
| --- | --- | --- |
| Preserve `slice-engine.js` and `neighborhood.js` rules | Pure state transitions and serializable local saves already work in Node and alternative browser UI | **Keep**, split by domain only when changing a feature |
| Keep 66 independent production scripts and stacked CSS as-is | Repeated screen ownership/overlap regressions, recent human rejection | **Change**, prioritize one scene subtree owner |
| Add Vite / TypeScript | Helps dependency graph, controlled bundles, typed boundaries; needs a new build step and GitHub Pages `/crownless/` asset base | **Trial when migrating the first real scene**, not wholesale immediately |
| Add Preact | Useful for explicit, testable ownership of map/card/buttons; no prerequisite for the engine to work | **Candidate for one production scene after comparing the lab** |
| Phaser | Provides 2D scenes, sprites and animation; duplicates the current map/DOM model if introduced broadly | **Defer**, isolated scene only after a measurable rendering need |
| PixiJS | Strong layer/effects/GPU rendering; not a game progression, input-form, save or location solution | **Defer** until visual compositing requires it |
| Godot / Unity / native shell | Broad platform and authoring migration; no evidence that the non-real-time tactical loop requires it | **Do not adopt now** |
| New backend / real-time network | Shared economy requires server authority, but local NPC trace can validate play before accounts | **Defer** until multi-account transaction spike |

The accepted [ADR 0010](adr/0010-selective-game-tooling-before-engine-migration.md) is **confirmed rather than superseded** by this experiment: selectively adopt game tools when a rendering boundary has a proven problem.

## Production map rollout — PR #968

The user authorized promoting the successful PR #967 UI boundary experiment into production. This change replaces **only** the home neighborhood Explore tab with `src/nearby-home-view.js` (single scene owner) and `neighborhood-rebuild.css`. The existing `slice-engine.js`, `neighborhood.js`, save parsers, location safety rules, actual expedition, battle, forge and character tabs continue unchanged.

Production map contract: a non-overlapping CSS grid containing a parchment fantasy-land map, one selected-location action card, and the same six-button persistent thumb dock. The compact card shows exactly one primary expedition CTA and one contextual route to details. Scouting, POI trade, stronger clue battles, one-time fictional NPC resources, restored-bell dialogue and landmark flags live in a **separate scrollable reading scene**, not layers above a live map. Discovered districts beyond six use bounded pagination; the saved selected district's page is shown on reload, preserving every discovered ID.

The new view has one owner but still uses existing CSS/JavaScript for other tabs; this is deliberately not a complete Preact/Vite conversion. Continued framework migration is conditional on observed maintenance benefit of this targeted slice.

Quality gate: Node regression including old/walk saved states, UI event routing, provenance and paginated POIs; actual Chromium touch paths 360×800, 390×844, 430×932 and 1280×900; elementFromPoint tap checks, three separate grid rectangles, no map scrolling, map >=40% viewport and nav at thumb reach; screenshots must be opened and visually inspected before merging. Keep `AGENTS.md` one scene per viewport requirement authoritative. The actual screenshots showed a legible wide parchment map and distinct CTA/dock, rather than the original overlay with stacked NPC paragraphs. **Human play-fun verdict remains pending.**

## Status after the first two production rollouts — 2026-10-11

The original rollout checklist below described **future work when PR #967 was opened**. Do not re-run it as if the first map slice were still unimplemented.

| Boundary | Evidence | Status |
| --- | --- | --- |
| Single-owner lab without game-state writes | PR #967, browser smoke and CI run `38113377086` | Complete for isolated map/expedition comparison |
| Production one-viewport neighborhood scene | PR #968, `src/nearby-home-view.js` and `neighborhood-rebuild.css` | Merged; Playwright phone-width checks passed on the PR |
| Production one-decision combat scene | PR #970, `combat-decision-scene.css`, battle UI changes and browser tests | Merged; the PR's test workflow succeeded |
| Travel-tab touch target repair | PR #966, real pointer navigation at 360/390px | Merged; still not proof that every button is usable on a physical phone |
| Old screenshot/Pages artifact accumulation | PR #969 and #971 | Cleanup workflows merged; verify runtime execution and account-wide quota separately |
| Actual 15-minute fun/playability verdict | Issue #717 | **Open**; cannot be inferred from CI or screenshots |
| iOS Safari and physical device behavior | No qualifying measurement in this review | **Unverified** |

### Current decision: no framework or engine migration

The original suspected blocker was overlapping DOM/CSS ownership, **not** a missing GPU game engine. PR #967 demonstrated a usable one-owner renderer with the same state engine. PRs #968 and #970 then applied focused changes to the live map and combat screens without Vite, Preact, Phaser, PixiJS, new state authority, or save-format migration.

**Keep this smaller stack for the next playtest.** The surviving `src/slice-app.js` and late-loaded view scripts remain maintenance risk, but 66 script entries alone do not justify a rewrite. Do not create a parallel UI framework merely to tidy file counts. Do not remove historical source modules based on the entrypoint inventory.

### Next unfinished gate

1. **Play the deployed tested build on a real phone**: start from the neighborhood; tap its main expedition and details actions; manually fight and use optional supplies; return with materials; change to smith, craft/equip, and go on one more expedition. Record the exact screen, action, device, failure, and whether another expedition is appealing, in #717. Repeat at least one key route on iOS Safari when available.
2. If a primary action cannot be tapped, or a panel overlaps at 360–430px, **fix that one owning scene first**, with a real Chromium pointer test and before/after screenshot. Do not compensate with another global overlay or `MutationObserver`.
3. Extract a shared save adapter or replaceable foreground-location provider **only when the next changed scene requires that seam**. Verify existing demo/walk records, cross-tab conflict protection, unreadable-save recovery, and landmark journal isolation. Do not move both systems speculatively.
4. Evaluate a small Preact + Vite vertical slice **only if subsequent changes show repeated ownership or maintenance failure** despite the current single-owner approach. Compare the same user actions, bundle/load cost, one-phone layout, number of competing render owners, and developer effort with the vanilla baseline. Keep one source of game state and restore the previous renderer easily.
5. Try Phaser/PixiJS only if a concrete animated scene exposes a measured DOM/SVG rendering limit, per accepted ADR 0010; compare on physical hardware before accepting the additional runtime.

**Stop condition:** If the map, combat, return, and craft loop is technically usable and maintenance remains tractable, stop environment work and prioritize #717's player-fun findings. CI green means the checks passed, not that the game is enjoyable.

**Still unmeasured:** real hardware frame times, iOS Safari, network bundle transfer, subjective player enjoyment, and cross-account server performance.
