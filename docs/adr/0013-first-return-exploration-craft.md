# ADR 0013 — First safe return should enable an exploration-changing craft

- **Status:** Accepted / pending implementation
- **Date:** 2026-10-14
- **Builds on:** AGENTS.md, ADR 0009 (smartphone scene usability), ADR 0011 (artisan-made equipment and viable non-combat play), ADR 0012 (landmark blessings), and current forest / fen exploration mechanics.
- **Refines ADR 0011 only in the first-craft trial order:** The first demonstrable crafted improvement may be a **useful exploration tool**, rather than requiring the first crafted object to be a weapon. ADR 0011's separate smith-made usable weapon → equip → changed combat trial remains required. This decision does not supersede the material-only gear-drop rule, shared warehouse, or character specialization.

## Context

The immediate loop is **Explore → Fight/Gather → Return alive with materials → Craft/Equip → Explore farther**. An automated Jev playtest review raised a plausible bottleneck: after the first successful expedition, the player's available materials may not satisfy an early weapon recipe (for example, the forest's crafted fang dagger needs two wolf fangs), leaving little visible reason to depart again. The same review flagged mobile navigation friction and sudden combat losses. Its scores and simulated behavior are **diagnostic hypotheses, not proof of human enjoyment**.

Simply guaranteeing two wolf fangs from the first wolf would make mandatory combat the implicit tutorial. That would undermine exploration-first progression and the explicitly viable gathering / artisan paths. Conversely, handing out a completed item on first login would sever the risk–return–craft loop. Current forest exploration already contains non-combat finds (scrap caches, fox trail, glade, treasure) and a genuinely hidden passage; the prototype also has learned trail-reading and a cross-region fen route. Improve the existing loop, not a speculative new profession or progression framework.

## Decision

**The first successful, deliberately resource-gathering return must offer one achievable, crafted exploration improvement; the subsequent expedition must make that improvement observable in a real choice or discovery.** This is a small playable experiment, not a general guarantee of loot for every outing.

1. **Gathering is a complete path.** Provide a clearly discoverable, reachable route in the starter forest to obtain the ingredients for one starter exploration tool **without fighting the wolf**. Players still choose to investigate and carry resources at risk; merely entering, instantly exiting empty-handed, or dying does not award a gift. Preserve the existing return/banking and retreat rules.
2. **Keep crafting meaningful.** The materials are banked only under the normal safe-return contract, consumed once in a real crafting action, and turned into a persistent usable object. Use the existing smith / workshop and account warehouse rather than creating a new profession, free scripted item, or parallel currency. Keep weapons and armor artisan-made and enemy loot material-only. A gathering-oriented player must not be forced to beat a boss to make the starter tool.
3. **The next expedition must actually differ.** The tool has one small, testable exploration effect tied to an existing route, clue, or obstacle: e.g., a scout's lantern improves the **distance or legibility of a relevant environmental clue** before investigating a concealed route. It must affect supported game state and player choices, not only add a text label or a +1 stat with no discernible result.
4. **Discovery remains discovery.** Do not show a destination arrow, pre-reveal an exact hidden entrance, mark impassable cells as walkable, or bypass the required deliberate investigation. Ordinary walkable routes can remain legible. Preserve learned exploration skills (including trail reading) as independently worthwhile; the tool must not make their earned secrets automatically available to unskilled characters.
5. **Teach through consequences, not chores.** On returning, show the gathered materials, the affordable craft and what new kind of clue it helps with; on the following expedition show a contextual, visually distinct cue at the moment it matters. Do not require diary entries, forced combat, daily timers, GPS movement grinding, or an extra onboarding screen.
6. **Preserve boundaries.** Character-specific skill progression, account-level storage, demo/real-world location separation, privacy rules, and ownership-gated landmark buffs remain unchanged. A manufactured exploration tool does not replace or silently stack with ADR 0012's unimplemented landmark exploration blessing. Do not build a generalized item-effects engine until this one behavior is demonstrably valuable.

### First implementation slice

- Choose **one existing starter-forest gathering route** and **one meaningful later discovery interaction**, preferably an existing hidden-path/clue affordance, before adding any new region or recipe catalog.
- Set the ingredient amount from actual reachable non-combat drops and travel time. Ensure that completing the chosen gathering route and returning alive makes one tool craftable, without changing every wolf's drop or promising a tool after an empty return.
- Implement a single tool recipe and its minimal inventory/save representation through the existing production path. Keep the smith-made weapon experiment intact as an independent next milestone.
- Implement an observable, inspectable **without-tool vs with-tool** difference on the next outing. For a lantern-style cue, reveal evidence *of something worth examining*, not the exact secret square or its destination.
- Validate on 360–430 CSS px phone viewports with one scene per viewport, thumb-reachable movement and return/craft actions, no hidden decision-critical detail and no document-level scrolling during the primary loop.
- Stop at this experiment. Combat spike tuning and fen dead-end pacing are important separate issues, not prerequisites for expanding the crafting system.

## Alternatives considered

- **Guarantee two wolf fangs on the first kill:** Fast route to the current dagger recipe, but pushes all new players through wolf combat and rewards fighting rather than exploring. Rejected as the *first-loop fix*; combat crafting continues separately.
- **Give everyone a free starter tool on return/login:** Makes progression obvious but eliminates the material-risk and artisan step. Rejected.
- **Add many gathering professions, tool tiers or a full crafting economy now:** Increases complexity before any one exploration-changing craft is proven fun. Deferred.
- **Only rebalance attack, defense or scrap reinforcement:** May improve survivability, but does not ensure new exploration decisions. Separate balancing work.
- **Add map markers/navigation to every hidden location:** Reduces friction but destroys the desired sensation of a secret. Rejected.

## Acceptance criteria / validation

- [ ] An ordinary new adventurer can, with reasonable exploration of the starter forest, **gather the required materials without mandatory enemy combat**, return alive and afford exactly the initial tool recipe. The route is discoverable without developer instructions and does not rely on a scripted free reward.
- [ ] The existing smith / workshop can craft it once, consuming the correct banked resources; save/reload, character switching and repeated clicks do not duplicate goods or craft payments.
- [ ] A subsequent expedition has at least one reproducible **decision-relevant before/after difference** from equipping or carrying the tool. Without the tool, the additional clue does not appear.
- [ ] The tool does not reveal the concealed path automatically or bypass obstacle / learned-skill rules. Existing forest/fen discovery, smith weapon crafting, safe-return loss semantics, and mode boundaries continue to work.
- [ ] The material source, craft action, effect and return controls remain discoverable and reachable in a 360–430px mobile viewport without long page scrolling or illegible controls.
- [ ] Run rule tests and an autonomous browser playthrough of **gather → return → smith craft → re-enter → discover difference**. Record exactly which steps the automation completed and which were inferred.
- [ ] Conduct a first-time human playtest: **after about 15 minutes, does the player voluntarily leave on another expedition because they expect to find something previously missed?** Also ask whether the clue felt earned instead of announced. If not, revise this single loop; do not expand the catalog.

## Consequences

**Positive:** Non-combat exploration can pay off in the first session; artisans make exploration measurably different; a second expedition has a concrete curiosity hook.

**Costs/risks:** Over-guaranteed starter resources can trivialize risk, and powerful tools can erase hidden-path surprise or eclipse exploration skills / landmark buffs. Mitigate with a deliberately gathered first recipe, one bounded effect, comparison fixtures and actual human play.

**Not authorized:** Global equipment/profession redesign, guaranteed enemy loot, additional region content, general buffs framework, new location tracking, real multiplayer economy, or automatic unlocking of hidden passages.
