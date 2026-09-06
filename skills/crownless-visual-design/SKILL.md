---
name: crownless-visual-design
description: Create, implement, or review Crownless visuals using its living medieval manuscript and woodcut Canon. Use for expedition preparation and reports, companions, Grey Hearth, discovery maps, equipment, UI, and game assets.
---

# Crownless Visual Design

## Scope and authority

Support **Location × Expedition RPG** and the loop **Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt**. Presentation should make the player care who returns and understand the next expedition decision.

Read [AGENTS.md](../../AGENTS.md) and [current gameplay Canon](../../docs/game-system-design.md), then [the visual guide](../../docs/visual-design-guide-v0.2.md). Inspect [the global calibration image](../../docs/assets/crownless-visual-design-reference-v0.1.jpg) and the accepted character examples in `../../assets/combat/minimal-v0.1/actors/` for proportion and silhouette where useful. Do not reload sources already inspected in this task unless they changed.

**Authority is scoped:** the visual guide governs linework, material, palette, and character proportions. Current gameplay and subsystem specs govern behavior, camera needs, controls, and screen purpose. Under [ADR 0002](../../docs/adr/0002-idle-expedition-pivot.md), real-time combat passages in older visual documents are historical context. They do not authorize Technique, Evade, combat HUD, or a battlefield for the current expedition loop.

Read the subsystem relevant to the requested work:

- Preparation, companions, equipment effects, waiting, outcomes, or reports: [expedition specification](../../docs/expedition-system-spec.md).
- Discovery, maps, locations, or regional visuals: [exploration and location specification](../../docs/exploration-location-spec.md).
- Room composition, safe-state interaction, recovery, or dispatch from the Hearth: [Hearth presentation specification](../../docs/hearth-presentation-spec.md).
- Named character identity or asset selection: [Character Visual Canon](../../docs/visual/CHARACTER_VISUAL_CANON.md). Resolve the current Approved Anchor there; runtime atlases and historical pose sheets have different roles.
- Explicitly authorized maintenance or repurposing of existing actor rendering: [legacy actor presentation](references/legacy-actor-presentation.md). Read only the applicable checks. Do not apply battlefield viewpoint or enemy-HUD rules to unrelated Hearth scenes or reports.

Keep the requested scope. A visual review does not authorize generating replacement art, promoting Candidates, or changing gameplay.

## Visual lock

Crownless is a playable medieval manuscript: rough hand-inked figures and places, woodcut texture, parchment negative space, and a world that gains knowledge and restrained color.

- Use irregular ink contours, crosshatched shadows, muted flat or lightly textured color, imperfect geometry, and physical ink marks.
- Humanoids are compact **3–3.5-head-tall folk-doll figures** with short limbs, tiny symbolic faces, restrained expressions, and weathered asymmetric equipment. Preserve silhouette and equipment identity before scene detail. Do not correct them toward realistic anatomy.
- Accepted actor proportions supersede the older calibration board's 4–5-head figures. Its linework, materials, palette, and manuscript grammar remain useful. An old battle illustration does not set the composition of a new report or Hearth scene.
- Match viewpoint to the requested scene and current asset contract. The oblique battlefield camera applies only to assets actually intended for that view.
- UI should feel written, stamped, scratched, or attached to the manuscript: ink rules, seals, ledger entries, restrained folios, and short annotations.

Semantic color:

- Ink black / charcoal: structure and unknown areas.
- Bone / parchment: readable neutral field.
- Ash grey: uncertainty, fog, and stone.
- Muted vermilion: danger and wounds.
- Ember orange: Hearth, safety, and secured progress.
- Faded blue-green: discovered land and knowledge.
- Dull ochre: earned significance.

Reject realistic or semi-realistic fantasy, painterly concept art, glossy chibi or cute mascots, anime-gacha, clean vector cartoons, uncanny modeled faces, generic Diablo styling, neon spectacle, and glossy mobile-RPG chrome. Do not introduce blue/purple/orange rarity-card framing. Strong deformation does not mean greater cuteness.

## Current gameplay surfaces

Apply only the guidance for the surface being changed. Present implemented state; future-compatible ideas in the specs are not claims that those systems already exist.

**Preparation and waiting:** make destination, companions, equipment/supplies, objective, and risk policy understandable. The final dispatch view shows known danger, important carried tools, policy, and expected return. Waiting communicates destination, party, and actual underway/overdue/resolved state without fake precision, a live tactical view, or required tapping.

**Reports:** show outcome, duration, injuries, important loot, discoveries, and one notable event first; offer an optional chronological log underneath. Use the resolved structured events as truth. Make the connection to prior choices legible, and expose the relevant next action, such as recovery, equipment changes, investigating a discovery, or rescue where implemented. Do not invent a success, secured reward, or revealed outcome for visual effect. A report is news from absent people, not a debug dashboard.

