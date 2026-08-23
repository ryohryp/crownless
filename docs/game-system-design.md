# Crownless — Game System Design

> **Status:** current design baseline / living document  
> **Updated:** 2026-08-23  
> This document is the canonical gameplay design reference for the current prototype. Older versioned documents remain as design history, but implementation and new decisions should follow this file.

## 1. Vision

Crownless is a location-based medieval fantasy action hack-and-slash RPG where real-world movement reveals and expands a dangerous game world.

The experience should feel like an **expedition**, not a walking-reward app. The player leaves safety, discovers something unknown, fights or makes a risky choice, carries value that is not yet secure, and decides whether to push deeper or return alive.

The project combines five pillars:

- **Wizardry:** dangerous expeditions, retreat decisions, dungeons, party identity, survival pressure
- **Kunio-kun:** immediate, physical, readable action with satisfying hits and simple controls
- **Diablo:** loot hunting, equipment identity, build experimentation, repeated runs
- **Location gameplay:** walking reveals and develops the world rather than merely filling a distance meter
- **Medieval political fantasy:** factions, territory, conflict, rumors, settlements, and war

The central loop is:

> **Explore → Fight → Loot → Survive → Grow → Explore deeper**

Every major feature should strengthen this loop or create a better reason to repeat it.

## 2. Development priority

Crownless is developed by repeating:

> **Design → smallest implementation → play → improve**

Fun takes priority over technical novelty and speculative architecture.

The current prototype exists to answer a practical question:

> **Does one short expedition create enough combat satisfaction, curiosity, risk, and reward that the player wants to begin another immediately?**

Systems that do not help answer that question should remain small or deferred.

The current implementation has already proven a broad solo slice. The next work should deepen weak parts of that loop rather than opening large new systems prematurely.

## 3. Player fantasy

The player begins as an unknown person with:

- no crown
- no class
- no permanent allegiance
- no weapon
- little protection
- incomplete knowledge of the surrounding world

This weak beginning is intentional. Identity should emerge through play rather than character creation menus.

### Unarmed combat is a real build

Bare-handed combat must remain viable beyond the opening minutes.

Finding a sword or dagger should create a new option, not prove that fists were only a tutorial state. Equipment, relics, technique behavior, and progression can all support distinct unarmed builds.

## 4. Expedition structure

The **Grey Hearth / 灰炉** is the current safe hub.

A normal expedition follows this rhythm:

1. leave the Grey Hearth
2. investigate one of the available discoveries / leads
3. resolve a fight, event, clue, or location discovery
4. gain loot, world knowledge, hunt progress, mission progress, or health pressure
5. inspect what is still unsecured
6. choose whether to return or continue
7. repeat until the player returns safely or is defeated

The route taken during the current expedition remains meaningful presentation. A run is a journey through places, not a sequence of disconnected reward cards.

### Exploration leads

Exploration should present **places or signs worth investigating**, not equivalent compass directions.

A lead can communicate:

- what the player sees or hears
- location identity or partial identity
- implied danger
- implied opportunity
- traces of a named target
- regional-mission clues
- dungeon relevance
- known / previously discovered state

Current event families include:

- normal combat
- higher-risk ambush combat
- hidden cache
- shrine choice
- wounded traveler / courier choice
- named-hunt traces and target lairs
- dungeon entrance and dungeon rooms
- real-world-geography-derived discoveries
- regional mission traces and discovered final targets

Non-combat events must be presented distinctly from combat. If no battle exists, combat HUD and combat controls should not appear.

## 5. Survival, risk, and return

The main expedition tension comes from carrying value that is **not yet safe**.

During an expedition, the player can accumulate:

- unsecured loot
- discoveries
- hunt clues
- regional-mission clues
- dungeon progress during the current delve
- health loss and other temporary pressure

### Learned value is different from carried value

Once the player actually discovers a place, **knowing that place is permanent world knowledge immediately**. The player may lose treasure carried out of that place, but defeat does not make the player forget that the place exists.

This creates two deliberately different kinds of expedition value:

- **carried value** — loot and rewards that may still be lost until safe return
- **learned value** — discovered world knowledge and explored-world memory that remain known once learned

