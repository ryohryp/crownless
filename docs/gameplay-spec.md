# Crownless — Active Gameplay Specification

> **Status:** Active supporting specification
> **Updated:** 2026-10-09
> **Authority:** `AGENTS.md` and accepted ADRs take precedence. This file describes the smallest current gameplay contract without creating a second product vision.

## 1. Current playable loop

The immediate loop is:

> **Explore → Fight/Gather → Return alive with materials → Craft/Trade/Equip → Explore farther**

The surrounding location/meta loop is:

> **Discover a place → Gather resources / affect the place → Leave a trace or create an item → Another character/player benefits → Revisit or expand**

The first milestone is the one in `AGENTS.md`: after roughly 15 minutes, does the player want to seek another material, craft another item, or inspect an effect they left in the world? The older stronghold/relic goals remain as playable systems, not the sole North Star.

## 2. Exploration and location

- Real-world movement reveals Crownless; it does not refill stamina or reward raw step count.
- Use coarse, game-facing place identity. Do not persist exact movement tracks as territory state.
- A discovered place should remain useful later from a safe stationary context.
- Real and simulated location must exercise the same gameplay contract.
- Landmark categories may influence stronghold identity, regional materials, relics, local shops/events, and Chronicle records.
- Discovering a new district should reveal a stable local POI (initially a small shop or short event) so the reward for walking somewhere new is immediately visible and creates a reason to inspect or revisit that place.
- Never encourage trespassing, dangerous travel, or prolonged phone attention while walking.

Detailed location/privacy behavior remains in `exploration-location-spec.md` and `exploration-discovery-contract.md`.

## 3. Fight, survival, and return

Combat is a short tactical decision loop, not real-time action combat.

- Target roughly 15–30 second encounters when practical.
- Keep combat usable in one phone viewport.
- Decisions should be legible: attack, defense/evasion, equipment/build synergy, enemy intent, risk, retreat, or similarly concise choices.
- Victory may award loot or progress toward conquest, but carried rewards become safe only through the current return/survival rules.
- Failure must have understandable consequences without turning play into punitive grind.
- Do not reintroduce joystick/twitch/platforming combat.

## 4. Materials, production, equipment, and provenance

The target rule is **all equippable weapons and armor are crafted by appropriate artisan skills**.

- Enemies can drop materials, currency, recipes, and non-equippable story relics, **not ready-made weapons or armor**.
- A returning adventurer deposits resources in the account warehouse; a smith turns them into usable gear. Starting loan gear is a non-tradeable exception.
- Multiple characters (initial target three slots) share storage but grow independent skills and cannot be active simultaneously. Changing characters never creates a remote physical presence.
- Crafting should offer decisions and identity: which material, design, recipient, and place; crafted equipment should meaningfully change expedition options.
- Finished products should eventually preserve maker identity and coarse origin and may be traded asynchronously.
- Current `src/slice-engine.js` new expeditions grant regional materials (wolf fangs, watch iron, marsh fiber), scraps, and non-equippable story relics; no newly awarded ready-made weapons. The local smith can craft the first dagger, shield and bow recipes. Existing saved equipment and pre-migration backpack gear are grandfathered.
- The source of truth is still browser-local for this playable slice. It is **not yet** a networked economy; artisan-made item provenance and exchanges between real accounts await later validation.

Do not add multiple recipe tiers, global prices, or punishment through wear before the single material→craft→equip loop demonstrates fun.

### Repeatable smith commissions — local NPC simulation

Crafted personal equipment remains one copy per item ID. To make production repeatable before there are real players, the smith can instead spend the same materials and iron scraps to supply one **fictional NPC** in a discovered region. One pending NPC commission per account. The NPC reports its consequence only after the adventurer completes at least one fight and returns alive from that same game region. The smith receives iron scraps, a completed-order count and a single-use +1 herb supply for the next expedition to that region. No real player account or live position is represented, and no duplicate equippable item is generated. A failed or zero-encounter return cannot claim the reward. This is a fun hypothesis, not networked trade.

