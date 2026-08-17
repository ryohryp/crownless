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

Vercel runtime logs have emitted Node `DEP0169` warnings for legacy `url.parse()` use while serving `/api/geography`.

Repository inspection for issue #73 found:

- no `url.parse` call in Crownless source
- no runtime dependencies in `package.json`
- `/api/geography` uses the platform-provided `fetch`

Therefore the warning is not currently attributable to Crownless application code. Until a trace identifies a repository-owned caller, it is classified as a runtime/platform-origin warning and does not justify replacing the native fetch path or adding a dependency solely to suppress it.

If the warning changes into an application stack trace pointing at Crownless code, fix that call site and update this note. If it remains platform-only, track Vercel/Node runtime updates rather than masking deprecation warnings globally.

## Deployment rule

Production deployment remains explicit through `.github/workflows/vercel-production.yml`, which is `workflow_dispatch` only. Do not enable Vercel Git automatic deployment for this repository.