Revisiting the same stable place updates the existing discovery record rather than creating another copy.

### Safe return

Returning to the Grey Hearth converts eligible unsecured rewards into permanent progress.

A successful return should clearly communicate:

- how deep the player went
- what loot was secured
- Renown gained
- Hearth progression or newly reached milestones
- regional knowledge that became fully resolved
- what changed for the next expedition

### Defeat

Failure must matter without making the player afraid to play.

Current principles:

- permanently secured progress remains
- discovered world knowledge remains
- explored coarse areas remain known
- equipped core gear is not deleted
- unsecured loot is at risk
- Hearth progression can improve recovery from defeat
- a defeat report should make the loss understandable and make another attempt feel possible

The goal is **tension and regret**, not catastrophic punishment.

## 6. Combat — current core direction

The current combat direction is **stand-to-strike**:

> **Move to survive and reposition. Stop to attack. Commit Technique at the right moment. Evade when timing demands it.**

This creates a recurring spatial decision without adding a virtual light-attack button.

### Current controls

**Desktop**

- movement: WASD / arrow keys
- normal attack: automatic while stopped and an enemy is within weapon range
- Technique: `K`
- Evade: `Space`

**Phone / pointer**

- movement: drag on the combat arena
- normal attack: automatic while stopped and an enemy is within weapon range
- Technique: large **技** button
- Evade: large **回避** button

Moving cancels normal attack commitment. Stopping is therefore a deliberate offensive choice.

### Combat decision loop

The player should repeatedly read the battlefield and decide:

- where is it safe to stand?
- should I keep moving or commit to an attack chain?
- can I bait a telegraphed attack toward my old position?
- is this the moment to use Technique?
- should I preserve Evade rather than overcommit?
- after a perfect evade or interrupt, how long can I punish safely?

### Weapon rhythms

Weapon families should alter the move/stop rhythm, not merely damage numbers.

Current prototype identities:

- **Fists:** compact 4-hit rhythm with strong close-range identity
- **Dagger:** very fast, short-range 6-hit chain; rewards tight positioning and quick punish windows
- **Sword:** slower 3-hit rhythm with longer reach, wider pressure, and heavier commitment

These exact counts are tuning values, not sacred rules. The important rule is that changing weapon family noticeably changes how the player positions and when the player dares to stop.

### Technique

Technique is the player's high-value committed action.

It should:

- feel materially stronger than normal attacks
- carry commitment and whiff risk
- interact with the equipped build
- interrupt or break appropriate enemy telegraphs / guards
- produce clear hit stop, knockback, screen shake, audio, and readable feedback

Once committed, Technique should not be freely cancelable into safety.

### Evade and counter windows

Enemy attacks telegraph before damage.

A well-timed evade can create a short counter opportunity. Perfect evade is valuable because it changes what the player can safely do next, not just because it avoids damage.

Weapon families can express different counter identities.

### 闘志 and 決着

Strong play builds **闘志**.

Current prototype sources include successful attacks, combo finishers, telegraph interrupts, and perfect evades. Taking damage removes a meaningful portion of the meter.

At full meter, the next Technique becomes **決着** — a faster, stronger, higher-stagger commitment. The meter is spent when the move is activated, preserving the risk of a miss.

### Battlefield weapon pickup

Defeated enemies can drop temporary battlefield weapons.

Current behavior:

- guards can drop swords
- rushers / skirmishers can drop daggers or sidearms
- moving onto a dropped weapon and stopping briefly picks it up
- no new pickup button is added
- the temporary weapon immediately changes combat rhythm
- a short post-victory pickup window allows the final enemy's weapon to be used

Battlefield weapons are **temporary combat state**. They do not overwrite the player's secured equipment, inventory, expedition loot, or permanent build.

## 7. Combat readability and feel

Combat should be understandable without staring at numerical UI.

Important feedback includes:

- enemy attack telegraphs
- aim lines / locked attack direction where appropriate
- hit stop
- knockback
- impact particles
- screen shake
- enemy stagger / fall / low-health posture
- generated sound feedback
- optional vibration on supported devices
- clear loot reveal after victory

