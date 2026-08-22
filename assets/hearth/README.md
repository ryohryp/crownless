# Grey Hearth visual candidates

These files are Issue #163 design candidates for the Grey Hearth first view. The
selected B composition is approved for the Grey Hearth runtime integration, but
these files are not Approved Visual Anchors and must not be chained as generation
parents.

## Concept comparison

| Candidate | Composition | Decision | Intended use |
| --- | --- | --- | --- |
| `concepts/grey-hearth-a-hearth-centered.png` | Hearth-centered | Compared, not selected | Safety and return-home reference |
| `concepts/grey-hearth-b-gate-centered.png` | Mist-gate-centered | **Selected direction** | Key visual candidate for #162 handoff |
| `concepts/grey-hearth-c-avatar-centered.png` | Avatar-centered | Compared, not selected | Player-presence reference |

The selected B direction gives the Mist Gate the clearest actionable silhouette
while keeping the warm Hearth, player figure, map, shelf, rumor board, and forge
visible as one lived-in place. Selection is a composition decision only; the
image remains a review candidate until explicitly approved.

## Supporting candidates

- `concepts/mist-gate-reference.png` — independent gate study; no UI or baked CTA.
- `concepts/hearth-prop-reference-set.png` — independent map rack, secured-loot
  shelf, rumor board, and forge study; blank paper is intentional so UI text is
  supplied by the application.
- `../combat/minimal-v0.1/actors/player-unarmed.png` — current valid unarmed
  player source and the avatar baseline for this handoff. The separate
  `docs/assets/player-unarmed-approved-anchor-v0.2.webp` could not be decoded
  during this work because its WebP bitstream is corrupt, so it was not used as a
  generation parent.

All generated images were prepared from the Crownless Global Visual Canon with
`must_not_chain_from_candidate: true`, `must_review_after_generation: true`, and
no UI, logo, issue metadata, or progress text in the handoff.
