# Crownless Character Visual Canon

This file maps Crownless combat subjects to the current character rules used by visual generation and review.

## Common rules

- Use `docs/visual-canon.md` and `docs/visual/GLOBAL_VISUAL_STYLE.md` for current global ink-wash/washi language. The former `docs/assets/crownless-visual-design-reference-v0.1.jpg` is historical only where its palette/woodcut treatment conflicts.
- Historical `assets/combat/minimal-v0.1/actors/` art was removed under ADR-0005, and is **not** a current runtime dependency or approved generation parent. Preserve the archived role silhouettes only as history.
- Older character / battle reference sheets are supporting style references only where they do not conflict with the accepted actor set.
- Keep humanoid figures approximately **3–3.5 heads tall**, strongly deformed, compact, weathered, asymmetrical, and readable at phone scale.
- Keep faces tiny, restrained, crude, and folk-art-like rather than cute, anime-like, painterly, or realistic.
- Combat figures must be authored for an **oblique top-down / three-quarter battlefield view** rather than as front-facing standing portraits.
- Generated images are review candidates and must not replace accepted anchors automatically.

## 冒険者A

### Approved Visual Anchor

- `docs/assets/adventurer-a-approved-anchor-v1.png`

The user selected the leftmost Adventurer A concept and, on 2026-10-27, explicitly approved making this design a separate official Crownless character. This approved anchor records **identity and appearance only**; it does not approve any current walking animation or replace the established `素手の主人公` or its pixel variant.

### Accepted visual conditions

- Charcoal tousled hair with a conspicuous silver forelock; short dark stubble.
- Deep indigo / navy split long coat, rolled ivory sleeves, dark trousers, worn strapped brown leather boots, belts and practical pouches.
- A sheathed sword on the back is part of the selected reference look; actual inventory, damage and weapon availability remain gameplay-controlled.
- Full-body right-facing oblique three-quarter pixel-art appearance, not a flat code-drawn puppet, with readable garments, highlights and natural material texture at phone scale.
- Character anatomy, facing direction, garment identity and facial features remain coherent through every temporal frame; no cloning, warping of a static portrait or swapping direction variants into a walk loop.
- Keep this identity distinct from the approved red-scarf, wrapped-hand `素手の主人公（ピクセル版）`.

### Animation acceptance status

The color-coded eight-pose walk dummy was approved by the user for **gait and timing only** on 2026-10-27. Its two legs alternate contact with level grounded soles and arms counter-swing. The flat, code-drawn costume overlay was explicitly rejected for weak art quality. Future high-detail temporal pixel animation must retain the approved gait while drawing all eight poses consistently from this identity anchor, then pass human phone-scale review before runtime adoption. No runtime sprite is currently approved here.

## 素手の主人公

### Approved Visual Anchor

- `docs/assets/player-unarmed-approved-anchor-v0.4.png`

This anchor is the approved identity, clothing/material, palette, silhouette, and unarmed-fighting reference. It is a transparent single-frame combat-ready anchor authored for the oblique top-down battlefield camera; runtime integration must preserve its visible alpha bounds, bottom-center foot point, uniform X/Y scale, and phone-scale readability.

The v0.4 replacement was generated from the approved v0.3 identity anchor after the prior v0.2 WebP failed local decode validation. The replacement is recorded in `docs/assets/player-unarmed-approved-anchor-v0.4.json`. The previous v0.3 plate remains historical calibration only; the unreadable v0.2 file remains a legacy reference and must not be used as a generation parent.

### Historical reference calibration (not a current global image)

- `docs/assets/crownless-visual-design-reference-v0.1.jpg` — legacy, only where consistent with current style; never use as mandatory image parent

### Approved Sprite Sheet Reference

- `docs/assets/player-unarmed-sprite-sheet-reference-v0.1.webp`

Use this sheet as a historical presentation/reference for the protagonist's directional pose family and unarmed action language only if it decodes correctly. It is not the runtime atlas, and its labels, background treatment, and sheet layout must not appear in gameplay sprites. The v0.4 Approved Visual Anchor above is the generation parent for subject identity, clothing/material language, palette, silhouette, and unarmed combat identity.

### Historical directional combat source — removed from current runtime

- `assets/combat/minimal-v0.1/actors/player-unarmed-combat-sprite-sheet-v0.1.png`

