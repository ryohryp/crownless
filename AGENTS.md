# AGENTS.md

This repository contains **Crownless**, a location-discovery expedition RPG in a medieval fantasy world.

## Product direction

The current canonical product direction is documented in:

- `docs/adr/0002-idle-expedition-pivot.md`
- `docs/game-system-design.md`
- GitHub Issue #189 (completed decision record)

This is no longer an experimental pivot. Treat **Location × Expedition RPG** as the product direction unless a later explicit ADR deliberately changes it.

Preserve these current pillars unless a later deliberate design change is documented:

- real-world movement reveals and expands the Crownless world
- the player prepares and dispatches companions into discovered places
- time passes between dispatch and result
- expedition reports, consequences, loot, and new knowledge drive the next decision
- survival / safe return matters
- equipment and companion traits should change expedition options, not only numbers
- medieval fantasy factions, territory, politics, and war remain future-compatible world layers

The canonical core loop is:

> **Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt**

The primary validation question is:

> **After dispatching an expedition, does the player want to reopen the game to see what happened?**

Real-time action combat is **not** part of the current core design. Existing stand-to-strike code, combat CSS, combat assets, and combat design documents are transition-era implementation / history unless explicitly repurposed by a current issue.

Elapsed-time / idle resolution is a mechanic inside expeditions, not the primary genre identity. Do not optimize the product toward generic idle-game conventions at the expense of location discovery, expedition judgment, anticipation, reports, and consequences.

## Canonical gameplay documents

Before changing gameplay, read:

1. `docs/game-system-design.md` — current overall gameplay Canon
2. `docs/expedition-system-spec.md` — expedition preparation, elapsed time, events, companions, outcomes, and reports
3. `docs/exploration-location-spec.md` — GPS / geography discovery and persistent world knowledge
4. `docs/hearth-presentation-spec.md` — Grey Hearth presentation and safe-state interaction

Older versioned documents and deprecated combat specifications do not override these files.

## Global visual design rule

Crownless has a deliberate visual identity built around a **living medieval manuscript / woodcut world**, not generic dark fantasy or realistic 3D.

For any task that creates, edits, implements, or evaluates visuals — including UI, CSS, Canvas, SVG, sprites, concept art, image prompts, maps, icons, characters, expedition reports, inventory presentation, or Grey Hearth presentation — read and inspect:

- `docs/visual-design-guide-v0.2.md` as the canonical visual-design rules
- `docs/assets/crownless-visual-design-reference-v0.1.jpg` as the canonical line / material / palette calibration image
- `assets/combat/minimal-v0.1/actors/` as the currently accepted character proportion / silhouette reference set where still useful
- `skills/crownless-visual-design/SKILL.md` as the execution and review workflow

Before invoking any image generator for a production asset, also read `docs/visual/IMAGE_GENERATION_HANDOFF.md` and perform its asset-only preflight. Issue/PR/progress/dashboard/report metadata must stay outside the generation request. If the generator returns meta-output instead of the requested game asset, reject it immediately; do not register it as a Candidate, reuse it as a parent, or blindly retry the same contaminated handoff.

Preserve the current visual grammar: hand-inked irregular linework, parchment / ash fields, woodcut / crosshatched shadow, restrained semantic color, compact **3–3.5-head-tall folk-doll manuscript characters**, annotation-like UI, and physical ink-like effects.

Character drift is a hard failure. Do not reinterpret “stylized” as modern glossy chibi, cute mascot, anime-gacha, realistic fantasy concept art, painterly illustration, or clean vector cartoon. **More stylized does not mean cuter.**

Do not drift back toward photorealistic rendering, glossy mobile-RPG UI, generic Diablo imitation, neon spectacle, or blue/purple/orange rarity-card language merely because those conventions are familiar.

A useful rejection test is:

> **If another dark-fantasy RPG could use the same visual by swapping the logo, reject it.**

## Location design rule

Do not reduce location gameplay to step-count rewards.

Real-world movement should reveal, discover, unlock, or develop the game world. Once a place is legitimately discovered, it can normally become an expedition destination that may be acted on later from a safe stationary context.

Location gameplay must remain safe and playable without requiring trespassing, dangerous travel, constant GPS precision, or prolonged phone attention while walking.

For exploration, map, location, regional-content, or AI-generation changes, read `docs/exploration-location-spec.md` and treat it as authoritative.

## Expedition design rule

Expeditions are the gameplay center.

The player should make a small number of meaningful decisions before dispatch:

- destination
- companions
- equipment / supplies
- objective
- risk policy

The game then resolves structured events over elapsed time and returns a report.

Combat may occur **inside** an expedition, but it is an event-resolution problem rather than a player-controlled action scene.

Do not recreate action-combat complexity through an overbuilt simulation platform. The first implementation may resolve elapsed time lazily on reopen using immutable dispatch inputs, a fixed seed, and deterministic rules.

