# Crownless — Combat Presentation Specification

> **Status:** current combat presentation specification  
> **Updated:** 2026-08-11  
> This document defines the current camera, battlefield presentation, HUD, and loot-readability direction for combat. It complements [`game-system-design.md`](game-system-design.md). The stand-to-strike combat model in the game-system design remains authoritative for controls and combat logic; when a generic presentation description conflicts with this document, this subsystem specification takes precedence for camera, HUD, visual readability, and combat loot presentation.

## 1. Goal

Combat should feel immediate, physical, and spatially readable on a phone while preserving the atmosphere and loot satisfaction of a medieval fantasy action RPG.

The target presentation is a **fixed oblique top-down combat view**:

> **a diagonal, elevated view of a compact battlefield where the player can immediately read enemies, escape space, telegraphs, impact, and dropped objects.**

The purpose of the camera is not visual novelty. It exists to strengthen the current combat loop:

> **move to survive → stop to attack → read the enemy → commit Technique / Evade → exploit the opening**

The view should make positioning itself fun to read.

## 2. Camera direction

### Oblique top-down view

Use a three-quarter / diagonal overhead presentation rather than a flat side view or near-vertical top-down view.

The first prototype should favor:

- enough elevation to understand enemy spacing and paths
- enough angle to see character bodies, attacks, knockback, and environment depth
- a battlefield that reads as a place rather than a flat diagram
- strong silhouettes even when several combatants overlap

Do not over-specify a final camera pitch before playtesting. A practical prototype range is acceptable; the deciding test is combat readability and feel, not matching a particular numeric angle.

### Fixed battlefield camera first

For the next iteration:

- the camera is anchored to the compact combat instance
- free camera rotation is not required
- pinch zoom is not required
- camera-follow behavior should not make dropped objects or scenery appear to slide relative to the battlefield
- combatants move within a stable arena composition

A fixed camera keeps the first implementation small and makes spatial cause-and-effect easier to read.

### Visual depth without rewriting the simulation

The first implementation does **not** require a 3D engine or a new world simulation.

Prefer the smallest technique that produces a convincing oblique battlefield while preserving deterministic combat logic. The simulation may remain on its current logical plane while rendering uses projection, scaling, layering, shadows, or transformed coordinates to create depth.

Do not rebuild combat architecture solely to achieve the camera angle.

## 3. Control contract

Changing the camera does not automatically change the current controls.

The current combat contract remains **stand-to-strike**:

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

Important constraints:

- do not add a dedicated light-attack button merely because a concept image shows one
- do not add a virtual joystick by default merely because it is conventional for mobile ARPGs
- preserve the move / stop decision unless playtesting shows the oblique view makes the current input model worse
- Technique and Evade remain the high-value explicit combat actions

Camera and controls should be tested together, but they are separate design decisions.

## 4. Battlefield composition

The battlefield should be compact enough that the player can understand the important fight state without excessive camera movement.

The player should be able to identify at a glance:

- their own position
- the closest threat
- enemies approaching from other directions
- telegraphed danger zones or attack lines
- open space for escape or repositioning
- temporary battlefield weapons
- whether Technique and Evade are available

Environment art should support this reading rather than compete with it.

Useful battlefield elements include:

- broken walls
- paths
- rubble
- barrels / carts / debris
- dungeon edges
- small elevation cues
- torches, braziers, or other local light sources

These elements may create visual identity, but the first slice should avoid complex navigation, hidden collision, or decorative clutter that makes enemy movement harder to understand.

## 5. Mobile HUD direction

The combat HUD should be **lighter than a conventional full-featured mobile ARPG HUD**.

The center of the screen belongs to combat.

### Keep visible

At minimum, combat should expose:

- player HP
- 闘志 / 決着 state when relevant
- Technique availability
- Evade availability
- essential enemy telegraphs and health state where needed for decisions

### Keep out unless proven necessary

Do not add these to the first oblique-view iteration by default:

- large party portrait stacks
- permanent minimap during a compact combat instance
- several consumable shortcut buttons
- auto-battle controls
- large quest text occupying combat space
- multiple skill buttons before the combat model actually supports those decisions
- persistent item-name labels covering the battlefield

