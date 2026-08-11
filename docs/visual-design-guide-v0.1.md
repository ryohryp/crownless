# Crownless — Visual Design Guide v0.1

> **Status:** global visual baseline / living document  
> **Created:** 2026-08-12  
> **Scope:** Grey Hearth, exploration, combat, inventory, reports, future image-generation references

This document defines the global visual language for Crownless. It does not replace the gameplay or subsystem specifications. It exists to make every screen feel like the same game while keeping the art direction achievable for a small prototype.

When this guide conflicts with gameplay behavior, the canonical gameplay and subsystem specifications remain authoritative:

- `game-system-design.md` for current gameplay rules
- `exploration-location-spec.md` for map / location exploration
- `combat-presentation-spec.md` for combat camera, HUD, and combat readability
- `hearth-presentation-spec.md` for Grey Hearth presentation

The central visual goal is:

> **A harsh medieval world rendered with restrained stylization, strong readability, and small moments of warmth — not photorealism, not ornate mobile-ARPG spectacle.**

---

## 1. Crownless visual identity

Crownless should feel like a world where the player begins with almost nothing and slowly earns safety, knowledge, equipment, and status.

The visual language should reinforce four states across the entire game:

- **Unknown = fog / cold grey / low information**
- **Danger = muted blood red / hard contrast / directional warning**
- **Secured safety = ember / warm amber / physical presence**
- **Earned significance = restrained gold / clear emphasis**

This creates a consistent emotional grammar:

> **cold world → dangerous decision → survive → bring warmth home**

The game should not look luxurious at the beginning. The world and UI may become slightly richer as the player progresses, but visual progression should feel earned rather than given by default.

### Keywords

Use these words when evaluating any new visual:

- weathered
- readable
- grounded
- restrained
- physical
- dangerous
- lived-in
- warm only where safety has been earned

Avoid visuals that are primarily:

- glossy
- ornate
- heroic-by-default
- photorealistic
- neon
- over-particle-heavy
- menu-dense

---

## 2. Rendering style

### Target style

Use a **stylized 2D / 2.5D medieval-fantasy presentation** with enough depth to make places and combat feel physical.

The desired result is not a realistic 3D render. It should look like a deliberately designed game scene whose shapes remain readable at phone size.

Preferred characteristics:

- simplified materials rather than physically accurate surfaces
- strong silhouettes
- limited texture frequency
- broad light and shadow shapes
- slightly exaggerated pose, weapon, and hit readability
- restrained environmental detail
- painterly / illustrative atmosphere without requiring hand-painted production assets
- depth created through projection, scale, overlap, shadows, lighting, and layering

### Explicitly avoid

- photorealistic characters or environments
- cinematic Unreal-style rendering as the visual target
- detailed skin, pores, cloth simulation, or realistic metal shaders
- tiny high-frequency environment clutter
- ultra-detailed armor that disappears at gameplay scale
- dramatic depth of field that hides gameplay information
- heavy bloom or lens effects

### Prototype implementation rule

The first playable slices must not require a new 3D engine or production art pipeline.

If the same visual idea can be expressed with:

- CSS / DOM layers
- simple sprites
- flat shapes
- pseudo-3D projection
- shadows
- transforms
- limited particles

prefer that approach first.

The question is not “can this look like a AAA game?” but:

> **Can the player read the state, feel the action, and want to play another expedition?**

---

## 3. Shape language

Crownless should use a consistent shape vocabulary.

### World shapes

- stone: broad, irregular, low-detail masses
- wood: simple beams, carts, shelves, doors, crates
- metal: sparse accents and weapon silhouettes
- cloth: broad banners, wraps, cloaks; avoid tiny folds
- fog / mist: soft masses used for unknown space and thresholds
- fire / ember: localized warm animation, not a full-screen color grade

### UI shapes

Prefer:

- thin rectangular frames
- narrow dividers
- subtle inset panels
- slightly worn / imperfect-feeling spacing and texture
- circles only where circular interaction genuinely helps, especially touch combat actions

Avoid:

