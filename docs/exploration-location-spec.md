# Crownless — Exploration & Location Discovery Specification

> **Status:** canonical subsystem specification  
> **Updated:** 2026-08-27  
> **Parent design:** [`game-system-design.md`](game-system-design.md)  
> **Related expedition spec:** [`expedition-system-spec.md`](expedition-system-spec.md)  
> **Platform decision:** [`adr/0003-web-first-native-ready-location.md`](adr/0003-web-first-native-ready-location.md)

## 1. Purpose

Location gameplay exists to make the Crownless world larger because the player physically went somewhere new.

The rule is:

> **Walk in reality to discover. Return to safety to decide what to send into what you found.**

GPS is not a stamina source, step counter, or check-in mechanic.

## 2. Core exploration loop

The location loop is:

```text
Move through reality
  ↓
Enter or revisit a coarse Crownless area
  ↓
Reveal terrain / signals / hints
  ↓
Discover or advance a Crownless place
  ↓
Persist world knowledge
  ↓
Use that place later as an expedition destination
```

The player should not have to walk the same route twice — once physically and then again through tedious in-game navigation.

## 3. Current implementation baseline

The existing browser prototype already supports:

- explicit device geolocation permission
- server-side geography access
- normalized public geographic signals
- deterministic translation into Crownless discoveries
- manuscript-style nearby sketch-map presentation
- stable discovered-place identity
- persistent Discovery Journal entries
- persistent coarse explored areas
- simulated / deterministic fallback
- supported location visuals

These remain useful foundations.

The change is what happens **after discovery**: newly found places should feed the expedition system instead of requiring a real-time combat session.

## 4. Platform strategy — web-first, native-ready

The idle-expedition PoC remains browser-based.

For the PoC, location discovery only requires **foreground, explicit current-location acquisition** after player interaction. The game does not require the browser to keep tracking while closed or backgrounded.

Typical PoC flow:

```text
open Crownless
  ↓
request current location
  ↓
resolve coarse WorldCell / nearby geography
  ↓
reveal new Crownless knowledge
  ↓
close the game
  ↓
later dispatch expeditions from safety
```

This is enough to test whether real movement creates valuable expedition destinations.

### 4.1 Platform boundary

Game and discovery rules must not become coupled directly to `navigator.geolocation`.

Maintain a replaceable boundary conceptually equivalent to:

```text
Game / Discovery Core
        |
        v
LocationProvider
   |          |
   |          +-- future NativeLocationProvider
   |
   +-- WebLocationProvider
          navigator.geolocation

SimulatedLocationProvider
  - deterministic tests
  - development
  - permission / platform fallback
```

The provider is responsible for acquiring location input. The following remain platform-independent:

- coarse WorldCell derivation
- geography normalization
- fantasy discovery translation
- stable place identity
- Discovery Journal persistence
- expedition-target availability
- privacy / persistence rules

### 4.2 Native migration is conditional

Crownless should not become native merely because it uses GPS.

Native packaging, Capacitor, and native location APIs become relevant if playtesting proves that the game materially benefits from this experience:

> **walk with the phone in a pocket → reopen later → Crownless has discovered places encountered while the app was not actively open**

That may require background / significant-location-change / geofence-style capabilities and platform-specific permission handling.

Those features are deliberately deferred until the idle-expedition loop itself is fun.

### 4.3 PoC non-goals

Do not make these requirements for the first PoC:

- background location
- continuous GPS tracking
- exact route logging
- native app-store packaging
- Capacitor integration
- Swift / Kotlin game rewrite
- discovery of every point traversed while the browser is closed

The platform decision is:

> **Native is justified when background movement becomes part of the fun, not simply because Crownless reads location.**

## 5. Discovery states

A place may move through:

1. **Unknown** — nothing known
2. **Hinted** — smoke, tracks, silhouette, rumor, unusual terrain
3. **Discovered** — stable identity exists and can be remembered
4. **Available for expedition** — enough is known to target it from safety
5. **Investigated / changed** — expedition outcomes changed what is known about it
6. **Cleared / transformed** — optional persistent terminal or changed state

Not every place needs every state.

## 6. Persistent world knowledge

Once a location reaches **Discovered**, the fact that it exists is learned value.

Rules:

- defeat or failed expeditions do not erase legitimate discovery
- revisiting the same stable place updates one record instead of creating duplicates
- later expedition results can enrich or change that record
- coarse explored areas remain separate from exact movement history

