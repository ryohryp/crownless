# New-image pilot: generated ruined watchtower (unapproved)

The candidate `.qa/candidates/generated-watchtower-inkwash-512.jpg` is a **lossy 512×288 review proxy** derived from a newly generated 1672×941 PNG environment image. It is not the previous legacy watchtower fixture and is **not adopted into runtime or global Canon**. Review source provenance: created for this Crownless image QA iteration, original PNG held outside the repo until selected for human review.

The candidate was reduced heavily to minimize evaluation payload; fine-detail/texture judgments and eventual production adoption MUST use the original full-resolution asset, never this low-quality proxy.

Run the existing quality gate with a trusted `TYPESAFE_API_KEY`:
```
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
npm run asset:quality -- --manifest docs/visual/quality-gate-generated-watchtower.json --stage all --force
```
The tool prepares a real candidate image, optionally evaluates with Jev Vision (Choice/Score/Noul) and assesses temporary placement at 360, 390, 430px. When the credential is absent, it MUST report `evaluation_unavailable`, not acceptance. Even with all advisory checks passing, a person must inspect actual artwork in the game before adoption.

No GPS, new player data, or production art path changes. An unacceptable image stays a candidate.