Combat presentation uses the fixed oblique top-down battlefield defined in `combat-presentation-spec.md`. Actor bodies preserve the accepted source-art proportions; ground position is projected while sprite anatomy is not distorted.

## 8. Enemy roles

The current small enemy roster deliberately tests distinct decisions.

### Rusher

- closes distance aggressively
- creates immediate positioning pressure
- punishes passive standing

### Guard

- slower and more defensive
- blocks ordinary pressure
- rewards guard breaks, strong Techniques, or better positioning

### Skirmisher

- maintains distance
- uses telegraphed ranged pressure
- locks aim early enough that moving out of the line creates a punish opportunity

A small number of enemies with readable identity is more valuable than many stat variations.

## 9. Loot and build identity

Equipment is the main source of frequent build experimentation.

An item should communicate:

- equipment / weapon type
- rarity or quality
- power comparison
- combat style
- playstyle identity
- meaningful modifier

Modifiers should change decisions rather than merely add tiny percentages.

The current prototype has enough itemization to prove build-sensitive combat, but **loot breadth is now one of the clearest weaknesses in the playable loop**. Ordinary loot is still concentrated around a small number of weapon bases and modifiers, so repeated expeditions can become familiar too quickly.

The next itemization pass should deepen the existing three weapon families before adding many new weapon categories:

- expand weapon bases within Fists / Dagger / Sword
- add decision-changing modifiers that reuse existing rules such as Technique, Perfect Evade, combo, guard break, 闘志, reach, cadence, and commitment
- make comparison UI explain meaningful differences
- preserve save compatibility and deterministic loot generation

Conceptually distinguish:

- **ordinary equipment** — repeatable randomized hack-and-slash loot
- **named equipment** — finite authored collection candidates tied to regions / events
- **relics** — signature rewards from Named Hunts, dungeons, or other special content

Do not solve loot variety by adding many shallow `+X% damage` modifiers or a large slot/crafting system before the current combat loop needs them.

## 10. Named hunts

Repeated expeditions need a reason to exist beyond generic random loot.

The current hunt loop is:

> **Rumor → traces → lair → named target → signature relic → next rumor**

Clue progress persists across expeditions.

Current named targets:

1. **灰牙** — Rusher identity → `灰牙の血布`, supporting a faster unarmed style
2. **鐘なき騎士** — Guard identity → `鐘喰らいの武装剣`, supporting heavy guard-breaking sword play
3. **沼鴉** — Skirmisher identity → `沼鴉の嘴`, supporting evade-focused dagger play

Signature relics drop as unsecured loot. Defeating the named enemy is not enough; the player must return alive to keep the prize.

## 11. Dungeons

Dungeons concentrate the Wizardry side of Crownless: uncertainty, depth, risk, and retreat.

The first implemented dungeon is **灰喰い坑道**.

Current structure:

- unlocked after defeating 灰牙
- three-room delve
- room 1: trap/skirmish decision
- room 2: elite combat
- room 3: boss / warden
- after resolved rooms, the player can retreat or descend deeper
- first clear grants a unique relic
- the dungeon remains replayable
- unlock and completion state persist even if a later expedition ends in defeat

The critical dungeon rule is not the exact room count. It is:

> **Going deeper must feel tempting enough that retreat becomes a real decision.**

## 12. Grey Hearth progression and presentation

Ordinary successful expeditions should matter even when the loot roll is mediocre.

The current meta-progression currency is **Renown**.

Current Hearth milestones remain intentionally small and functional:

- **5 Renown — 地図掛け:** new expeditions begin with one scouting charge
- **15 Renown — 回収係:** defeat recovers one additional unsecured item
- **30 Renown — 鍛冶火:** modest combat refinement

The Grey Hearth is now presented as a **scene-first safe room**, not a dashboard. Its major systems are represented by physical / spatial objects where practical:

- Mist Gate — leave on expedition
- player figure — current player presence / equipment identity
- fire — ambient safe-place interaction
- wall map — discovery journal and explored-world memory
- loot shelf — secured equipment / loot access
- rumor / pursuit presentation — Named Hunts and other known goals
- recovery cache and forge — visible Hearth milestones
- regional mission board / presentation — discovered dangerous regional content that is ready for stationary assault

