# Crownless — Exploration & Location Discovery Specification

> **Status:** current subsystem direction / implementation target  
> **Updated:** 2026-08-18  
> **Parent design:** [`game-system-design.md`](game-system-design.md)

This document defines the next direction for Crownless exploration, location gameplay, and the relationship between outdoor discovery and full combat.

## 1. Why this redesign exists

The current exploration presentation is too close to a gamebook:

> read a short description → choose one branch → read the result → repeat

Even when choices differ, the player does not feel that they are **exploring a place**. The world is not spatially visible, unknown territory does not gradually become known, and discoveries feel like event cards rather than places the player found.

The redesign changes the meaning of exploration:

> **Exploration is the act of revealing an unknown world map. Events and battles are things discovered through exploration, not exploration itself.**

## 2. Design goals

The exploration system should create these feelings:

- **I opened this part of the world myself.**
- **I can see where I have been and where I have not been.**
- **There is something ahead, but I do not yet know exactly what it is.**
- **I chose to investigate this danger rather than being forced into it.**
- **Walking somewhere new in the real world can reveal something new in the game world.**
- **A place in the game can feel connected to the real region without simply copying the real map.**

Text can support discovery, but text must not be the main exploration mechanic.

## 3. Core exploration loop

The target loop is:

> **Move → reveal terrain → notice a clue / silhouette → identify a place → decide whether to investigate → mark or enter → continue exploring**

This is deliberately different from:

> choose event → resolve event → choose next event

The map is the primary exploration surface.

## 4. Progressive map reveal

The game world begins partially hidden by fog / unknown space.

Exploration gradually changes map knowledge.

A location can conceptually move through these states:

1. **Unknown** — the player knows nothing about the cell / area.
2. **Frontier hint** — the player can see that something may exist nearby: smoke, ruins, water, tracks, lights, a road, a tower silhouette, an unnatural shadow, etc.
3. **Discovered** — the place type or identity becomes known.
4. **Investigated** — the player has interacted with the place or entered its content.
5. **Cleared / changed** — when relevant, the place records a persistent result.

Not every location needs every state, but important places should not jump instantly from invisible to fully explained.

### Map readability

The player should be able to understand at a glance:

- current position / current explored area
- Grey Hearth or another safe point
- previously visited route
- explored territory
- the unexplored frontier
- discovered but uninvestigated places
- known high-risk places
- important persistent targets such as named hunts or dungeons

An incomplete map should visibly invite completion.

## 5. Discovery and encounter are separate systems

Finding something does **not** automatically mean entering full combat.

A discovery can result in:

- terrain / world knowledge only
- a clue or rumor
- a resource or cache
- a short environmental interaction
- a lightweight field encounter
- a dangerous point of interest
- a named target location
- a dungeon entrance
- another persistent world change

Full combat should occur because the player deliberately enters danger, or because a rare ambush is meaningful enough to justify interrupting exploration.

This separation is important for exploration tempo.

## 6. Encounter weight

Exploration should not be stopped by the current full combat experience every few steps.

Use several encounter weights instead.

### 6.1 Ambient discovery

No combat interruption.

Examples:

- tracks
- weathered signs
- distant smoke
- ruins
- shrine remains
- rumors
- regional lore
- resources

### 6.2 Lightweight field event

Resolves quickly and keeps the player in exploration flow.

Examples:

- a brief choice
- avoiding a patrol
- chasing or ignoring a fleeing enemy
- grabbing a cache under minor risk
- a very short skirmish if later proven fun

These should take seconds, not become the main combat loop.

### 6.3 Full combat point of interest

A discovered dangerous place can be entered deliberately.

Examples:

- bandit camp
- monster den
- named hunt lair
- guarded ruin
- elite encounter

Entering launches the existing full action-combat system.

### 6.4 Dungeon / deep expedition content

Dungeons remain longer, higher-commitment content with multiple rooms, retreat decisions, and stronger rewards.

## 7. Outdoor play and at-home play

Crownless should support two complementary play styles rather than requiring full action combat while walking outside.

### Outdoor / moving play — exploration first

When the player is physically moving, the main activity should be:

- reveal new map territory
- discover routes and places
- identify clues and regional features
- collect rumors / traces
- mark dangerous content for later
- resolve short lightweight events

The game should remain usable in short glances and should not encourage unsafe phone interaction while walking.

### At home / stationary play —攻略 first

Longer sessions can focus on:

- full combat
- named hunts
- dungeon delves
- bosses / elites
- equipment comparison
- build experimentation
- preparing the next expedition

A strong target direction is that **outdoor exploration discovers or unlocks content that can later be deliberately challenged during a stationary session**.

The exact rule for when and where discovered combat content can be launched is still open, but the product direction is clear:

> **Outside should feel like discovery. Home should be able to feel like攻略.**

## 8. Location data as world-generation input

Real-world location should eventually drive what part of the fantasy world is revealed.

It must not become only:

- step counting
- distance rewards
- coins for walking

Instead, movement into new real-world areas should reveal new fantasy-world territory or information.

The map should use coarse, safe world cells / regions rather than requiring meter-perfect GPS behavior.

The game must not encourage trespassing, entering unsafe areas, or staring at the phone while navigating traffic or other hazards.

### Location enrichment must not gate play

External geographic services are world-enrichment inputs, not a prerequisite for starting or continuing an expedition.

The browser prototype follows this rule:

1. deterministic / simulated exploration choices are usable immediately
2. GPS and geographic metadata are requested asynchronously in the background
3. when matching real-world signals arrive, up to three current exploration choices can be replaced or enriched with geographic discoveries
4. if the player has already moved on, the late result must not interrupt or rewind play
5. permission denial, upstream errors, timeouts, or no matching features leave the deterministic choices usable

