# Grey Hearth Presentation Spec

> **Status:** current presentation direction / v0.1  
> **Updated:** 2026-08-11

## Purpose

The Grey Hearth must feel like a place the player returns to, not a dashboard shown between expeditions.

The safe hub should turn secured progress into visible world state and give the player small, optional things to touch before leaving again.

The design goal is:

> **Return → notice what changed → touch the Hearth → choose to leave again**

This presentation must strengthen the existing expedition loop rather than become a separate management game.

## v0.1 room objects

The first playable version keeps the implementation deliberately small.

- **Mist Gate:** starts the existing expedition flow.
- **Player figure:** reflects the equipped weapon family and can be clicked for a short idle response.
- **Fire:** purely playful interaction; clicking it throws sparks and produces a short ambient line.
- **Secured loot shelf:** reflects secured-loot count and jumps to the existing equipment list.
- **Wall map:** reflects Hearth Renown and jumps to the existing progression panel.
- **Recovery cache:** becomes visually present at the 15 Renown milestone.
- **Forge:** becomes visibly lit at the 30 Renown milestone.

No new currency, inventory rule, crafting rule, or hub-management loop is introduced in v0.1.

## Progression should change the room

Grey Hearth progression should not exist only as numbers and cards.

Current visual milestones:

- **5 Renown — 地図掛け:** the wall map becomes readable and marked.
- **15 Renown — 回収係:** a recovery crate appears as a lived-in part of the room.
- **30 Renown — 鍛冶火:** the forge becomes visibly active.

Future Hearth milestones should prefer visible environmental change when practical.

## Interaction rule

Not every interaction needs mechanical reward.

Small interactions may exist only to make the Hearth feel inhabited, provided they are cheap, readable, and do not obstruct the main loop.

Examples:

- stir the fire
- inspect the current weapon
- hear a short ambient line
- notice a new object after progression

These interactions must not turn into required chores or daily-click reward systems.

## Presentation rule

The Hearth should read as a dim medieval safe room with a warm center and a dangerous exit.

Priority order:

1. Mist Gate is the clearest actionable destination.
2. Player and fire make the room feel alive.
3. Secured loot and Renown are represented by physical objects.
4. Detailed lists remain available below the room for precise inventory and progression management.

The room is a presentation layer over existing state. Existing gameplay state remains authoritative.

## Success criteria

The v0.1 Hearth is successful when:

- opening the game feels like entering a game space rather than reading a dashboard
- the player immediately understands how to start an expedition
- clicking around reveals small responses even when no progression action is required
- returning with loot visibly changes the shelf state
- Renown milestones visibly change the room
- no existing expedition, equipment, persistence, or progression behavior regresses

If the room looks richer but slows the player down, reduce decoration before adding more systems.