The room remains a presentation layer over existing game state. Do not create a separate Hearth-management game.

## 13. Persistence

The prototype stores **safe Grey Hearth state** as permanent browser progress, with deliberately narrow exceptions for knowledge that should survive immediately.

Rules:

- safe state is versioned
- return, defeat resolution, and equipment changes can update the safe snapshot
- beginning a new expedition checkpoints the current safe state
- active unfinished expedition state is never written as secured progress
- newly learned discovery journal state can be merged into the safe snapshot while an expedition is active
- coarse explored-area knowledge can persist as world knowledge
- knowledge persistence must never secure active HP, expedition depth, unsecured loot, temporary combat state, or other carried expedition value
- refreshing during an expedition restores safe Hearth state plus world knowledge that was already legitimately learned
- corrupt or older save data must fail safely and normalize missing fields

Persistent world knowledge stores game-facing identity and coarse area state only. Do not persist raw GPS coordinates, exact movement history, `mapOrigin`, or `representativeCoordinate` as collection state.

This keeps the survival contract understandable:

> **what returned home is owned; what the player truly learned remains known; what was still being carried outside was not secure.**

Cloud accounts and backend persistence are deferred.

## 14. Location system — current implementation and direction

Real-world location is a core pillar and is already part of the browser prototype.

The current implementation can:

- request device location with player permission
- obtain nearby public geographic signals through the Crownless geography API
- normalize external geographic features behind Crownless-owned discovery rules
- translate geography into fantasy exploration candidates
- present nearby candidates on a lightweight manuscript-style sketch map rather than a navigation map
- keep deterministic / simulated fallback available when location or geography is unavailable
- preserve stable discovered-place identity across runs
- remember discovered places in the Discovery Journal
- remember coarse explored areas without storing raw movement tracks
- show coarse area discovery progress in the journal
- associate supported discoveries with location visuals

Location is a **world discovery input**, not a pedometer score.

The fantasy map should not require one-to-one mapping to private businesses or exact properties. Use coarse, safe regions/cells and avoid gameplay that encourages trespassing, dangerous travel, or meter-perfect GPS behavior.

External geography enriches the world but must not be the only way the game can function. The deterministic provider remains a development, testing, and failure fallback.

## 15. Regional missions — current first implementation

Regional missions connect location discovery to reasons to revisit and eventually challenge a place.

The first implemented mission is:

> **地域依頼：消えた荷駄隊 / Missing Pack Train**

Current loop:

1. a road-like region / discovery can start or advance the mission
2. the player discovers **two deterministic traces** while exploring
3. the traces reveal **街道荒らしの野営地** as a persistent dangerous target
4. the discovered target remains known instead of forcing immediate combat outdoors
5. the player returns to the **Grey Hearth** and deliberately arms the assault
6. the existing full combat system resolves the camp fight
7. combat rewards remain ordinary **unsecured loot** until safe return
8. a successful return marks the mission cleared, records regional knowledge, and unlocks a follow-up rumor

The current regional knowledge result is:

> **この街道には組織的な襲撃者がいる**

Important contract:

> **Outdoor discovery may reveal and mark danger. Longer full combat can be deliberately launched from the Grey Hearth / stationary context.**

This is now the first implemented answer to the outdoor-versus-stationary combat question. Treat it as the baseline to playtest, not yet as a reason to build a universal quest engine.

Mission persistence must continue to store game-facing state only. Raw GPS coordinates and exact movement history do not belong in persistent mission progress.

## 16. Party system — future pillar

Party play remains part of the product vision but is not part of the current implementation priority.

Companions may eventually affect:

- combat roles
- exploration options
- dungeon survival
- injuries and loss
- relationships
- faction ties
- story and political choices

Party composition should create expedition decisions, not merely passive stat bonuses.

Do not build the party framework before the solo core loop is consistently fun.

## 17. Factions and territory — future pillar

The long-term world contains competing powers with borders, settlements, interests, alliances, and wars.

Player behavior may eventually affect:

- local reputation
- access to services and settlements
- regional danger
- rumors and quests
- faction conflict
- control or influence over territory

