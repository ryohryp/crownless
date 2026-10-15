# New-image pilot: generated ruined watchtower (unapproved)

The candidate `.qa/candidates/generated-watchtower-inkwash-512.jpg` is a **lossy 512×288 review proxy** derived from a newly generated 1672×941 PNG environment image. It is not the previous legacy watchtower fixture and is **not adopted into runtime or global Canon**. Review source provenance: created for this Crownless image QA iteration, original PNG held outside the repo until selected for human review.

The screenshot scene is explicitly seeded with a **synthetic tower district** in a fresh demo-only browser context, so a watchtower candidate is not judged against the starter forest land. No real coordinates or player saves are involved.

The Git-tracked review proxy must match SHA-256 `02109e5f4a5b952d2f561b9b9ab0756aa15eb7ba418878a45ef0dc6c52491b4c`. The phone QA injects it temporarily into the land detail scene; the old map background insertion was almost fully obscured by opaque map tiles.

The candidate was reduced heavily to minimize evaluation payload; fine-detail/texture judgments and eventual production adoption MUST use the original full-resolution asset, never this low-quality proxy.

Run the existing quality gate with a trusted `TYPESAFE_API_KEY`:
```
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
npm run asset:quality -- --manifest docs/visual/quality-gate-generated-watchtower.json --stage all --force
```
The tool prepares a real candidate image, optionally evaluates with Jev Vision (Choice/Score/Noul) and assesses temporary placement at 360, 390, 430px. When the credential is absent, it MUST report `evaluation_unavailable`, not acceptance. Even with all advisory checks passing, a person must inspect actual artwork in the game before adoption.

No GPS, new player data, or production art path changes. An unacceptable image stays a candidate.

## First real-image deterministic E2E — 2026-10-15

- Source preview Git blob `f78135e96f4c77166c105ec3f9938f74a74b1736` is byte-for-byte verified with local generated preview.
- Exact 512×288 JPEG decoded correctly; format, size, and non-transparency checks passed.
- Captured three actual demo detail-screen placements at 360, 390, and 430 CSS px; reported image visibility fraction was **1.0** at all widths, with no detected tap obstructions or horizontal overflow.
- The selected synthetic land title was `北の見張り跡 · 2` for all screenshots, avoiding mismatch with the starter wood biome. A separate regression proves the old placement hidden behind opaque map tiles is detected.
- Evidence: [GitHub Actions deterministic review](https://github.com/ryohryp/crownless/actions/runs/38757028311) and [phone screenshots + JSON report artifact](https://github.com/ryohryp/crownless/actions/runs/38757028311/artifacts/11984206205). Artifacts expire after two days.
- **Live Jev Vision was NOT executed**: `TYPESAFE_API_KEY` was missing; both candidate and screenshot reports explicitly say `evaluation_unavailable`, with zero API requests. The successful CI outcome certifies **only deterministic checks**, not the artistic quality of the image or approval for production.
- The one-off QA workflow used to produce this report was removed after running. The permanent phone regression and reusable `asset:quality` script remain.

To complete semantic approval, supply a credential only to a trusted execution environment and rerun the above command using the **full-resolution original image**, then review the result on a phone. Do not merge artwork into a runtime path solely because deterministic checks passed.

## Subsequent live Jev Vision E2E — 2026-10-15 16:00 UTC

After `TYPESAFE_API_KEY` was configured as a GitHub Actions repository secret, an isolated branch-scoped run called the **real** official TypeSafe Jev Vision API. The secret value was never printed or committed.

- **Run:** [live Jev Vision review](https://github.com/ryohryp/crownless/actions/runs/38765186613); [short-lived JSON report and 360/390/430 px screenshots](https://github.com/ryohryp/crownless/actions/runs/38765186613/artifacts/11989245036).
- **Model:** `jev-1.13.0`; **2 successful image calls** (asset and three-phone-screenshot assessment); input 7,036 tokens; output 362 tokens.
- **Asset:** model verdict `accept_candidate` at confidence **0.53**, interpreted as **`needs_review`**, not accepted. Style alignment **2.99 / 4** (confidence 0.62); quality **2.71 / 4** (confidence 0.29). Possible style drift remains meaningful (27% `main_issue=style` probability).
- **Phone:** verdict `accept_candidate` at confidence **0.65**, interpreted as `accept_candidate`; readability **3.87 / 4**, no clear UI obstruction (noul 0.12). Deterministic tests show 100% visibility on all three phone widths, no blocked controls, no horizontal overflow, and the matching fictional tower district.
- **Decision:** keep the newly generated 512×288 JPEG as an **unapproved review-only proxy**. The live evaluation proves SDK image transport + semantic model response + gameplay screenshot evaluation, **not final aesthetic acceptance of full-resolution source art**. User review of the full-resolution PNG and an actual phone playtest remain before any production image adoption.
- **Cleanup:** the branch-scoped one-off workflow `_temp-live-jev-watchtower.yml` was removed after the report was captured; no recurring calls or secrets-bearing workflow remain on this branch.

All non-image gameplay, location privacy, save behavior, and existing approved visual anchors are unchanged.
