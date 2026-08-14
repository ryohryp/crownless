# Crownless — Combat Presentation Specification

> **Status:** current combat presentation specification  
> **Updated:** 2026-08-14  
> This document defines the current camera, battlefield presentation, HUD, actor rendering, combat-asset validation, overlap behavior, and loot-readability direction for combat. It complements [`game-system-design.md`](game-system-design.md). The stand-to-strike combat model in the game-system design remains authoritative for controls and combat logic; this file takes precedence for camera, HUD, visual readability, actor presentation, and combat loot presentation.

## 1. Goal

Combat should feel immediate, physical, and spatially readable on a phone while preserving the atmosphere and loot satisfaction of a medieval fantasy action RPG.

The target presentation is a **fixed oblique top-down combat view**:

> **a diagonal, elevated view of a compact battlefield where the player can immediately read enemies, escape space, telegraphs, impact, and dropped objects.**

The camera exists to strengthen the current combat loop:

> **move to survive → stop to attack → read the enemy → commit Technique / Evade → exploit the opening**

The view should make positioning itself fun to read.

## 2. Camera direction

### Oblique top-down view

Use a three-quarter / diagonal overhead presentation rather than a flat side view or near-vertical top-down view.

Favor:

- enough elevation to understand enemy spacing and paths
- enough angle to see character bodies, attacks, knockback, and environment depth
- a battlefield that reads as a place rather than a flat diagram
- strong silhouettes when several combatants overlap

Do not over-specify a final camera pitch before playtesting. The deciding test is combat readability and feel.

### Fixed battlefield camera first

For the current prototype:

- the camera is anchored to the compact combat instance
- free camera rotation is not required
- pinch zoom is not required
- camera-follow behavior must not make dropped objects or scenery appear to slide relative to the battlefield
- combatants move within a stable arena composition

### Visual depth without rewriting the simulation

The simulation may remain on its current logical plane while rendering uses projection, scaling, layering, shadows, or transformed coordinates to create depth.

Do not rebuild combat architecture solely to achieve the camera angle.

## 3. Control contract

Changing the camera does not change the current stand-to-strike controls.

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

Do not add a light-attack button, virtual joystick, large skill cluster, or other conventional ARPG controls merely because the camera resembles an ARPG.

## 4. Battlefield composition

The battlefield should be compact enough that the player can identify at a glance:

- their own position
- the closest threat
- enemies approaching from other directions
- telegraphed danger zones or attack lines
- open space for escape or repositioning
- temporary battlefield weapons
- whether Technique and Evade are available

Environment art should support this reading rather than compete with it.

Useful battlefield elements include broken walls, paths, rubble, carts, debris, dungeon edges, elevation cues, torches, and braziers. Keep them subordinate to combat readability.

## 5. Mobile HUD direction

The combat HUD should be **lighter than a conventional full-featured mobile ARPG HUD**. The center of the screen belongs to combat.

### Keep visible

At minimum:

- player HP
- 闘志 / 決着 state when relevant
- Technique availability
- Evade availability
- essential enemy telegraphs and health state where needed for decisions

### Keep out unless proven necessary

- large party portrait stacks
- permanent minimap
- several consumable shortcut buttons
- auto-battle controls
- large quest text occupying combat space
- multiple unsupported skill buttons
- persistent item-name label carpets

### Enemy HUD hierarchy

Enemy silhouette is primary. Floating HUD exists only to resolve information the silhouette cannot communicate clearly enough.

Current priority:

1. nearest / currently relevant enemy and bosses may show **name + HP**
2. non-priority ordinary enemies should prefer **compact HP only**
3. telegraphing or otherwise decision-critical enemies may temporarily receive stronger emphasis
4. if labels crowd, simplify or relocate HUD before changing combatant simulation positions for UI reasons

The goal is not to guarantee every enemy name is visible at every instant. The goal is to make the important threat readable without turning the battlefield into text.

## 6. Readability and overlap rules

Combat should be understandable without reading floating numbers.

Prioritize:

- enemy silhouettes
- clear facing / attack direction
- telegraphs that remain readable against the environment
- character shadows / grounding cues
- reliable draw ordering
- visible stagger and knockback
- distinct impact feedback
- attack effects that show direction and reach

### Depth ordering contract

The oblique battlefield needs stable painter-style overlap.

For ordinary ground-bound actors:

- derive ordering from the actor's projected **foot / ground contact**, not head position or raw sprite box
- draw smaller / farther screen-ground Y first and larger / nearer screen-ground Y later
- use a stable tie-breaker when two actors share nearly the same ground Y so they do not flicker frame-to-frame
- dead / falling actors that remain visible should participate in the same ordering until their presentation ends
- do not use static enemy-array order as visual depth order

This is a presentation rule only; it must not reorder simulation updates or change AI behavior.

### Crowded enemy HUD contract

When multiple enemies collapse into one visual cluster:

- treat each enemy HUD as a **rectangle with real width and height**, not just a point
- avoid both other HUD rectangles and the nearby actor silhouette / head region
- first use small vertical lanes above the actor
- if vertical lanes still collide, use restrained horizontal nudges
- keep the HP background and its filled portion locked to the same resolved HUD placement
- reset collision occupancy once per frame
- avoid large leader lines or speech-bubble UI unless later playtesting proves necessary

A crowded encounter should remain readable at phone size with three ordinary enemies overlapping.

## 7. Actor rendering contract

The accepted combat actors are illustrated **3–3.5-head folk-doll figures**. Their authored proportions and authored camera view must survive runtime rendering unchanged.

### Source-art viewpoint

Combat actors must be authored for the gameplay camera:

- oblique top-down / three-quarter view
- visible top planes of head / shoulders / equipment as appropriate
- grounded feet and battle-ready posture
- less front-facing portrait information than a standing character illustration

