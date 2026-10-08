# Crownless Global Visual Style

This is the Visual Director adapter to [the active Visual Canon](../visual-canon.md).

## Current global calibration

The user approved a **Western medieval fantasy × Japanese sumi-e** map/town/forge/event composite on 2026-10-08. That image is not yet archived in this repository. The former `docs/assets/crownless-visual-design-reference-v0.1.jpg` is **historical** where its woodcut/blue-green palette conflicts with the new approved direction. Do not identify the old board as the new reference.

## Style lock

```text
Western medieval fantasy illustrated in expressive Japanese sumi-e on warm handmade washi. Black and charcoal-gray ink washes, feathered edges, irregular dry-brush contours, layered atmospheric distance and generous unpainted paper. Distinct silhouettes for tower, village, bridge, forest, river, shop and relic. Sparse muted vermilion only for danger, rivals, seals or meaningful focus. Map, town, forge, event and UI feel drawn on the same page; compact readable annotation-like controls. Not a simple sepia filter on clean vector graphics.
```

## Avoid

Glossy RPG chrome, photorealism, oil-paint fantasy concept art, anime-gacha framing, neon effects, dominant teal/green, decorative aged-gold borders, flat clean clip-art, dense textures over labels, huge opaque cards over the map, baked-in text on scene art.

## Authority order

1. `AGENTS.md`, accepted ADRs and `docs/gameplay-spec.md` govern gameplay and safe phone UI.
2. `docs/visual-canon.md` governs the global art family.
3. The user-approved 2026-10-08 composite calibrates that style (repository archival pending).
4. `docs/visual/CHARACTER_VISUAL_CANON.md` and existing approved runtime actors govern their silhouette, camera, frame geometry and identity until separately reviewed.
5. Older visual boards are historical references only where consistent.

Generate only the next needed asset, evaluate in the actual 360–430px interface, and never promote an unreviewed candidate automatically.
