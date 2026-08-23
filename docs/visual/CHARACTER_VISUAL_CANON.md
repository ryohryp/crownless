# Crownless Character Visual Canon

This file maps Crownless combat subjects to the current character rules used by visual generation and review.

## Common rules

- Use `docs/assets/crownless-visual-design-reference-v0.1.jpg` for global linework, palette, material, and manuscript-family calibration.
- Use `assets/combat/minimal-v0.1/actors/` as the current authority for combat-character proportion, deformation, silhouette width, facial simplification, and battlefield viewpoint.
- Older character / battle reference sheets are supporting style references only where they do not conflict with the accepted actor set.
- Keep humanoid figures approximately **3–3.5 heads tall**, strongly deformed, compact, weathered, asymmetrical, and readable at phone scale.
- Keep faces tiny, restrained, crude, and folk-art-like rather than cute, anime-like, painterly, or realistic.
- Combat figures must be authored for an **oblique top-down / three-quarter battlefield view** rather than as front-facing standing portraits.
- Generated images are review candidates and must not replace accepted anchors automatically.

## 素手の主人公

### Approved Visual Anchor

- `assets/combat/minimal-v0.1/actors/player-unarmed-approved-anchor-v0.4.png`

This anchor is the approved identity, clothing/material, palette, silhouette, and unarmed-fighting reference. It is a transparent single-frame combat-ready anchor authored for the oblique top-down battlefield camera; runtime integration must preserve its visible alpha bounds, bottom-center foot point, uniform X/Y scale, and phone-scale readability.

The v0.4 replacement was generated from the approved v0.3 identity anchor after the prior v0.2 WebP failed local decode validation. The replacement is recorded in `docs/assets/player-unarmed-approved-anchor-v0.4.json`; the approval-package copy at `docs/assets/player-unarmed-approved-anchor-v0.4.png` is byte-identical provenance. The previous v0.3 plate remains historical calibration only; the unreadable v0.2 file remains a legacy reference and must not be used as a generation parent.

### Reference calibration

- `docs/assets/crownless-visual-design-reference-v0.1.jpg`

### Approved Sprite Sheet Reference

- `docs/assets/player-unarmed-sprite-sheet-reference-v0.1.webp`

Use this sheet as a historical presentation/reference for the protagonist's directional pose family and unarmed action language only if it decodes correctly. It is not the runtime atlas, and its labels, background treatment, and sheet layout must not appear in gameplay sprites. The v0.4 Approved Visual Anchor above is the generation parent for subject identity, clothing/material language, palette, silhouette, and unarmed combat identity.

### Accepted Combat Sprite Source

- `assets/combat/minimal-v0.1/actors/player-unarmed-combat-sprite-sheet-v0.1.png`

This transparent 768×512 optimized derivative is accepted as the source-art sheet for runtime combat animation. It must be sliced, normalized, and validated before runtime replacement. The Approved Visual Anchor remains the identity parent.

### Accepted visual conditions

- anonymous unknown survivor with no crown, class costume, or permanent allegiance
- intentionally unarmed with wrapped, visually emphasized hands in a credible fighting stance
- patched cloth, scavenged belt / pouch, mismatched protection, visibly poor equipment
- compact grounded silhouette that makes bare-handed combat look deliberate rather than incomplete
- no weapon or shield in the base state
- oblique three-quarter top-down pose with readable foot contact, not a portrait pose

The approved base state is the unarmed expedition survivor. Equipment changes silhouette only in separately requested and reviewed states.

## 敵：Rusher

### Approved Visual Anchor

- `assets/combat/minimal-v0.1/actors/enemy-rusher.png`

### Accepted visual conditions

- aggressive forward-driving silhouette that reads as immediate closing pressure
- compact low mass with lunging / rushing intent
- limbs and attacking mass directed toward the target, no shield-wall posture
- crude weathered asymmetric protection and clear close-range threat shape
- oblique top-down view that still preserves the forward lean
- distinct from braced Guard and distance-keeping Skirmisher without labels

This is the ordinary Rusher archetype, not 灰牙 unless requested separately.

## 敵：Guard

### Approved Visual Anchor

- `assets/combat/minimal-v0.1/actors/enemy-guard.png`

### Accepted visual conditions

- braced, slow, defensive silhouette with a broad shield readable at phone scale
- weight held behind the shield, compact blocking stance rather than forward rush
- rough armor and weathered side weapon without polished knightly grandeur
- shield, shoulders, and planted legs form the primary silhouette language
- oblique top-down view exposes enough shield / helmet top plane to belong to the battlefield camera
- distinct from lunging Rusher and narrow ranged Skirmisher without labels

This is the ordinary Guard archetype, not 鐘なき騎士 unless requested separately.

## 敵：Skirmisher

### Approved Visual Anchor

- `assets/combat/minimal-v0.1/actors/enemy-skirmisher.png`

### Accepted visual conditions

- leaner distance-keeping silhouette with a clearly readable bow / ranged posture
- narrower profile, retreat-ready legs, readable aim direction
- weathered hunting gear and asymmetric small protection rather than polished archer armor
- ranged tool remains legible without a large floating label or glowing projectile language
- oblique top-down view keeps bow, shoulders, quiver, and feet coherent with the battlefield camera
- distinct from lunging Rusher and broad shielded Guard without labels

This is the ordinary Skirmisher archetype, not 沼鴉 unless requested separately.

## Runtime acceptance

Source-art approval is not enough. In the actual combat viewport:

- X/Y scale must remain uniform
- feet / shadow / logical ground point must agree
- overlap must depth-sort by projected foot Y
- priority labels must clear the silhouette
- non-priority labels should simplify when enemies crowd
- PNGs must decode and contain meaningful visible alpha coverage

If the runtime actor is stretched, unexpectedly invisible, visibly corrupt, or presents the wrong camera angle, reject the integration even if the source concept looked correct.
