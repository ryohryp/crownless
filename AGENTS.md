# AGENTS.md

Crownless is a location-driven medieval-fantasy RPG. This repository is being treated as a reboot: preserve the product concept and useful evidence, but do not assume the legacy implementation, architecture, product loop, ADRs, or historical issue structure are still the right answer.

## Product invariants

Keep these unless the user deliberately changes them:

- The core loop is **Explore → Fight → Loot → Return alive → Improve → Explore farther**.
- Real-world movement is used to **discover and open the game world**, not as a step-count reward system.
- Exploration should create curiosity, uncertainty, risk, and a reason to go somewhere or attempt something.
- Returning safely should matter. Going farther should create a meaningful risk/reward decision.
- Loot and equipment should change later choices, combat style, or build direction rather than acting only as collection filler.
- The player begins as an unknown person with little or no equipment and can grow into different combat styles and builds.
- Medieval-fantasy factions, territory, politics, and war are compatible future layers, but they are not required in the first playable slice.
- The game should be designed primarily for actual smartphone play in the real world.

Useful inspirations are Wizardry's tension around exploration and survival, Diablo's loot/build progression, intuitive and satisfying action-game feedback, and a politically alive medieval-fantasy world. Treat these as experience references, not implementation requirements.

## Current product question

The first reboot milestone is deliberately small:

> **Can a player spend roughly 15 minutes with Crownless and want to start one more expedition?**

Prefer work that answers this question over infrastructure, long-term architecture, content scale, or speculative systems.

## Technology and architecture

Choose the technology stack, application shape, Web/PWA/native approach, libraries, persistence model, rendering approach, and architecture that best serve the current playable goal.

Do not preserve a legacy stack merely because it already exists. Do not rewrite working pieces merely for architectural cleanliness either. Reuse old code only when it is cheaper and clearer than replacing it.

Avoid speculative abstraction. Build the smallest architecture that can support the current slice cleanly and can be changed later if playtesting proves the game deserves further investment.

Historical ADRs and design documents are reference material, not automatic Canon. Read them when a task needs historical context or contains useful implementation knowledge; do not preload them by default.

## Location safety and privacy

Location is a game mechanic, but player safety and privacy override novelty.

- Do not require trespassing, dangerous travel, or prolonged attention to the phone while walking.
- Prefer discovery and play that can continue from a safe stationary context after a place has been legitimately discovered.
- Do not persist raw route history or exact movement tracks unless the current product truly requires it and the privacy impact is explicitly justified.
- Keep simulated location available for development and deterministic testing where practical.

## Development loop

Prefer:

> **Design → smallest implementation → run → play/inspect → improve**

Do not spend a long phase only designing the eventual game. Create a playable slice quickly, observe what actually happens, and let evidence shape the next implementation.

When making a reasonable product or technical choice, make it and continue. Ask for a human decision only when the choice is genuinely high-impact, irreversible, costly, security/privacy sensitive, or would substantially change the game concept.

## Completion boundary

Do not stop at a proposal when the task can be implemented and checked.

For implementation work, continue through the relevant completion steps:

1. inspect the current code and only the context needed for the task,
2. make the smallest coherent change,
3. run appropriate tests or checks,
4. launch or render the result when practical,
5. inspect the actual affected behavior or screen,
6. fix obvious regressions or blockers,
7. leave the slice in a playable or verifiably working state.

Passing CI means the implementation works under those checks. It does not mean the game is fun. Gameplay remains a human playtest question.

## Gameplay scope

Do not assume the reboot must preserve territory control, elapsed-time expedition resolution, real-time combat, a specific map model, the Grey Hearth, or any other historical Crownless subsystem.

A historical mechanic can survive if it helps the current product hypothesis. It can also be removed or replaced if a simpler or better design tests the concept more effectively.

Likewise, do not add large systems merely because they fit the fantasy. PvP, guilds, seasons, complex economies, large procedural worlds, social systems, and faction simulations should wait until a smaller playable loop proves there is a game worth extending.

## Visual work

Visuals are part of the gameplay test, not post-production decoration. A first playable slice should look coherent enough that the player can judge the intended experience.

Do not assume the historical manuscript/woodcut direction is mandatory for the reboot. It remains useful reference material until a current visual direction is selected.

For substantial visual creation, image generation, or visual review, use `skills/crownless-visual-design/SKILL.md` when relevant. Prefer a small approved art direction and a few strong reference assets over a large speculative art bible.

## Playtesting

For gameplay evaluation, use `skills/crownless-playtest/SKILL.md` when relevant.

Keep implementation evidence, automated validation, observed play behavior, and player judgment distinct. Never infer that a feature is fun from source code, tests, CI, screenshots, or your own expectation.

The most important result of a playable slice is a product decision: **Keep, Change, Kill, or Playtest pending**.

## Engineering expectations

Apply these only where they help the current slice:

- Keep game rules deterministic and testable where practical.
- Keep location-dependent behavior testable with simulated locations.
- Keep important balance/content values easy to tune during playtesting.
- Avoid placing paid-provider secrets or sensitive credentials in client code.
- Preserve save/state integrity for the flows being changed.
- Validate important mobile UI on a representative phone-sized viewport.
- Trace real runtime references before deleting legacy code or assets; absence from one entry file does not prove something is unused.

Do not create a framework merely to satisfy these bullets. The playable game is the objective.

## Priority rule

When two reasonable approaches exist, prefer the one that lets us learn sooner whether Crownless is fun to explore, fight in, loot from, survive, and play again.
