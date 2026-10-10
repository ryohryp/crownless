# ADR 0012 — Landmark control grants passive blessings

- **Status:** Accepted / pending implementation
- **Date:** 2026-10-11
- **Builds on:** ADR 0006 (asynchronous territory control), ADR 0008 (landmarks / frontier), ADR 0011 (location-based sandbox), and `AGENTS.md`
- **Refines:** The current `docs/gameplay-spec.md` boundary that deferred passive outpost benefits. This ADR permits the small, directly playable effects below; it does **not** authorize passive timers, an idle economy, or a wider stat system.

## Context

Crownless now lets the player discover the fantasy counterpart of a real-world landmark, defeat that *named landmark's* guardian, safely return, and claim it. The map shows an earned flag, and the prototype currently grants one extra starting herb (maximum three) **only for an expedition departing from that owned landmark**.

Human feedback after actually claiming a landmark: conquest needs a compelling effect beyond the flag. A permanent benefit makes different destinations worth discovering and conquering and connects a real-world visit to later gameplay, even when the adventurer is elsewhere. This must not turn into compulsory daily check-ins or a raw count-of-city-landmarks power race.

## Decision

**An owned landmark grants its distinctive passive blessing automatically while the player holds it.** There is no equip slot, activation button, text entry, maintenance payment, timer, or physical return requirement.

1. **Earn, don't merely visit:** A footprint or discovery seal alone never grants a buff. Conquest is confirmed only after a named landmark expedition's boss is defeated and the player returns alive, following the existing safe-return rule.
2. **Works away from the landmark:** An active buff applies to eligible gameplay throughout the current save/mode, not only to expeditions launched from that landmark. The existing departure-only herb bonus remains a separate local outpost benefit for now.
3. **Ownership is authoritative:** Derive active blessings from the existing `claimedLandmarks` IDs in the current game's **valid, readable** save; do not grant buffs from the separate private footprint journal, the region/biome `cleared` list, or an unverified report. Do not silently award anything if the game save cannot be read.
4. **No infinite stacking:** Blessings have effect families (e.g. attack, defense, exploration, production). If multiple landmarks offer the **same kind of bonus** in a family, apply only the strongest applicable effect; never add unlimited numeric power for collecting more landmarks. Different effects may coexist, subject to normal balance checks.
5. **Automatic loss:** If an authoritative control change removes a landmark, its passive effect ends. The present browser-only prototype has no genuine remote rival who can take it; this rule matters when asynchronous control is added.
6. **Readable feedback:** Display the currently active `領地の加護` compactly on the game UI and each relevant landmark's description. The gameplay calculation—not merely the label—must change, and important combat numbers must remain legible on a 360–430px phone.

### First three landmarks (initial playtest values)

| Real landmark → fantasy outpost | Passive blessing | Initial gameplay effect | Family |
| --- | --- | --- | --- |
| 東京タワー → **紅蓮の望楼** | **紅蓮の闘志** | Attack damage **+1** in eligible fights | Attack |
| 東京スカイツリー → **天穿つ白塔** | **天眼** | Increase the chance to discover **hidden treasure** in supported exploration events | Exploration |
| 大阪城 → **翠冠の王城** | **王城の加護** | Incoming combat damage **−1** | Defense |

These are **design targets, not claims of features already shipped**. For `天眼`, first identify an actual existing hidden-treasure/discovery roll to modify; select the bonus chance and eligible events in the smallest implementation and playtest. Do not invent a treasure subsystem, fake an increased drop rate, or promise numeric odds before it exists. Attack/defense values are likewise adjustable after real combat play; apply the selected effect consistently across normal and landmark expeditions. Do not allow defense reduction to create accidental invulnerability; specify and test the damage floor in implementation.

## Scope and product guardrails

- **One small iteration:** Implement the three buffs with the smallest changes to the existing deterministic game rules. Recompute from control IDs rather than persisting a second, independently editable buff inventory. Avoid introducing a general-purpose effects framework for hypothetical future landmarks.
- **Modes and privacy:** Demo and real walking modes keep their distinct saves and blessings. Passive bonuses never use GPS fixes, stored routes, or live physical location; a real-world trip unlocks *opportunity*, while conquest earns the benefit.
- **No city-count advantage:** Dense-city players must not receive unlimited compounded attack or defense merely because there are more towers nearby. Prefer different play styles and category diversity over ever-higher numeric bonuses, and later evaluate accessible opportunities outside major cities.
- **No coercive return:** No daily expiration, login streak, decay, forced defense session, or punitive maintenance. Any future asynchronous contest must remain fair to players who cannot log in every day.
- **Crafting stays meaningful:** Combat blessings must not crowd out equipment upgrades, material gathering, smithing, or commissions—the core `Explore → Fight/Gather → Return → Craft/Equip → Explore` loop remains the purpose.
- **Existing bonuses:** Keep the prototype's outpost-specific herb supply distinct from global passives until play shows whether both are worthwhile; avoid duplicate or contradictory UI descriptions.

## Alternatives considered

- **Flag / stamp only:** Low implementation cost, but insufficient incentive to seek and conquer further landmarks after the first victory.
- **Active buff selection or equipment slots:** Adds repetitive menus and inventory chores; rejected for the initial location-first slice.
- **Every landmark adds +1 power:** Makes cities and high-count collectors dominant; rejected.
- **Effects only while near the landmark:** Encourages repeated physical check-ins and makes travel spoils less useful after returning home; rejected.

## Validation and implementation gate

Implement *after* this ADR, not as part of its acceptance. The smallest playable test must demonstrate:

- [ ] Discovering or revisiting a landmark without conquest gives **no** passive buff.
- [ ] Named guardian victory **and safe return** activate only the corresponding blessing; retreat, ordinary biome victory, and death do not.
- [ ] Attack and damage-reduction bonuses change real combat calculations; exploration bonus alters an actual supported discovery mechanic with a defined, tested probability.
- [ ] Blessings work away from their origin and reappear after save/reload, with no second state to desynchronize.
- [ ] The strongest applicable same-kind blessing wins; unbounded stacking is impossible.
- [ ] Losing control (via a fixture for now) removes its benefit immediately.
- [ ] Active blessings are easy to inspect without adding mandatory taps or sacrificing tactical readability on phone.
- [ ] Materials, crafting, existing herb bonus, safe-return behavior and demo/walk isolation still work.
- [ ] A player with a controlled landmark voluntarily chooses another expedition or another landmark *because of* the blessing. If not, simplify or rebalance rather than build more effect systems.

**Human playtest questions:** “Does a new landmark's blessing make me want to conquer it?” and “Can I actually feel the benefit on the next expedition?”

## Consequences

**Positive:** Control has durable value, landmark identity matters, and ordinary travel feeds back into varied combat/exploration without new daily chores.

**Risk:** Balance, metropolitan landmark density, effects that are too subtle to notice, and ownership-save consistency. Address these through the three-place experiment, explicit feedback and real play, not speculative MMO infrastructure.

**Not in scope:** Nationwide buff assignment; passive resource production; buff upgrade trees; server-authoritative PvP control; guilds or territory upkeep. Future ADRs or tested iterations can change numerical effects without overturning the core automatic, ownership-gated, stacking-limited decision.
