# AGENTS.md

Crownless is a location-driven medieval-fantasy RPG being rebooted around one goal: make a small game that is fun to play again.

## Product invariants

Keep these unless the user changes them:

- Core loop: **Explore → Fight → Loot → Return alive → Improve → Explore farther**.
- Real-world movement discovers and opens the game world; it is not a step-count reward system.
- Equipment should visibly change the character and meaningfully change later choices.
- Combat should reward strategy and meaningful decisions.
- Exploration should make the world feel larger and open new possibilities.
- Stronger equipment should create motivation to explore again.
- The player starts unknown and poorly equipped, then develops different builds and combat styles.
- Design for real smartphone play.

The first milestone is simple:

> **Can someone play for about 15 minutes and want one more expedition?**

Prefer work that strengthens the loop above.

## Smartphone UI principles

Crownless is a smartphone game, not a web page that happens to run on a phone.

- Treat primary gameplay screens as **one scene = one viewport**. Avoid long document-level scrolling during the core loop.
- Keep frequent global navigation and high-frequency actions in a persistent bottom area that is easy to reach with a thumb.
- Navigation must not disappear because the player scrolled.
- Use the upper area mainly for scene identity and compact status; do not scatter frequent actions across the top and body.
- Reveal secondary information and contextual actions only when needed, using detail views, bottom sheets, tabs, modals, or local scrolling.
- Scrolling is allowed when reading or browsing is the task (logs, codex, long lists), and within bounded content regions when necessary.
- Do not shrink controls or text merely to force everything into one viewport. Keep touch targets comfortably tappable.
- Respect iOS/Android safe areas and gesture regions, and reserve content space so persistent bottom UI does not cover gameplay.
- Validate primary flows on real-phone-sized viewports (roughly 360–430 CSS px wide), not desktop alone.
- When choosing placement, ask: **what will the player do most often on this screen?** Put that action in the easiest reachable place.
- If a primary gameplay screen starts to feel like a vertically stacked website, reconsider its information architecture before polishing CSS.

Related implementation work: #602, #708, #709, #710.

## Build principles

- Choose the stack, architecture, Web/PWA/native approach, rendering, storage, and libraries that best fit the current playable goal.
- Do not preserve legacy architecture or mechanics by default.
- Reuse old code only when it is genuinely useful.
- Historical ADRs and design docs are references, not Canon.
- Avoid speculative systems and abstractions.
- Prefer **Design → smallest implementation → run → play/inspect → improve**.
- Make reasonable product and technical decisions without stopping for approval.

Territory control, factions, politics, war, large economies, PvP, guilds, seasons, and other historical or future systems can wait until the core loop is fun.

## Completion boundary

Do not stop at a proposal when implementation is possible.

For implementation work:

1. inspect only the context needed,
2. make the smallest coherent change,
3. run relevant checks,
4. run/render the result when practical,
5. inspect the actual behavior or screen,
6. fix obvious blockers,
7. leave it playable or verifiably working.

CI proves checks pass; it does not prove the game is fun.

## Location safety

Never require trespassing, dangerous travel, prolonged phone attention while walking, or unnecessary storage of precise movement history.

Keep location-dependent behavior testable with simulated locations where practical.

## Skills

Use `skills/crownless-loop-engineering/SKILL.md` for gameplay iteration, `skills/crownless-playtest/SKILL.md` for evaluation, and `skills/crownless-visual-design/SKILL.md` for visual work when relevant.

## Priority

When two reasonable approaches exist, choose the one that teaches us sooner whether Crownless is fun enough to play again.
