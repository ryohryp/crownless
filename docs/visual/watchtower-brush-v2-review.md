# Watchtower brush direction candidate v2 — pending review

A newly generated alternative to the earlier 1672×941 watchtower image.

## Candidate and provenance

- The rendered full-resolution generated v2 PNG is currently retained as a conversation artifact, **not committed to Crownless**. This Git-tracked `640×360` JPEG is a **lossy review proxy**, not a full-resolution production source, and is **not accepted**.
- Preview: `.qa/candidates/watchtower-inkwash-brush-v2-640.jpg`; SHA-256 `fae5d33ea7d20720b778dcdfee590c6722c7adc35dfc87f636da4578d0743999`.
- Git blob SHA: `f5464bc765da1323140a6bc3053f7217f7c6917d`. Byte-exact checked against the generated proxy.
- The first high-resolution uploaded candidate is still at `.qa/candidates/a_wide_atmospheric_landscape_illustration_paintin.png` and MUST remain untouched.
- Intent: preserve readable watchtower and stairway silhouette, soften distant valley into ink wash and open more warm paper space; avoid accidental place labels, photorealism, visual route guidance or retro blue/teal/gold UI.

## Assessment

Initial Jev image and three-width phone checks pending. The baseline original high-resolution test was `needs_review`, style `2.63/4`, quality `3.03/4`, smartphone readability `3.81/4`; reference [run](https://github.com/ryohryp/crownless/actions/runs/38818567936). Scores from a smaller proxy are *not* direct evidence that the full-sized new original would outperform the old one.

This branch carries a temporary, branch-specific QA workflow to exercise the existing official TypeSafe Jev SDK and screenshot pipeline. It will be deleted immediately after the run; the installed manual-only workflow remains the stable review entrypoint.

**No production adoption or approved Canon changes.** Confirm visual merit by human phone review, and check the full-resolution v2 source before any promotion.
