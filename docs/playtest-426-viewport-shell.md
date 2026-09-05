# Atlas viewport shell — Issue #426

Implemented; human playtest pending.

## Scope

The first slice covers the mobile Hearth entry → World Atlas / nearby survey →
place selection → local action/result → existing expedition preparation flow.
The Hearth keeps its room and existing optional collections; its new bottom
entry opens the map without searching down the page. Other screens have not
been redesigned.

Atlas uses a bounded `dvh` shell with `VisualViewport` resize/scroll updates and
safe-area padding. Header, map switch and bottom actions remain outside the
scrolling notes. Mobile and short landscape layouts open the selected place in
the map area; desktop keeps the notes beside the map. Actions precede lore.
Dense or overlapping marks can also be selected by name from the notes picker.
Short viewports suppress unselected map labels to preserve the ink marks.

Results use the existing action sheet. Escape closes the innermost surface,
Tab stays inside it, and closing restores focus. Existing desktop Hearth
shortcuts yield to Atlas controls. Survey updates replace the surface rather
than extending the document. No discovery, expedition or save schema changed.

Browser verification also exposed two existing presentation defects on this
path: global button press transforms displaced map marks, and report rendering
assumed every log entry included `causes`. The marks now keep their position;
the report accepts an absent optional causes array. Resolution logic is unchanged.

## Repeatable browser regression

Use Node 22+ and an isolated QA environment:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node scripts/check-atlas-viewport.cjs
```

The script starts and closes its own local static server and isolated browser
contexts. Only the location provider is simulated; discovery persistence,
selection, event handlers, expedition dispatch/resolution and save/load use the
real runtime. The clock is fixed for reproducible expeditions. Optional
`ATLAS_SCREENSHOT_DIR` saves screenshots; `ATLAS_BROWSER_CHANNEL=msedge` uses
an installed Edge instead of the Playwright Chromium binary.

Coverage:

- 390×844, 320×568, 844×390 and 1366×900: map, bounded footer, local notes and results.
- World/nearby switching, three repeated surveys, stable discovery count/visits,
  no precise location data in persisted discoveries, no document growth or wheel scroll.
- Direct map selection and selection by name; event → follow-up choices → result.
- Escape, Tab containment, Enter activation, focus restoration and viewport shrinking.
- Preparation and dispatch; active expedition survives reload; clock advance returns
  it; instant expeditions exercise other sizes; reopening reports does not duplicate rewards.
- Empty map, denied location and failed provider keep retry and map access available.
- No uncaught browser errors across the main loop.

## Local verification, 2026-09-05

Node 24.19.0 / Playwright 1.62.1 / headless Edge on Windows:

- Full suite on the final working copy: 889 tests passed.
- Focused Atlas tests: 34 passed.
- All four browser sizes and denied/empty/offline cases passed.
- Screenshots reviewed for phone, short landscape and desktop layouts.
- Syntax checks and `git diff --check` passed.

The repository test workflow now runs the browser regression alongside the
existing suite on Node 22 / Chromium. Hosted GitHub CI has not been run from
this local, unpushed change. Physical iOS/Android keyboards, browser chrome,
notches, real GPS and outdoor play remain unverified. Emulator resize coverage
does not substitute for those device checks. Whether the flow feels better in
play remains a human playtest judgment.
