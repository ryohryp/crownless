# Crownless — Game System Design

> **Status:** current design baseline / living document  
> **Updated:** 2026-08-20  
> This document is the canonical gameplay design reference for the current prototype. Older versioned documents remain as design history, but implementation and new decisions should follow this file.

## 1. Vision

Crownless is a location-based medieval fantasy action hack-and-slash RPG where real-world movement reveals and expands a dangerous game world.

The experience should feel like an **expedition**, not a walking-reward app. The player leaves safety, discovers something unknown, fights or makes a risky choice, carries value that is not yet secure, and decides whether to push deeper or return alive.

The project combines five pillars:

- **Wizardry:** dangerous expeditions, retreat decisions, dungeons, party identity, survival pressure
- **Kunio-kun:** immediate, physical, readable action with satisfying hits and simple controls
- **Diablo:** loot hunting, equipment identity, build experimentation, repeated runs
- **Location gameplay:** walking reveals and develops the game world rather than merely filling a distance meter
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
2. choose one of several visible expedition leads
3. resolve a fight or exploration event
4. gain loot, clues, health changes, or world knowledge
5. inspect what is still unsecured
6. choose whether to return or continue
7. repeat until the player returns safely or is defeated

The route taken during the current expedition should remain visible. A run is a journey through places, not a sequence of disconnected reward cards.

### Expedition leads

Exploration should present **places worth investigating**, not equivalent compass directions.

A lead should communicate some combination of:

- what the player sees or hears
- location identity
- implied danger
- implied opportunity
- traces of a named target
- dungeon or faction relevance

Current event families include:

- normal combat
- higher-risk ambush combat
- hidden cache
- shrine choice
- wounded traveler / courier choice
- named-hunt traces and target lairs
- dungeon entrance and dungeon rooms

Non-combat events must be presented distinctly from combat. If no battle exists, combat HUD and combat controls should not appear.

## 5. Survival, risk, and return

The main expedition tension comes from carrying value that is **not yet safe**.

During an expedition, the player can accumulate:

- unsecured loot
- discoveries
- hunt clues
- dungeon progress during the current delve
- health loss and other temporary pressure

### Discovery knowledge is different from carried loot

Once the player actually discovers a place, **knowing that place is permanent world knowledge immediately**. The player may lose the treasure carried out of that place, but defeat does not make the player forget that the place exists.

This creates two deliberately different kinds of expedition value:

- **carried value** — loot and other rewards that may still be lost until safe return
- **learned value** — discovered world knowledge that remains part of the player's map once learned

Revisiting the same stable place updates the existing discovery record rather than creating another copy. This distinction lets exploration itself remain rewarding even when an expedition ends badly, without weakening the survival risk around equipment and loot.

### Safe return

Returning to the Grey Hearth converts eligible unsecured rewards into permanent progress.

A successful return should clearly communicate:

- how deep the player went
- what loot was secured
- Renown gained
- Hearth progression or newly reached milestones
- what changed for the next expedition

### Defeat

Failure must matter without making the player afraid to play.

Current principles:

- permanently secured progress remains
- discovered world knowledge remains
- equipped core gear is not deleted
- unsecured loot is at risk
- Hearth progression can improve recovery from defeat
- a defeat report should make the loss understandable and make another attempt feel possible

The goal is **tension and regret**, not catastrophic punishment.

## 6. Combat — current core direction

The earlier AUTO-move mobile model has been superseded.

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

These exact counts are tuning values, not sacred rules. The important rule is that changing weapon family should noticeably change how the player positions and when the player dares to stop.

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

Enemy attacks should telegraph before damage.

A well-timed evade can create a short counter opportunity. Perfect evade is valuable because it changes what the player can safely do next, not just because it avoids damage.

Weapon families can express different counter identities.

### 闘志 and 決着

Strong play builds **闘志**.

Current prototype sources include successful attacks, combo finishers, telegraph interrupts, and perfect evades. Taking damage removes a meaningful portion of the meter.

At full meter, the next Technique becomes **決着** — a faster, stronger, higher-stagger commitment. The meter is spent when the move is activated, preserving the risk of a miss.

