# Player Unarmed Runtime Sprite Acceptance

The approved sprite-sheet reference is not directly shippable. A runtime-ready protagonist sprite set must satisfy all of the following before replacing or extending `assets/combat/minimal-v0.1/actors/player-unarmed.png`:

- transparent background with no presentation labels, title blocks, palette swatches, or sheet decorations
- consistent frame dimensions and a stable logical ground / foot point
- uniform X/Y scale in the combat viewport
- oblique top-down / three-quarter battlefield camera in every gameplay frame
- approximately 3–3.5-head compact proportion preserved across motion
- no weapon, shield, crown, class costume, or polished heroic armor in the base state
- wrapped hands remain visually readable as deliberate unarmed fighting equipment
- idle / locomotion / attacks remain identifiable at phone scale
- alpha channel decodes correctly and has meaningful visible coverage
- frame-to-frame silhouette does not drift into realistic, anime, cute mascot, or polished RPG character language

Recommended first implementation slice: `idle`, `walk`, `jab`, `hurt` in the minimum directions required by the current combat camera. Do not build the full reference sheet before validating those states in-game.