- thick decorative fantasy frames around every panel
- giant beveled gold borders
- jewel-like chrome
- many different corner-radius styles
- excessive floating cards

A UI panel should feel closer to a practical field ledger, map board, iron plate, or dark work surface than a royal interface.

---

## 4. Color system

The current prototype palette is the baseline and should be preserved unless playtesting creates a concrete readability problem.

### Core tokens

| Semantic role | Token / value | Use |
|---|---|---|
| Deep background | `#080807` | deepest world / UI background |
| Dark panel | `rgba(20, 18, 15, 0.93)` | primary panels |
| Secondary panel | `rgba(30, 26, 20, 0.92)` | raised / nested surfaces |
| Paper text | `#eadcc2` | primary readable text |
| Muted text | `#9f9584` | secondary explanation |
| Dim text | `#6f685d` | low-priority metadata |
| Earned gold | `#c9a35d` | important state / labels |
| Bright gold | `#f0c772` | strongest positive emphasis / focus |
| Threat red | `#b34f43` | danger / health / hostile state |
| Hot red | `#e56a58` | urgent hostile emphasis |
| Field green | `#839a79` | safe / stable / natural support state |
| Hearth warm | `#d5a35a` | Grey Hearth warmth |

### Semantic rule

Color must communicate state, not decorate everything.

- **Gold** is earned. Do not use it on every border.
- **Red** means danger, damage, hostility, or serious commitment.
- **Amber** belongs to hearth, fire, secure progress, and human warmth.
- **Grey / black** is the default world and UI field.
- **Green** is supporting information, not the game's dominant color.

Do not introduce multiple saturated rarity colors until the item system actually needs them. If rarity can be read with shape, border treatment, name weight, or one controlled accent, prefer that over a rainbow palette.

---

## 5. Light and atmosphere

Lighting is part of the game's information design.

### Global rule

The world is generally dim and desaturated, but **not so dark that enemies, routes, or interactable objects disappear**.

Use local light to tell the player what matters.

Examples:

- Grey Hearth fire = safe center
- Mist Gate = cold uncertain threshold
- dangerous POI = darker mass plus readable warning accent
- loot after victory = small focused reveal
- forge milestone = new warm light physically appearing in the room

### Contrast hierarchy

The player character, immediate threat, telegraph, and actionable object should have stronger contrast than background decoration.

When a scene looks beautiful but the player cannot instantly answer “what should I look at?”, simplify it.

---

## 6. Character and enemy presentation

Characters are viewed at gameplay scale, so silhouette matters more than costume detail.

### Player

The player begins as an unknown, poorly equipped person.

The baseline visual should communicate:

- no heroic crown or royal armor
- simple clothing and protection
- equipment visibly changing the silhouette over time
- bare-handed combat looking intentional rather than unfinished

Fists, dagger, and sword should be distinguishable by pose and rhythm before the player reads a label.

### Enemy roles

Enemy role must be readable from body shape and motion.

- **Rusher:** forward lean, aggressive approach, compact silhouette
- **Guard:** wider stance, heavier frontal shape, obvious defensive posture
- **Skirmisher:** open spacing, ranged silhouette, clearer attack direction

Do not rely on color alone to distinguish roles.

### Proportion

Use slightly stylized proportions rather than realism. Hands, weapons, stance, and motion may be exaggerated enough to remain readable on a phone.

Avoid chibi proportions and avoid realistic tiny anatomy.

---

## 7. Environment density

The environment should make the battlefield or map feel like a place without becoming visual noise.

Good environment elements include:

- broken walls
- paths
- rubble groups
- carts
- crates
- shelves
- fire
- gates
- map boards
- simple landmarks

Use **clusters**, not evenly distributed clutter.

Leave quiet visual areas around important gameplay state.

A useful rule for the prototype:

> **One memorable environmental idea is better than ten decorative props.**

---

## 8. Typography

The current prototype direction remains valid:

- restrained serif character for the Crownless brand and large display moments
- practical sans-serif for body text, numbers, status, and interaction labels

