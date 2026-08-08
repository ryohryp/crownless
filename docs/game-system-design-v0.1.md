# Crownless — Game System Design v0.1

## 1. Vision

Crownless is a location-based medieval fantasy action hack-and-slash RPG where real-world movement reveals and expands a dangerous game world.

The experience should feel like an expedition rather than a walking reward app. The player leaves safety, discovers something unknown, fights for valuable loot, and must return alive to make that progress secure.

## 2. Core loop

> Explore → Fight → Loot → Survive → Grow → Explore deeper

Every major system should strengthen at least one part of this loop.

### Explore

Real-world movement reveals game-world locations, routes, rumors, ruins, settlements, dungeons, faction activity, and temporary events.

### Fight

Encounters use direct action controls. Combat should be readable and responsive rather than menu-heavy, while still supporting meaningful equipment and build choices.

### Loot

Enemies and exploration generate weapons, armor, materials, currency, and rare modifiers. Loot should frequently create interesting decisions rather than only increasing a single power number.

### Survive

Unsecured rewards are at risk while the player remains on an expedition. Returning to a safe location converts dangerous progress into permanent progress.

### Grow

The player improves through equipment, combat mastery, character choices, party composition, and access to the wider world.

## 3. Player fantasy

The player begins as an unknown person with no title, class, or weapon.

The opening state is intentionally weak:

- no weapon
- little protection
- limited knowledge of the surrounding world
- no allegiance that defines the player permanently

Bare-handed combat is a real progression path. Finding a sword should be exciting, but equipping it should be a choice rather than an automatic upgrade from an invalid starting style.

## 4. Combat

### Goals

- immediate and understandable controls
- short, punchy encounters during normal exploration
- enough depth for timing, spacing, defense, and build identity
- strong differences between weapon families
- viable unarmed combat

### Initial combat vocabulary

The first prototype should prove a small set of verbs before adding complexity:

- move
- light attack
- heavy attack
- evade / guard
- interact / pick up

Weapon types can alter timing, reach, impact, stamina use, and special behavior without requiring a completely different control scheme.

### Prototype enemy set

Start with a very small enemy roster whose behavior is clearly different:

1. **Rusher** — closes distance and attacks aggressively.
2. **Guard** — blocks frontal attacks and rewards positioning or heavy attacks.
3. **Skirmisher** — maintains distance and forces movement.

Three good enemies are more useful than twenty stat variations during the first playable phase.

## 5. Loot and builds

Equipment is the main source of frequent build experimentation.

An item can be described by:

- equipment type
- base properties
- quality / rarity
- one or more modifiers
- durability or risk properties if later proven fun

The first item system should prioritize modifiers that change play rather than tiny percentage bonuses.

Examples:

- heavy attacks stagger more easily
- successful evades empower the next strike
- unarmed attacks build combo faster
- low-health attacks gain impact at increased risk
- blocking stores power for a counterattack

Avoid designing a giant affix pool until a small set is proven fun in play.

## 6. Expedition and survival

The central tension comes from carrying value that is not yet safe.

### Expedition state

During an expedition, the player can accumulate:

- unsecured loot
- discovered locations
- temporary resources
- injuries or other pressure

### Safe return

Reaching an eligible safe point secures the expedition's rewards and prepares the next run.

The exact penalty for defeat should be tuned through playtests. The important rule is that failure must matter without making players afraid to leave home.

A reasonable prototype model is:

- permanent character progress remains
- equipped core gear is not fully deleted
- some unsecured loot is lost on defeat
- rare recovery opportunities can create a reason to return to the failed expedition area

## 7. Location system

Location is a world-generation and discovery input, not merely a distance counter.

### World abstraction

The real map is transformed into a fantasy layer. Exact real-world businesses or private properties do not need direct one-to-one fantasy equivalents.

The game should operate on safe, coarse regions or cells rather than demanding meter-perfect GPS behavior.

A location cell can contain generated or persistent game entities such as:

- roads
- wilderness
- settlements
- ruins
- dungeon entrances
- faction control
- rumors
- resources
- roaming threats

### Discovery

Travel should reveal unknown information progressively. The map starts incomplete and becomes a record of the player's knowledge.

The game should support simulated movement so core gameplay can be developed and tested from a desk.

## 8. Dungeons

Dungeons are concentrated expedition content inspired by Wizardry's tension and Diablo's reward structure.

They should provide:

- unknown layouts or partially hidden information
- escalating danger
- meaningful decisions about continuing or retreating
- stronger loot deeper inside
- exits or checkpoints that create relief

A dungeon does not need to mirror a physical building. A discovered location in the real world can unlock an abstract dungeon instance that can be played safely.

## 9. Party system

Party play is a core direction, but it should not block the first solo prototype.

Potential party members can provide:

- combat roles
- exploration abilities
- personality and relationships
- faction ties
- injury or loss risk

The long-term goal is for party composition to influence both combat and expedition decisions rather than simply adding passive stats.

## 10. Factions and territory

The world contains competing powers with borders, interests, wars, alliances, and local influence.

Player actions can eventually affect:

- local faction reputation
- access to settlements and services
- regional danger
- quests and rumors
- control of territory

This system should emerge after the exploration/combat/loot loop is proven. Do not build a grand strategy simulation before the moment-to-moment game is fun.

## 11. Progression

Avoid a rigid class choice at character creation.

Character identity should emerge from:

- weapons used
- combat techniques learned
- equipment and modifiers
- companions
- faction relationships
- repeated player choices

The design should allow a player who enjoys fighting bare-handed to continue developing that style at high levels.

## 12. First playable vertical slice

The first playable build should answer one question:

> Is one short Crownless expedition fun enough that the player immediately wants another?

Minimum slice:

1. start at a safe hub
2. select or simulate movement into an unexplored neighboring cell
3. reveal one point of interest
4. enter a short combat encounter
5. defeat 1–3 enemies using simple action combat
6. receive randomized loot with at least one gameplay-changing modifier
7. choose whether to continue or return
8. return safely and secure the loot
9. equip the new item and start another expedition

The prototype may use a simulated map and placeholder visuals. GPS integration is not required to validate this loop.

## 13. Explicit non-goals for the first prototype

Do not prioritize these yet:

- massive seamless world
- real-time multiplayer
- large-scale faction warfare simulation
- hundreds of items or enemies
- elaborate crafting
- monetization systems
- production GPS infrastructure
- sophisticated procedural generation
- photorealistic art

## 14. Success criteria for v0.1 prototype

The prototype is successful when playtesting shows that:

- combat is enjoyable without progression rewards
- finding loot regularly changes what the player wants to try
- carrying unsecured loot creates meaningful tension
- retreating can be a rational and satisfying decision
- discovering the next location creates curiosity
- players voluntarily start another run

If these are not true, add fewer systems and improve the loop rather than expanding scope.
