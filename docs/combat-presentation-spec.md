# Crownless — Combat Presentation Specification

> **Status:** DEPRECATED / historical transition reference  
> **Deprecated:** 2026-08-27  
> **Reason:** [`adr/0002-idle-expedition-pivot.md`](adr/0002-idle-expedition-pivot.md) / Issue #189

This document previously defined the oblique top-down real-time combat presentation for Crownless.

That combat model is **no longer gameplay Canon**.

The current canonical design is:

- [`game-system-design.md`](game-system-design.md)
- [`expedition-system-spec.md`](expedition-system-spec.md)
- [`exploration-location-spec.md`](exploration-location-spec.md)

Under the current design, combat may occur as a structured event during an expedition, but it is not a player-controlled real-time action scene.

Do not use this file to justify new work on:

- stand-to-strike controls
- combat HUD
- Technique / Evade
- 闘志 / 決着
- battlefield weapon pickup
- real-time enemy telegraphs or action-combat rendering

unless a new accepted design decision explicitly brings such a system back.

The old implementation remains available in Git history and may still exist in the runtime during the transition. Cleanup or repurposing must trace code, tests, assets, manifests, and deployment references rather than deleting files blindly.