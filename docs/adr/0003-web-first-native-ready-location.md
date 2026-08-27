# ADR 0003 — Web-first PoC with a native-ready location boundary

> **Status:** accepted  
> **Date:** 2026-08-27  
> **Related:** #191, #189

## Context

Crownless uses real-world location to reveal and expand the game world. The current playable implementation is browser-based and can request foreground location after explicit player interaction.

A future version may want a stronger experience:

> walk with the phone in a pocket → reopen Crownless later → discover that the world expanded while the app was not actively open

That experience may require native background-location capabilities, but implementing them now would add platform permissions, battery behavior, store-policy constraints, packaging, and OS-specific code before the new idle-expedition loop has proven that it is fun.

## Decision

The first idle-expedition PoC remains **web-first**.

The PoC uses foreground, explicit location acquisition and does not require continuous or background tracking.

Location access must remain behind a replaceable platform boundary so the game/discovery core does not depend directly on browser APIs.

Conceptually:

```text
Game / Discovery Core
        |
        v
LocationProvider
   |          |
   |          +-- future NativeLocationProvider
   |
   +-- WebLocationProvider
          navigator.geolocation

SimulatedLocationProvider
  - tests
  - development
  - fallback
```

World-cell conversion, fantasy discovery generation, persistent knowledge, expedition availability, and save rules remain platform-independent.

## Native migration trigger

Crownless does **not** become native merely because it uses GPS.

Native packaging / Capacitor / Native Location APIs should be evaluated when playtesting proves that background discovery materially improves the game, especially if the desired experience becomes:

- discover while the app is not actively open
- low-power background movement recognition
- significant-location-change or geofence-style discovery

Until then, App Store / Google Play packaging is not a PoC blocker.

## Consequences

### Positive

- keeps the PoC focused on whether `Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt` is fun
- preserves the existing browser prototype and rapid deployment workflow
- avoids premature iOS / Android platform complexity
- keeps a clear migration path to Capacitor or another native container later
- preserves deterministic simulated location for tests and fallback

### Trade-offs

- the PoC will not reliably discover every place visited while the browser is closed
- foreground location requires the player to open the game and explicitly allow location access
- background discovery remains a later product decision rather than a current promise

## Non-goals

- immediate Capacitor integration
- Swift / Kotlin rewrite of the game core
- background location implementation
- continuous route logging
- step-count rewards
- raw GPS history persistence

## Decision rule

> **Native is justified when background movement becomes part of the fun, not simply because Crownless reads location.**
