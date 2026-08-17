# Crownless geography Production operations

> Status: current Production operations note  
> Related issue: #73

## Purpose

`/api/geography` is a thin server-side proxy over multiple public Overpass API endpoints. The game remains functional while at least one configured upstream is available.

The proxy deliberately tries endpoints in order and returns structured attempt history. A successful response includes:

- `elements`: Overpass elements from the first successful upstream
- `endpoint`: the upstream that succeeded
- `attempts`: one record per attempted upstream
- `total`: configured upstream count
- `timeoutMs`: timeout applied to each upstream request

Each attempt includes `state`, `httpStatus`, `error`, `timedOut`, `failureKind`, and `durationMs`.

`failureKind` is one of:

- `timeout` — Crownless stopped waiting after the configured timeout
- `http` — the upstream returned a non-success HTTP status
- `aborted` — the request was aborted outside the normal timeout path
- `network` — fetch failed before a usable HTTP response was received

When a fallback succeeds, the Vercel function emits a structured `geography_upstream_state` warning. When every upstream fails, it emits the same event at error level with `state: "all_failed"`.

## Current upstream behavior

The Production incident that opened issue #73 showed this sequence:

1. `https://overpass.openstreetmap.jp/api/interpreter` — fetch failure from Vercel
2. `https://overpass.private.coffee/api/interpreter` — timed out
3. `https://overpass-api.de/api/interpreter` — succeeded

This is treated as degraded upstream availability, not an application outage, while a later endpoint succeeds.

The timeout is intentionally per endpoint. A slow first endpoint therefore increases total response latency before fallback. The attempt `durationMs` values are the primary evidence for deciding whether endpoint order or timeout should be changed later.

## Monitoring

`.github/workflows/geography-health.yml` checks the Production endpoint on a schedule and can also be run manually.

The check requires:

- HTTP 200 from `/api/geography` for a valid location
- a non-empty `attempts` array
- a successful selected `endpoint`
- at least one attempt with `state: "success"`

Fallback is reported in the workflow summary but does not fail the check. Total upstream failure fails the workflow.

## DEP0169 disposition

Issue #73 originally associated Node `DEP0169` (`url.parse()`) warnings with `/api/geography`, but repository inspection found no `url.parse` call in Crownless source and `package.json` contains no runtime dependencies. `/api/geography` itself uses the platform-provided native `fetch`.

A later GitHub Pages deployment provided concrete evidence of the same `DEP0169` warning outside the geography runtime path. In Pages workflow run #143 (commit `5c715de4ab3f7b08f3bf1f2bec904dacc7819633`), the warning appeared while `actions/upload-artifact@v4` was uploading the Pages artifact. The artifact upload itself succeeded; the first deployment attempt then failed separately because the GitHub Pages deployment API returned HTTP 503, and a re-run succeeded.

This proves that at least one observed `DEP0169` instance originates in GitHub Actions tooling rather than Crownless application code. It does **not** by itself prove that every earlier Vercel-side warning has the same origin, so those warnings should not be attributed to Vercel, GitHub Actions, or Crownless without a stack trace from the specific occurrence.

Current disposition:

- do not change Crownless geography code merely to suppress `DEP0169`
- do not add a dependency solely to replace the native `fetch` path
- when `DEP0169` is observed, record the workflow/runtime and surrounding step before assigning ownership
- if a stack trace points to Crownless-owned code, fix that call site and update this note
- if it points to third-party platform/action code, track the corresponding upstream update rather than masking deprecation warnings globally

## Deployment rule

Production deployment remains explicit through `.github/workflows/vercel-production.yml`, which is `workflow_dispatch` only. Do not enable Vercel Git automatic deployment for this repository.
