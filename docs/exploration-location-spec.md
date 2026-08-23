# Crownless — Exploration & Location Discovery Specification

> **Status:** current subsystem specification / implementation + target direction  
> **Updated:** 2026-08-23  
> **Parent design:** [`game-system-design.md`](game-system-design.md)

This document defines Crownless exploration, location gameplay, persistent world knowledge, regional discovery, and the relationship between outdoor play and full combat.

The subsystem now has a real GPS-backed playable implementation. Sections explicitly labeled **target direction** describe the next layer to prove through play rather than features that already exist.

## 1. Exploration meaning

Crownless exploration is not a pedometer reward loop and should not become a gamebook of disconnected event cards.

The intended meaning is:

> **Exploration is the act of revealing, remembering, and developing an unknown world. Events and battles are things discovered through exploration, not exploration itself.**

The system should create these feelings:

- **I opened this part of the world myself.**
- **I can see what I have already learned.**
- **There is something ahead that I do not fully understand yet.**
- **I chose which danger to investigate.**
- **Walking somewhere different in reality can reveal something different in Crownless.**
- **A region can influence the fiction without being copied literally.**

Text supports discovery, but spatial / persistent change should carry the experience.

## 2. Current implementation baseline

As of 2026-08-23, the browser prototype already supports:

- device geolocation after player interaction / permission
- Crownless server-side geography access rather than direct browser-to-Overpass access
- normalized public geographic signals such as water, crossing, sacred, woods, road hub, settlement, and height
- deterministic translation of those signals into Crownless discoveries
- up to a small set of nearby exploration candidates
- a manuscript-style nearby sketch map based on relative placement rather than navigation-grade precision
- deterministic / simulated fallback when location or geographic enrichment is unavailable
- stable discovered-place identity that distinguishes source namespaces such as `node`, `way`, and `relation`
- persistent Discovery Journal entries
- known-place recognition and visit / state updates without duplicate collection entries
- persistent coarse explored areas, stored separately from exact movement history
- coarse area discovery progress / completion presentation in the Discovery Journal
- a Discovery Journal browser for list + detail review
- location visuals for supported discovery archetypes, beginning with the Ruined Watchtower
- the first deterministic regional mission, **消えた荷駄隊**, which connects outdoor clues to a stationary full-combat target

This is the implementation baseline. Do not describe real GPS integration as deferred.

## 3. Core exploration loop

The long-term loop remains:

> **Move → reveal terrain → notice a clue / silhouette → identify a place → decide whether to investigate → mark or enter → continue exploring**

The current browser implementation proves parts of that loop through nearby discoveries, coarse explored areas, the journal, area progress, and regional-mission clues.

It does **not** yet fully prove a rich continuous fog/frontier system where every neighboring cell visibly transitions through all discovery stages. That remains incremental target work.

## 4. Progressive map reveal

### Target state model

A location can conceptually move through:

1. **Unknown** — nothing is known
2. **Frontier hint** — smoke, ruins, tracks, road, tower silhouette, water, lights, or another partial sign appears
3. **Discovered** — the place type or identity becomes known
4. **Investigated** — the player has interacted with the place or entered its content
5. **Cleared / changed** — a persistent result is recorded when relevant

Not every location needs every state.

### Current proven layer

The current implementation already provides persistent spatial memory through coarse explored areas and area-level discovery progress. It also preserves discovered POIs in the journal.

Therefore the next map work should **extend** this baseline rather than replacing it with a new world-map architecture.

Useful next experiments include:

- stronger unexplored-versus-explored visual contrast
- frontier hints around known coarse areas
- discovered persistent danger markers
- a clearer relationship between an area and the discoveries recorded within it
- map changes that communicate regional mission progress

Do not introduce map complexity unless it makes the player more curious to explore.

## 5. Persistent world knowledge / Discovery Journal

Once a place reaches **Discovered**, the fact that the player knows that place becomes permanent world knowledge immediately. This is deliberately different from unsecured loot.

Rules:

- defeat does not make the player forget a discovered place
- revisiting the same stable place updates one entry rather than creating a duplicate
- later states such as Investigated or Cleared may advance that same entry
- the Grey Hearth wall map / journal distinguishes accumulated knowledge from first-time discovery
- the collection represents **Crownless discoveries**, not literal real-world POI completion

