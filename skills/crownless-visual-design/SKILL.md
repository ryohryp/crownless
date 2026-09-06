---
name: crownless-visual-design
description: Create, implement, or review Crownless visuals using its living medieval manuscript and woodcut Canon. Use for World Atlas and territory states, scouting and contests, expedition reports, companions, Grey Hearth, discovery maps, equipment, UI, and game assets.
---

# Crownless Visual Design

## Scope and authority

Support **Location × Territory RPG** and the canonical loop **Walk → Discover → Scout / Learn → Prepare → Contest / Expedition → Control → Exploit / Defend / Expand → Next place**. Presentation should make world change, uncertainty, strategic value, and the next meaningful territorial decision legible without turning Crownless into a generic strategy-map game.

Read [AGENTS.md](../../AGENTS.md), [ADR 0004](../../docs/adr/0004-territory-driven-reforge.md), and [current gameplay Canon](../../docs/game-system-design.md), then [the visual guide](../../docs/visual-design-guide-v0.2.md). Inspect [the global calibration image](../../docs/assets/crownless-visual-design-reference-v0.1.jpg) and the accepted character examples in `../../assets/combat/minimal-v0.1/actors/` for proportion and silhouette where useful. Do not reload sources already inspected in this task unless they changed.

**Authority is scoped:** ADR 0004 and current gameplay Canon define the product identity, loop, North Star, and Territory-driven behavior. The visual guide governs linework, material, palette, and character proportions. Current subsystem specs govern behavior, camera needs, controls, and screen purpose. [ADR 0002](../../docs/adr/0002-idle-expedition-pivot.md) remains historical/compatible context only where ADR 0004 preserves it; it does not restore the old expedition-result North Star or authorize Technique, Evade, combat HUD, or a battlefield as current gameplay.

Read the subsystem relevant to the requested work:

- Preparation, companions, equipment effects, elapsed-time resolution, outcomes, or reports: [expedition specification](../../docs/expedition-system-spec.md). Use its detailed contracts under ADR 0004; do not inherit superseded product-level claims that expeditions are the final purpose.
- Discovery, maps, locations, regional visuals, or geography: [exploration and location specification](../../docs/exploration-location-spec.md).
- Room composition, safe-state interaction, recovery, or preparation from the Hearth: [Hearth presentation specification](../../docs/hearth-presentation-spec.md).
- Named character identity or asset selection: [Character Visual Canon](../../docs/visual/CHARACTER_VISUAL_CANON.md). Resolve the current Approved Anchor there; runtime atlases and historical pose sheets have different roles.
- Explicitly authorized maintenance or repurposing of existing actor rendering: [legacy actor presentation](references/legacy-actor-presentation.md). Read only the applicable checks. Do not apply battlefield viewpoint or enemy-HUD rules to unrelated Hearth, Atlas, or report scenes.

Keep the requested scope. A visual review does not authorize generating replacement art, promoting Candidates, changing gameplay, or redefining Territory Canon.

## Product-level visual target

The Territory-driven North Star is:

> **自分の行動で勢力圏が広がった地図を見たとき、次の地点を取りたくなるか？**

For visual work, that means the player should be able to see enough of the causal chain to understand:

1. what is still unknown or only partially known,
2. who controls a place now,
3. why a place matters,
4. what changed because the player succeeded or failed,
5. how taking one place affects another,
6. and what target is worth considering next.

The former expedition-result question may still be useful for Report readability, but it is not the current product-level North Star.

## Visual lock

Crownless is a playable medieval manuscript: rough hand-inked figures and places, woodcut texture, parchment negative space, and a world that gains knowledge and restrained color.

- Use irregular ink contours, crosshatched shadows, muted flat or lightly textured color, imperfect geometry, and physical ink marks.
- Humanoids are compact **3–3.5-head-tall folk-doll figures** with short limbs, tiny symbolic faces, restrained expressions, and weathered asymmetric equipment. Preserve silhouette and equipment identity before scene detail. Do not correct them toward realistic anatomy.
- Accepted actor proportions supersede the older calibration board's 4–5-head figures. Its linework, materials, palette, and manuscript grammar remain useful. An old battle illustration does not set the composition of a new Atlas, report, or Hearth scene.
- Match viewpoint to the requested scene and current asset contract. The oblique battlefield camera applies only to assets actually intended for that view.
- UI should feel written, stamped, scratched, or attached to the manuscript: ink rules, seals, ledger entries, restrained folios, marginal notes, heraldic marks, route scratches, and short annotations.