This system exists to make clean combat visibly accumulate toward a payoff.

### Battlefield weapon pickup

Defeated enemies can drop temporary battlefield weapons.

Current prototype behavior:

- guards can drop swords
- rushers / skirmishers can drop daggers or sidearms
- moving onto a dropped weapon and stopping briefly picks it up
- no new pickup button is added
- the temporary weapon immediately changes combat rhythm
- a short post-victory pickup window allows the final enemy's weapon to be used

Battlefield weapons are **temporary combat state**. They do not overwrite the player's secured equipment, inventory, expedition loot, or permanent build.

This mechanic supports the fantasy of an unarmed nobody surviving by using whatever the battlefield provides.

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
- sound feedback generated without requiring an asset pipeline
- optional vibration on supported devices
- clear loot reveal after victory

Feedback should reinforce actual game state rather than become decoration disconnected from decisions.

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

Examples already aligned with the prototype include:

- faster or stronger combo payoff
- perfect-evade follow-up
- stronger guard break / heavy impact
- unarmed tempo changes
- low-health risk/reward behavior

The item screen should make it obvious whether a find is simply stronger, meaningfully different, or both.

## 10. Named hunts

Repeated expeditions need a reason to exist beyond generic random loot.

The current hunt loop is:

> **Rumor → traces → lair → named target → signature relic → next rumor**

Clue progress persists across expeditions.

Current named targets:

1. **灰牙** — Rusher identity → `灰牙の血布`, supporting a faster unarmed style
2. **鐘なき騎士** — Guard identity → `鐘喰らいの武装剣`, supporting heavy guard-breaking sword play
3. **沼鴉** — Skirmisher identity → `沼鴉の嘴`, supporting evade-focused dagger play

Signature relics still drop as unsecured loot. Defeating the named enemy is not enough; the player must return alive to keep the prize.

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

Future dungeons can become more varied only after this push-your-luck structure proves fun.

## 12. Grey Hearth progression

Ordinary successful expeditions should matter even when the loot roll is mediocre.

The current meta-progression currency is **Renown**.

Renown is gained for meaningful successful expeditions, with additional value from deeper runs, carried loot, named-hunt clears, and dungeon clears. Simply leaving and immediately returning should not become a grind loop.

Current Hearth milestones are intentionally small and functional:

- **5 Renown — 地図掛け:** new expeditions begin with one scouting charge
- **15 Renown — 回収係:** defeat recovers one additional unsecured item
- **30 Renown — 鍛冶火:** modest combat refinement

The existing wall map also acts as the physical home for accumulated discovery knowledge. It should show that the world has been learned without becoming a separate management dashboard.

This is not intended to become a giant passive skill tree. Hearth growth should change the texture of future expeditions without replacing equipment and player skill.

## 13. Persistence

The prototype stores **safe Grey Hearth state** as permanent browser progress, with one narrow exception: newly learned world knowledge may be merged into that safe snapshot while an expedition is active.

Rules:

- safe state is versioned
- return, defeat resolution, and equipment changes can update the safe snapshot
- beginning a new expedition checkpoints the current safe state
- active unfinished expedition state is never written as secured progress
- when a place is discovered, only the sanitized discovery journal may be merged into the existing safe snapshot immediately
- that world-knowledge merge must never secure active HP, expedition depth, unsecured loot, temporary progression changes, encounter state, or other expedition data
- refreshing during an expedition restores the last safe Hearth snapshot plus any discovery knowledge already learned
- corrupt or older save data must fail safely and missing discovery-journal fields must normalize safely

Persistent discovery entries contain game-facing identity and state only. Do not persist raw GPS coordinates, exact movement history, `mapOrigin`, or `representativeCoordinate` as part of the journal.

This keeps the survival contract understandable: **what returned home is owned; what the player truly learned remains known; what was still being carried outside was not secure.**

Cloud accounts and backend persistence are deferred.

## 14. Location system — target direction

Real-world location is a core pillar. The current browser prototype now uses GPS/geographic enrichment when available while retaining simulated exploration as a deterministic fallback.

