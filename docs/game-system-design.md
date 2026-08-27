# Crownless — Game System Design

> **Status:** current canonical gameplay design  
> **Updated:** 2026-08-27  
> **Decision:** [`adr/0002-idle-expedition-pivot.md`](adr/0002-idle-expedition-pivot.md)  
> **Expedition subsystem:** [`expedition-system-spec.md`](expedition-system-spec.md)

## 1. Vision

Crownless is a **location-discovery idle expedition RPG** set in a medieval fantasy world.

The player walks through the real world to reveal unknown parts of Crownless, returns to a safe place, chooses who to send into those places, equips them, decides how much risk they may take, and later reads what happened.

The defining fantasy is:

> **I found this place. I sent them there. Now I need to know whether they came back.**

Crownless is not a walking-reward app, and it is no longer designed around real-time action combat.

## 2. Core loop

The canonical loop is:

> **Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt**

In Japanese:

> **歩く → 発見する → 準備する → 送り出す → 待つ → 報告を読む → 次を判断する**

Each major feature should strengthen at least one of these stages.

### Walk

Real movement exposes different geography and therefore different Crownless world seeds.

### Discover

The player reveals a place, clue, route, region, danger, or rumor. Discovery becomes persistent world knowledge.

### Prepare

At the Grey Hearth, choose companions, equipment, supplies, destination, objective, and risk policy.

### Dispatch

Commit the expedition. Dispatch choices become immutable inputs to its resolution.

### Wait

Time passes. The prototype may resolve lazily when reopened; it does not need a continuously running backend.

### Report

The game reveals what happened: discoveries, choices, combat, loot, injury, delay, disappearance, retreat, or return.

### Adapt

Treat injuries, change the party, equip recovered items, attempt rescue, choose another destination, or walk somewhere new to expand the world.

## 3. Product validation target

The first question is no longer whether combat feels satisfying.

It is:

> **After dispatching an expedition, does the player want to reopen the game to see what happened?**

Everything in the first PoC should help answer this question.

Secondary signals:

- does the player care who was sent?
- does the player understand why a result happened?
- does risk policy create regret or satisfaction?
- does a report create a story worth remembering?
- does walking somewhere new create a destination worth using later?

## 4. Player fantasy

The player begins as nobody important.

They do not begin as a king, legendary hero, or powerful guild master. The initial Grey Hearth should feel poor, small, and uncertain.

The player's power comes from accumulated relationships with the world:

- known land
- trusted companions
- recovered tools and weapons
- rumors
- routes
- favors and faction knowledge later
- a growing place to return to

Progression should feel like **having more options and more history**, not only increasing a level number.

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

These are Crownless translations of coarse geography, not literal copies of private homes or individual businesses.

Once a destination is legitimately discovered, it can normally be used later as an expedition target from a safe stationary context. The player should not need to physically stand at the destination while an expedition is resolved.

See [`exploration-location-spec.md`](exploration-location-spec.md).

## 6. The Grey Hearth

The Grey Hearth is the player's safe anchor.

It is where the player can:

- review discovered places
- review returned or missing expeditions
- choose companions
- equip gear and tools
- treat or wait for injured companions
- dispatch new expeditions
- inspect secured loot
- follow rumors, rescue opportunities, hunts, and future regional events

It should feel like a place people return to, not a modern management dashboard.

The Hearth may visibly improve over time, but it must not become a separate chores/economy game.

## 7. Expeditions

Expeditions are the primary gameplay system.

The player makes a small number of high-value decisions before dispatch:

- destination
- companions
- equipment / supplies
- objective
- policy

The expedition then resolves through deterministic or seeded events.

Events can include:

- travel
- clues
- hazards
- hostile encounters
- discoveries
- loot
- disagreement or initiative from companions
- injury
- retreat
- delay
- disappearance
- return

The detailed contract lives in [`expedition-system-spec.md`](expedition-system-spec.md).

## 8. Combat is an expedition event

Combat still exists in the fiction, but it is no longer a real-time action-game requirement.

A hostile encounter can resolve from:

- who was sent
- what they carried
- their traits
- terrain and surprise
- enemy profile
- current injuries
- objective
- expedition policy

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
- rare death

The result should be legible enough that the player can connect it back to earlier choices.

Existing real-time combat code and specifications are transition-era legacy implementation unless explicitly repurposed.

## 9. Companions

Companions should become the emotional center of repeated expeditions.

They are persistent people with:

- name
- origin / role
- traits
- strengths and weaknesses
- current condition
- expedition history
- notable rescues / relationships / scars when implemented

