# Mobile Combat v0.4

## Goal

Make Crownless comfortable to play one-handed on a phone without turning combat into a virtual gamepad exercise.

## Control model

- Movement is automatic.
- Basic attacks are automatic.
- The player makes two high-value timing decisions:
  - **Technique**: a cooldown-based heavy / build-defining strike.
  - **Evade**: a context-aware dodge with a perfect-evade window.
- Desktop keyboard mirrors the same model with `K` for Technique and `Space` for Evade.

## Readability

- Mobile combat uses a closer camera and larger combatants.
- The arena is rendered immediately when combat starts instead of waiting for the first simulation frame.
- Touch actions are two large thumb-friendly buttons; the old d-pad and light-attack button are removed from the active layout.

## Design intent

The interesting mobile decision should be *when to commit a technique and when to evade*, not whether the player can steer a tiny character around a browser canvas.

## v0.6 combat rhythm

- Auto attacks, combo finishers, telegraph interrupts, and perfect evades build **闘志**.
- Taking damage removes half of the current meter, so clean timing has visible value.
- At 100, the next Technique becomes **決着**: a faster, stronger, higher-stagger commitment.
- Spending the full meter on activation preserves the risk of a missed Technique.
- The meter, button state, generated sound, hit stop, screen shake, and optional vibration all communicate the same combat event.
