# Crownless — Game System Design

> **Status:** current canonical gameplay design  
> **Updated:** 2026-09-06  
> **Decision:** [`adr/0004-territory-driven-reforge.md`](adr/0004-territory-driven-reforge.md)  
> **Historical pivot:** [`adr/0002-idle-expedition-pivot.md`](adr/0002-idle-expedition-pivot.md)  
> **Expedition subsystem:** [`expedition-system-spec.md`](expedition-system-spec.md)

## 1. Vision

Crownless is a **location-discovery territory-expansion RPG** set in a medieval fantasy world.

The player walks through the real world to reveal unknown parts of Crownless, learns what matters about discovered places, chooses how to approach them, prepares companions and equipment, contests NPC-held locations, and sees persistent control of the world change as a result.

The defining fantasy is:

> **I found this place, learned how to take it, changed the map, and now I can see where I want to go next.**

Crownless is not a walking-reward app, a territory XP grinder, or a real-time action-combat game.

Expeditions remain an important system. They are now a principal way to act on places rather than the final purpose of play.

## 2. Core loop

The canonical product loop is:

> **Walk → Discover → Scout / Learn → Prepare → Contest / Expedition → Control → Exploit / Defend / Expand → Next place**

In Japanese:

> **歩く → 発見する → 偵察する → 攻略を準備する → 地点を争う → 支配する → 利用する／守る／広げる → 次の地点へ**

Each major gameplay feature should strengthen at least one relationship in this loop and should normally leave the player with a changed world state or a changed next decision.

### Walk

Real movement exposes different geography and therefore different Crownless world seeds. Walking expands what can be discovered; it does not refill energy.

### Discover

Reveal a place, clue, route, strategic feature, danger, or rumor. Legitimate discovery becomes persistent world knowledge with stable game-facing identity.

### Scout / Learn

Decide whether to spend time/opportunity to reduce uncertainty before contesting a place. Scouting should reveal useful danger, opportunity, approach, route, faction, or strategic-effect information. It must not be a disguised control-progress action.

### Prepare

Choose the companions, equipment, supplies, objective/policy where relevant, and an approach suitable for the target. Preparation should create understandable consequences rather than only hidden percentage bonuses.

### Contest / Expedition

Act on the place. Reuse the existing deterministic expedition/event resolver wherever practical. A contest may include travel, scouting, hostile encounters, hazards, retreat, injury, or other structured events.

### Control

On a legitimate success, a place may persistently move from NPC control to player control. Failure or retreat does not grant control. The transition and its effects must be idempotent across reload and Report reapplication.

### Exploit / Defend / Expand

A controlled place must do more than show a badge. It should make at least one later decision different — for example by changing an approach, risk, duration, available resource, scouting information, route, or another strategic condition.

Phase 1 does not require a full defense simulation. `Defend` is part of the long-term loop, while the first slice may prove only immediate use/expansion consequences.

### Next place

After taking a place, the Atlas should make another meaningful target naturally visible. The player should be deciding **where/why/how next**, not merely filling a checklist.

## 3. Product validation target

The current North Star is:

> **自分の行動で勢力圏が広がった地図を見たとき、次の地点を取りたくなるか？**

Everything in the #503 Phase 1 slice should help answer this question.

Secondary signals:

- does the player hesitate over which place to take next?
- does the player want to scout before committing, or deliberately accept uncertainty?
- does a companion, item, or approach create a reason to prepare differently?
- can the player understand why a contest succeeded, failed, or caused injury?
- does control visibly alter the Atlas?
- does taking one place change another place's conditions or options?
- is the desire to expand driven by strategy and curiosity rather than a progress bar?

The former question — whether the player reopens the game primarily to read an expedition result — remains a useful expedition-quality signal, but it is no longer the product North Star.

## 4. Player fantasy

The player begins as nobody important.

They do not begin as a king, legendary hero, or powerful guild master. The initial Grey Hearth should feel poor, small, and uncertain.

The player's power comes from accumulated relationships with the world:

- known land
- places scouted and understood
- places brought under control
- strategic routes and footholds
- trusted companions
- recovered tools and weapons
- local knowledge
- rumors
- a growing place to return to

Progression should feel like **having more options, more history, and more influence on the map**, not only increasing a level number.

## 5. Real-world movement and discovery

Location remains a core pillar.

The rule is:

> **Walking expands the playable world; it does not refill energy.**

Real-world movement may reveal:

- forests
- ruins
- roads
- caves
- shrines
- abandoned settlements
- crossings
- regional clues
- dangerous locations
- strategically useful places

