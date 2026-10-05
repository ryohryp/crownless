# ADR 0008 — Frontier Development, Regional Relics, and Travel Chronicle

- **Status:** Accepted / Active product direction
- **Date:** 2026-10-06
- **Builds on:** ADR 0004, ADR 0006
- **Supersedes:** ADR 0007 (side-scrolling action pivot is cancelled)
- **Core Loop:** Real-world movement & discovery → Regional outpost conquest → Frontier development & unique relic collection → Asynchronous rival contention → Travel chronicle archive

## Context

Crownless was originally conceived around one core premise:
> Real-world movement discovers and opens a medieval-fantasy game world.

Following human evaluation in early October 2026, the team recognized that the turn-based expedition loop felt passive and lacked player motivation (average motivation score 1.77/5.0, drag risk up to 74%). An initial proposal (ADR 0007) suggested pivoting to a 2D side-scrolling platformer. However, player feedback and real-world mobile usage clarified that a precision action platformer directly conflicts with outdoor smartphone play, location discovery, and walking safety.

What players genuinely seek from Crownless is:
1. **Location-based territory contest (陣取り)**: discovering real-world landmarks, conquering them, and claiming them against rivals.
2. **Pioneering and developing visited lands (開拓)**: not merely taking a spot, but developing outposts with watchtowers, forges, and hearths that yield local resources and bolster defense.
3. **Collecting unique regional relics (ご当地武具収集)**: real travel and outings rewarding the player with distinctive local equipment and artifacts tied to geographic features (shrines, bridges, stations, forests, peaks, castles).
4. **Archiving personal journeys (旅の冒険録・パスポート)**: clearing the fog of war on a living map, stamping travel seals, and preserving an album of expeditions and souvenirs to look back on.

## Decision

Crownless adopts **Frontier Development, Regional Relics, and Travel Chronicle** as the core product pillars around location exploration.

### 1. Real-World Geographic Landmarks as Strongholds & Sanctuaries

Using existing OpenStreetMap (OSM/Overpass) signals and simulated discovery providers:
- `sacred` (神社・寺・祠): Ancient shrines and hidden sanctuaries.
- `water` / `crossing` (川・湖・橋): Riverside crossings, water sprite basins, ancient bridges.
- `road_hub` / `station` (駅・主要交差点): Frontier gates, courier stations, trade hubs.
- `woods` / `park` (森・公園): Untamed woodlands, hunter groves.
- `height` / `tower` (展望・高台・塔): Watch peaks, high towers, windy bluffs.
- `historic` / `castle` (城跡・旧跡): Ancient keeps, forgotten dynasties, warlord ruins.

### 2. Frontier Outposts (開拓基地)

When a player conquers an outpost:
- It becomes a player-controlled **Frontier Outpost (開拓拠点)**.
- Players can invest iron scraps and regional materials to construct and upgrade facilities:
  - **見張り塔 (Watchtower)**: Strengthens outpost defense and lowers rival retake chance.
  - **開拓鍛冶場 (Frontier Forge)**: Refines regional weapons found in this territory.
  - **旅人の焚き火 (Wayfarer Hearth)**: Serves as a resting haven for the player and passing travelers.
- Outposts produce distinct regional materials over time.

### 3. Regional Relics & Local Loot (ご当地武具・名産品)

Each landmark category and geographic region provides unique, collectible equipment with distinct abilities and origins:
- Shrines drop exorcism blades and sacred talismans.
- Waterways drop wave shields and mist-piercing rapiers.
- Road hubs drop courier mail and merchant daggers.
- Woodlands drop hunter bows and herbalist cloaks.
- Towers drop eagle scopes and gale blades.
- Castle ruins drop warlord armor and ancestral spears.

Every piece of regional equipment remembers where it was found (`originPlace`, `discoveredAt`), becoming a meaningful memento of real travel.

### 4. Travel Chronicle & Passport (旅の冒険録)

Real-world travel and outings are preserved in a dedicated **Travel Chronicle**:
- **Fog of War Map**: Fog lifts as the player visits new districts and cities.
- **Regional Heraldic Seals (旅の消印・紋章スタンプ)**: Automatically stamped into the player's passport upon visiting new landmarks and districts.
- **Expedition Postcard Album**: Beautiful summary cards capturing each conquest, discovery, and relic acquired.

### 5. Moment-to-Moment Combat Principle

Moment-to-moment combat must remain safe, rapid, and mobile-friendly:
- Quick, tactical, 15-30 second encounters on a single phone viewport (360–430px).
- Driven by build synergy, regional relic traits, and concise tactical commands.
- No real-time platforming or twitch jumping required while walking.

## Validation

The implementation is validated when:
1. Real or simulated landmark discovery awards unique regional relics with distinct origins.
2. Conquering a landmark enables frontier outpost development (building facilities).
3. The Travel Chronicle displays visited places, stamps, and collected regional relics.
4. The entire loop is playable thumb-friendly within a single smartphone viewport.
5. All automated checks and TypeSafe Jev semantic quality evaluations pass.
