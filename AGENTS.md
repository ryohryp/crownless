# AGENTS.md

This repository contains **Crownless**, a location-discovery territory-expansion RPG in a medieval fantasy world.

## Product direction

The current canonical product direction is documented in:

- `docs/adr/0004-territory-driven-reforge.md`
- `docs/game-system-design.md`
- GitHub Issue #503 (human-approved Reforge decision and validation scope)

ADR 0002 remains useful history and still governs compatible boundaries such as removal of real-time action combat, deterministic expedition resolution, and safe location play, but it no longer defines the current product-level loop or North Star.

Treat **Location × Territory RPG** as the current product direction unless a later explicit ADR deliberately changes it.

Preserve these current pillars unless a later deliberate design change is documented:

- real-world movement reveals and expands the Crownless world
- discovered places become things the player can learn about, contest, control, and use
- scouting / incomplete information creates meaningful risk before a contest
- companions, equipment, and approach should change what is possible or likely, not only add invisible numbers
- expeditions remain a principal way to act on places, but are a means rather than the product goal
- success can change persistent place control from NPC to player
- a controlled place must visibly change the Atlas and at least one later decision, approach, risk, duration, resource, or piece of information
- failure / retreat may create consequences, but does not grant control
- territory progression is driven by judgment and preparation, not by repetitive control XP grinding
- medieval fantasy factions, territory, politics, and war remain future-compatible world layers, but Phase 1 is NPC-only and deliberately small

The canonical product loop is:

> **Walk → Discover → Scout / Learn → Prepare → Contest / Expedition → Control → Exploit / Defend / Expand → Next place**

In Japanese:

> **歩く → 発見する → 偵察する → 攻略を準備する → 地点を争う → 支配する → 利用する／守る／広げる → 次の地点へ**

The primary validation question is:

> **自分の行動で勢力圏が広がった地図を見たとき、次の地点を取りたくなるか？**

Real-time action combat is **not** part of the current core design. Existing stand-to-strike code, combat CSS, combat assets, and combat design documents are transition-era implementation / history unless explicitly repurposed by a current issue.

Elapsed-time expedition resolution may remain useful, but do not optimize the product toward generic idle-game conventions. Waiting and reports only matter insofar as they support meaningful action on places, understandable consequences, and the next territorial decision.

## Canonical gameplay documents

Before changing gameplay, read:

1. `docs/adr/0004-territory-driven-reforge.md` — current product decision and supersession boundary
2. `docs/game-system-design.md` — current overall gameplay Canon
3. `docs/expedition-system-spec.md` — deterministic expedition preparation/resolution subsystem; use its detailed contracts under ADR 0004, not its superseded product-level “gameplay center” wording
4. `docs/exploration-location-spec.md` — GPS / geography discovery and persistent world knowledge
5. `docs/hearth-presentation-spec.md` — Grey Hearth presentation and safe-state interaction

Older versioned documents and deprecated combat specifications do not override these files or ADR 0004.

## Global visual design rule

Crownless has a deliberate visual identity built around a **living medieval manuscript / woodcut world**, not generic dark fantasy or realistic 3D.

For any task that creates, edits, implements, or evaluates visuals — including UI, CSS, Canvas, SVG, sprites, concept art, image prompts, maps, icons, characters, expedition reports, inventory presentation, territory presentation, or Grey Hearth presentation — read and inspect:

- `docs/visual-design-guide-v0.2.md` as the canonical visual-design rules
- `docs/assets/crownless-visual-design-reference-v0.1.jpg` as the canonical line / material / palette calibration image
- `assets/combat/minimal-v0.1/actors/` as the currently accepted character proportion / silhouette reference set where still useful
- `skills/crownless-visual-design/SKILL.md` as the execution and review workflow

Before invoking any image generator for a production asset, also read `docs/visual/IMAGE_GENERATION_HANDOFF.md` and perform its asset-only preflight. Issue/PR/progress/dashboard/report metadata must stay outside the generation request. If the generator returns meta-output instead of the requested game asset, reject it immediately; do not register it as a Candidate, reuse it as a parent, or blindly retry the same contaminated handoff.

Preserve the current visual grammar: hand-inked irregular linework, parchment / ash fields, woodcut / crosshatched shadow, restrained semantic color, compact **3–3.5-head-tall folk-doll manuscript characters**, annotation-like UI, and physical ink-like effects.

Character drift is a hard failure. Do not reinterpret “stylized” as modern glossy chibi, cute mascot, anime-gacha, realistic fantasy concept art, painterly illustration, or clean vector cartoon. **More stylized does not mean cuter.**

Do not drift back toward photorealistic rendering, glossy mobile-RPG UI, generic Diablo imitation, neon spectacle, blue/purple/orange rarity-card language, or a generic modern strategy-map aesthetic merely because those conventions are familiar.

A useful rejection test is:

> **If another dark-fantasy RPG could use the same visual by swapping the logo, reject it.**

Territory control must still read as part of a living manuscript/woodcut world. Do not solve ownership merely by turning the Atlas into flat modern colored polygons.

## Location design rule

Do not reduce location gameplay to step-count rewards.

Real-world movement should reveal, discover, unlock, or develop the game world. Once a place is legitimately discovered, it can normally be remembered and acted on later from a safe stationary context.

Location gameplay must remain safe and playable without requiring trespassing, dangerous travel, constant GPS precision, or prolonged phone attention while walking.

Do not persist raw latitude / longitude, exact route history, or exact movement tracks as territory state. Keep simulated location sufficient for deterministic development and tests.

For exploration, map, location, regional-content, or AI-generation changes, read `docs/exploration-location-spec.md` and treat its privacy and stable-identity contracts as authoritative under ADR 0004.

## Territory design rule

Territory is the current product center, but it is **not a renamed XP system**.

A place should matter because the player can learn something about it, make a preparation/approach decision, contest it, change its control state, and then see a meaningful consequence for the next place.

For the #503 Phase 1 slice, prefer authored scope over infrastructure:

- exactly enough state for three representative places
- NPC-controlled and player-controlled states
- visible strategic value / uncertainty
- scouting versus acting with incomplete information
- at least one companion / equipment / approach difference that affects the contest
- persistent NPC → player control on success only
- idempotent Report/reload behavior
- at least one captured-place effect that changes the next target's approach, risk, duration, resource, or information
- a clear next-target decision immediately after capture

Do not create a generalized territory scripting engine merely to support three places.

### Anti-grind

Do not introduce as the core control loop:

- a control XP/progress bar
- capture from killing N disposable enemies
- daily / stamina / energy chores
- arbitrary repetition of an already-solved contest
- tiny invisible percentage bonuses as the primary reward for control

Progress should come mainly from scouting, information, companion/equipment fit, route/approach choice, and the strategic effects of prior control.

### Phase 1 scope boundary

Do not add PvP, clan/guild war, seasons, rankings, always-on faction simulation, a new backend, mandatory cloud accounts, large economy simulation, a generic territory engine, large save migration, raw GPS history, or real-time combat.

If a large save migration, GPS/privacy change, security/auth change, backend/hosting change, or another irreversible architecture decision becomes necessary, stop at a human gate.

## Expedition design rule

Expeditions remain a major subsystem and a principal means of acting on places. They are **not** the ultimate product goal.

The player should make a small number of meaningful decisions before dispatch or contest, such as:

- destination
- companions
- equipment / supplies
- objective
- risk policy
- scouting state / approach where relevant

The game can resolve structured events over elapsed time and return a report. Reuse the existing deterministic resolver wherever practical for scouting, contesting, securing, exploiting, defending, or expanding a place.

Combat may occur **inside** an expedition, but it is an event-resolution problem rather than a player-controlled action scene.

Do not recreate action-combat complexity through an overbuilt simulation platform. Deterministic/lazy resolution using immutable dispatch inputs and fixed seeds remains preferred where it fits.

For expedition changes, read `docs/expedition-system-spec.md`, but resolve any product-level conflict in favor of ADR 0004 and `docs/game-system-design.md`.

## Report design rule

The expedition Report is an important causal/evidence surface, but it is no longer the primary product reward by itself.

A Report should make it clear what happened and why, including where relevant:

- returned / delayed / missing / failed
- injuries
- important loot / knowledge
- scouting or contest outcome
- decisions/approach that mattered
- control change or failure to take control
- strategic effect unlocked by a captured place
- the next meaningful target/decision

Prefer deterministic structured events. Do not add Report wording merely to manufacture novelty; Report work is valuable when it explains a real game-state or territorial consequence.

## Companion design rule

Companions should become memorable because of history, traits, injuries, rescues, geographic knowledge, and repeated survival — not because of gacha rarity.

Do not add a gacha / hero-collector framing unless a later product decision explicitly changes this.

Companions should increasingly answer a territorial question such as “who helps us take this place, and why?” rather than existing as generic power cards.

Failure should prefer consequences that create another decision:

- tired
- injured
- early return
- lost carried value
- delayed
- missing
- captured
- rare death

## Grey Hearth presentation rule

The Grey Hearth is a **playable-feeling safe place**, not merely a dashboard.

It is where the player can understand reports, companions, equipment, injuries, discoveries, controlled places, and the next attempt before acting on the map again.

For hub layout, Hearth interactions, environmental progression, or safe-state presentation, read `docs/hearth-presentation-spec.md`.

Small Hearth interactions may exist without mechanical rewards when they make the place feel inhabited, but they must not become required chores or a separate management loop.

## Historical combat rule

The following are **deprecated as gameplay Canon** after ADR 0002 and remain deprecated under ADR 0004:

