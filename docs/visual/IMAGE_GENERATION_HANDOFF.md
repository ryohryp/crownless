# Crownless Image Generation Handoff

This document is the fail-closed handoff contract between Crownless visual Canon preparation and the image generator.

The goal is to ensure that a production visual request produces the requested game asset itself, not a rendering of the surrounding development conversation, Issue, progress report, validation UI, or other meta-output.

## Mandatory preflight

Before invoking any image generator for a Crownless production asset:

1. Resolve the current repository Canon first. Use the current gameplay/subsystem specification, `docs/visual-design-guide-v0.2.md`, the Global Visual Reference, and the relevant Grand Design / compiled Canon contract.
2. Build an **asset-only handoff**. The final generation request must describe only the requested asset, its composition, required scene facts, style lock, allowed changes, forbidden changes, and approved/reference assets that are valid for that generation.
3. Keep development metadata outside the generation request. Do not ask the image model to render or reproduce Issue numbers, PRs, task status, progress percentages, dashboards, reports, validation summaries, commit SHAs, acceptance-checklist UI, or tool output unless the requested production asset is explicitly one of those things.
4. Do not let unrelated conversation images become implicit parents. If the host cannot mechanically restrict image bindings to the current Generation Package or an explicit empty/approved reference set, fail closed instead of guessing.
5. Respect `must_not_chain_from_candidate`. Rejected, unrelated, prior generated Candidates are never source references for a new production asset.
6. Respect the asset contract. If `source_reference_required` is false, do not invent a source image merely to satisfy the generator.

## Asset-only handoff contents

The final handoff may contain:

- asset identity and purpose
- target aspect ratio / framing
- required scene facts and composition
- Global Visual Style Lock / relevant subsystem style rules
- semantic palette rules
- explicit allowed changes
- explicit forbidden changes / avoid block
- only the reference assets approved by the current Canon package

It must not contain development-status prose whose only purpose is to explain the work around the asset.

## Meta-output rejection rule

Treat any of the following as an immediate generation failure when they were not the requested asset:

- GitHub / project-management style screens
- progress dashboards or status cards
- validation or review reports rendered as an image
- acceptance-criteria checklists rendered as UI
- issue / PR / commit metadata rendered into the image
- dimensions, PASS/FAIL, Approved/Rejected, or similar process labels baked into the image

A meta-output image is **not a Candidate**. Do not register it, adopt it, use it as a parent, crop it into a production asset, or place it in runtime paths.

## Retry after meta-output

Do not blindly retry the same contaminated request.

Rebuild the handoff from the repository Canon and the current asset contract, remove meta/progress context from the generation request, re-establish the valid image-reference boundary, and only then attempt another generation.

If the same wrong-reference or meta-output class repeats twice, stop generation and treat it as a handoff / host-binding defect rather than continuing to spend generations.

## Background / discovered-location reminder

For subjectless discovered-location backgrounds such as the exploration journal visuals:

- use the repository Global Visual Canon and the `background` Grand Design contract
- keep characters and creatures absent unless explicitly requested
- keep text, labels, logos, game UI, issue UI, and progress UI out of the image
- preserve the requested wide environmental composition and phone-scale landmark readability
- use parchment negative space, rough hand-inked / woodcut grammar, restrained semantic color, and avoid photoreal / painterly / cinematic generic dark-fantasy drift

Generated output remains a Candidate until Canon review passes.