Location is a **world discovery input**, not a pedometer score.

Real movement can reveal or influence:

- routes
- wilderness
- settlements
- ruins
- dungeon entrances
- rumors
- resources
- roaming threats
- faction influence
- regional events

Once a stable Crownless place is discovered, it joins the player's persistent discovery journal. Geographic identity must not depend on an ephemeral candidate slot; source namespaces such as `node`, `way`, and `relation` must remain distinguishable. The collection represents **Crownless discoveries**, not a checklist of literal real-world POIs.

The fantasy map should not require one-to-one mapping to private businesses or exact properties. Use coarse, safe regions/cells and avoid gameplay that encourages trespassing or dangerous travel.

The gameplay layer must continue to support simulated movement so combat, loot, dungeons, and progression can be developed from a desk and can fall back safely when location/geography is unavailable.

## 15. Party system — future pillar

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

## 16. Factions and territory — future pillar

The long-term world contains competing powers with borders, settlements, interests, alliances, and wars.

Player behavior may eventually affect:

- local reputation
- access to services and settlements
- regional danger
- rumors and quests
- faction conflict
- control or influence over territory

This system should emerge from an already enjoyable exploration game. Do not build a grand-strategy simulation while combat and expeditions still need iteration.

## 17. Current playable slice

The current slice is broader than the original v0.1 prototype but still intentionally small.

It now tests whether several expeditions in a row remain interesting through:

- curiosity-driven exploration leads
- GPS/geographic discovery enrichment with simulated fallback
- a lightweight nearby sketch map rather than navigation UI
- persistent discovery journal / world knowledge with known-place recognition
- combat / non-combat event variety
- stand-to-strike combat
- weapon-specific movement rhythms
- Techniques, Evades, counters, 闘志, and 決着
- temporary battlefield weapon pickups
- three distinct enemy roles
- loot comparison and build-changing modifiers
- unsecured-loot return pressure
- route history and dedicated return/defeat reports
- named hunts and signature relics
- a retreatable three-room dungeon
- persistent Renown / Grey Hearth milestones
- safe local persistence with discovery-knowledge-only merge during active expeditions

Party play, faction warfare, accounts, and production backend infrastructure remain deferred.

## 18. Current success criteria

The prototype is moving in the right direction when playtesting shows that:

- moving and stopping in combat creates real tactical decisions
- punching an ordinary enemy is satisfying before rewards are considered
- weapon families materially change how the player positions and commits
- telegraphs, Evade, Technique, and counter windows create readable risk/reward
- battlefield weapon pickups create interesting improvisation without extra control clutter
- exploration leads create curiosity about the next place
- discovering a new place feels valuable even before loot is considered
- the player can tell when a nearby place is already part of their world knowledge
- the accumulated wall map / exploration journal makes the world feel personally explored rather than reset each run
- loot frequently creates a build decision rather than only a larger number
- carrying unsecured rewards makes returning home emotionally meaningful
- named hunts and dungeon depth create a reason to begin another expedition
- retreat can feel smart rather than cowardly
- Grey Hearth progression makes successful runs matter without becoming a grind tree
- players voluntarily start another run

If these are weak, improve the loop rather than adding a larger world.

## 19. Explicit non-goals for the next iteration

Do not prioritize:

- massive seamless world generation
- real-time multiplayer
- large-scale faction warfare simulation
- party implementation before the solo loop is proven
- hundreds of items or enemies
- elaborate crafting
- monetization systems
- account/backend architecture that the playable loop does not need
- collection leaderboards or real-POI completion percentages
- raw GPS movement-history storage
- sophisticated procedural generation for its own sake
- production art pipeline or photorealism

## 20. Design history that must not be mistaken for current direction

Some older documents and commits describe an **AUTO movement + AUTO basic attack** combat model optimized around two buttons. That model was useful as a mobile experiment but was later judged too passive.

The current direction is the stand-to-strike model described in this document:

> **manual movement → stop to auto-strike → Technique / Evade for high-value timing decisions**

When implementation and older documents conflict on this point, treat the current implementation and this living design document as authoritative.