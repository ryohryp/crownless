# Full-resolution generated watchtower: unapproved Jev Vision review

This is a review-only manifest for the **actual user-uploaded original** `.qa/candidates/a_wide_atmospheric_landscape_illustration_paintin.png` in `main` commit `1474742`. It is not the earlier heavily compressed 512×288 JPEG proxy.

- Source: 1672×941 PNG RGB, 3,199,294 bytes.
- Verified against the original file in the conversation: Git blob SHA `6f9c80d006ded696e7ff95cb382b039f215b7ac2` and SHA-256 `56fb9dbd3c5cc71c97465c9a03dac3b6227a8b0e018fb8a4786f205f3fe155d0`.
- Purpose: assess the full-resolution **unapproved candidate** and in-game appearance at 360/390/430 CSS px in a fictional matching tower district.
- The quality gate generates its own bounded Jev upload preview with Sharp; it does **not** replace the original in GitHub or alter the active game's artwork.
- Previous low-resolution JPEG Jev result: `needs_review`; it cannot substitute for this full-resolution review.
- The temporary, branch-scoped GitHub Actions runner performs the first evaluation with the existing repository `TYPESAFE_API_KEY` secret. It will be removed after the run; the permanent manual-only `Image candidate Jev Vision review` workflow is reusable thereafter.
- **No automatic adoption or Canon update**, irrespective of raw model verdict, CI green status, or success of the phone visibility tests.

## Live high-resolution result — 2026-10-15 22:39 UTC

[Actual original-image GitHub Actions run](https://github.com/ryohryp/crownless/actions/runs/38818567936) **PASS as a transport/technical review** and [short-lived report plus screenshots](https://github.com/ryohryp/crownless/actions/runs/38818567936/artifacts/12012116850). The source candidate hash matched the previously generated original in this conversation, exactly.

- TypeSafe Jev Vision model: `jev-1.13.0`, **two real API requests**, 10,214 input tokens and 362 output tokens.
- Asset: `needs_review` (**not accepted**). Raw model top choice `accept_candidate` confidence **0.33**. Visual style **2.63/4**, quality **3.03/4**. Primary issue is **style**, confidence 0.34 (style probability **0.41**; no issue probability 0.33). Do not treat a 2.63/4 score as approved Canon compliance.
- Phone: `needs_review` (**not accepted**). Raw model top choice `accept_candidate` confidence **0.52**, readability **3.81/4**. Crop probability 0.37 vs no-issue probability 0.50: review composition at phone sizes.
- Deterministic Playwright: the unmodified original 1672×941 PNG was temporarily inserted into the **matching fictional** `北の見張り跡 · 2` land detail view at **360/390/430 CSS px**. It loaded at all three widths, sampled visible fraction **1.0** at all widths, with **no overflow, tap obstruction, or context mismatch**. These are UI checks, not artistic approval.
- Visual inspection: the landmark and stone stairway read clearly, but very detailed stonework and illustration-like shading may drift away from the current **expressive dry-brush sumi-e, airy washi** target. Consider a new candidate with fewer small masonry details, stronger intentional brush marks and negative space, then compare on an actual phone. Do **not** overwrite the original.

**Decision: unapproved, human review required**. No runtime art replacement, Canon promotion, GPS/location recording, player-save changes or automatic merges. The temporary push-triggered credentialed workflow was deleted after the verified run; for future explicit evaluations, use the merged permanent **Image candidate Jev Vision review** Action with manifest `docs/visual/quality-gate-watchtower-fullres.json` after that manifest is merged. A green action means evaluation completed only.
