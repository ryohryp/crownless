# AGENTS.md

This repository contains **Crownless**, a location-based medieval fantasy action hack-and-slash RPG.

## Product direction

Preserve these pillars unless a deliberate design change is documented:

- Wizardry-like dungeon exploration, party play, and tension around returning alive
- Kunio-kun-like direct and satisfying action combat
- Diablo-like loot hunting, itemization, and build construction
- GPS/location-based discovery of the game world
- Medieval fantasy factions, territory, politics, and war

The core loop is:

> Explore → Fight → Loot → Survive → Grow → Explore deeper

The player starts as an unknown person with no weapon. Unarmed combat must remain a legitimate play style rather than only a temporary tutorial state.

## Global visual design rule

Crownless has a deliberate visual identity built around a **living medieval manuscript / woodcut world**, not generic dark fantasy or realistic 3D.

For any task that creates, edits, implements, or evaluates visuals — including UI, CSS, Canvas, SVG, sprites, concept art, image prompts, combat effects, maps, icons, characters, enemies, inventory presentation, reports, or Grey Hearth presentation — read and inspect:

- `docs/visual-design-guide-v0.2.md` as the canonical visual-design rules
- `docs/assets/crownless-visual-design-reference-v0.1.jpg` as the canonical line / material / palette calibration image
- `assets/combat/minimal-v0.1/actors/` as the authoritative current combat-character proportion and silhouette set
- `skills/crownless-visual-design/SKILL.md` as the execution and review workflow

Before invoking any image generator for a production asset, also read `docs/visual/IMAGE_GENERATION_HANDOFF.md` and perform its asset-only preflight. Issue/PR/progress/dashboard/report metadata must stay outside the generation request. If the generator returns meta-output instead of the requested game asset, reject it immediately; do not register it as a Candidate, reuse it as a parent, or blindly retry the same contaminated handoff.

The older visual boards remain useful for linework, palette, materials, map/UI grammar, and physical ink effects. They are **not** authoritative for the old 4–5-head character proportion.

Preserve the current visual grammar: hand-inked irregular linework, parchment / ash fields, woodcut / crosshatched shadow, restrained semantic color, compact **3–3.5-head-tall folk-doll manuscript characters**, annotation-like UI, and physical ink-like combat effects.

Character drift is a hard failure. Do not reinterpret “stylized” as modern glossy chibi, cute mascot, anime-gacha, realistic fantasy concept art, painterly illustration, or clean vector cartoon. **More stylized does not mean cuter.**

Combat character art must also be authored for the gameplay camera: **oblique top-down / three-quarter battlefield view**, not a front-facing standing portrait that the renderer later tries to fake into perspective.

Do not drift back toward photorealistic rendering, glossy mobile-RPG UI, generic Diablo imitation, neon magic spectacle, or blue/purple/orange rarity-card language merely because those conventions are familiar.

A useful rejection test is:

> **If another dark-fantasy RPG could use the same visual by swapping the logo, or if the characters belong to a different illustration family than the accepted combat actors, reject it.**

## Location design rule

Do not reduce location gameplay to step-count rewards.

Real-world movement should reveal, discover, unlock, or develop the game world. The location layer must create meaningful exploration decisions while remaining safe and playable without requiring trespassing, dangerous travel, or constant GPS precision.

Exploration is moving toward a progressively revealed map rather than a text-branch / gamebook flow. For exploration, map, location, regional-content, or AI-generation changes, read `docs/exploration-location-spec.md` and treat it as the detailed subsystem specification. If an older generic exploration description conflicts with that file, the subsystem specification takes precedence.

## Combat presentation rule

Combat uses a **fixed oblique top-down battlefield view**. For combat camera, battlefield composition, HUD, visual readability, actor integration, combat assets, or combat-loot presentation changes, read `docs/combat-presentation-spec.md` and treat it as the detailed subsystem specification.

The current **stand-to-strike** combat model in `docs/game-system-design.md` remains authoritative for controls and combat logic. Do not add a light-attack button, virtual joystick, large skill cluster, party HUD, combat minimap, or persistent item-label carpet merely because those elements appear in conventional ARPGs or concept art.

For combat visuals:

- project actor **ground positions**, not actor anatomy
- render illustrated bodies in screen space with uniform X/Y scale
- use stable foot pivots and visible / alpha bounds
- draw overlapping actors back-to-front using their projected foot / ground Y ordering
- keep labels subordinate to silhouettes; avoid label carpets
- when enemy HUD elements crowd, use collision-aware placement and simplify non-priority labels before moving combatants for UI reasons
- never infer gameplay events from prototype drawing colors when an actual state/event source exists