For expedition changes, read `docs/expedition-system-spec.md`.

## Report design rule

The expedition report is a primary reward surface, not only debugging output.

Show a concise summary first:

- returned / delayed / missing / failed
- injuries
- important loot
- discoveries
- notable event

Then allow an optional chronological log built from structured events.

The first implementation does not require an LLM call per report. Prefer deterministic authored event text until the loop proves fun.

## Companion design rule

Companions should become memorable because of history, traits, injuries, rescues, and repeated survival — not because of gacha rarity.

Do not add a gacha / hero-collector framing unless a later product decision explicitly changes this.

Failure should prefer consequences that create another decision:

- tired
- injured
- early return
- lost carried value
- delayed
- missing
- captured
- rare death

Missing companions are especially valuable because they can create rescue expeditions.

## Grey Hearth presentation rule

The Grey Hearth is a **playable-feeling safe place**, not merely a dashboard between expeditions.

It should become the place where the player reviews reports, world knowledge, companions, secured equipment, injuries, and available destinations before dispatching again.

For hub layout, Hearth interactions, environmental progression, or safe-state presentation, read `docs/hearth-presentation-spec.md`.

Small Hearth interactions may exist without mechanical rewards when they make the place feel inhabited, but they must not become required chores or a separate management loop.

## Historical combat rule

The following are **deprecated as gameplay Canon** after ADR 0002:

- `docs/combat-presentation-spec.md`
- `docs/mobile-combat-v0.4.md`
- stand-to-strike controls and combat logic formerly described in `docs/game-system-design.md`

They may remain temporarily as implementation/history references while old runtime code is removed or repurposed.

Do not add or polish real-time combat, Technique, Evade, 闘志, 決着, combat HUD, battlefield weapon pickup, or combat-specific presentation unless a current issue explicitly authorizes that work under a later deliberate Canon decision.

Do not delete old combat runtime/resources blindly either. Trace runtime, tests, docs, manifests, and deployment references before cleanup.

## Development rule

Prefer short playable loops over long speculative design phases:

> **Design → smallest implementation → play → improve**

When choosing between architectural novelty and something that tests whether the expedition loop is fun, choose the playable improvement unless the simpler option creates a clear blocker.

## Before changing code

1. Read this file.
2. Read `docs/game-system-design.md`.
3. If the task touches expeditions, companions, equipment effects, elapsed-time resolution, outcomes, or reports, read `docs/expedition-system-spec.md`.
4. If the task touches exploration, maps, location data, GPS, regional flavor, or world discovery, read `docs/exploration-location-spec.md`.
5. If the task touches the Grey Hearth, read `docs/hearth-presentation-spec.md`.
6. If the task touches visuals, read `docs/visual-design-guide-v0.2.md`, inspect the visual reference, and read `skills/crownless-visual-design/SKILL.md`.
7. If an image generator will be used, also read `docs/visual/IMAGE_GENERATION_HANDOFF.md` and complete its preflight.
8. Inspect the current implementation and open issues before proposing replacement architecture.
9. Treat old combat and versioned gameplay documents as history when they conflict with the current Canon.
10. Preserve existing useful location, persistence, world-knowledge, visual, and deployment behavior unless there is a concrete reason to change it.

## Implementation expectations

- Keep the first playable slice small.
- Do not build a large backend/platform before dispatch → wait → report is fun.
- Prefer deterministic game logic testable without GPS or network access.
- Prefer deterministic elapsed-time resolution over an always-running simulation for the first PoC.
- Put device/location integrations behind interfaces so gameplay can run with simulated locations.
- Keep balance values and content data configurable rather than scattering magic numbers through code.
- Add tests around expedition idempotency, policy effects, injury, loot securing, discovery persistence, and save/load.
- Active expedition resolution must not duplicate outcomes after reload or repeated open.
- Never put paid AI provider API keys in the client.
- For visual implementation, prefer reusable low-cost techniques that can be playtested before committing to a production asset pipeline.
- Validate presentation with real phone-size screenshots or equivalent viewports.

## Resource lifecycle

Keep `main` centered on current gameplay, Canon, Approved assets, runtime sources, and intentionally maintained tools.

- Remove isolated experiments after useful behavior has been absorbed, unless explicitly retained.
- Do not keep Rejected, corrupt, or superseded generated Candidates solely for history; Git history is the default archive.
- Keep Candidate / Approved / runtime roles explicit.
- Older design documents may remain as history; they do not override current Canon.
- Before deleting old combat, Canon, Approved, runtime, deployment, or tooling sources, trace direct and dynamic references and update every authoritative reference.
- A file absent from `index.html` is not automatically unused; check dynamic loaders and tooling.

## Product priority

If a change makes the architecture cleaner but does not help answer whether **the player wants to come back for the expedition result**, it is probably not the next task.