For geography-backed discoveries, stable identity includes the selected source namespace (`node`, `way`, or `relation`) plus Crownless translation identity. Simulated discovery uses deterministic game-world identity.

Persistent discovery records store **game-facing knowledge only**. Do not persist:

- raw latitude / longitude
- exact route history
- `mapOrigin`
- `representativeCoordinate`
- exact movement tracks

Transient coordinates may be used for the current nearby sketch map; they are not collection state.

## 6. Persistent explored areas

World knowledge now also distinguishes **places discovered** from **coarse areas explored**.

The current explored-area contract is:

- exploration is represented by a coarse deterministic cell / area identity
- exploring the same area again updates existing state instead of adding duplicate history
- explored-area state survives return, defeat, reload, and later expeditions
- the journal can group / filter discoveries by coarse area
- area progress uses a stable game-facing target rather than live OSM feature count as its denominator
- old journal entries without area identity remain readable

This is **not** GPS tracking. The purpose is to remember that the player opened part of the Crownless world, not where the player walked meter by meter.

## 7. Discovery and encounter are separate systems

Finding something does **not** automatically mean entering full combat.

A discovery can result in:

- terrain / world knowledge only
- clue or rumor
- resource or cache
- short environmental interaction
- lightweight field event
- dangerous point of interest
- named target location
- dungeon entrance
- regional mission trace or final target
- another persistent world change

Full combat occurs because the player deliberately enters danger, or because a rare ambush is meaningful enough to justify interrupting exploration.

## 8. Encounter weight

Exploration should not be stopped by full combat every few steps.

### 8.1 Ambient discovery

No combat interruption.

Examples:

- tracks
- weathered signs
- distant smoke
- ruins
- shrine remains
- regional lore
- resources
- regional-mission traces

### 8.2 Lightweight field event

Resolves quickly and keeps the player in exploration flow.

Examples:

- brief choice
- avoiding a patrol
- chasing or ignoring a fleeing enemy
- grabbing a cache under minor risk

### 8.3 Full combat point of interest

Dangerous content can be deliberately entered when the play context is appropriate.

Examples:

- bandit camp
- monster den
- named hunt lair
- guarded ruin
- elite encounter

### 8.4 Dungeon / deep expedition content

Dungeons remain longer, higher-commitment content with multiple rooms, retreat decisions, and stronger rewards.

## 9. Outdoor play and stationary play

Crownless supports two complementary rhythms rather than requiring action combat while physically moving.

### Outdoor / moving play — exploration first

The main activity should be:

- reveal / revisit coarse world areas
- discover routes and places
- identify clues and regional features
- collect rumors / traces
- mark dangerous content for later
- resolve short lightweight events

The game should remain usable in short glances and should not encourage unsafe phone interaction while walking.

### Stationary / Grey Hearth play —攻略 first

Longer sessions can focus on:

- full combat
- Named Hunts
- dungeon delves
- bosses / elites
- equipment comparison
- build experimentation
- preparing the next expedition
- deliberately launching dangerous regional content that was discovered outdoors

### First implemented stationary-combat contract

The previous design left this question open:

> after discovering dangerous content outdoors, exactly when can it be played later?

The first implemented answer now exists in the regional mission system:

> **discover and identify the dangerous target outdoors → keep it as world knowledge → return to the Grey Hearth → deliberately launch the full-combat assault from safety**

This is now the baseline for regional mission content and should be playtested before applying the same rule universally to every POI type.

The product principle remains:

> **Outside should feel like discovery. Home should be able to feel like攻略.**

## 10. Location data as world-generation input

Real-world location is already an active world-discovery input.

It must not become only:

- step counting
- distance rewards
- coins for walking

Movement into different real-world areas should expose different fantasy-world information, signals, and regional opportunities.

The system should use coarse safe cells / regions rather than meter-perfect GPS rules.

The game must not encourage trespassing, dangerous travel, or staring at the phone while navigating traffic or other hazards.

### External geography must degrade safely

External geographic services enrich the game world; they are not the only way Crownless can function.

Requirements:

- deterministic / simulated exploration remains available for development and fallback
- GPS denial, position failure, upstream errors, timeouts, or zero matching features must not permanently block play
- late or failed geography must not corrupt the current expedition state
- diagnostic detail may exist for development but should not dominate normal player UI
- server-side query limits / endpoint strategies are operational tuning, not gameplay contracts

## 11. Nearby sketch map

The current exploration map is intentionally **not** Google Maps.

It should:

- show the player's current local exploration context
- preserve approximate relative direction / distance rather than promise navigation precision
- use manuscript / ink / parchment visual language
- visually connect candidate markers with their corresponding exploration choices
- remain readable at phone width
- coexist with persistent known-place / explored-area information

Do not add road-navigation chrome, turn-by-turn directions, exact-coordinate readouts, or satellite-like rendering.

## 12. Real place → fantasy translation

A core Crownless identity is that a region subtly influences the fiction found there.

Useful real-world inputs may include:

- region / neighborhood names
- older place names
- local history from defined sources
- rivers, coastlines, hills, forests, plains, or other terrain
- public landmarks and cultural features
- historical industries or regional motifs
- public myths, legends, or folklore where appropriate

These are **inputs**, not literal game content.

Possible fantasy outputs include:

- regional names
- dungeon names
- enemy or named-target themes
- relic and weapon names
- settlement names
- local rumors
- faction terminology
- environmental descriptions

The desired feeling is:

> **A local player may notice where the inspiration came from, while the result still belongs naturally to the Crownless world.**

Do not map private homes, individual businesses, or sensitive real-world properties directly into dangerous game locations.

## 13. Regional missions — implemented MVP

Regional missions add **a reason to keep exploring or revisit a region**, not a generic quest checklist.

The first implemented mission is:

> **地域依頼：消えた荷駄隊 / Missing Pack Train**

### Current mission trigger

The mission is selected deterministically from a road-like regional context. In the current implementation, road-hub / crossing geography can qualify, and the simulated `dead-kings-road` path provides a deterministic fallback test path.

### Current mission loop

1. explore a qualifying road-like region
2. discover the first mission trace
3. discover the second mission trace
4. reveal **街道荒らしの野営地** as a persistent dangerous POI
5. keep that danger marked rather than automatically starting outdoor full combat
6. return to the Grey Hearth
7. deliberately arm / launch the assault
8. resolve the existing full combat encounter
9. receive ordinary unsecured combat loot
10. return alive to secure the rewards and complete regional knowledge
11. record **この街道には組織的な襲撃者がいる** and unlock a follow-up rumor

Mission identity is stable per region key so revisiting the same region does not create duplicate missions.

Persistent mission state must remain game-facing only. Raw GPS coordinates and exact movement history are not mission progress.

### Regional mission design rule

> **The player should feel “I am following something happening in this land,” not “I am clearing a quest checklist.”**

The current system intentionally implements **one** regional mission template. Do not build a generalized MMO quest engine until playtesting proves this loop creates curiosity and revisit motivation.

## 14. AI generation policy

AI can help with regional flavor, but Crownless must not call a paid model for every move, event, or action.

### Required architecture rule

**The client must never contain or directly use a paid provider API key.**

AI generation is performed by a trusted host-side service or an offline / batch process.

### Generate once, reuse many times

Regional flavor should normally follow this pattern:

1. obtain trusted geographic / regional metadata
2. derive stable tags and game-generation inputs
3. generate or assemble the Crownless interpretation
4. persist the result under a stable region / content identifier
5. reuse it for later visits

### Rules first, AI second

Gameplay structure should remain deterministic or rule-driven:

- terrain categories
- mission conditions
- encounter tables
- difficulty
- loot rules
- dungeon structure
- progression
- combat statistics

AI is primarily for flavor and transformation:

- naming
- regional motifs
- short descriptions
- thematic variants
- lore fragments

The game must remain functional if AI generation is unavailable.

### Source discipline

AI is not a factual source for local history. When real regional facts matter, obtain them from a defined source first and transform supplied facts into fantasy.

## 15. Conceptual data model

This is a gameplay model, not a required production database schema.

### WorldCell / ExploredArea

- stable coarse cell / area ID
- exploration state
- optional first / last explored metadata
- no raw movement history

