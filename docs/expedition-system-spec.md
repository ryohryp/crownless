# Crownless — Expedition System Specification

> **Status:** canonical subsystem specification / target for the next playable slice  
> **Updated:** 2026-08-27  
> **Parent design:** [`game-system-design.md`](game-system-design.md)  
> **Decision:** [`adr/0002-idle-expedition-pivot.md`](adr/0002-idle-expedition-pivot.md)

## 1. Purpose

Expeditions are the new gameplay center of Crownless.

The player does not directly control moment-to-moment combat. The player creates the conditions under which an expedition succeeds or fails:

- choose a destination
- choose who goes
- choose what they carry
- choose the expedition objective
- choose how much risk they are allowed to take
- dispatch them
- later inspect what happened
- react to the result

The core emotional target is:

> **I want to know whether they came back, what they found, and what went wrong.**

## 2. Core loop

```text
Known destination
  ↓
Select companions
  ↓
Select equipment / supplies
  ↓
Choose objective
  ↓
Choose policy
  ↓
Dispatch
  ↓
Elapsed time
  ↓
Resolve events
  ↓
Return / delay / missing / defeat
  ↓
Read report
  ↓
Secure loot and knowledge
  ↓
Treat / replace / rescue / re-plan
```

The system should make the **before** and **after** interesting. Waiting itself does not need constant interaction.

## 3. MVP expedition inputs

For the first playable slice, an expedition requires only:

### Destination

A previously discovered Crownless location.

MVP destination families:

- forest
- abandoned village
- cave

Each destination defines:

- base duration
- danger profile
- possible event families
- possible loot families
- possible discovery outcomes

### Party

Select one or more companions from the Grey Hearth roster.

The MVP should begin with three companions and support at least one-person and multi-person expeditions if that does not materially increase implementation cost. If party support would delay the first playable loop, begin with one expedition slot containing one companion and make the data model party-ready.

### Loadout

The player may assign:

- weapon
- armor / clothing
- one or more tools or supplies

Items should change event options or outcome weights where practical rather than existing only as linear power.

### Objective

MVP objectives:

- **Explore** — favor new information, routes, and places
- **Scavenge** — favor loot and resources
- **Hunt** — favor hostile encounters / target traces

The first PoC may ship only Explore if three objectives dilute the test.

### Policy

MVP policies:

- **Cautious / 慎重** — retreat early after meaningful injury or escalating danger
- **Standard / 通常** — balance progress and survival
- **Greedy / 強欲** — accept greater risk to continue until higher-value progress is found

Policy must affect at least one real branch in the MVP. It must not be decorative text.

## 4. Expedition time model

The prototype does **not** require an always-running simulation server.

Store:

- `startedAt`
- `expectedReturnAt`
- deterministic expedition seed
- content / rules version
- immutable dispatch inputs

When the app is opened or expedition state is inspected:

1. compare current time with expedition milestones
2. deterministically resolve events that should have occurred
3. materialize the resulting report and final state

This allows idle progression without background execution.

### Development acceleration

Development / test mode must support:

- instant completion
- short artificial durations
- deterministic fixed clock input

Do not make developers wait real-world hours to test the loop.

## 5. Event resolution

An expedition is a sequence of compact events, not a hidden real-time battle simulation.

Useful MVP event families:

- travel / arrival
- clue or trace discovery
- environmental hazard
- hostile encounter
- loot find
- companion proposal / disagreement
- injury
- retreat decision
- new location discovery
- return journey

An event can read:

- destination tags
- objective
- expedition policy
- companion traits
- equipment / tools
- current health / injury pressure
- previous events in this expedition

The MVP should prefer explicit deterministic rules over a generalized scripting engine.

## 6. Combat inside expeditions

Combat is an **event-resolution problem**, not a player-controlled action scene.

A hostile encounter resolves from factors such as:

- party composition
- equipment
- companion traits
- enemy profile
- surprise / terrain
- prior injuries
- objective and policy

Possible results include:

- avoid encounter
- negotiate / pay / bluff
- ambush successfully
- win cleanly
- win with injury
- retreat
- lose gear
- become delayed
- become missing
- death in rare high-risk cases

The player should sometimes be able to look back at the dispatch choices and think:

