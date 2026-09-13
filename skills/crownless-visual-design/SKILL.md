---
name: crownless-visual-design
description: Create, implement, or review Crownless visuals and generated game assets while preserving a coherent medieval-fantasy identity, mobile readability, and the current approved art direction.
---

# Crownless Visual Design

## Purpose

Use this Skill for concept art, game assets, UI presentation, map visuals, characters, equipment, environments, image-generation prompts, or visual review.

The goal is not to preserve every historical Crownless visual decision. The goal is to make the current game visually coherent, distinctive, readable on a phone, and suitable for actual play.

## Context rule

Read only what the task needs:

- the current Crownless product brief or project instruction,
- the current approved visual direction when one exists,
- reference images or asset contracts relevant to the requested surface,
- the implementation being changed when the task is in-game presentation.

Do not automatically load old ADRs, retired gameplay loops, legacy combat documents, or historical art rules. Legacy Crownless material may be used as inspiration or implementation reference, but it is not binding unless the current project explicitly keeps it.

If there is no current approved visual direction, create the smallest useful visual direction for the slice instead of inventing a large art bible.

## Visual priorities

Prefer, in order:

1. **Gameplay readability** — the player can understand important state and available action at phone size.
2. **Identity** — the game should not look like a generic fantasy mobile template.
3. **Consistency** — characters, environments, icons, UI, and generated assets feel like one game.
4. **Production practicality** — the direction can be produced repeatedly without excessive manual cleanup.
5. **Polish** — detail and decoration come after the above are working.

The broader tone is medieval fantasy with danger, discovery, survival, loot, and an expanding sense of the world. Do not assume a specific rendering style such as manuscript, woodcut, realistic 3D, pixel art, or anime unless that direction has been explicitly selected for the current reboot.

## Establish a small art direction when needed

For a new reboot or undefined surface, define only enough to produce and judge the first playable assets:

- overall mood,
- shape / silhouette language,
- character proportion or camera treatment where relevant,
- material / texture tendency,
- restrained palette guidance if useful,
- a few explicit “do not drift into” examples.

Prefer one to three strong reference images over a long prose specification. Once the user approves a direction, treat those references and the concise direction as the working visual Canon for subsequent assets until deliberately changed.

## Image generation

Generate images when they materially help the playable slice. Do not generate a large asset library in advance.

A generation request should contain only asset-relevant information:

- asset purpose,
- subject,
- framing / camera,
- required gameplay facts,
- current style references,
- allowed and forbidden changes,
- transparency or size requirements when relevant.

Keep Issue numbers, PR metadata, progress notes, CI output, and project-management text out of image-generation prompts.

If a generated result contains development metadata, dashboard-like output, unintended text, wrong subject matter, or obvious style drift, reject it rather than treating it as a usable game asset.

Do not chain repeatedly from a bad candidate. Return to the approved direction or reference and generate a clean replacement.

## Character and equipment consistency

When recurring characters, enemies, or equipment exist, preserve identity through the features that matter most in play:

- silhouette,
- body proportion,
- major clothing / armor shapes,
- weapon or equipment identity,
- recurring marks or colors,
- scale relative to other game elements.

Do not let repeated generation slowly change the character into a different visual archetype merely because each individual image looks attractive.

## Maps and location visuals

Location is part of gameplay, not decoration.

Map or exploration visuals should make discovery, available destinations, uncertainty, danger, and meaningful state changes legible without requiring exact-coordinate displays or prolonged attention while walking.

Do not reduce location play to step-count graphics. Avoid showing precise real-world location data unless the current implementation actually requires and safely handles it.

## UI and in-game implementation

Before changing presentation, inspect the real screen and the state that drives it. Do not create a separate visual truth that disagrees with gameplay state.

Use the smallest reusable implementation that achieves the intended result. Prefer existing layout, CSS, SVG, Canvas, sprites, or image layers over building a new rendering framework unless the simpler approach is a real blocker.

Check the actual affected states rather than only a static happy-path mockup.

For mobile gameplay, verify at a representative phone viewport:

- readable text and key icons,
- reachable primary actions,
- no accidental horizontal overflow,
- usable scrolling,
- touch target sanity,
- important states remain visually distinguishable,
- the screen still communicates the intended game decision.

Desktop support matters only to the degree required by the current product or development workflow.

## Review rule

Review visuals against the current playable purpose, not against historical Crownless documents by default.

Ask:

- Can the player understand what matters?
- Does this belong to the same game as the other approved assets?
- Is the visual identity distinctive enough to remember?
- Does the image or UI support the next gameplay decision?
- Can we produce more of this direction reliably?
- Does it work on the target device rather than only as source art?

A beautiful standalone image is not automatically a good game asset.

## Evidence

Keep these distinct when reporting results:

- source-art review,
- generated-asset review,
- rendered in-game screenshot,
- automated visual or browser checks,
- human playtest judgment.

Do not claim runtime quality from an image file alone, and do not claim visual enjoyment from automated checks.

## Anti-patterns

- Do not preserve a historical visual style merely because it already has documentation.
- Do not create a huge visual system before a small playable slice exists.
- Do not generate dozens of speculative assets “for later.”
- Do not copy the visual language of a well-known RPG closely enough that Crownless loses its own identity.
- Do not let generated images redefine gameplay state.
- Do not optimize for desktop mockups when the game is meant to be played primarily on a phone.

The visual workflow should help Crownless reach a convincing playable experience faster, then become more specific only as real play reveals what deserves to survive.
