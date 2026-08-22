# Grey Hearth visual candidates

These files are Grey Hearth design candidates. The empty-room background added
for Issue #166 is the runtime candidate: it keeps the physical room in one
image while leaving the player and state annotations to the application. These
files are not Approved Visual Anchors and must not be chained as generation
parents.

## Concept comparison

| Candidate | Composition | Decision | Intended use |
| --- | --- | --- | --- |
| `concepts/grey-hearth-a-hearth-centered.png` | Hearth-centered | Compared, not selected | Safety and return-home reference |
| `concepts/grey-hearth-b-gate-centered.png` | Mist-gate-centered | Historical direction | Key visual candidate for #162 handoff |
| `concepts/grey-hearth-c-avatar-centered.png` | Avatar-centered | Compared, not selected | Player-presence reference |
| `concepts/grey-hearth-empty-room-v0.2.png` | Empty-room / gate-centered | **Issue #166 runtime candidate** | Background with no baked person or UI |

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

The Issue #166 background was prepared through Visual Director as a subjectless
`background` Generation Package. It has no Approved Visual Anchor requirement;
the source/reference boundary was rebuilt from the Canon after the host rejected
the local JPG upload. The generated file is still a review Candidate.