- `docs/combat-presentation-spec.md`
- `docs/mobile-combat-v0.4.md`
- stand-to-strike controls and combat logic formerly described in `docs/game-system-design.md`

They may remain temporarily as implementation/history references while old runtime code is removed or repurposed.

Do not add or polish real-time combat, Technique, Evade, 闘志, 決着, combat HUD, battlefield weapon pickup, or combat-specific presentation unless a current issue explicitly authorizes that work under a later deliberate Canon decision.

Do not delete old combat or expedition runtime/resources blindly. Trace runtime, tests, docs, manifests, and deployment references before cleanup.

## Development rule

Prefer short playable loops over long speculative design phases:

> **Design → smallest implementation → play → improve**

When choosing between architectural novelty and something that tests whether taking a place makes the next place desirable, choose the playable vertical slice unless the simpler option creates a clear blocker.

For autonomous task selection, follow the **Gameplay Gate** in `docs/autonomous-development-policy.md`. A gameplay innovation must add a meaningful player-visible change or decision in the Territory-driven loop and be playable end-to-end as a smallest slice; **CI green means Implemented, not fun**. Record gameplay work as **Playtest pending → Keep / Change / Kill** after human playtest.

For any human gameplay playtest, play-feel evaluation, or Keep / Change / Kill decision, read `skills/crownless-playtest/SKILL.md` and use it as the execution and recording workflow. Keep implementation evidence, automated validation, observed play behavior, and player judgment distinct; never infer a gameplay verdict from CI or static review.

Do not treat another isolated location-specific binary choice, Report text addition, tiny UI tweak, or expedition-result optimization as sufficient product innovation merely because it is low risk. It must serve the new North Star or be necessary maintenance.

## Before changing code

1. Read this file.
2. Read `docs/adr/0004-territory-driven-reforge.md` and `docs/game-system-design.md`.
3. Read Issue #503 while the Territory Phase 1 acceptance criteria remain incomplete.
4. If the task touches expeditions, companions, equipment effects, elapsed-time resolution, outcomes, or reports, read `docs/expedition-system-spec.md`.
5. If the task touches exploration, maps, location data, GPS, regional flavor, or world discovery, read `docs/exploration-location-spec.md`.
6. If the task touches the Grey Hearth, read `docs/hearth-presentation-spec.md`.
7. If the task touches visuals, read `docs/visual-design-guide-v0.2.md`, inspect the visual reference, and read `skills/crownless-visual-design/SKILL.md`.
8. If an image generator will be used, also read `docs/visual/IMAGE_GENERATION_HANDOFF.md` and complete its preflight.
9. If the task is a gameplay playtest, play-feel evaluation, or Keep / Change / Kill decision, read `skills/crownless-playtest/SKILL.md` before evaluating the slice.
10. Inspect current implementation, open issues/PRs, recent merged work, and current CI before proposing replacement architecture.
11. Treat old product-level expedition wording and old combat documents as history when they conflict with ADR 0004.
12. Preserve useful location, persistence, world-knowledge, expedition, visual, and deployment behavior unless there is a concrete reason to change it.

## Implementation expectations

- Keep the first Territory playable slice small: three authored places, not a platform.
- Reuse the existing deterministic expedition resolver where practical.
- Do not build a large backend/platform before the three-place territory hypothesis is fun.
- Prefer deterministic game logic testable without GPS or network access.
- Keep device/location integrations behind interfaces so gameplay can run with simulated locations.
- Keep balance values and content data configurable rather than scattering magic numbers through code.
- Add tests around territory control idempotency, failure/retreat non-capture, captured-place effects, expedition idempotency, injury, loot/knowledge persistence, and save/load where touched.
- Reapplying a Report or reopening must not duplicate control, rewards, or consequences.
- Never put paid AI provider API keys in the client.
- For visual implementation, prefer reusable low-cost techniques that can be playtested before committing to a production asset pipeline.
- Validate presentation with real phone-size screenshots or equivalent viewports.

## Resource lifecycle

Keep `main` centered on current gameplay, Canon, Approved assets, runtime sources, and intentionally maintained tools.

- Remove isolated experiments after useful behavior has been absorbed, unless explicitly retained.
- Do not keep Rejected, corrupt, or superseded generated Candidates solely for history; Git history is the default archive.
- Keep Candidate / Approved / runtime roles explicit.
- Older design documents may remain as history; they do not override current Canon.
- Before deleting old combat, expedition, Canon, Approved, runtime, deployment, or tooling sources, trace direct and dynamic references and update every authoritative reference.
- A file absent from `index.html` is not automatically unused; check dynamic loaders and tooling.

## Product priority

If a change makes the architecture cleaner or makes an expedition/report incrementally richer but does not help answer whether **seeing the map change makes the player want to take the next place**, it is probably not the next product task.