Persist game-facing identity only.

Do not persist as collection state:

- raw latitude / longitude
- exact route history
- exact movement tracks
- `mapOrigin`
- `representativeCoordinate`

Transient coordinates may be used to render nearby context while the player is exploring.

## 7. Real geography → Crownless world

Real geography is an input, not a literal reskin.

Useful normalized signals include:

- water
- crossing
- woods
- road hub
- settlement
- height
- coast
- sacred / historic features where safe and appropriate

Possible Crownless outputs include:

- forest
- marsh
- ford
- ruined watchtower
- abandoned village
- cave / mine lead
- old road
- shrine remains
- dangerous camp
- rumor / regional event

Do not map a private home or individual business directly into a dangerous fantasy target.

## 8. Outdoor play rule

Outdoor play should be glanceable and safe.

Prefer:

- reveal area
- notice hint
- discover place
- save it for later
- collect a clue
- update the journal

Avoid:

- action combat while walking
- long text choices requiring attention in traffic
- meter-perfect positioning
- turn-by-turn navigation
- repeated tap-heavy map traversal
- incentives to trespass or enter dangerous areas

The game should work even if the player briefly opens it, discovers something, and closes it again.

## 9. Discovered places become expedition destinations

A core rule of the new design is:

> **Once a destination is legitimately discovered, the player does not normally need to physically remain there to play its expedition content.**

From the Grey Hearth or another safe stationary context, the player can:

- review the place
- inspect known danger / opportunity
- select companions
- equip tools
- choose policy
- dispatch an expedition

The real-world trip created the destination. The game should respect that investment rather than require repeated presence for every result.

Exceptions may exist later for special live events, but they are not the baseline.

## 10. Nearby sketch map

The map remains a discovery surface, not a navigation app.

It should:

- show coarse nearby context
- emphasize unknown versus known areas
- show hints and discovered locations
- use manuscript / ink / parchment language
- avoid implying survey-grade accuracy
- remain readable on a phone

Do not add navigation chrome, exact coordinates, satellite rendering, or route optimization.

## 11. Simulated fallback

Location-dependent systems must remain testable and playable without live GPS.

Requirements:

- deterministic simulated areas
- deterministic discovered-place IDs
- deterministic geography → fantasy translation tests
- graceful fallback on permission denial, timeout, upstream errors, or zero matching features

Live external geography enriches the world; it must not be the only way to exercise the core game loop.

## 12. Regional content under the new loop

Regional missions, hunts, dungeons, and events should now primarily produce **expedition targets or modifiers**.

Example rewrite of `消えた荷駄隊`:

```text
road-like region discovered
  ↓
find two traces while exploring
  ↓
reveal 街道荒らしの野営地
  ↓
return to Grey Hearth
  ↓
dispatch an expedition to investigate / raid / scout it
  ↓
report resolves encounter, injury, loot, and knowledge
  ↓
regional knowledge changes
```

Do not route this back through deprecated real-time combat.

## 13. AI generation policy

AI may help transform regional facts into Crownless flavor, but gameplay must not depend on a paid model call per movement or expedition event.

Rules:

- no provider API keys in the client
- prefer deterministic rules for gameplay structure
- generate regional flavor host-side or batch when needed
- persist generated regional identity under stable IDs
- reuse generated content
- remain functional when AI generation is unavailable

AI is for naming and flavor, not authoritative local-history facts or hidden combat resolution.

## 14. Conceptual model

### ExploredArea

- stable coarse area ID
- exploration state
- game-facing progress metadata

### PointOfInterest

- stable POI ID
- family / type
- discovery state
- known danger / opportunity tags
- expedition availability state
- persistent changed / cleared state when relevant

### RegionTheme

- stable region identity
- normalized real-world inputs
- Crownless motifs
- destination / event weighting hints

### DiscoveryJournalEntry

- stable game-facing discovery identity
- state
- first / last known metadata
- discovered knowledge
- expedition-derived updates

Persistent models must avoid raw location history.

## 15. Success criteria

Location gameplay is working when:

- walking somewhere new can reveal meaningfully different Crownless content
- the player feels they opened the area themselves
- new places create future expedition choices
- outdoor use remains safe and low-attention
- the player can later act on a discovery without physically revisiting it
- discovered places feel like accumulated world knowledge rather than disposable event cards
- simulated fallback still exercises the same gameplay contracts

The key standard is:

> **Did walking somewhere give me a new place I care about sending people into?**