> **That happened because I sent the wrong person / tool / policy.**

Pure opaque RNG is not sufficient.

## 7. Companions

Companions are persistent people, not disposable rarity cards.

Minimum companion model:

- stable ID
- name
- origin / role
- 2–3 traits
- current condition
- expedition history summary
- notable relationship / rescue flags when available

Example traits:

- cautious
- brave
- greedy
- woodsman
- poor night vision
- loyal
- stubborn

Traits should affect event resolution or available branches.

### Condition

MVP condition states:

- ready
- tired
- injured
- unavailable
- missing

Death is allowed by the long-term design but does not need to be frequent in the first PoC.

## 8. Injury, missing, rescue, death

Failure should create new decisions rather than only subtract numbers.

### Injury

An injured companion may:

- reduce expedition effectiveness
- require recovery time
- cause a cautious expedition to return early

### Missing

A companion or expedition can become **missing** instead of immediately dead.

Missing state should create a future rescue opportunity. A discovered location or last-known area can become a rescue destination.

This is a high-value Crownless-specific failure mode because it connects idle uncertainty, attachment, and location discovery.

### Death

Death should be possible but relatively rare and understandable. Do not use frequent random permadeath as ordinary friction.

## 9. Equipment and supplies

Items have two jobs:

1. improve survival / success
2. unlock or alter expedition choices

Examples:

- miner's pick → opens a mine / cave branch
- royal cloak → changes patrol / checkpoint reactions
- rope → avoids or reduces cliff / ruin hazards
- old map → improves discovery outcomes
- dagger → improves ambush / escape outcomes

Linear stats may exist, but the most memorable items should create decisions.

## 10. Loot and knowledge

Expedition outcomes produce two different value classes.

### Carried value

Examples:

- weapons
- armor
- tools
- valuables
- consumables

Carried value remains at risk until the expedition returns safely.

### Learned value

Examples:

- discovered place
- known route
- enemy presence
- regional clue
- target rumor

Once legitimately learned, world knowledge can remain known even if carried loot is later lost.

This preserves the existing Crownless distinction between **what was carried home** and **what the player truly learned**.

## 11. Expedition report

The report is not merely an audit log. It is a primary reward surface.

### Summary first

The first view should show, at minimum:

- outcome: returned / delayed / missing / failed
- duration
- injuries
- important loot
- new discoveries
- notable event

### Expandable chronology

Example:

```text
06:12  灰の森へ到着
06:35  大型獣の足跡を発見
06:48  ミラが追跡を提案
07:13  オオカミ3頭と遭遇
07:18  エド負傷
07:44  朽ちた荷車から古い軍用剣を回収
08:06  負傷悪化。慎重方針に従い帰還開始
```

Logs should be concise, authored from structured events, and deterministic for a given resolved expedition. The MVP does not require an LLM call to write every report.

## 12. Persistence contract

Persist immutable dispatch input and resolved outcomes.

Do not persist raw GPS tracks as expedition data.

An active expedition must survive reload.

Resolution must be idempotent: opening the app twice must not duplicate loot, injuries, discoveries, or report entries.

## 13. First PoC slice

Minimum target:

- 3 companions
- 3 destination families
- 3 policies
- roughly 15 items / supplies
- 8–12 event templates
- one meaningful injury flow
- one meaningful loot find
- one new-location discovery outcome
- one policy-driven early-return branch
- instant / accelerated developer resolution
- a report summary plus chronological log

If this is still too large, cut destination and item breadth before adding architecture.

## 14. Success criteria

The PoC succeeds when playtesting shows:

- the player cares which companion is sent
- changing policy can visibly change a result
- at least one item changes a branch rather than only a number
- the report contains at least one event the player wants to read
- loss / injury creates a next decision instead of only frustration
- the player wants to dispatch another expedition
- most importantly, the player wants to reopen Crownless later to see what happened

## 15. Explicit non-goals for the first slice

- real-time action combat
- large combat animation system
- generalized MMO quest engine
- always-on backend simulation
- cloud accounts
- gacha
- stamina / energy monetization
- daily chores
- PvP
- clans
- faction-war simulation
- crafting tree
- LLM-generated event resolution

Build the smallest thing that can answer whether **waiting for an expedition result is compelling**.