Japanese text must prioritize legibility over matching an English serif exactly.

### Hierarchy

Use roughly four textual levels:

1. screen / place title
2. important state or object name
3. explanatory body text
4. small metadata

Avoid putting large flavor paragraphs over active game space.

During exploration and combat, spatial change should carry more meaning than text.

---

## 9. Icons

Icons should be simple silhouettes with consistent stroke / fill behavior.

Good icon subjects:

- weapon family
- danger
- route / map
- secured / unsecured state
- Technique
- Evade
- return / retreat

Avoid highly detailed heraldry at small sizes.

Where text is clearer than an unfamiliar icon, use text. The current **技** and **回避** labels are acceptable and should not be replaced merely for visual novelty.

---

## 10. Motion and effects

Crownless combat should feel physical rather than magical-by-default.

### Normal actions

Prefer:

- hit stop
- knockback
- small dust bursts
- weapon trail only when needed for direction
- brief sparks
- short screen shake
- readable stagger

Avoid turning every normal attack into a large glowing arc.

### Technique / 決着

Technique may be visibly stronger, but its effect must still show:

- who was hit
- attack direction
- resulting movement
- remaining danger

**決着** can temporarily break the restraint more than ordinary attacks, because the player earned that payoff.

### Ambient motion

Use low-cost motion to make spaces feel alive:

- fire flicker
- drifting fog
- hanging cloth movement
- small dust / ash
- subtle map reveal

Do not animate every element at once.

---

## 11. Global UI hierarchy

The gameplay world is primary. UI exists to expose decisions.

### Always ask

Before adding a permanent HUD element:

> **What decision becomes impossible or meaningfully harder without this?**

If there is no strong answer, do not keep it permanently visible.

### Preferred hierarchy

1. world / arena / map
2. immediate actionable state
3. player survival state
4. contextual controls
5. details on demand

This means Crownless should generally avoid “mobile RPG dashboard syndrome.”

---

## 12. Grey Hearth visual rules

The Grey Hearth is the warmest space in the game, but it should remain humble.

Core composition:

- dim room
- warm fire near the emotional center
- Mist Gate as the clearest exit / action
- player visibly present
- secured loot shown physically
- Renown progression reflected by room changes

The Hearth should feel increasingly inhabited as progress becomes safe.

Do not turn it into:

- a grid of feature buttons
- a management dashboard
- a bright fantasy tavern full of decorative NPCs before the systems need them

The visual story is:

> **This place was almost empty. You survived, and now it contains evidence of your life.**

---

## 13. Exploration visual rules

The map is the primary exploration surface.

### Map states

The visual treatment should clearly distinguish:

- unknown territory
- frontier hint
- discovered place
- investigated place
- cleared / changed place
- known high-risk place
- safe Hearth

Unknown space should feel inviting, not merely disabled.

Use fog, broken edge information, silhouettes, smoke, tracks, faint paths, or partial landmarks to create curiosity.

### Real-world relationship

The fantasy map should feel regionally influenced without becoming a literal street map.

The player should feel:

> **“I discovered this fantasy place by moving through the real world.”**

not:

> **“This is Google Maps with monster icons.”**

---

## 14. Combat visual rules

Combat uses the fixed oblique top-down battlefield direction.

### Camera

- compact fixed arena first
- three-quarter / diagonal overhead view
- enough elevation to read spacing
- enough body visibility to read stance and knockback
- no free camera rotation or zoom requirement for the first slice

### Mobile controls

The current combat contract remains authoritative:

- drag on the arena to move
- stop to normal attack automatically
- large **技** button
- large **回避** button

Do **not** add by default:

- virtual joystick
- dedicated light-attack button
- large skill cluster
- combat minimap
- party portrait stack
- consumable hotbar

A generated concept image that includes those elements is wrong for the current game even if it looks polished.

### HUD

Keep visible only what supports combat decisions:

- HP
- 闘志 / 決着 state when relevant
- Technique availability
- Evade availability
- essential enemy telegraphs / health cues

The center belongs to the fight.