A companion should eventually become memorable because of what happened to them, not because a card says `SSR`.

Long-term states may include:

- ready
- tired
- injured
- unavailable
- missing
- captured
- dead

The first PoC only needs enough state to make assignment and return meaningful.

## 10. Risk, return, and value

Crownless keeps the distinction between **carried value** and **learned value**.

### Carried value

Loot, tools, valuables, and other physical rewards remain at risk until the expedition safely returns.

### Learned value

A legitimately discovered place, route, clue, or regional fact can become persistent knowledge when learned.

The fundamental contract remains:

> **What returned home is owned. What was truly learned remains known. What was still being carried outside was not secure.**

### Failure

Failure must create consequences without making the game miserable.

Prefer a ladder of consequences:

- tired
- injured
- early return
- lost loot
- damaged / lost tool
- delayed
- missing
- captured
- rare death

Missing companions are especially valuable because they create rescue expeditions and continuing stories.

## 11. Equipment and loot

Loot remains important, but the design target changes.

Items should not mainly be judged by how they alter real-time attack rhythm. Prefer items that change expedition possibilities.

Examples:

- rope → safer ruin / cliff branches
- miner's pick → additional cave / mine choices
- royal cloak → changes patrol / checkpoint events
- old map → improves exploration branches
- dagger → improves ambush / escape outcomes

Linear combat or survival stats may exist, but memorable equipment should affect decisions.

Conceptually distinguish:

- ordinary equipment — repeatable expedition loot
- named equipment — authored items tied to places / people / events
- relics — rare rewards from important hunts, dungeons, factions, or stories

## 12. Reports are a reward surface

The report is a core piece of game content.

The top layer should be quickly readable:

- returned / delayed / missing / failed
- duration
- injuries
- important loot
- discoveries
- notable event

A second layer can show a chronological expedition log.

The log should be generated from structured events and remain deterministic. The first implementation does not need an LLM call per expedition.

A good report creates a sentence the player might naturally retell:

> **I sent Ed and Mira to the forest on Greedy, Ed got hurt, but they found an old military sword before barely making it home.**

## 13. World systems after the PoC

The following remain compatible with the new direction but are not first-slice requirements:

### Named Hunts

Rumors can become expedition targets. Traces gathered across expeditions can reveal a lair or named enemy.

### Dungeons

Dungeons can become multi-stage expeditions where a policy controls how deep the party dares to continue.

### Regional events

A region can change over hours or days: bandits block a road, refugees appear, a village is raided, a mine collapses.

### Factions and war

The world can later change without waiting for the player. Territory and faction state can alter expedition routes, encounters, prices, rumors, and available opportunities.

Do not implement this simulation until the base dispatch/report loop is fun.

## 14. Persistence

The prototype should persist:

- discovered game-facing places
- coarse explored areas
- companion state
- secured inventory
- active expedition dispatch inputs
- expedition timing
- resolved expedition reports
- safe Grey Hearth state

It should not persist raw movement history or expose exact coordinates as game collection state.

Active expedition resolution must be idempotent. Reloading or reopening must not duplicate rewards or consequences.

## 15. Technical simplicity rule

Do not overbuild idle infrastructure.

The first implementation may store `startedAt`, `expectedReturnAt`, a deterministic seed, and immutable dispatch inputs. When the app is reopened, resolve elapsed events locally/deterministically.

No always-on server is required unless later playtesting proves one is necessary.

Keep location access behind providers and keep game rules testable without live GPS or network services.

## 16. First PoC scope

Target roughly:

- 3 companions
- 3–5 discovered destinations
- 3 destination families: forest / abandoned village / cave
- 3 expedition policies: cautious / standard / greedy
- around 15 pieces of equipment / supplies
- a small event library
- injury
- loot
- new discovery
- policy-driven retreat
- report summary + chronology
- accelerated / instant test mode

If this is too much, reduce content breadth before adding infrastructure.

## 17. Explicitly deferred

- real-time action combat
- party battle controls
- large skill trees
- crafting systems
- gacha
- stamina / energy loops
- dailies / weekly chores
- PvP
- clans
- large faction-war simulation
- cloud accounts
- always-on world server
- large LLM-generated content pipeline
- monetization design

## 18. Development priority

Continue to work in short cycles:

> **Design → smallest implementation → play → improve**

The next implementation should not begin by deleting every old combat file. It should first build the smallest dispatch → elapsed time → report loop that can be playtested.

If the new loop is not compelling, fix the loop before expanding GPS infrastructure, world simulation, art production, or content volume.