Semantic color:

- Ink black / charcoal: structure and unknown areas.
- Bone / parchment: readable neutral field.
- Ash grey: uncertainty, fog, and stone.
- Muted vermilion: danger, hostility, and wounds.
- Ember orange: Hearth, safety, and secured progress.
- Faded blue-green: discovered land and knowledge.
- Dull ochre: earned significance and strategic value.

Color is semantic support, not the whole state model. Ownership, scouting, danger, and target value should remain understandable through shape, ink marks, annotations, seals, hatching, symbols, or composition where practical.

Reject realistic or semi-realistic fantasy, painterly concept art, glossy chibi or cute mascots, anime-gacha, clean vector cartoons, uncanny modeled faces, generic Diablo styling, neon spectacle, glossy mobile-RPG chrome, and generic modern strategy-map language. Do not introduce blue/purple/orange rarity-card framing or solve territory with flat colored polygons alone. Strong deformation does not mean greater cuteness.

## Current gameplay surfaces

Apply only the guidance for the surface being changed. Present implemented state; future-compatible ideas in the specs are not claims that those systems already exist.

**World Atlas and territory:** the Atlas is the primary reward surface for the current Territory hypothesis. Make control, uncertainty, strategic role/value, captured-place consequence, and next useful target legible within the manuscript/woodcut grammar.

- Distinguish NPC-controlled and player-controlled places with more than a tiny badge or hue shift. Prefer authored marks such as seals, banners, scratched borders, ink-over stamps, controlled-route marks, changed marginalia, or place treatment that still looks physically drawn into the Atlas.
- Distinguish unknown, hinted, discovered, and scouted knowledge only where the runtime actually supports those states. Unknown information should feel withheld, not absent because the UI failed to load.
- Strategic value should be readable as a reason to care about the place: route, foothold, resource, local knowledge, or another implemented effect. Avoid abstract modern-stat panels when an annotation, route change, seal, callout, or contextual consequence can explain the same fact.
- A successful control change must visibly alter the Atlas. Failure or retreat must not visually imply ownership.
- If taking one place changes another place's risk, duration, route, information, resource, or approach, show that causal link near the affected decision when possible. Do not make the player infer a critical territorial consequence from an unrelated log line.
- After capture, expose another meaningful target or choice. The visual reward is not “badge acquired”; it is “the map is different, and now this other place matters.”
- Do not represent territory as a control-XP meter, modern province fill, heatmap dashboard, conquest progress ring, or flat colored polygon system unless a later Canon explicitly changes direction.

**Scouting and incomplete information:** scouting should make uncertainty and revealed knowledge visible without becoming a disguised capture-progress surface. Before scouting, show what is known and what remains genuinely uncertain. After scouting, reveal only information supported by state, and make the newly actionable consequence easy to connect to preparation or contest choice. Avoid fake percentages or precision when the system does not model them.

**Preparation and contest / expedition:** make destination, companions, equipment/supplies, objective, approach/risk policy, relevant scouting knowledge, and controlled-place support understandable. The final action view should clarify what is being attempted, what known danger or uncertainty matters, what important tools/people are being committed, and what prior territorial advantage applies. Elapsed-time resolution must not become a live tactical view or required tapping loop.

**Reports:** show outcome, duration, injuries, important loot/knowledge, control change or failed capture, strategic effect, and one notable event first; offer an optional chronological log underneath. Use resolved structured events and persisted control state as truth. Make the connection to prior choices legible, then expose the relevant next action or target. Do not invent success, secured reward, scouting knowledge, ownership, or strategic effects for visual drama. A Report is causal evidence, not the product reward by itself and not a debug dashboard.

**Companions and equipment:** communicate traits, condition, history, geographic knowledge, and meaningful effects on scouting/contest options. Distinguish injured, dispatched, and missing people without gacha rarity or a hero-card lineup. Treat equipment as a field ledger / relic catalogue; use maker marks, provenance, geography, worn silhouettes, and what the item enables rather than rarity color as identity. Distinguish secured inventory from value still carried outside.

**Discovery:** show knowledge being added to a manuscript through terrain lines, routes, symbols, names, notes, and restrained blue-green color. Distinguish unknown, hinted, discovered, and actionable states only as supported by actual data. Discovered places can normally be acted on later from safety. Avoid step-reward framing, navigation chrome, exact-coordinate displays, and prolonged phone attention while walking.

