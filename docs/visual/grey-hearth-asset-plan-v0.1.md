# Grey Hearth visual asset plan v0.1

Status: Issue #163 direction selected; image files remain review Candidates.

## Selected composition

Use the mist-gate-centered direction as the first-view composition. The cold gate
and its path create the strongest reason to leave safety, while the fire remains
the warm counterweight. The player stays in the lower-left/midground so the
silhouette is present without competing with the primary expedition action.

The three alternatives are stored in
`assets/hearth/concepts/grey-hearth-*.png` for side-by-side review:

- A: fire is the emotional center; strongest safety, weakest outward pull.
- B: gate is the visual and action center; selected for the #162 homepage handoff.
- C: avatar is the emotional center; strongest self-presence, but a quieter CTA.

## Implementation handoff to #162

Treat the selected composition as a layered scene, not a card or a single button.

1. Background: `grey-hearth-b-gate-centered.png`, cropped responsively with the
   gate kept inside the central safe crop. For a narrow portrait crop, bias the
   focal point slightly left of center (about 44%) so the avatar and gate remain
   readable together; do not rely on the desktop crop's far-right forge detail.
2. Midground: the existing interactive hit regions for Mist Gate, wall map,
   secured-loot shelf, rumor board, forge, and fire. Keep labels in HTML/CSS;
   do not bake them into the image.
3. Avatar: reuse the valid current source
   `assets/combat/minimal-v0.1/actors/player-unarmed.png` as the base silhouette.
   Equipment state remains application-owned; the image candidate must not
   decide gameplay state.
4. Foreground: warm fire edge, floor shadow, and restrained ink/paper texture.
   Keep the gate CTA visually dominant and preserve keyboard focus and touch
   affordances.

The independent gate and prop studies define object material, contour, scale,
and spacing. They are references for the implementation layers, not a reason to
replace the current authoritative Hearth state or add a new management loop.

## Visual review gates

- 16:9 desktop composition remains readable at phone crop.
- Gate, avatar, fire, map, shelf, rumor board, and forge read as one room.
- Ember orange means safety; ash/charcoal means the unknown outside; color is not
  used as generic rarity decoration.
- No image contains UI labels, logos, buttons, issue metadata, progress cards, or
  acceptance text.
- The player remains an anonymous unarmed survivor with compact folk-doll
  manuscript proportions; no crown, weapon, shield, or heroic armor is implied.
- Generated candidates remain non-canon until explicit visual approval.

## Generation and integrity note

The non-character candidates were prepared through Visual Director's subjectless
background contract using the repository Global Visual Canon. The requested
player-avatar generation was intentionally stopped when the configured Approved
Anchor WebP failed to decode; no fallback candidate was silently promoted and no
new player image was generated from an unapproved source.
