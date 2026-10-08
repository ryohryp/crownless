# ADR 0010 — Adopt game-development tools selectively before considering engine migration

- **Status:** Accepted / current tooling decision
- **Date:** 2026-10-09
- **Builds on:** [AGENTS.md](../../AGENTS.md), [ADR 0003](0003-web-first-native-ready-location.md), [ADR 0005](0005-realtime-combat-rejected.md), [ADR 0008](0008-frontier-and-chronicle.md), [ADR 0009](0009-smartphone-combat-viewport-and-tactical-density.md), [Visual Canon](../visual-canon.md)
- **Scope:** Current playable web game, art production, rendering, and evaluation tooling

## Context

Crownless is a location-driven medieval-fantasy RPG. Its playable core currently uses plain JavaScript, HTML/CSS, and SVG. Real-world movement reveals places in a fictional neighborhood/world map. Combat is deliberate, choice-based, and **not** real-time action.

Recent work has exposed three different problems:

1. **Presentation reliability:** mobile layout, navigation, image sizing, and DOM update regressions consume iteration time.
2. **Visual consistency:** approved western-medieval × sumi-e art requires recognizable landmark silhouettes and consistent ink/paper treatment across map, place, shop, event, and combat surfaces.
3. **Player motivation:** discovering a district is not yet consistently exciting; a discovered place needs a distinctive reason to inspect, visit, claim, or revisit it.

A full game-engine migration could improve some visual workflows but would also introduce a second rendering/application model, migration costs, and new mobile/browser failure modes. It does not inherently solve the third problem.

## Decision

**Keep the current web-first game and adopt specialized development tools only when they remove a demonstrated bottleneck. Do not migrate the entire game to Phaser, Godot, Unity, or a native client now.**

This is not a permanent commitment to vanilla JS/DOM/SVG, nor a ban on game engines. Choose the smallest change that improves the playable loop and can be validated on a phone.

### 1. Stabilize the existing presentation path first

- Keep the current game rules, player state, location/discovery flow, and save contracts authoritative. Avoid reimplementing them in a new rendering framework.
- Fix concrete DOM ownership, scene sizing, touch/safe-area, image alignment, and navigation regressions in the affected screens; do not launch an unrelated whole-app rewrite.
- Prefer one clear owner for each rendered scene/subtree. Stop independent post-render patches from overwriting one another when a focused ownership fix is possible.
- Exercise existing tests and browser/playtest tooling; add targeted phone-sized screenshot or interaction regression checks when a repeated defect justifies them (e.g., Playwright). CI success alone is not playtest success.

### 2. Use art tools for art problems

- Use SVG/vector and paint tools such as Inkscape or Krita **as needed** for preparation, cropping, alignment, silhouettes, and ink-wash assets. No specific editor or proprietary format becomes required by this ADR.
- Establish per-asset **visible bounds, anchor/placement, aspect ratio, transparency, and intended on-screen role** for the assets actually used in a scene; do not demand identical pixel dimensions for unlike objects.
- Preserve [Visual Canon](../visual-canon.md): washi/parchment, expressive sumi-e washes, limited muted vermilion, legibility, and recognizable local landmarks. Do not replace the approved image reference with an automatically generated alternative.
- Create and integrate only the next needed asset. Inspect at 390×844 (and other relevant 360–430 px widths) before expanding the catalog.

### 3. Do not adopt a mapping engine just for map-like appearance

The current neighborhood/world view is a **fictional discovery map**, not a turn-by-turn road map. Preserve location privacy and safe-stop interactions. Continue with its lightweight presentation while that serves the game.

Evaluate MapLibre or another geospatial renderer only if a tested player-facing feature genuinely requires geographic layers or geographic interaction that the present implementation cannot reasonably provide. Introducing a renderer must not imply continuous GPS tracking, unsafe navigation prompts, or precise movement-history storage.

### 4. Trial a 2D game engine only at a proven rendering boundary

If real tests or playtests demonstrate that DOM/SVG cannot deliver an important scene affordably (e.g., layered character animation, compositing, or sustained frame performance), run **one reversible, isolated Phaser/Phaser Editor proof of concept**:

- one specific scene, with a baseline of the existing implementation;
- existing game rules, save format, combat decisions, and location provider remain unchanged;
- no duplicated game-state authority, unrelated UI migration, or real-time action combat;
- compare mobile usability, visual clarity, performance, maintenance cost, and effect on player choices;
- **keep, revise, or remove** the trial based on evidence. A successful demo does not authorize an engine-wide migration.

Godot/Unity remain alternatives only if future requirements actually demand their capabilities. Native packaging/Capacitor remains conditional on the background-discovery player benefit described by [ADR 0003](0003-web-first-native-ready-location.md).

### 5. Measure player value, not tooling adoption

Prioritize experiments that improve the loop:

**Explore → Fight → Loot → Return alive → Improve → Explore farther**

For the next slice, prioritize **one newly discovered local place with a distinct silhouette and a meaningful shop, event, rival trace, or reward** over building a generic game editor or animation system.

Acceptance evidence should distinguish:

1. **Deterministic:** unchanged progression/save/location behavior, no broken controls, relevant checks green.
2. **Visual/mobile:** coherent ink-wash language, readable scene and stable touch layout across phone viewports.
3. **Human play:** after about 15 minutes, does the player want one more expedition or to inspect another nearby place?

## Alternatives considered

| Option | Assessment |
| --- | --- |
| Migrate everything to Phaser now | Reject for now: unnecessary logic/UI migration before identifying a scene that benefits. |
| Rebuild in Godot or Unity now | Reject for now: larger tooling/platform shift without a proven player-facing gain. |
| Adopt MapLibre for all maps now | Reject for now: the active fantasy map is not a street-navigation surface. |
| Never use third-party game tools | Reject: a targeted editor, browser test tool, or renderer trial may reduce real defects and iteration cost. |
| Preserve web core; introduce tools per demonstrated need | **Selected:** smallest reversible path with fast playtest feedback. |

## Consequences and review triggers

- **Positive:** continue shipping and playtesting the current game; invest in art consistency, rendering stability, and place-specific discovery instead of a speculative rewrite.
- **Trade-off:** HTML/CSS/SVG layout and animation complexity remain real constraints. Revisit this decision when a reproducible bottleneck outweighs targeted fixes.
- **Reconsider engine adoption** when a concrete player-facing scene repeatedly fails visual/performance goals with current rendering, and an isolated engine trial demonstrably does better.
- **Reconsider native/map tooling** only when a validated location experience requires capabilities outside the current web/fantasy-map boundary.
- **Non-goals:** immediate dependency/editor installation, mass asset generation, full CSS rewrite, broad architecture framework, action-combat resurrection, or an automated belief that prettier art equals a better game.

This ADR guides *tool choice*. It does not supersede gameplay, smartphone, safety, or visual Canon decisions above.
