# ADR 0015 — One meaningful expedition branch before more UI or content

- **Status:** Accepted / first gameplay experiment pending
- **Date:** 2026-10-17
- **Builds on:** `AGENTS.md`, ADR 0009 (phone-first tactical scenes), ADR 0011 (artisan-made equipment and shared-world hypothesis), ADR 0013 (non-combat gather → safe return → exploration-changing craft), ADR 0014 (fictional neighborhood map), and `docs/visual-canon.md`.
- **Origin:** User play feedback after [PR #1026](https://github.com/ryohryp/crownless/pull/1026): the game still is not much more fun. Argon v0.4 was reviewed as an interaction *prototype*, not as a source of authoritative game state or proven retention.

## Context

Crownless has improved map continuity, crafting guidance and recipe legibility. PR #1026 added a real, saveable **斥候の灯**: a smith-crafted exploration tool that enables deliberate inspection of a forest clue on a later trip. Rule and browser tests established reachability and persistence, **not** that people want to go on another expedition. The user's reaction is that the improvement remains insufficiently fun.

A new clue or clearer button is not enough when it does not change a meaningful decision. The promising lesson from Argon v0.4 is the **consequential expedition fork**: the same encounter can play differently depending on what the adventurer brought, what they risk, and what they are trying to bring home. The Argon example combined a tool-enabled alternative, non-combat gathering and a costly direct route; its exact item names and numbers are illustrative, not Crownless rules.

## Decision

**Before adding more UI polish, recipes, places or multiplayer features, implement and playtest exactly one small, consequential branch in an existing expedition.** Begin in the starter forest, with the existing 斥候の灯, existing field geometry and normal safe-return contract. The player must be able to make a reasoned choice and then observe an actual consequence in game state and the next action.

1. **One local encounter, not a universal branching engine.** Select one reachable forest situation already near a meaningful clue, obstacle or existing reward. Reuse the forest movement, field actions and saved expedition state. Keep other regions and combat rules intact.
2. **Choices with distinct trade-offs.** Test an encounter with routes such as: a safer detour with less reward, a risky direct approach with a real HP/combat or potential-loot trade-off, and an optional tool-enabled investigation or passage with a different discovery/reward. These are **candidate shapes**, not mandated three-choice UI, prescribed rewards, or fixed numerical balancing.
3. **Equipment changes the decision, not just the description.** Having the lantern must produce a reproducible difference in an available action or outcome; without it, the encounter must still be playable and not dead-end. The lantern may help notice or investigate evidence, but must **not** automatically reveal the exact hidden entrance, unlock a secret tile, or bypass a deliberate investigation or earned `trailReading` skill.
4. **Make cost and consequence legible at the moment of choice.** Explain the relevant risk, likely category of reward, and whether the bag is still unsecured using the existing mobile scene. Do not disclose every surprise or turn the encounter into an unskippable tutorial.
5. **Keep survival stakes real.** All gathered materials remain provisional until a genuine safe return; death/loss and already-established retreat protections remain authoritative. The encounter cannot mint free banked loot, enable repeated reward farming, duplicate crafted items, or introduce an unavoidable forced fight for non-combat explorers.
6. **Preserve a believable world.** Outcomes should be grounded in what is encountered in the medieval-fantasy forest, with distinct discoverable consequences rather than sci-fi combat geometry, a parallel currency/inventory, or decoration posing as a new mechanic.

### Smallest implementation and playtest

- Observe the existing forest path and choose **one** branch point that a first-time player can reach on a phone without developer instructions.
- Specify the smallest credible consequences based on current HP, materials, player tools, skills and return rules. **Balance figures are implementation hypotheses to test, not set by this ADR.**
- Add one bounded decision and its consequences, preferably using the existing `CrownlessSlice` / forest-field functions and without introducing a general event framework.
- Compare without-lantern and with-lantern runs from equivalent saves. Confirm the player can decline danger, investigate intentionally, retain existing secret mechanics, return alive and see the earned materials in the shared warehouse.
- Run deterministic rules and automated browser playthroughs covering each route, repeat taps, save/reload, defeat and safe return, and touch-reachable primary choices at **360–430 CSS px**. Keep primary gameplay to one viewport with persistent navigation; no long document scrolling.
- Play the loop as a first-time player, not only as an automated test. After around 15 minutes, ask: **did the risk/reward choice require thought, did the lantern make a satisfying difference, and did the outcome create a voluntary reason to depart again?** If not, change or remove this one encounter before expanding.

### Boundaries

- Keep real-world discovery distinct from fictional dungeon movement. No background location tracking, real-world route instructions, private-place traversal requirements, or precise location histories. Stationary, explicit foreground discovery stays authoritative.
- Preserve demo/walk separation, account-level warehouse, character/skill ownership, save migration and anti-duplication checks, material-only enemy drops and smith-made equipment.
- Do not turn the optional lantern into a required key for ordinary forest completion. Existing manually opened secrets, blocked tiles and earned abilities remain meaningful.
- No forced timers, daily chores, mandatory combat, or live multiplayer dependency.

## Promising Argon ideas, deferred until this is fun

These are **candidate follow-ups**, not acceptance criteria for this ADR and not commitments to build now:

- **Useful traces and commissions:** artisan requests, signposts and limited facilities that materially affect a later visit; label fabricated NPCs and simulated player fixtures explicitly rather than presenting them as real player activity. Validate one local consequence before networking an asynchronous world.
- **Read-and-counter combat:** a clearer payoff for correctly interpreting an enemy's omen and choosing a counter. Prefer improving one existing encounter rather than importing Argon's geometric boss or building a separate combat system.
- **Distinct landmark benefits:** controlled real landmarks may influence later expeditions, subject to ADR 0012's own ownership, non-stacking and real-effect validation. Do not award invented buffs from ordinary footprint counts.
- **More tool-dependent routes:** only after the first choice proves fun; new tools, regions and recipe catalogs are not prerequisites.

## Alternatives considered

- **More map, cards, button hierarchy or crafting explanations now:** They can reduce friction but have not yet supplied enough meaningful replay motivation. Defer presentation polish unless it blocks the test.
- **Add many quests, regions, materials or equipment tiers:** Increases content and complexity without testing whether any one decision is engaging. Defer.
- **Build asynchronous MMO systems first:** Matches the long-term vision of ADR 0011 but risks infrastructure work before a single-player encounter is enjoyable. Defer.
- **Force every expedition into exactly three options:** Predictable and formulaic; the meaningful trade-off matters, not an arbitrary UI count. Reject as a global rule.
- **Automatically use the lantern to unlock the hidden route:** Removes investigation, weakens discovery and conflicts with ADR 0013. Reject.

## Consequences

**Expected upside:** Crafted gear changes actual choices, returning alive retains tension, and a missed alternative provides a specific reason to explore again.

**Risks:** Too-obvious optimal paths, free loot, concealed costs, frustrating punishment, spoilers or overlong decision UI can reduce enjoyment. Use a single measured encounter with explicit failure evidence, then rebalance or remove it.

**Not authorized:** New universal crafting/effects/branching frameworks, fabricated multiplayer signals, wholesale combat redesign, more geography data collection, real-route navigation, or expansion of the Argon demo's simulated economy.

**Evidence standard:** A green CI and completed click-through mean the branch works; only observed play can establish that it is more fun.
