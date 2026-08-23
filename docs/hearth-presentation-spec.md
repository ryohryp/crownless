# Grey Hearth Presentation Spec

> **Status:** current presentation specification  
> **Updated:** 2026-08-23

## 1. Purpose

The Grey Hearth must feel like a **place the player returns to**, not a dashboard shown between expeditions.

The safe hub turns secured progress and accumulated world knowledge into visible state, gives the player small optional things to touch, and makes leaving again feel tempting.

The design loop is:

> **Return → notice what changed → touch the Hearth → review what was learned / secured → choose to leave again**

This presentation strengthens the expedition loop. It must not become a separate management game.

## 2. Current implementation baseline

The Hearth has moved beyond the original v0.1 panel layout into a **scene-first 2D room presentation**.

Current implementation principles:

- the first view should read as one Grey Hearth room rather than a collection of cards
- the Mist Gate is the primary path back into adventure
- the player is an explicit runtime character layer, not a second figure accidentally baked into the room background
- physical objects represent important functions where practical
- detailed lists / panels still exist where precision is needed, but they are subordinate to the room
- subtle fire / mist / light behavior can make the room feel inhabited without turning it into an animation showcase
- desktop and mobile must remain operable without overlap, horizontal scrolling, or missing primary actions

The room remains a presentation layer over authoritative game state.

## 3. Scene composition

The Hearth should read as a dim, poor medieval safe room with a warm center and a dangerous exit.

Visual priority:

1. **Mist Gate / outside temptation** — the clearest actionable destination
2. **Player presence** — the player clearly exists in the room
3. **Fire / warm safety** — the emotional center of survival
4. **Accumulated world and loot state** — wall map, shelf, rumors, recovered objects
5. **Detailed information** — available when needed, but not the dominant first impression

The goal is not a luxurious tavern or RPG menu lobby. It is a used, imperfect shelter that becomes more inhabited as the player survives.

## 4. Background and runtime-layer contract

The current visual implementation separates the room from runtime state.

Rules:

- prefer a Grey Hearth background that does **not** bake in a duplicate player figure
- do not render a second wall map / player / major interactive prop merely because it already exists decoratively in the background
- player, state-sensitive objects, labels, and interactions should be independent runtime layers when their state can change
- background, player, props, annotations, and effects must belong to the same Crownless manuscript / woodcut illustration family
- do not hide illustration-family mismatch with saturation filters, glow, or generic overlays
- new visual assets must follow the repository Visual Canon and Visual Director workflow

The accepted protagonist / actor visual identity is authoritative when the player appears.

## 5. Current room objects and functions

### Mist Gate

- starts the existing expedition flow
- is the clearest persistent CTA
- should visually contrast Hearth safety with the unknown outside
- may carry short known-world hooks near it, but should not become a quest list

### Player figure

- represents the player as the only primary controllable person in the room
- reflects the current character / equipment identity where implemented
- may support small idle or inspection responses
- must visually belong to the same manuscript / woodcut world as the room

### Fire

- communicates safety and habitation
- may support a purely playful interaction such as sparks / ambient line
- does not need a mechanical reward

### Wall map / Discovery Journal

- is the physical home for accumulated world knowledge
- opens the Discovery Journal browser
- reflects that previously discovered places and coarse explored areas remain known
- should not duplicate an always-visible modern map dashboard

### Secured loot shelf / equipment access

- reflects secured possessions / loot state
- provides access to detailed equipment management
- should feel like a physical part of the room before it feels like a menu tile

### Rumor / pursuit presentation

- communicates Named Hunts and other known long-term targets
- should feel like information accumulated in the Hearth, not a live-service quest board

### Regional mission presentation

The Hearth now also hosts discovered regional danger that is ready for a stationary assault.

For the first regional mission, **消えた荷駄隊**:

- outdoor exploration discovers and advances clues
- the final dangerous POI is recorded as world knowledge
- the player must return to the Grey Hearth before deliberately launching the full-combat assault
- the Hearth presentation communicates mission stage / traces and exposes the assault action when ready

This is an important bridge between outdoor discovery and longer at-home combat.

### Recovery cache

- becomes visually meaningful around the 15 Renown milestone
- represents the existing recovery benefit rather than a new management rule

### Forge

- becomes visibly active around the 30 Renown milestone
- represents the existing combat refinement benefit
- is not a crafting-system commitment

## 6. Progression should change the room

Grey Hearth progression should not exist only as numbers and cards.

Current functional milestones:

- **5 Renown — 地図掛け:** one scouting charge at expedition start; the map / accumulated exploration becomes an important room object
- **15 Renown — 回収係:** defeat can recover one additional unsecured item; the recovery cache becomes part of the room
- **30 Renown — 鍛冶火:** modest combat refinement; the forge becomes active

Future Hearth milestones should prefer visible environmental change when practical.

Do not grow this into a large passive skill tree unless playtesting shows that the expedition loop needs it.

## 7. Interaction rule

Not every interaction needs a reward.

Small interactions may exist only to make the Hearth feel inhabited, provided they are cheap, readable, and do not obstruct the main loop.

Examples:

- stir the fire
- inspect the current weapon / player
- hear a short ambient line
- open the map / Discovery Journal
- inspect loot
- check a rumor
- notice a newly active object after progression

These interactions must not turn into required chores, daily-click rewards, or an economy loop.

## 8. UI and annotation rule

The room should avoid looking like a dashboard painted over a background.

Prefer:

- physical object hit regions
- short annotation-like labels
- labels that appear or strengthen on hover / focus / tap when appropriate
- restrained parchment / ink folios for detailed lists
- one clear primary CTA for departure

Avoid:

- several permanent rectangular status cards competing for attention
- duplicated map / inventory / character representations
- glossy mobile-RPG panels
- large blocks of instructional text over the room

Precise inventory / progression detail may live below or in an opened folio. The scene remains the first impression.

## 9. Input and accessibility

Major Hearth interactions must remain usable with:

- mouse
- keyboard focus
- touch

Do not rely on hover alone for essential information.

Decorative motion must respect `prefers-reduced-motion` and should stop or simplify without hiding state.

## 10. Responsive contract

The Hearth must remain coherent on desktop and mobile.

At minimum:

- no horizontal scrolling caused by the scene
- no primary CTA disappears outside the viewport
- the player and major objects do not become unreadable through overlap
- labels do not collide with the player, map, shelf, or major copy
- scene-first composition may simplify on mobile rather than forcing the full desktop arrangement into a narrow viewport

When content grows vertically, safe scrolling is preferable to clipping important actions.

## 11. State authority

The Hearth does not invent gameplay state.

Existing systems remain authoritative for:

- secured loot
- equipped gear
- Renown
- recovery benefits
- forge refinement
- Named Hunt progress
- Discovery Journal / explored areas
- regional mission state
- save / load

Presentation may reorganize how these are seen and touched, but must not create duplicate truth.

## 12. Success criteria

The current Hearth direction is successful when:

- opening the game feels like entering a place rather than reading a dashboard
- the player immediately understands how to leave on an expedition
- the player figure reads as the single player presence rather than a duplicated background character
- the wall map feels connected to accumulated discoveries
- returning with loot / knowledge visibly changes what the player can inspect
- Renown milestones visibly change the room
- a discovered regional danger can be deliberately launched from the Hearth without making outdoor play unsafe or combat-heavy
- small optional interactions make the room feel inhabited
- the scene and annotations remain usable on desktop and phone
- no expedition, equipment, persistence, exploration, or progression behavior regresses

If the room looks richer but slows the player down or hides the next adventure, reduce decoration before adding more systems.