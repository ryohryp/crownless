# Crownless Location Assets

## Ruined Watchtower

- project_id: `crownless`
- asset_type: `background`
- location: `Ruined Watchtower`
- location_id: `ruined_watchtower`
- status: `candidate`
- Approved Visual Anchor: `false`
- file: `assets/locations/ruined-watchtower.png`
- Canon review: `PASS` (user-supplied Issue #123 Candidate)
- dimensions: `1280×720` (`16:9`)

This candidate was reviewed against the Crownless Global Visual Canon and the
subjectless `background` Grand Design. It contains no baked text, logo, or UI;
the landmark and approach path remain readable at phone size, with restrained
faded blue-green used as discovered-knowledge color.

The asset is not a Visual Anchor and must not be used as a reference or parent
for later generation. The applicable policy remains:

```text
must_use_approved_anchor=false
must_not_chain_from_candidate=true
must_review_after_generation=true
```

Runtime resolves `崩れた物見台` to this static asset from
`src/location-visuals.js`; asset metadata is not persisted in save data.
