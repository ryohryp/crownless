# ADR 0009 — Smartphone Combat Viewport and Tactical Information Density

- **Status:** Accepted / Active UI principle
- **Date:** 2026-10-06
- **Builds on:** AGENTS.md, ADR 0005, ADR 0008
- **Solves:** Issue #897 (Smartphone combat tactical visibility and viewport ergonomics)
- **Core Principle:** One viewport = one scene without hiding decision-critical tactical numbers. Density through compact typography, not through omission.

## Context

Crownless is designed first for real smartphone play (360–430 CSS px wide). AGENTS.md establishes that:
> "Treat primary gameplay screens as **one scene = one viewport**. Avoid long document-level scrolling during the core loop."

In pursuit of this principle, early mobile CSS optimizations made a critical mistake: to fit the battle panel into one viewport, they hid the action button guidance text (`.combat-choice-grid .choice small { display: none; }` and `.combat-foot .choice small { display: none; }`), and truncated the enemy intent text with single-line ellipses (`white-space: nowrap; text-overflow: ellipsis;`). Furthermore, the outer masthead and footer were hidden on mobile (`.masthead, .footer { display: none; }`), inadvertently eliminating the player's only interface for toggling sound effects (Audio ON/OFF), switching sunlight mode, or viewing the rules of play.

A rigorous human and TypeSafe Jev playtest review in October 2026 revealed severe gameplay degradation resulting from these omissions:
1. **Blind Decisions**: Players could not see how much damage Guard absorbed (9 damage block), whether it restored stamina (+1 stamina), or whether Dodge avoided damage, suffered half damage, or yielded a counter-attack bonus (+3 damage). They were forced to guess in the dark.
2. **Truncated Guidance**: Enemy intent explanations like "横薙ぎ。防御なら安定。回避しても半分は受け、追撃の好機は作れない。" were cut off mid-sentence with `...`, hiding the very advice needed to choose a countermeasure.
3. **Muted Experience**: Players on phones had no way to enable audio feedback or view game explanations during expeditions.

## Decision

Crownless formally adopts **Tactical Information Density without Omission** as a permanent smartphone UI architectural invariant.

### 1. Zero-Omission Rule for Tactical Data

To fit a scene onto a mobile viewport, developers must **never use `display: none` on decision-critical attributes**.
- **Combat action buttons** must always display both their primary title/cost and compact secondary operational metrics:
  - Strike: Damage output and stamina gain (`気力 +1`).
  - Heavy: Damage output and stamina cost (`気力 −2`).
  - Guard: Stamina gain and damage reduction / counter values (`気力 +1 / 9 軽減`).
  - Dodge: Stamina cost and intent-specific outcome (`気力 −1 / 無傷・追撃` or `気力 −1 / 半分被弾`).
  - Restorative (Potion): Recovery amount and enemy action turn penalty (`敵も行動する`).
  - Retreat: Minimum health risk and carried loot retention rule.
- Density must be achieved through **compact typography (9–10px font size, 1.2 line height, tight padding)**, fitting within the 50px minimum thumb touch target without increasing viewport height.

### 2. Multi-Line Clamped Intent Guidance

Enemy intent descriptions must never be truncated with a single-line ellipsis.
- `.intent small` must use multi-line clamping (`-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;`).
- This guarantees up to two full lines of tactical counter guidance fit within ~25px height, preserving readability across narrow 360px viewports.

### 3. Persistent In-Scene Contextual Settings Access

When top/bottom app chrome (masthead/footer) is suppressed to conserve screen real estate:
- The active scene header (`.scene-top-actions`) must host an unobtrusive contextual settings button (`⚙ 設定`).
- Tapping `⚙ 設定` opens the unified modal settings dialog (`#help`), giving the player instantaneous access to:
  - Audio Feedback Toggle (効果音 ON/OFF).
  - Outdoor Sunlight Contrast Mode (日光モード ON/OFF).
  - Rules of Play (遊び方).
  - Safe Dismissal (`旅へ戻る` and Escape key handling).
- The settings modal must be dismissible without disrupting expedition state, combat turns, or navigation.

### 4. Single-Viewport Bounded Physics

- Combat panel height must remain locked (`min-height: 0; overflow: hidden;`) during standard phone gameplay.
- Total vertical stack (vitals + enemy summary + intent + 4-choice grid + combat log + foot buttons + bag status) must not exceed ~360px, maintaining >150px safety headroom on standard 667–844px mobile viewports.

## Consequences

- **Positive**: First-time and returning players have full, deterministic clarity on all tactical options. Audio and outdoor usability are always accessible. Zero regression on single-viewport discipline.
- **Enforcement**: Guarded by automated unit tests in `test/issue-897-mobile-ui.test.js` and `test/mobile-combat-vitals-layout.test.js`, and verified by `@jkudish/jev-browser` fast autonomous smoke testing.
