# Crownless Minimal Combat Assets v0.1

This directory contains the first image-based combat asset set for the fixed
oblique top-down prototype.

## Status

- Runtime use: playable prototype candidate
- Visual Canon status: review candidate
- Visual Director project: `crownless`
- Visual Director config: `visual-director.projects.json`

These files do not replace an Approved Visual Anchor automatically. Regenerate
each asset from the Approved Anchors listed below; never chain a new generation
from one of these candidates.

## Approved generation references

- `docs/assets/crownless-visual-design-reference-v0.1.jpg`
- `docs/assets/crownless-character-reference-v0.1.png`
- `docs/assets/crownless-battle-reference-v0.1.png`

## Asset registry

| Asset ID | File | Gameplay reading |
| --- | --- | --- |
| `player_unarmed` | `actors/player-unarmed.png` | Intentionally unarmed player with wrapped hands |
| `enemy_rusher` | `actors/enemy-rusher.png` | Forward-driving close-pressure enemy |
| `enemy_guard` | `actors/enemy-guard.png` | Broad, planted shield enemy |
| `enemy_skirmisher` | `actors/enemy-skirmisher.png` | Narrow, retreat-ready ranged enemy |
| `dropped_sword` | `weapons/dropped-sword.png` | Temporary sword on the battlefield |
| `dropped_dagger` | `weapons/dropped-dagger.png` | Temporary dagger on the battlefield |
| `ink_effects` | `effects/ink-effects-sheet.png` | Slash, impact, and broken-hatch recoil marks |
| `vermilion_telegraphs` | `effects/vermilion-telegraphs-sheet.png` | Arc, circle, and directional danger marks |

## Implementation contract

- Files are transparent PNGs with enough padding to prevent clipped ink marks.
- Character and weapon silhouettes must remain legible at phone scale.
- Black ink communicates physical action and impact.
- Muted vermilion communicates danger or an incoming attack.
- No file contains labels, UI, controls, loot beams, glow, or rarity colors.
- Sprite sizing, pivots, atlas splitting, and animation frames remain an
  implementation step; this set is the minimal visual source set.
