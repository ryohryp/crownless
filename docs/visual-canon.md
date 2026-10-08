# Crownless Visual Canon

> **Status:** Active. User-approved visual direction on 2026-10-08.
> **Authority:** AGENTS.md and accepted ADRs govern gameplay; this file governs the global visual language. Specialized character/runtime anchors govern their own anatomy, camera, and animation contracts.

## Approved direction — Western medieval fantasy × sumi-e

The user explicitly approved the **ink-wash map / town / forge / local-event composite** on 2026-10-08. It replaces the former blue-green/aged-gold medieval manuscript board as the **global style direction**. The approved chat reference is **not yet archived as a repository binary**: do not claim an older `docs/assets/*` board is that image, and do not substitute a new generated candidate for it without review.

A Crownless screen should feel like **the same illustrated page of a medieval travel journal painted in Japanese sumi-e**, not a conventional glossy fantasy UI.

- **Materials:** warm washi/parchment, imperfect fibers, dry-brush ink, soft bleeding wash, hand-drawn silhouettes, deliberate negative space.
- **Palette:** warm ivory / parchment; charcoal and layered black-gray ink; **small muted vermilion** only for danger, rival control, seals, and important focal points. Natural gray-brown washes are permitted. Avoid teal or gold as the default world color.
- **Map:** atmospheric mountain, river, forest, tower, bridge, road, and village forms painted in uneven ink; discovered POIs should have distinct silhouettes, not identical abstract dots.
- **Town / shop / event:** the same ink and paper grammar across buildings, traders, forge, notices, inventory and short local events. A place should make the player curious about what is there.
- **UI:** quiet, legible annotations and restrained paper/ink panels. Avoid stacking large opaque cards over the world. Text and controls must remain readable at 360–430 CSS px, including sunlight use.
- **Equipment / character:** worn medieval shapes with recognizably different silhouettes. Existing accepted actor anchors, frame geometry and combat readability remain binding until separately reviewed.

### Avoid

Glossy 3D, cinematic fantasy key art, generic western RPG brown-gold chrome, neon effects, gacha rarity gradients, anime-style hero art, uniform vector-clean iconography, oversaturated blue-green terrain, large ornamental frames, and texture that overwhelms labels.

## First implementation slice

Start with **the living neighborhood map**, where the player discovers a new place and sees a shop/event or rival mark. `assets/living-map-terrain.svg` and the scoped rules in `neighborhood.css` are the first runtime calibration, **not** a replacement for the approved composite. Reuse SVG where it stays light and crisp; do not pre-generate a giant asset catalog.

When adding assets, prioritize the first player-visible deficit: distinguishable landmark silhouettes, then shop/event scenes, then a regional relic. Produce one asset at a time, integrate it, inspect on a 390×844 viewport, and only keep it if the place is easier to recognize or more intriguing.

## Gameplay and visual acceptance

The current playable loop is governed by ADR-0008 / ADR-0009, AGENTS.md, and `docs/gameplay-spec.md`: location discovery, conquest, frontier growth, regional relics, Chronicle, and brief tactical combat. Visual work must not resurrect superseded side-scrolling controls or hide tactical information to fit a mockup.

For a new visual, review separately:
1. **Deterministic:** asset loads, correct sizing/contrast, existing controls/POIs and safe areas intact, tests/CI green.
2. **Visual:** ink/paper/limited-vermilion family consistent across map and detail, not merely a sepia CSS filter.
3. **Human playtest:** on a phone, does a discovered place make the player want to inspect or reveal the next one?

Old manuscript/woodcut and blue-green boards under `docs/assets/` and older supporting docs remain **historical calibration only** where they disagree with this approved direction. Never automatically promote generated candidates to Canon.