These are Crownless translations of coarse geography, not literal copies of private homes or individual businesses.

Once a place is legitimately discovered, it can normally be remembered and acted on later from a safe stationary context. The player should not need to physically stand at the destination while a contest/expedition is resolved.

Do not persist raw latitude/longitude, exact route history, or exact movement tracks as territory state.

See [`exploration-location-spec.md`](exploration-location-spec.md).

## 6. World Atlas and territory

The World Atlas is a primary reward surface for the Territory-driven Reforge.

At minimum, a place should be able to expose game-facing concepts such as:

- stable place identity
- discovery/knowledge state
- controlling owner kind (`npc` / `player` for Phase 1)
- strategic role/value
- known danger and unknown information
- control effect
- whether it is a meaningful next target

Phase 1 may use an authored three-place slice. Do **not** create a generalized territory graph, scripting engine, or nationwide simulation merely to prove this loop.

The minimum control state needed by Phase 1 is conceptually:

```text
unknown
known
controlled_by_npc
controlled_by_player
```

Add `contested` only if the slice genuinely needs it.

Control must be visually legible in the current living-manuscript / woodcut Visual Canon. Avoid a generic modern strategy-map treatment.

## 7. Territory is not XP

Do not implement the central territory loop as:

```text
control 4,280 / 10,000
kill enemy +20
```

That is a level/XP grind with renamed labels.

The main sources of advantage should be decisions and preparation:

- scout before attacking or accept incomplete information
- use local/geographic companion knowledge
- choose suitable equipment
- select a route or approach
- take a crossing/road/foothold before a harder target
- use a controlled place's strategic effect

Do not add dailies, stamina, energy, or repeated chores to make territory last longer. Do not require arbitrary repetition of a solved contest. Do not make a tiny invisible `+N%` modifier the primary reward for control.

## 8. The Grey Hearth

The Grey Hearth is the player's safe anchor.

It is where the player can:

- review discovered and controlled places
- review returned or missing expeditions
- choose companions
- equip gear and tools
- treat or wait for injured companions
- prepare scouting/contest actions
- inspect secured loot
- understand newly available routes, targets, and consequences

It should feel like a place people return to, not a modern management dashboard.

The Hearth may visibly improve over time, but it must not become a separate chores/economy game.

## 9. Expeditions

Expeditions remain a major gameplay subsystem and one of the main ways to act on a place.

They are **not** the product's ultimate purpose under ADR 0004.

The player can make a small number of high-value decisions before dispatch/contest:

- destination
- companions
- equipment / supplies
- objective
- risk policy
- scouting/approach when relevant

The expedition then resolves through deterministic or seeded events.

Events can include:

- travel
- clues
- scouting information
- hazards
- hostile encounters
- discoveries
- loot
- disagreement or initiative from companions
- injury
- retreat
- delay
- disappearance
- control success/failure where the destination supports it
- return

The detailed resolver contract lives in [`expedition-system-spec.md`](expedition-system-spec.md). Where that older subsystem spec says expeditions themselves are “the gameplay center,” ADR 0004 and this document supersede that product-level wording while keeping the deterministic rules reusable.

## 10. Combat is an expedition/contest event

Combat still exists in the fiction, but it is not a real-time action-game requirement.

A hostile encounter can resolve from:

- who was sent
- what they carried
- their traits / geographic knowledge
- terrain and surprise
- enemy profile
- current injuries
- objective
- policy
- scouting knowledge
- approach
- strategic effects of already-controlled places where explicitly authored

Interesting outcomes are broader than win/lose:

- avoid
- hide
- bribe
- bluff
- ambush
- win cleanly
- win with injury
- retreat
- lose an item
- become delayed
- become missing
- fail to take control
- rare death

The result should be legible enough that the player can connect it back to earlier choices.

Existing real-time combat code and specifications are transition-era legacy implementation unless explicitly repurposed.

## 11. Companions

Companions are persistent people and should become memorable through place, history, traits, injuries, rescues, and repeated survival.

They may have:

- name
- origin / role
- traits
- geographic knowledge/affinity where implemented
- strengths and weaknesses
- current condition
- expedition history
- notable rescues / relationships / scars

The Territory-driven question is not merely “who has the largest bonus?” but:

> **Who helps us understand or take this place, and what do we give up by choosing them?**

Do not use gacha rarity as the primary identity.

## 12. Risk, return, control, and value

Crownless keeps the distinction between **carried value**, **learned value**, and now **changed world state**.

