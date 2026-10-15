# Watchtower brush direction candidate v2 — pending review

A newly generated alternative to the earlier 1672×941 watchtower image.

## Candidate and provenance

- The rendered full-resolution generated v2 PNG is currently retained as a conversation artifact, **not committed to Crownless**. This Git-tracked `640×360` JPEG is a **lossy review proxy**, not a full-resolution production source, and is **not accepted**.
- Preview: `.qa/candidates/watchtower-inkwash-brush-v2-640.jpg`; SHA-256 `fae5d33ea7d20720b778dcdfee590c6722c7adc35dfc87f636da4578d0743999`.
- Git blob SHA: `f5464bc765da1323140a6bc3053f7217f7c6917d`. Byte-exact checked against the generated proxy.
- The first high-resolution uploaded candidate is still at `.qa/candidates/a_wide_atmospheric_landscape_illustration_paintin.png` and MUST remain untouched.
- Intent: preserve readable watchtower and stairway silhouette, soften distant valley into ink wash and open more warm paper space; avoid accidental place labels, photorealism, visual route guidance or retro blue/teal/gold UI.

## Live Jev Vision assessment — 2026-10-15 23:14 UTC

The **actual 640×360 JPEG candidate bytes** were checksum-verified on the GitHub runner. The official TypeSafe Jev SDK made **two real Jev Vision API calls** (`jev-1.13.0`; 7,243 input / 362 output tokens), including the temporarily inserted image at three mobile sizes. [Successful technical QA run](https://github.com/ryohryp/crownless/actions/runs/38822301648); [short-lived report and actual phone screenshots](https://github.com/ryohryp/crownless/actions/runs/38822301648/artifacts/12012997417).

- Asset: `needs_review`, **not accepted**. Raw `revise` choice at confidence **0.27**, style issue flagged (probability .35 vs no-issue .35); style **2.78/4** and quality **2.47/4**. Compression and resized source may impair fine detail; do not infer production-ready quality.
- Actual 360/390/430 px UI: `needs_review`, raw `accept_candidate` at confidence **0.55**, readability **3.84/4**. Deterministic image visibility **1.0** at each width; no overflow, blocked taps, or wrong-scene placement.
- Previous full-res source scored style **2.63/4**, quality **3.03/4**, phone readability **3.81/4** ([prior result](https://github.com/ryohryp/crownless/actions/runs/38818567936)). Different resolutions/compression and probabilistic estimates mean these are directional signals, **not an apples-to-apples rank**.
- Visual observation: silhouette and stairway remain recognisable, but too much rendered masonry/shading persists for a fully expressive, deliberate sumi-e brush painting. The phone details also show extensive lower-screen whitespace in the demo view; visual review of one asset alone is not proof of enjoyable exploration gameplay.
- The temporary, push-triggered, secret-consuming runner was **removed after the single live run**. The normal manual-only `Image candidate Jev Vision review` workflow remains unchanged.

**Decision: HOLD / do not promote.** Preserve the existing baseline, keep this small JPEG as a review-only candidate and do not treat it as an approved global or runtime art anchor. To learn whether the visual meaningfully improves discovery, test real player curiosity before generating a larger batch or rebuilding the rendering system. The full-res generated v2 source remains available as a conversation output for explicit later review; only the lossy review proxy is in GitHub.