**Grey Hearth:** preserve one physical room before detailed folios. Use the wall map for destinations and controlled places, a table or ledger for reports, people and empty places for condition/absence, shelves for secured gear, and fire/beds for recovery. State changes should make the refuge feel inhabited. Keep report → understand map/control → prepare → act reachable without a permanent dashboard or required chores.

## Image generation — only when requested or needed

Before production generation, read [IMAGE_GENERATION_HANDOFF.md](../../docs/visual/IMAGE_GENERATION_HANDOFF.md) and complete its mandatory preflight. Resolve the current asset contract / Generation Package, subject, reference permissions, and Approved Anchor before calling a generator. Use the available Visual Director workflow when required by that contract; do not invent a missing anchor or promote a Candidate to satisfy it.

Build an **asset-only handoff** containing asset identity, framing, required scene facts, style lock, semantic palette, allowed/forbidden changes, and only permitted reference images. Preserve the applicable `must_use_approved_anchor`, `must_not_chain_from_candidate`, and `must_review_after_generation` constraints. If `source_reference_required` is false, do not fabricate a reference dependency.

Keep Issue/PR metadata, progress, tool output, review checklists, and validation reports outside the generation request. A requested in-game expedition report can contain its specified game content; development reports cannot become scene content. For subjectless location backgrounds, omit people, creatures, labels, and UI unless explicitly requested.

Use the shared visual lock, then add only asset-relevant constraints: a background does not need a character pose, and a standalone sprite does not need a playable-screen or UI prompt. Mechanically restrict image bindings to the permitted references or explicit empty set. If the host cannot enforce that boundary, stop generation and report the specific limitation.

Review the output against Canon and the asset contract. Reject character drift or **meta-output** immediately. A progress dashboard, validation card, or project-management screen is not a Candidate, parent, crop source, or runtime asset. Rebuild a contaminated handoff from Canon before retrying; if the same wrong-reference or meta-output class repeats twice, stop generation and report the handoff/host-binding defect.

Keep Candidate, Approved Anchor, and runtime roles explicit. Generation or successful validation alone does not authorize anchor promotion or runtime adoption; follow the current contract and the user's existing authorization without asking again for a step already authorized.

## Implementation and review

1. Inspect the current screen, state source, territory/knowledge state where relevant, asset roles, and references before changing presentation. Preserve gameplay, location, persistence, control ownership, and stable IDs; do not create a separate presentation truth.
2. Use the smallest reusable technique that serves the requested surface: existing tokens, CSS, SVG/Canvas ink marks, masks, or illustrated layers. Correct composition, silhouette, state legibility, and readability before adding texture or filters.
3. For territory/Atlas work, verify the actual affected states rather than static mockups alone: NPC control, player control, unknown/scouted information, the implemented strategic effect, and next-target presentation where applicable. Ensure failure/retreat does not look captured and that ownership is not conveyed only by modern flat-fill color.
4. For sprites, inspect the source and transform chain. Keep uniform X/Y scale and use visible alpha bounds; preserve a ground pivot where the scene needs one. Verify actual decode and meaningful alpha coverage, not compressed byte size. For transparent assets, check for baked checkerboards; for animation, inspect temporal frames as well as pose consistency. Use the conditional legacy reference for oblique depth/HUD details.
5. For UI changes, inspect the actual implementation at phone size and desktop size. Check readable labels, reachable Atlas/scout/prepare/report actions, no horizontal overflow, scrolling folios, keyboard focus, touch, and reduced motion where applicable. Check only the states affected by the change, including relevant injury/absence, unresolved/resolved, scouting, or control states.
6. Run checks appropriate to changed behavior. If gameplay or persistence changes, include its relevant deterministic tests. For documentation-only work, validate skill structure and links rather than claiming browser verification.
7. Report evidence and limitations separately: source-art review, rendered screenshots, automated checks, CI, and human playtest are different outcomes. For gameplay changes, follow [the autonomous development policy](../../docs/autonomous-development-policy.md): passing CI is Implemented; enjoyment remains Playtest pending until human Keep / Change / Kill judgment.

Before accepting the result, verify that it preserves the actual gameplay contract, reads at phone size, uses the manuscript/woodcut illustration family and semantic palette, and matches applicable character proportions and asset constraints. For Territory-driven work, also verify that the map change and its next-decision consequence are visually legible. A source image alone cannot establish runtime quality; parchment colors alone cannot establish visual fidelity.

If the same visual could serve another dark-fantasy RPG by swapping the logo, reject it. When a critical check fails, fix or reject before polishing and state exactly which acceptance remains unverified.