This system should emerge from an already enjoyable exploration game. Do not build a grand-strategy simulation while combat, exploration, and loot still need iteration.

## 18. Current playable slice

The current slice is broad enough to test repeated solo expeditions end to end.

It currently includes:

- curiosity-driven exploration leads
- GPS / geography discovery with deterministic fallback
- manuscript-style nearby sketch map
- persistent Discovery Journal with stable known-place identity
- persistent coarse explored areas and area-completion presentation
- location visuals for supported discoveries
- combat / non-combat event variety
- stand-to-strike combat
- weapon-specific movement rhythms
- Techniques, Evades, counters, 闘志, and 決着
- temporary battlefield weapon pickups
- three distinct enemy roles
- loot comparison and build-changing modifiers
- unsecured-loot return pressure
- route history and dedicated return / defeat reports
- three Named Hunts and signature relics
- a retreatable three-room dungeon
- persistent Renown / Grey Hearth milestones
- scene-first Grey Hearth presentation
- the first regional mission, connecting outdoor clues to a Grey Hearth stationary assault
- safe local persistence with world-knowledge-only exceptions during active expeditions

Party play, faction warfare, accounts, and production backend infrastructure remain deferred.

## 19. Current success criteria

The prototype is moving in the right direction when playtesting shows that:

- moving and stopping in combat creates real tactical decisions
- punching an ordinary enemy is satisfying before rewards are considered
- weapon families materially change how the player positions and commits
- telegraphs, Evade, Technique, and counter windows create readable risk / reward
- battlefield weapon pickups create interesting improvisation without control clutter
- exploring a different real region can expose meaningfully different Crownless discoveries
- revealing and remembering places is satisfying even when no loot drops
- explored areas and the Discovery Journal make the world feel accumulated rather than reset each run
- regional clues create a reason to look for one more discovery or revisit a region
- discovering a dangerous regional target creates anticipation to challenge it later from safety
- loot frequently creates a build decision rather than only a larger number
- carrying unsecured rewards makes returning home emotionally meaningful
- Named Hunts and dungeon depth create a reason to begin another expedition
- retreat can feel smart rather than cowardly
- Grey Hearth progression makes successful runs matter without becoming a grind tree
- players voluntarily start another run

If these are weak, improve the loop rather than adding a larger world.

## 20. Immediate design / playtest priorities

Prioritize the following before Party or faction-scale systems:

1. **Deepen ordinary loot variety and build choice.** The combat rules are broader than the current item pool.
2. **Playtest the regional mission loop.** Verify that outdoor clues → marked danger → stationary assault feels like one continuous adventure rather than a checklist.
3. **Improve progressive map reveal only where playtesting shows a clear payoff.** Coarse explored areas now exist; frontier hints / richer fog behavior should be added incrementally, not as a speculative world-map rewrite.
4. **Continue phone-size visual QA.** Presentation work is only successful if combat, exploration, journal, and Hearth remain readable on real phone-sized viewports.

## 21. Explicit non-goals for the next iteration

Do not prioritize:

- massive seamless world generation
- real-time multiplayer
- large-scale faction warfare simulation
- party implementation before the solo loop is proven
- hundreds of shallow items or enemies
- elaborate crafting
- monetization systems
- account/backend architecture that the playable loop does not need
- collection leaderboards or real-POI completion percentages
- raw GPS movement-history storage
- paid AI calls on every player movement
- sophisticated procedural generation for its own sake
- production art pipeline or photorealism

## 22. Design history that must not be mistaken for current direction

Some older documents and commits describe an **AUTO movement + AUTO basic attack** combat model optimized around two buttons. That model was useful as a mobile experiment but was later judged too passive.

The current direction is the stand-to-strike model described in this document:

> **manual movement → stop to auto-strike → Technique / Evade for high-value timing decisions**

Older exploration documents also describe GPS as deferred or treat the later stationary-combat rule as unresolved. Those statements are historical now: real GPS/geographic discovery is implemented, and the regional-mission slice currently proves one concrete outdoor-discovery → Grey-Hearth-assault contract.

When older documents conflict with this living design document, subsystem specifications, current implementation, or accepted visual assets, use the current sources.