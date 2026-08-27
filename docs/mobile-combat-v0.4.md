# Crownless — Mobile Combat v0.4

> **Status:** DEPRECATED / historical transition reference  
> **Deprecated:** 2026-08-27  
> **Reason:** [`adr/0002-idle-expedition-pivot.md`](adr/0002-idle-expedition-pivot.md) / Issue #189

This file documented an earlier mobile real-time combat direction.

It is no longer a current gameplay specification.

Crownless now treats hostile encounters as expedition events resolved from companions, equipment, terrain, objective, policy, and prior expedition state. The player does not need a mobile real-time action-control layer in the new core design.

See:

- [`game-system-design.md`](game-system-design.md)
- [`expedition-system-spec.md`](expedition-system-spec.md)

The previous design remains recoverable from Git history. Existing runtime code may still contain mobile combat during the transition; do not extend it unless a later accepted decision explicitly restores real-time combat.