### Drops

Temporary battlefield weapons must remain physically readable during the fight.

Expedition loot stays quiet until victory, then gets a clear reward moment.

---

## 15. Inventory, loot, and report screens

These screens may be denser than combat, but should still feel grounded in the same visual system.

### Item presentation

An item should communicate in this order:

1. weapon / equipment type
2. stronger, different, or both
3. playstyle identity
4. rarity / significance
5. detailed modifier text

Do not make rarity color the only way to understand value.

### Return / defeat reports

Reports should visually distinguish:

- what became safe
- what remained unsecured
- what was lost
- what changed in the Hearth
- what new lead opened

A successful return should feel warmer and more settled than an expedition screen.

A defeat should feel cold and regrettable, but not visually catastrophic or punitive enough to make the player afraid to try again.

---

## 16. Crownless composition signature

Across screens, favor this composition pattern:

> **large playable / spatial surface + one strong focal action + restrained peripheral information**

Examples:

- Hearth: room + Mist Gate + small object labels
- Exploration: map + frontier / POI + contextual action
- Combat: arena + Technique / Evade + minimal bars
- Loot: item silhouette + comparison + one decision

This is the opposite of building every screen from a stack of equally weighted cards.

---

## 17. Image-generation contract

Any future concept-art or UI image prompt for Crownless should include the global style constraints below unless the task deliberately explores an alternative.

### Required direction

- stylized 2D / 2.5D medieval fantasy game screen
- readable at mobile size
- restrained detail
- strong silhouettes
- dark weathered world with localized warm light
- current Crownless muted black / paper / amber / red palette
- indie-prototype-realistic scope
- gameplay readability over cinematic realism

### Required negative constraints

Explicitly state:

- **not photorealistic**
- **not realistic AAA 3D rendering**
- **not glossy mobile fantasy UI**
- **no oversized decorative gold frames**
- **no excessive particle spectacle**

For combat images also state:

- fixed oblique top-down battlefield
- drag-to-move implied
- stop-to-auto-strike gameplay
- only **技** and **回避** as major touch actions
- **no virtual joystick**
- **no light-attack button**
- **no skill cluster**
- **no combat minimap**

Generated art is a reference for composition, mood, silhouette, and information hierarchy. It is not allowed to silently redefine game controls or systems.

---

## 18. Implementation budget rule

For the current prototype, every visual feature should pass this test:

> **Can we approximate the idea cheaply enough to playtest it before investing in a production asset pipeline?**

Prefer:

- reusable tokens
- CSS variables
- shared panel treatments
- shared icon grammar
- simple sprite silhouettes
- procedural / CSS atmosphere
- one clear effect per important event

Avoid creating a large bespoke asset dependency for a feature whose gameplay value is still unknown.

---

## 19. Review checklist

Before accepting a new Crownless screen, answer:

1. Does it look like the same game as the Grey Hearth, exploration map, and combat?
2. Is the world or playable surface more visually important than the UI chrome?
3. Can the main action be identified within a second?
4. Are important states readable without relying on tiny text?
5. Is gold used sparingly enough to remain meaningful?
6. Is red reserved for real danger / damage / commitment?
7. Are environment details grouped so they do not create clutter?
8. Does the scene avoid photorealistic / AAA expectations the prototype cannot support?
9. Does the UI reflect actual gameplay instead of generic ARPG conventions?
10. Could the current prototype approximate this without an engine rewrite?
11. Does the screen reinforce exploration → combat → loot → return rather than distract from it?
12. Does it make the player want to touch, move, fight, inspect, or leave again?

If several answers are “no,” simplify before adding detail.

---

## 20. v0.1 design statement

The working visual statement for Crownless is:

> **汚れた中世世界 × 読みやすい2.5D × 控えめなUI × 物理的で小気味よいアクション。**
>
> **世界は冷たい。生還して持ち帰ったものだけが、灰炉に少しずつ暖かさを増やしていく。**

This is the baseline for the next visual passes. The guide should evolve through actual prototype play rather than speculative art expansion.
