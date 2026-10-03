# ADR 0006 — Social territory control becomes the core meta-loop

- **Status:** Accepted / pending merge
- **Date:** 2026-10-03
- **Builds on:** ADR 0004
- **Supersedes:** ADR 0004's Phase 1 exclusion of player-owned territory competition and the current `AGENTS.md` guidance that territory/PvP should wait until after the core loop is fun

## Context

Recent playtests show that Crownless's immediate expedition loop can function mechanically:

> **Explore → Fight → Loot → Return alive → Improve → Explore farther**

Strategic combat, survival pressure, loot, return, and improvement can all work, but the current loop still gives the player too little reason to care about the next expedition. The missing motivation is not another reward tier, another combat mechanic, or a larger economy.

Crownless's distinctive fantasy is stronger when the player can see that real-world movement and successful expeditions leave a persistent mark on a shared medieval-fantasy world.

ADR 0004 already established territory expansion as a promising long-term product direction, but its first slice deliberately excluded PvP and player-owned territory competition. The current decision changes that boundary: visible traces of other players and asynchronous contest over places are now part of the hypothesis we want to test.

This is not a decision to bolt a generic social network onto the game.

## Decision

Crownless will use **social territory control as the core meta-loop around the existing expedition loop**.

The moment-to-moment loop remains:

> **Explore → Fight → Loot → Return alive → Improve**

The higher-level motivation becomes:

> **Discover a place → Conquer it → Leave a visible mark → See another player's mark or challenge → Retake or expand → Prepare for the next contest**

The product fantasy is:

> **Move through the real world, discover Crownless strongholds, conquer them, and leave a persistent trace that other players can encounter, challenge, and change.**

Equipment, combat, loot, survival, and improvement are not discarded. They become means to take, hold, retake, and expand meaningful places.

## Social design principle

The social layer must emerge from **gameplay events attached to places**, not from a separate social feed added beside the game.

A place may show events such as:

- who first discovered or conquered it
- who currently holds it
- who challenged or retook it
- what happened during a notable successful or failed attempt
- what defensive setup or combat snapshot was overcome
- how control changed over time

This history is the social surface.

Following, friending, posting arbitrary text, general-purpose comments, and a standalone timeline are not required for the first playable hypothesis.

## Asynchronous contest

The first social competition model is **asynchronous**, not real-time PvP.

A player who controls a stronghold leaves behind a defendable snapshot derived from the current game state, for example:

- equipment/build
- one or more defenders
- a small defensive modifier or choice
- a compact authored or system-generated encounter setup

Another player contests that snapshot through the normal Crownless gameplay loop.

The defender does not need to be online.

Real-time PvP, synchronous matchmaking, chat-driven coordination, or live battles are explicitly out of scope.

## Territory MVP

The smallest coherent slice is:

1. discover a stronghold through location-driven exploration
2. defeat an NPC-held version of that stronghold
3. claim it and leave the player's banner/name on the place
4. expose a control-history log for that place
5. let a second-player fixture or simulated rival challenge and change control
6. let the original player see that the place was taken and attempt a retake
7. make the next nearby target visible after conquest or loss

The MVP must answer:

> **When another player changes a place I cared about, do I want to go back, retake it, or take another nearby place?**

The initial test may use simulated identities and local fixtures.

Do **not** build authentication, a generic multiplayer backend, guild infrastructure, presence, matchmaking, or a large persistence system until the social territory slice proves fun enough to justify them.

## Territory clusters

After the single-stronghold loop is fun, nearby strongholds may form a lightweight territory cluster.

A first version can simply recognize that controlling several nearby places creates a visible local domain.

This must not initially require:

- faction simulation
- diplomacy systems
- taxes or large economies
- scheduled wars
- seasons
- leaderboards
- guild ownership
- clan permissions
- complex siege timers

Those are future experiments, not prerequisites.

## Relationship to ADR 0004

ADR 0004 remains useful for these principles:

- real-world movement discovers meaningful places
- territory must visibly change the world
- captured places should affect what the player can do next
- territory must not become renamed XP or repetitive control grinding
- the Atlas should make control state and next targets legible
- raw GPS history should not become territory state

This ADR changes ADR 0004 in one important way:

> **Player-owned territory competition is no longer deferred from the first product hypothesis.**

However, we still reject the idea of building a full multiplayer strategy game before validating the smallest social contest loop.

## Relationship to the current expedition loop

The existing expedition loop is not removed.

A stronghold attempt should still contain meaningful choices involving some combination of:

- combat
- equipment
- risk
- survival
- loot
- retreat or return
- improvement

The change is motivational:

> Before: improve so the next expedition is easier or more rewarding.
>
> After: improve because there is a place, rival trace, or nearby target the player wants to conquer.

## Anti-patterns

Do not satisfy this ADR by adding:

- a generic social feed with likes
- arbitrary user posts as the main social mechanic
- follower counts as progression
- global chat as the primary source of social interaction
- control bars filled through repetitive chores
- mandatory daily defense actions
- long unattended siege timers
- pay-to-hold territory
- always-on real-time PvP
- a large backend before the local/simulated interaction proves fun

The social system should create stories because players changed places, not because the game contains social-media furniture.

## Location and safety

Real-world movement remains a discovery input.

Territory mechanics must not encourage trespassing, dangerous travel, prolonged phone attention while walking, or storing exact route histories.

Game-facing strongholds should use coarse, safe, testable place identity. Simulated location must remain sufficient for development and automated playtests.

## Validation

The first implementation is successful enough to continue only if playtesting shows at least one of these behaviors without being explicitly instructed:

- the player chooses to retake a lost stronghold
- the player chooses a nearby stronghold because of its relation to an existing holding
- the player changes equipment/build because of a specific rival or stronghold
- the player inspects control history because it changes the next decision
- the player voluntarily starts one more expedition because of territory state

Jev and browser automation may be used as screening tools, but the main validation remains actual play.

A useful automated test should avoid instructions such as "retake the stronghold" or "start another expedition." The agent should be given the game state and allowed to choose what to do next.

## Build consequence

The next territory work should prefer a narrow playable slice over architecture:

> **one stronghold + one player identity + one simulated rival + ownership + history + retake**

Only after that is fun should we decide whether Crownless needs shared accounts, server authority, broader multiplayer persistence, territory clusters, or richer social systems.