First place-bound consequence (2026-10-10): when a completed NPC commission is reported after a victorious encounter and safe return, the **specific coarse district** where the adventurer returned gains a named permanent trail/sign of the NPC's work. Revisit that district to see the sign; its first victorious enemy on each new expedition there carries **one extra regional material**, still lost if the adventurer fails to return. Another district of the same biome does not inherit the trail. Existing districts migrate with no trace; no exact GPS, clock data, player-to-player exchange, or network state is added. The one-off commission herb benefit remains separate. This is a local simulated human-fun test, not evidence of actual MMO interaction.

## 5. Territory and frontier development

A conquered meaningful place can become a Frontier Outpost.

The smallest useful territory state is enough to answer:
- who controls this place?
- what changed because it was conquered?
- what can I do here now?
- what nearby target became interesting?

Outpost development should produce visible or strategic consequences. Current examples include watch/defense, forge/relic improvement, and hearth/rest functions, but do not build a generalized city-builder before those choices prove fun.

Territory is not renamed XP. Avoid repetitive control bars, mandatory chores, daily defense upkeep, large passive economies, or arbitrary repetition of solved encounters.

## 6. Asynchronous world traces and rival activity

Asynchronous social interaction is place-centered and can be cooperative or competitive. Territory control is one existing prototype of a broader living-world idea. A place might retain a defeated adventurer's remnant, a built camp, a crafted facility, or a control change; the later visitor's choices and results should change because of it.\n\nSocial territory control is place-centered and asynchronous.

The minimum slice is:
1. conquer a stronghold,
2. leave visible ownership/history,
3. allow a simulated or real rival snapshot to change control,
4. show the change,
5. allow a retake,
6. expose another nearby target.

No real-time PvP, generic social feed, guild platform, matchmaking, chat dependency, seasons, or rankings are required before this loop proves motivating.

## 7. Home / Hearth

The player's home is a safe anchor, not a management dashboard.

It may expose:
- current equipment and secured loot,
- nearby/discovered places,
- frontier development,
- recovery/state needed for the next outing,
- recent conquest/rival changes,
- Chronicle access.

Presentation should feel like returning to a place. Do not preserve old dispatch/report UI merely because the former expedition system used it.

## 8. Travel Chronicle

The Chronicle preserves the player's relationship with the real-world journey.

It may record:
- discovered districts/landmarks,
- conquest and control changes,
- regional seals/stamps,
- relic origins,
- notable expedition summaries/postcards.

The Chronicle is a memory/reward surface, not a substitute for gameplay. Its purpose is to make travel and conquest feel owned and remembered.

## 9. Persistence and authority

Persist only state that changes future play or preserves meaningful travel history.

Important categories include:
- discovered coarse places,
- territory/control history,
- frontier development,
- secured inventory/equipment,
- regional relic origin,
- Chronicle records,
- current player progression required by the playable loop.

State transitions must tolerate reload/reapplication where practical. Do not create duplicate presentation-owned truth.

## 10. Smartphone contract

Primary gameplay follows `AGENTS.md`:
- one scene = one viewport where practical,
- persistent thumb-reachable primary actions,
- safe-area aware,
- no document-style scrolling in the core loop,
- validate roughly 360–430 CSS px widths,
- secondary detail may use bounded scrolling/sheets/details.

## 11. Explicit non-goals

Until play proves a need, do not add:
- real-time action/platforming combat,
- a generic expedition timer/waiting game,
- stamina/energy/dailies,
- generalized faction politics or economy simulation before the production slice proves fun,
- large multiplayer infrastructure,
- guilds/seasons/leaderboards,
- speculative nationwide territory engines,
- systems whose main justification is future extensibility.

## 12. Validation

Automated tests and Jev are screening tools. They do not prove fun.

A successful iteration should make at least one unprompted behavior more likely:
- start one more expedition,
- pursue a nearby stronghold,
- retake a lost place,
- change equipment for a target,
- seek a regional relic,
- develop a frontier outpost,
- inspect the Chronicle because the journey now matters.

Prefer the smallest implementation that lets a human test one of those behaviors.