### Carried value

Loot, tools, valuables, and other physical rewards remain at risk until safely returned/secured.

### Learned value

A legitimately discovered place, route, clue, enemy tendency, or regional fact can become persistent knowledge when learned.

### Changed world state

A valid successful contest can persistently change control and unlock a strategic effect. That effect must not be duplicated by reload or Report reapplication.

The fundamental contract becomes:

> **What returned home is owned. What was truly learned remains known. What was legitimately taken changes the map. What failed or retreated was not captured.**

Failure should create consequences without making the game miserable. Prefer tired, injured, early return, lost loot/tool, delayed, missing/captured, and rare death over invisible grind penalties.

## 13. Equipment and loot

Loot remains important, but equipment should create situational reasons to choose it.

Prefer items that alter information, approaches, routes, contest options, or consequences rather than only linear power.

Examples:

- rope → safer ruin/cliff or alternate approach
- miner's pick → mine/cave route option
- local cloak → changes detection or local knowledge
- old map → improves scouting / reveals a route
- marked weapon → interacts with a faction/place

Geographic loot is especially compatible with Territory play when new places make different loadouts useful without making old places/items obsolete.

## 14. Reports are causal evidence, not the destination

Reports remain important because they explain what happened.

The top layer should quickly communicate relevant facts such as:

- returned / delayed / missing / failed
- duration
- injuries
- important loot/knowledge
- notable event
- scouting/approach consequence
- whether control changed
- what strategic effect is now available
- what next target or unresolved problem follows

A second layer can show a chronological structured log.

The report should be deterministic and must not invent events. The first implementation does not require an LLM call per expedition.

Do not treat Report wording/content alone as sufficient gameplay innovation. The important question is what game state/decision the Report explains.

## 15. Phase 1 three-place golden slice

The #503 Phase 1 test is deliberately bounded to three representative discovered places.

The target flow is:

```text
1. real or simulated location reveals three places
2. Atlas shows NPC control, uncertainty, and strategic value
3. player chooses a first target
4. player scouts or accepts incomplete information
5. player chooses companion/equipment/approach
6. existing deterministic expedition resolver resolves the contest where practical
7. success changes NPC control → player control; failure/retreat does not
8. Atlas visibly changes
9. the captured place changes at least one condition/option for another target
10. the UI makes “which place next?” the natural decision
```

Useful authored roles include:

- foothold / small fort
- road/crossing
- resource/special site

They do not need to become generic system types in Phase 1.

## 16. Persistence

The prototype should persist only game-facing state required by the loop, such as:

- discovered places / coarse explored areas
- relevant place knowledge
- place control state
- strategic effects that are active because of valid control
- companion state
- secured inventory
- active expedition/contest immutable inputs
- expedition timing
- resolved reports
- safe Grey Hearth state

It should not persist raw movement history or expose exact coordinates as game collection/territory state.

Active expedition resolution and territory application must be idempotent. Reloading/reopening must not duplicate rewards, control, or consequences.

If Phase 1 requires a large save migration or irreversible data transformation, stop for human review rather than forcing the slice through.

## 17. Technical simplicity rule

Do not overbuild territory or idle infrastructure.

Reuse current stable discovery identity, World Atlas, world knowledge, simulated location, companions, equipment, deterministic expedition resolution, Report/event data, and existing privacy boundary wherever practical.

No always-on faction server is required for Phase 1. No generic territory scripting engine is required. No mandatory cloud account is required.

Keep location access behind providers and keep game rules testable without live GPS or network services.

## 18. Explicitly deferred / prohibited in Phase 1

- real-time action combat
- PvP territory contests
- clans / guild war
- rankings
- seasons / resets
- always-on faction simulation
- cloud accounts as a requirement
- new backend solely for territory
- large economy simulation
- settlement-management game
- generic territory scripting platform
- large save migration without human gate
- raw GPS / exact route-history persistence
- gacha
- stamina / energy loops
- dailies / weekly chores
- large LLM-generated content pipeline
- monetization design

## 19. Development priority

Continue to work in short cycles:

> **Design → smallest implementation → play → improve**

The next implementation after this Canon is merged should not begin with a generalized territory engine or mass deletion of expedition code. It should build the smallest authored three-place slice that proves:

> **taking one place changes the map and makes another place desirable.**

If that slice is not compelling, fix or kill the hypothesis before expanding territory content, faction simulation, infrastructure, or production assets.

After implementation and CI, gameplay remains **Implemented / Playtest pending**. Human playtest decides Keep / Change / Kill.