### RegionTheme

- stable region ID or coarse regional context
- source metadata / normalized tags
- generated / assembled fantasy identity
- naming vocabulary
- environmental motifs
- enemy / item / dungeon theme hints
- generation version when generated content is used

### PointOfInterest

- stable POI ID
- type
- discovery state
- danger level
- reward / clue category
- optional combat / dungeon reference
- persistent completion state where relevant

### RegionMission

- stable mission ID
- regional theme requirement
- title / hook
- clue goal and clue family
- final POI / encounter definition
- knowledge result
- optional follow-up rumor / hunt reference

### RegionMissionProgress

- stable mission + region identity
- clues discovered
- final POI discovered state
- encounter resolution state
- regional knowledge result

Persistent models must avoid raw location history.

## 16. Current browser slice versus target direction

### Implemented now

- real GPS / geography enrichment
- deterministic fallback
- nearby sketch map
- stable discoveries
- Discovery Journal persistence
- supported location visuals
- coarse explored-area persistence
- area progress / completion presentation
- known-place revisits
- regional-mission clue collection
- persistent regional final target
- Grey Hearth stationary assault for that target

### Still target / playtest work

- richer frontier-hint behavior before full discovery
- more satisfying visual fog / unexplored boundaries
- stronger feeling that the player is changing the map rather than merely browsing markers
- more regional mission templates **only if the first one is fun**
- regional equipment pools / named equipment integration
- broader generated regional identity
- faction / territory influence on geography

Do not confuse these target items with already implemented GPS infrastructure.

## 17. Success criteria

The exploration system is moving in the right direction when playtesting shows that:

- the player describes the activity as exploring rather than choosing events
- changing real-world region can expose meaningfully different Crownless signals
- revealing / remembering an area is satisfying even without loot
- the player can visually remember where they have been
- known places feel like part of an accumulated world rather than duplicate stamps
- unexplored or incomplete areas create curiosity
- discovering danger does not always force immediate full combat
- players deliberately choose which dangerous places to challenge
- outdoor discovery and stationary combat feel complementary
- regional clues create a reason to search for one more trace or revisit an area
- the first regional mission feels like following an event in the land rather than checking tasks
- the system still works deterministically when live location / geography is unavailable

## 18. Decisions already made

These are current design decisions, not open brainstorm items:

- exploration moves away from text-branch / gamebook presentation
- the map / accumulated world state becomes the primary exploration surface
- discovery and full combat are separate concepts
- outdoor play is exploration-oriented; longer stationary play can be combat-oriented
- the first regional-mission contract launches its discovered final danger from the Grey Hearth
- real regional identity influences fantasy naming / themes through translation, not literal copying
- GPS/geography integration is implemented and remains coarse / safe
- simulated / deterministic exploration remains available as fallback
- discovered world knowledge persists immediately and is not lost on defeat
- repeated discovery updates one stable entry rather than creating duplicates
- coarse explored areas persist without raw GPS tracks
- persistent location / mission state contains game-facing knowledge, not raw coordinates or exact routes
- paid AI calls do not run directly from player clients
- AI regional generation is host-side / batch-capable, persisted, and reused
- gameplay rules remain mostly deterministic; AI is mainly a flavor layer
- the browser prototype remains valid for testing before native-app work

## 19. Open design questions

Solve these through prototypes and playtests rather than long speculative design:

- how much richer should the coarse explored-area map become before it stops being worth the complexity?
- what is the best frontier-hint presentation around an explored area?
- should all dangerous POIs eventually follow the Grey-Hearth stationary-assault pattern, or only selected regional content?
- how frequently should regional missions appear without feeling like chores?
- how should regional mission chains connect to Named Hunts, dungeons, and future factions?
- how should regional item pools become noticeable without making travel mandatory for basic viability?
- is world discovery personal per player, globally shared, or hybrid once accounts exist?
- which additional geographic / historical sources are worth the operational cost?
- how much generated regional content should be shared across players versus personalized?
- when do web/PWA capabilities become insufficient enough to justify a native wrapper or rewrite?

Until playtesting proves otherwise, implement the smallest change that makes **revealing, remembering, and returning to the world more fun**.