A correct source PNG that looks wrong in-game is a renderer/presentation failure. A corrupt or unexpectedly transparent PNG is an asset failure. Diagnose which layer is wrong before compensating elsewhere.

## Grey Hearth presentation rule

The Grey Hearth is a **playable-feeling safe place**, not merely a dashboard between expeditions.

For hub layout, Hearth interactions, environmental progression, or how safe-state information is presented, read `docs/hearth-presentation-spec.md` and preserve the principle that existing gameplay state remains authoritative while secured progress becomes visible in the room.

Small Hearth interactions may exist without mechanical rewards when they make the place feel inhabited, but they must not become required chores or a separate management loop.

## Development rule

Prefer short playable loops over long speculative design phases:

> Design → smallest implementation → play → improve

When choosing between architectural novelty and something that makes the prototype more fun, choose the playable improvement unless the simpler option creates a clear blocker.

## Before changing code

1. Read this file.
2. Read `docs/game-system-design.md` as the canonical current gameplay design.
3. If the task touches visuals in any form, read `docs/visual-design-guide-v0.2.md`, inspect `docs/assets/crownless-visual-design-reference-v0.1.jpg`, inspect the accepted actor set when characters are involved, and read `skills/crownless-visual-design/SKILL.md`.
4. If the task will invoke an image generator for a production asset, also read `docs/visual/IMAGE_GENERATION_HANDOFF.md` and complete the asset-only preflight before generation.
5. If the task touches exploration, maps, location data, GPS, regional flavor, outdoor/stationary play, or AI-generated world content, also read `docs/exploration-location-spec.md`.
6. If the task touches combat camera, HUD, battlefield presentation, readability, actors, combat assets, or combat loot presentation, also read `docs/combat-presentation-spec.md`.
7. If the task touches the Grey Hearth hub, safe-room presentation, or environmental progression, also read `docs/hearth-presentation-spec.md`.
8. Inspect the current implementation and open issues before proposing a replacement architecture.
9. Treat older versioned design documents and old visual-proportion references as history when they conflict with canonical design, subsystem specifications, current implementation, or accepted combat actors.
10. Preserve existing decisions unless there is a concrete reason to change them.

## Implementation expectations

- Keep the first playable slice small.
- Avoid building large backend/platform systems before the core loop is fun.
- Prefer deterministic game logic that can be tested without GPS or network access.
- Put device/location integrations behind interfaces so gameplay can run with simulated locations.
- Keep balance values and content data configurable rather than scattering magic numbers through code.
- Add tests around progression, rewards, encounter resolution, inventory loss, and other high-impact game rules.
- Never put paid AI provider API keys in the game client. Regional AI generation must be host-side or batch-generated, persisted, and reusable.
- For visual implementation, prefer reusable low-cost techniques that can be playtested before committing to a production asset pipeline.
- For visual fidelity, fix actor silhouette / drawing grammar before trying to solve mismatch with filters, tinting, texture overlays, or extra decoration.
- For combat actor PNG changes, verify that the image decodes and contains a meaningful non-transparent silhouette. Do not use file byte size alone as an integrity test.
- For presentation changes, validate with a real phone-size screenshot or equivalent viewport, including crowded multi-enemy cases.

## Resource lifecycle

Keep `main` centered on current gameplay, Canon, Approved assets, runtime sources, and intentionally maintained tools.

- Remove isolated experiment pages, scripts, styles, and their dedicated tests after the useful behavior has been absorbed into the playable prototype, unless the experiment is explicitly designated as ongoing.
- Do not keep Rejected, corrupt, or superseded generated Candidates on `main` solely for history; Git history is the default archive.
- Keep Candidate / Approved / runtime roles explicit in manifests and asset READMEs.
- Older versioned design documents may remain when they are intentionally useful as historical design context; they do not override current Canon.
- Before deleting a Canon, Approved, runtime, deployment, or tooling source, trace direct and dynamic references and update every manifest, test, documentation reference, and runtime path that makes it authoritative.
- A file that is absent from `index.html` is not automatically unused; check dynamic loaders and server/tooling entry points before removal.

## Product priority

If a change makes the architecture cleaner but the game no more fun, it is probably not the next task.