The generated concept art that inspired the view is a **camera and mood reference**, not a literal HUD specification.

### Phone layout

For phone play:

- movement interaction should remain on / through the arena
- **技** and **回避** should remain large and thumb-readable
- controls should stay near screen edges
- controls must not cover common enemy approach lanes
- central combat space should remain visually open

Desktop may expose keyboard hints more lightly because persistent touch targets are unnecessary.

## 6. Readability rules

Combat should be understandable without reading floating numbers.

Prioritize:

- enemy silhouettes
- clear facing / attack direction
- telegraphs that remain readable against the environment
- character shadows or grounding cues so positions do not appear to float
- reliable draw ordering / overlap behavior
- visible stagger and knockback
- distinct player / enemy impact feedback
- attack effects that show direction and reach

The oblique angle must not introduce ambiguous hit positions. The rendered body, its shadow / ground contact, and the logical collision position should feel consistent.

If visual depth makes the true hit area confusing, simplify the projection before adding more effects.

## 7. Combat feel in the oblique view

The view should make physical reactions more satisfying, not merely prettier.

Retain and tune:

- hit stop
- knockback
- stagger / fall states
- impact particles
- limited screen shake
- audio feedback
- optional vibration on supported devices

A strong hit should visibly move an enemy through battlefield space.

Effects must remain subordinate to readability. A Technique can be dramatic, but the player should still understand who was hit, where enemies moved, and what danger remains afterward.

## 8. Loot and dropped-object presentation

Crownless has two different classes of combat drops and they should not be visually confused.

### Temporary battlefield weapons

Battlefield weapons are immediate combat state.

They should:

- remain visible during combat
- be clearly distinguishable from scenery
- communicate weapon type without requiring a large text label
- remain spatially anchored to the battlefield
- be usable through the current pickup behavior without adding a dedicated pickup button

These drops exist to enable improvisation during the fight.

### Expedition loot

Persistent / unsecured expedition loot is reward state, not an immediate combat decision.

During active combat:

- use a compact glow, beam, silhouette, rarity cue, or pickup marker
- avoid large item-name cards over the battlefield
- avoid a dense "label carpet" that hides enemies or telegraphs

After victory:

- reveal the full item name and rarity clearly
- allow the player to understand what was gained
- make the transition from **fight** to **loot** feel satisfying

The preferred rhythm is:

> **fight stays readable → victory creates a breath → loot gets its moment**

## 9. First implementation slice

The first oblique-view implementation should reuse as much current combat logic as possible.

Minimum scope:

1. render one existing combat arena in the oblique view
2. preserve current movement and stand-to-strike behavior
3. preserve existing enemy roles and telegraphs
4. make player / enemy positioning and overlap readable
5. preserve Technique, Evade, hit stop, knockback, and 闘志 / 決着
6. show battlefield weapon drops correctly in the projected space
7. reduce combat HUD to the elements required for decisions
8. keep persistent loot presentation quiet until victory
9. playtest before adding additional camera systems or controls

Do not require new weapon families, a new skill tree, a party system, or a production art pipeline for this pass.

## 10. Playtest questions

The prototype is moving in the right direction when a player can answer these without consciously parsing the UI:

- Where am I?
- Which enemy is threatening me now?
- Where can I move safely?
- What attack is being telegraphed?
- Did my hit connect?
- Where did the enemy get knocked?
- Can I safely stop and attack now?
- Are Technique and Evade available?
- Is that dropped object something I can use during the fight?
- After victory, what did I actually gain?

More importantly:

> **Does moving, stopping, striking, and knocking enemies around in this view feel better than the current presentation?**

If the answer is no, improve the camera and combat feel before adding more combat systems.

## 11. Explicit non-goals for this pass

Do not prioritize:

- free camera rotation
- complex zoom controls
- a full 3D engine migration
- elaborate environmental collision
- a large mobile skill-button cluster
- joystick + attack-button controls unless playtesting demonstrates they are better
- party HUDs
- combat minimap systems
- production-quality 3D assets
- large quantities of new enemies or gear

The goal is to prove that the **oblique battlefield itself makes the existing combat more readable and more satisfying**.