**Companions and equipment:** communicate traits, condition, history, and meaningful expedition effects. Distinguish injured, dispatched, and missing people without gacha rarity or a hero-card lineup. Treat equipment as a field ledger / relic catalogue; use maker marks, provenance, and worn silhouettes rather than rarity color as its identity. Distinguish secured inventory from value still carried outside.

**Discovery:** show knowledge being added to a manuscript through terrain lines, routes, symbols, names, notes, and restrained blue-green color. Distinguish unknown, hinted, discovered, and expedition-available states only as supported by actual data. Discovered places can be used later from safety. Avoid step-reward framing, navigation chrome, exact-coordinate displays, and prolonged phone attention while walking.

**Grey Hearth:** preserve one physical room before detailed folios. Use the wall map for destinations, a table or ledger for reports, people and empty places for condition/absence, shelves for secured gear, and fire/beds for recovery. State changes should make the refuge feel inhabited. Keep return → report → prepare → dispatch reachable without a permanent dashboard or required chores.

## Image generation — only when requested or needed

Before production generation, read [IMAGE_GENERATION_HANDOFF.md](../../docs/visual/IMAGE_GENERATION_HANDOFF.md) and complete its mandatory preflight. Resolve the current asset contract / Generation Package, subject, reference permissions, and Approved Anchor before calling a generator. Use the available Visual Director workflow when required by that contract; do not invent a missing anchor or promote a Candidate to satisfy it.

Build an **asset-only handoff** containing asset identity, framing, required scene facts, style lock, semantic palette, allowed/forbidden changes, and only permitted reference images. Preserve the applicable `must_use_approved_anchor`, `must_not_chain_from_candidate`, and `must_review_after_generation` constraints. If `source_reference_required` is false, do not fabricate a reference dependency.

Keep Issue/PR metadata, progress, tool output, review checklists, and validation reports outside the generation request. A requested in-game expedition report can contain its specified game content; development reports cannot become scene content. For subjectless location backgrounds, omit people, creatures, labels, and UI unless explicitly requested.

Use the shared visual lock, then add only asset-relevant constraints: a background does not need a character pose, and a standalone sprite does not need a playable-screen or UI prompt. Mechanically restrict image bindings to the permitted references or explicit empty set. If the host cannot enforce that boundary, stop generation and report the specific limitation.

Review the output against Canon and the asset contract. Reject character drift or **meta-output** immediately. A progress dashboard, validation card, or project-management screen is not a Candidate, parent, crop source, or runtime asset. Rebuild a contaminated handoff from Canon before retrying; if the same wrong-reference or meta-output class repeats twice, stop generation and report the handoff/host-binding defect.

Keep Candidate, Approved Anchor, and runtime roles explicit. Generation or successful validation alone does not authorize anchor promotion or runtime adoption; follow the current contract and the user's existing authorization without asking again for a step already authorized.

## Implementation and review

1. Inspect the current screen, state source, asset roles, and references before changing presentation. Preserve gameplay, location, persistence, and stable IDs; do not create a separate presentation truth.
2. Use the smallest reusable technique that serves the requested surface: existing tokens, CSS, SVG/Canvas ink marks, masks, or illustrated layers. Correct composition, silhouette, and readability before adding texture or filters.
3. For sprites, inspect the source and transform chain. Keep uniform X/Y scale and use visible alpha bounds; preserve a ground pivot where the scene needs one. Verify actual decode and meaningful alpha coverage, not compressed byte size. For transparent assets, check for baked checkerboards; for animation, inspect temporal frames as well as pose consistency. Use the conditional legacy reference for oblique depth/HUD details.
4. For UI changes, inspect the actual implementation at phone size and desktop size. Check readable labels, reachable dispatch/report actions, no horizontal overflow, scrolling folios, keyboard focus, touch, and reduced motion where applicable. Check only the states affected by the change, including relevant injury/absence or unresolved/resolved states.
5. Run checks appropriate to changed behavior. If gameplay or persistence changes, include its relevant deterministic tests. For documentation-only work, validate skill structure and links rather than claiming browser verification.
6. Report evidence and limitations separately: source-art review, rendered screenshots, automated checks, and human playtest are different outcomes. For gameplay changes, follow [the autonomous development policy](../../docs/autonomous-development-policy.md): passing CI is Implemented; enjoyment remains Playtest pending until human Keep / Change / Kill judgment.

Before accepting the result, verify that it preserves the actual gameplay contract, reads at phone size, uses the manuscript/woodcut illustration family and semantic palette, and matches applicable character proportions and asset constraints. A source image alone cannot establish runtime quality; parchment colors alone cannot establish visual fidelity.

If the same visual could serve another dark-fantasy RPG by swapping the logo, reject it. When a critical check fails, fix or reject before polishing and state exactly which acceptance remains unverified.
