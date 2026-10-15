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