A geographic provider may therefore have a longer network budget than the visible interaction budget. The important latency requirement is that **waiting for external geography never blocks the exploration loop**.

The current prototype queries a coarse area around the player (currently 650 m) for useful public terrain / place signals. That radius is a tuning value, not a gameplay contract; it may change after field testing without changing the non-blocking rule above.

## 9. Real place → fantasy translation

A core Crownless identity is that a region can subtly influence the fantasy content found there.

Useful real-world inputs may include:

- region / neighborhood names
- older place names
- local history
- rivers, coastlines, hills, forests, plains, or other terrain
- public landmarks and cultural features
- historical industries or regional motifs
- public myths, legends, or folklore where appropriate

These are **inputs**, not literal game content.

The game should transform them into medieval-fantasy equivalents.

Examples of possible outputs:

- regional fantasy names
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

## 10. AI generation policy

AI can help with regional flavor, but the game must not call a paid model for every move, event, or player action.

### Required architecture rule

**The client must never contain or directly use the provider API key.**

AI generation is performed by a trusted host-side service or an offline / batch generation process.

### Generate once, reuse many times

Regional flavor should normally follow this pattern:

1. obtain trusted geographic / regional metadata
2. derive stable tags and game-generation inputs
3. generate or assemble the Crownless fantasy interpretation
4. persist the result under a stable region / content identifier
5. reuse the stored result for later visits and other players

AI should help **create the world**, not regenerate the same world every time somebody opens it.

Popular or known regions may also be pre-generated in batches.

### Rules first, AI second

The majority of gameplay structure should remain deterministic or rule-driven:

- terrain categories
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

The game must remain functional if AI generation is temporarily unavailable.

### Source discipline

AI should not be trusted to invent factual local history from coordinates alone.

When real regional facts matter, obtain them from a defined data source first. The model transforms supplied facts into fantasy; it is not the factual source of truth.

## 11. Conceptual data model

This is a gameplay model, not a required database schema.

### WorldCell

- stable cell ID
- coarse geographic / simulated coordinate
- exploration state
- terrain tags
- region-theme reference
- discovered POIs
- neighboring frontier hints

### RegionTheme

- stable region ID
- source metadata / tags
- generated fantasy identity
- naming vocabulary
- environmental motifs
- enemy / item / dungeon theme hints
- generation version

### PointOfInterest

- stable POI ID
- type
- discovery state
- map position
- danger level
- reward / clue category
- optional combat or dungeon reference
- persistent completion state where relevant

The prototype does not require a production backend implementation of these models yet.

## 12. First browser prototype

Real GPS is **not** required to test the new exploration experience.

The next exploration prototype should use a simulated map and prove the reveal loop first.

### Minimum implementation

1. Show a small map around the Grey Hearth.
2. Most of the map begins hidden by fog.
3. The player can move / choose an adjacent frontier cell using simulated movement.
4. Entering new territory reveals the cell.
5. Some neighboring cells show partial hints without revealing their exact identity.
6. Discovered POIs remain visible on the map.
7. Exploration can reveal content without forcing full combat.
8. Dangerous discovered POIs offer an explicit **enter / investigate later / continue exploring** decision.
9. Existing named hunts and the dungeon can be represented as persistent map locations when unlocked.
10. Existing short exploration events become supporting map interactions rather than the primary exploration UI.

The existing combat system should be reused rather than rewritten for this prototype.

## 13. Prototype UX principle

The player should spend more time **looking at and changing the map** than reading event text.

Short text is useful for flavor:

> 湿った風の向こうに、崩れた石塔が見える。

But the meaningful result should be visible spatially:

- a tower marker appears
- a path is revealed
- a frontier opens
- a danger is marked
- a route becomes known

The map change is the reward for exploration.

## 14. Success criteria

The exploration redesign is successful when playtesting shows that:

- the player describes the activity as "exploring" rather than "choosing events"
- revealing a new area is satisfying even when no loot drops
- the player can visually remember where they have been
- unexplored edges of the map create curiosity
- partial information makes the player want to move closer
- discovering danger does not always break exploration flow with full combat
- players deliberately choose which dangerous places to challenge
- outdoor-style exploration and stationary combat feel complementary rather than competing
- the system still works with simulated location input

## 15. Decisions already made

These are current design decisions, not open brainstorm items:

- exploration will move away from text-branch / gamebook presentation
- a progressively revealed map becomes the primary exploration surface
- discovery and full combat are separate concepts
- full combat should be less frequent during exploration and more deliberate
- outdoor play is exploration-oriented; longer stationary play can be combat-oriented
- real regional identity should influence fantasy naming and themes
- real data is translated into fantasy rather than copied directly
- external geography enriches exploration asynchronously and never gates the core loop
- simulated / deterministic exploration remains available when GPS or geographic upstreams are late or unavailable
- paid AI calls will not run directly from player clients
- AI regional generation will be host-side / batch-capable, persisted, and reused
- gameplay rules remain mostly deterministic; AI is mainly a flavor-generation layer
- the browser prototype remains valid for testing this system before native-app work

## 16. Open design questions

These should be solved through the next prototype rather than by long speculative design work:

- square grid, hex grid, graph, or another map representation?
- what real-world area should one game cell represent?
- does crossing into a real cell reveal it directly, or does movement produce some spendable exploration capability?
- how much neighboring information should become visible before entering a cell?
- after discovering a dangerous POI outdoors, exactly when can full combat be played later?
- is world discovery personal per player, globally shared, or a hybrid?
- which geographic / historical data sources should feed regional themes?
- how much AI-generated regional content should be shared across players versus personalized?
- when do web/PWA capabilities become insufficient enough to justify a native app wrapper or rewrite?

Until playtesting proves otherwise, implement the smallest version that makes **revealing the map itself fun**.