Do not take a front-facing standing portrait and rely on renderer skew, squash, or stretching to make it look top-down.

### Runtime transform

The battlefield and actor body use different transform rules:

1. logical world position is projected onto the oblique battlefield
2. the projected point represents the actor's **feet / ground contact**
3. the illustrated actor body is drawn above that point in screen space with **uniform X/Y scale**

Therefore:

- project actor **position**, not actor anatomy
- do not apply floor-plane squash, skew, or non-uniform perspective scaling to the sprite body
- do not independently stretch width and height
- preserve the visible aspect ratio of the accepted source artwork
- use alpha / visible-content bounds or tightly trimmed source sprites when calculating size
- do not use raw square PNG canvas dimensions as apparent character size
- transparent padding must not make an actor smaller or thinner
- use an authored pivot where available; otherwise use bottom-center of visible content bounds as the foot anchor
- keep foot anchor and grounding shadow aligned with the logical combat position
- preserve role-specific visible widths: Guard broad, Rusher compact / forward-driven, Skirmisher narrower / ranged

If a correct source actor appears tall/thin, squat/wide, compressed, skewed, or otherwise differently proportioned on device, treat that as a renderer bug rather than an art problem.

## 8. Combat asset integrity contract

Visual defects can come from the renderer **or from the PNG itself**. Diagnose before compensating.

For any new or replaced combat actor PNG:

- verify the PNG can actually be decoded, not merely that the file exists
- verify expected bit depth / supported color format when relevant to the runtime pipeline
- verify it contains a meaningful amount of non-transparent image data
- inspect visible alpha bounds so accidental near-empty or implausibly narrow silhouettes fail review
- do not use compressed file byte size as the primary validity test; valid images can compress very differently
- if a sprite shows colored garbage, missing limbs, only a shadow / label, or an implausibly tiny visible region, inspect the source PNG before modifying the renderer

When an actor asset is changed, add or extend integrity coverage appropriate to that asset instead of relying only on visual memory.

## 9. Combat effects

Retain and tune:

- hit stop
- knockback
- stagger / fall states
- impact particles
- limited screen shake
- audio feedback
- optional vibration

Crownless effects use physical ink language:

- normal attack: short black ink slash
- stronger attack / Technique: larger black brush stroke, ink splash, broken hatch
- danger: restrained hand-drawn vermilion arc / circle / directional mark

Effects must remain subordinate to role silhouettes and telegraphs.

Presentation layers must not infer hit events purely from prototype fill colors when the real game state or explicit event can be used. Color-remapping is acceptable for presentation; gameplay-event inference from drawing color is brittle and should be avoided.

## 10. Loot and dropped-object presentation

### Temporary battlefield weapons

Battlefield weapons are immediate combat state. They should remain visible, distinguishable from scenery, spatially anchored, and usable through the existing move-over-and-stop pickup behavior without a new button.

### Expedition loot

Persistent / unsecured expedition loot is reward state, not an immediate combat decision.

During combat, keep it visually quiet. After victory, let loot receive its full reveal.

Preferred rhythm:

> **fight stays readable → victory creates a breath → loot gets its moment**

## 11. Phone-size acceptance check

Every actor integration, renderer, HUD, overlap, or combat-asset pass must include an actual phone-size screenshot or equivalent viewport review.

Check at minimum:

- player and enemy proportions match accepted source art
- authored oblique viewpoint still reads correctly
- feet and shadow agree with logical ground point
- near/far actor overlap follows foot-Y depth ordering
- Guard / Rusher / Skirmisher remain distinguishable in a three-enemy cluster
- priority enemy name / HP remains readable
- non-priority labels do not create a carpet
- HUD rectangles do not cover role-defining faces, shields, bows, or telegraphs unnecessarily
- effects do not obscure role-defining shape
- actor PNGs are visibly intact with no corruption / unexpected transparency

Do not approve from source PNG inspection or desktop-only review.

## 12. First implementation slice / current proven baseline

The current oblique-view baseline should preserve:

1. existing combat simulation and stand-to-strike behavior
2. fixed oblique battlefield
3. accepted 3–3.5-head actor art authored for the oblique view
4. screen-space uniform sprite rendering with stable foot anchors
5. foot-Y depth ordering for actor overlap
6. collision-aware enemy HUD placement
7. simplified non-priority enemy labels
8. Technique, Evade, hit stop, knockback, 闘志 / 決着
9. temporary battlefield weapon drops
10. quiet combat loot presentation until victory
11. asset integrity checks for changed combat actor PNGs
12. phone-size playtest before further camera or HUD expansion

## 13. Playtest questions

The prototype is moving in the right direction when a player can answer these without consciously parsing the UI:

- Where am I?
- Which enemy is threatening me now?
- Which enemy is in front when bodies overlap?
- Where can I move safely?
- What attack is being telegraphed?
- Did my hit connect?
- Where did the enemy get knocked?
- Can I safely stop and attack now?
- Are Technique and Evade available?
- Is that dropped object usable during the fight?
- After victory, what did I gain?
- Do the actors still look like the accepted source art rather than stretched or front-facing pasted portraits?

More importantly:

> **Does moving, stopping, striking, and knocking enemies around in this view feel better than the previous presentation?**

If not, improve readability and feel before adding more combat systems.

## 14. Explicit non-goals for this pass

Do not prioritize:

- free camera rotation
- complex zoom controls
- 3D-engine migration
- elaborate environmental collision
- large mobile skill-button clusters
- joystick + attack-button controls unless playtesting demonstrates they are better
- party HUDs
- combat minimap systems
- production-quality 3D assets
- large quantities of new enemies or gear

The goal is to prove that the **oblique battlefield makes the existing combat more readable and satisfying without distorting actor art or covering the fight in UI**.