This older 768×512 derivative is no longer present in the current repository; its past directional-pose analysis is recorded only for historical context. Pixel and runtime review established that its eight columns are direction variants rather than temporal frames; cycling them produces a rotating actor. Its hair, collar, and clothing silhouette also do not preserve the Approved Visual Anchor's subject identity. It must not replace `assets/combat/minimal-v0.1/actors/player-unarmed.png`. A future runtime animation set must be authored from the v0.4 Approved Visual Anchor and pass `docs/visual/generation-packages/player-unarmed-runtime-sprite-acceptance-v0.1.md`.

### Historical MVP runtime animation — removed under ADR-0005

- `assets/combat/minimal-v0.1/actors/player-unarmed-combat-sprite-sheet-v0.3.png`
- `assets/combat/minimal-v0.1/player-unarmed-animation.json`

The formerly accepted v3 atlas (now removed from current runtime) was the source for `idle`, `walk`, `jab`, and `hurt`. It preserves the v0.4 Approved Visual Anchor's identity and unarmed equipment language across one fixed oblique top-down facing. Each action has four temporal frames on a transparent 512×512 cell with an authored ground pivot at `(256, 480)`. The existing `player-unarmed.png` remains the static decode/load fallback; the v0.4 Anchor remains the generation parent and is not replaced by this atlas.

### Accepted visual conditions

- anonymous unknown survivor with no crown, class costume, or permanent allegiance
- intentionally unarmed with wrapped, visually emphasized hands in a credible fighting stance
- patched cloth, scavenged belt / pouch, mismatched protection, visibly poor equipment
- compact grounded silhouette that makes bare-handed combat look deliberate rather than incomplete
- no weapon or shield in the base state
- oblique three-quarter top-down pose with readable foot contact, not a portrait pose

The approved base state is the unarmed expedition survivor. Equipment changes silhouette only in separately requested and reviewed states.

## 素手の主人公（ピクセル版）

### Approved Visual Anchor
- `docs/assets/player-unarmed-approved-pixel-anchor-v1.png`

The action-forest pixel variant is the same protagonist, explicitly approved by the user on 2026-10-23 (“これでいいよ”). It has its own subject ID so the historical illustration anchor remains unchanged. The current concrete reference is `docs/assets/player-unarmed-approved-pixel-anchor-v1.png`.

### Accepted visual conditions

- Preserve the approved dark tied hair, muted red headband/scarf, patched cream and charcoal clothing, belt pouch, wrapped unarmed hands and worn boots.
- Preserve the approved face, body proportions, camera and coherent whole-body silhouette.
- Pixel rendering follows the user's current direction; do not reproduce the rejected code-drawn character anatomy.
- Walking uses temporal poses of this same character facing right in the same camera. Direction variants are not walking frames.
- No new weapons, armor class or ornaments in the base unarmed animation. Equipment layers come later.
- The human approval covers this still. New animation remains subject to actual phone-scale review.

## 敵：Rusher

### Historical actor reference — **not a current Approved Visual Anchor**

- `assets/combat/minimal-v0.1/actors/enemy-rusher.png` — removed from `main` when real-time combat was retired (ADR-0005); do not use this file as a live anchor.

### Accepted visual conditions

- aggressive forward-driving silhouette that reads as immediate closing pressure
- compact low mass with lunging / rushing intent
- limbs and attacking mass directed toward the target, no shield-wall posture
- crude weathered asymmetric protection and clear close-range threat shape
- oblique top-down view that still preserves the forward lean
- distinct from braced Guard and distance-keeping Skirmisher without labels

This is the ordinary Rusher archetype, not 灰牙 unless requested separately.

## 敵：Guard

### Historical actor reference — **not a current Approved Visual Anchor**

- `assets/combat/minimal-v0.1/actors/enemy-guard.png` — removed from `main` when real-time combat was retired (ADR-0005); do not use this file as a live anchor.

### Accepted visual conditions

- braced, slow, defensive silhouette with a broad shield readable at phone scale
- weight held behind the shield, compact blocking stance rather than forward rush
- rough armor and weathered side weapon without polished knightly grandeur
- shield, shoulders, and planted legs form the primary silhouette language
- oblique top-down view exposes enough shield / helmet top plane to belong to the battlefield camera
- distinct from lunging Rusher and narrow ranged Skirmisher without labels

This is the ordinary Guard archetype, not 鐘なき騎士 unless requested separately.

## 敵：Skirmisher

### Historical actor reference — **not a current Approved Visual Anchor**

- `assets/combat/minimal-v0.1/actors/enemy-skirmisher.png` — removed from `main` when real-time combat was retired (ADR-0005); do not use this file as a live anchor.

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
