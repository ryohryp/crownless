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

## Next production slice and acceptance gate

1. Rebuild **only the map tab** around exactly one owning component and a stable one-viewport layout: legible fantasy map; one summary card outside the map; one primary CTA; long lore behind an optional detail view. Do not pile the existing `bellPanel`, `visitorNotice`, `traceNotice`, and POI text in the first view.
2. Run the same saved scenarios through both implementations, on 360, 390, and 430px phones and desktop width. Assert no panel/card overlap, no document/nested scroll traps for the primary screen, all interactive targets actually reachable with touch, and no disappeared tactical information (ADR 0009). Inspect screenshots visually **before merge**; enforce review, not automated claims of subjective fun.
3. Preserve `parse/serialize` and journal migrations, and test existing real `demo` and `walk` saves. Use a single explicit save adapter and a separately testable location provider.
4. Once the first scene passes visual and live-play comparison, decide whether maintaining it in vanilla DOM or small Preact components produces the lower real maintenance cost. Migrate only that vertical slice; do not rewrite combat or forge simultaneously.
5. Trial Phaser/PixiJS on **one isolated animated scene** only if further human play finds that real visual rendering, not UI layering, is the repeat blocker. Compare real mobile frame times, memory, visual legibility, integration complexity, and player action value against the DOM baseline.

**Unmeasured:** subjective fun, real hardware frame times, network bundle transfer, iOS Safari behavior, genuine multi-account throughput. Do not infer them from this CI green result.
