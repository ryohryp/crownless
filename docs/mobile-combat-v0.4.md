# Historical Design Note — Mobile Combat v0.4

> **Superseded.** This document records the earlier AUTO-movement / AUTO-basic-attack mobile experiment.  
> The current combat direction is the **stand-to-strike** model documented in [`game-system-design.md`](game-system-design.md): manual movement, automatic normal attacks while stopped and in range, plus Technique and Evade as high-value actions.

## Original goal

Make Crownless comfortable to play one-handed on a phone without turning combat into a virtual gamepad exercise.

## Experimental control model

- Movement was automatic.
- Basic attacks were automatic.
- The player made two high-value timing decisions:
  - **Technique**: a cooldown-based heavy / build-defining strike.
  - **Evade**: a context-aware dodge with a perfect-evade window.
- Desktop keyboard mirrored the same model with `K` for Technique and `Space` for Evade.

## Readability experiment

- Mobile combat used a closer camera and larger combatants.
- The arena rendered immediately when combat started instead of waiting for the first simulation frame.
- Touch actions were two large thumb-friendly buttons; the old d-pad and light-attack button were removed from the active layout.

## Why this was replaced

The simplified model improved phone readability and removed fiddly virtual controls, but later playtesting showed that fully automatic movement made combat too passive. The combat-lab experiments established a stronger loop:

> move to survive → stop to attack → exploit the punish window

That stand-to-strike loop was subsequently brought into the main expedition combat.

## Ideas retained from this experiment

Several useful ideas survived the control-model change:

- no dedicated light-attack button
- **Technique** and **Evade** remain high-value manual actions
- perfect evades and telegraph interrupts create counter opportunities
- mobile combat still prioritizes large readable targets and controls
- **闘志** is built by strong play
- at 100, the next Technique becomes **決着**
- sound, hit stop, screen shake, and optional vibration reinforce important combat events
