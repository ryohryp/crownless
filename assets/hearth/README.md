# Grey Hearth visual assets

The Grey Hearth package keeps only the current Approved / runtime visual sources on `main`. Rejected and superseded concept work is preserved in Git history rather than retained as generation parents.

## Approved background

`concepts/grey-hearth-empty-room-v0.2.png` is the scoped **Approved Visual Anchor** and runtime background source for the Grey Hearth. It keeps the physical room in one image while leaving the player and state annotations to the application.

Its approval record and source hash are maintained in `approved/grey-hearth-empty-room-v0.2.json`.

Earlier Hearth-centered, gate-centered, avatar-centered, Mist Gate study, and prop-reference candidates were reviewed during the Grey Hearth exploration and are intentionally no longer kept on `main`. Recover them from Git history only when historical comparison is explicitly required; do not chain them as generation parents.

## Avatar runtime (approved)

`actors/player-unarmed-hearth-v0.1.png` is a separate high-resolution, transparent Grey Hearth runtime asset derived from the approved `docs/assets/player-unarmed-approved-anchor-v0.4.png`. It is scoped to the safe-room display and does not replace or modify the combat source at `../combat/minimal-v0.1/actors/player-unarmed.png`.

The user approved this file for Grey Hearth runtime use on 2026-08-23. This approval keeps the global protagonist Anchor and Canon unchanged; the file is a runtime presentation asset only.

## Asset lifecycle

- Keep Canon, Approved Visual Anchors, and runtime sources on `main`.
- Rejected or superseded generated candidates are kept in Git history unless a current design or tooling dependency explicitly requires them.
- A Candidate must not become a generation parent unless it has the required approval for that scope.
- When an Approved or runtime source changes, update the manifest, approval record, tests, and documentation together.
- Do not keep rejected candidates solely as historical baggage in the working tree.
