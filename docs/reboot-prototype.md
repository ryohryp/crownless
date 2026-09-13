# Crownless Reboot Prototype — play and verification guide

> Status: implemented prototype / human playtest pending  
> Related: #529, #531, #533, #557, #560

## What this prototype covers

`reboot.html` is a bounded consequence-chain prototype. It starts with the unnamed player discovering the Bell Tower, carries four irreversible decisions through six remembered places, and ends in one of four endings.

The intended loop in this prototype is:

1. discover the Bell Tower,
2. decide the Bell Tower's fate,
3. discover and decide the old crossing,
4. discover Black Raven Hill and choose which direction receives the signal,
5. choose which fork place to visit first while the unvisited place also changes,
6. find the collision point created by both consequence chains,
7. read the ending and the six-place land memory.

This is a prototype slice, not a new chapter/economy/progression system. Automated completion does not decide whether the experience is fun.

## Start locally

From the repository root:

```sh
npm start
```

Then open:

```text
http://localhost:4173/reboot.html
```

Use a browser that supports foreground geolocation if testing real GPS. `localhost` is accepted as a secure context by modern browsers; a normal remote deployment should use HTTPS.

## Two ways to explore

### Current location

Choose **現在地から始める** and only press the location-check buttons while safely stopped. Crownless reads a foreground position only when the player explicitly asks for it.

The Reboot prototype rejects a GPS sample when reported accuracy is worse than **120 m**. Permission denial, position-unavailable errors, timeout, low accuracy, and missing callbacks return the UI to a retryable state instead of consuming the choice or advancing the world.

A delayed location callback from a request that was abandoned by switching to simulated/DEV movement is ignored.

### Simulated / DEV movement

Choose **模擬探索で試す** to exercise the same discovery rules without live GPS. Later DEV movement buttons skip only physical travel time and are intended for development verification.

DEV movement is not an in-world rewind and does not authorize a different gameplay transition.

## Persistence behavior

The prototype persists game-facing world state under the Reboot save key when browser storage is available.

It does **not** persist raw latitude/longitude, reported GPS accuracy, exact route history, or movement tracks.

If browser storage cannot be read or written, Crownless falls back to same-tab memory. The current tab can still reach an ending, and newer in-memory world state takes precedence over older persistent data during that tab. A persistent warning remains visible because closing/reloading the tab can lose the memory-only progress.

Quota exhaustion is treated the same as other storage-write failures.

## DEV reset

**DEV: Prototypeを最初からやり直す** removes only the Reboot Prototype save key.

It does not call `localStorage.clear()` and must not remove unrelated Crownless/browser keys.

If that specific key cannot be removed, the prototype shows a warning and does **not** reload. This avoids throwing away memory-only progress or reloading back into an older persistent state.

## Ending and land memory

The ending surface shows:

- one of four ending titles,
- the four decisions in player-facing language,
- six land-memory cards,
- which early places were changed by a direct choice,
- which fork place was visited and which remained unvisited while still changing,
- the collision place that was ultimately discovered.

Internal branch keys and implementation/debug transition names are not part of the normal ending text.

## Automated verification

The browser check in `scripts/check-reboot-chapter.cjs` is intended to cover:

- all 16 irreversible branches,
- reload/idempotent ending recovery,
- denied reads/writes and quota-exceeded storage fallback,
- GPS permission denial, unavailable, timeout, low accuracy, retry, duplicate suppression, and stale callback handling,
- GPS discovery of the collision point through the same game transition as DEV discovery,
- persistent hill name and crossing-to-hill consequence line after the hill choice,
- 320 px, 390 px, and 1366 px horizontal bounds/readability checks.

CI success is implementation evidence only.

## Human real-walk playtest

The real-device walk remains **Playtest pending** until a person safely plays from first discovery through the collision point and ending on a phone.

Record separately:

- permission denial and recovery,
- reload during the route,
- whether normal GPS accuracy causes stalls,
- whether the player understands that earlier choices changed later land,
- whether they want to revisit another branch,
- any over-explained or boring section.

Only that human play session can produce a Keep / Change / Kill judgment. Automated tests must not be used as a substitute.
