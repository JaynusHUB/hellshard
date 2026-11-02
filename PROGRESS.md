# HELLSHARD — Progress

## Current status

**Complete.** Phases 0–7 are implemented. The game boots into the main menu, supports a full run from
the cemetery through the seeded church/swamp route to the Final Gate, and persists meta progression.

## Verification (final pass)

- `npm run build` - passes after the tile-catalog/map audit (64 modules, no errors; atlases are
  generated at runtime, JS 851.54 kB / 225.98 kB gzip).
- Layout note: hidden breakable/fake-wall chests are registered in the layout grid after the room
  structures are indexed.
- `npm test` — **34/34 tests passing** in 8 suites (RNG, upgrades/evolutions, world generation,
  achievements, sprite manifest facing/coverage, localization, pit AI, enemy hazards/refund/crowd).
- `npm run validate:tiles` — **passed**: five 16x16 catalogs, source margin 0, spacing 0, all frame
  rects in bounds; cemetery Tiled reference is 300x14 tiles with
  `Collisions Layer > Back Layer > Main Layer`.
- `npm run validate:world` — **passed for seeds 1..100**: 100 worlds, 500 zones, max gap 4 tiles,
  max jump 70.5px, max distance 92.0px.
- `npm run validate:alignment` — **passed**: 5 zones, 50 ground props, 124 placed objects,
  footSink applied, ±1px tolerance.
- `npm run validate:layout` — **passed**: 100 seeds × 5 zones; zero overlaps, floating chests,
  clearance violations or unsupported single-tile structures.
- Production preview smoke test (`npm run preview`) — menu → achievements → character select →
  gameplay (move/jump/dash/basic/heavy/ability) → pause → settings → resume → level-up → Final Gate →
  result. **No console errors, no failed requests, no external requests.**
- Full production route smoke test — all three bosses defeated, all three shards claimed, boss chests
  spawned, Final Gate opened, victory result and meta save verified.
- Browser screenshots verified in `.tmp` (ignored): menu, character select, HUD, settings EN/TR,
  achievements, level-up, all five zones, three bosses, result, debug overlay and stress test
  (150 enemies / ~939 particles at 11 draw calls).

## Known issues — post-playtest fixes (2026-11-02)

- [x] **Player sprite walked ~80px below the visible ground in all five zones.** Root cause: sprite
  anchors measured the opaque foot from the top of the frame, but `SpriteBatch` applied the anchor with
  the wrong sign, pushing every sprite below its world foot point. Fixed in `SpriteBatch.js`; the same
  fix also corrects decorations, chests, gates and NPC-height props. Moving platforms now use a top
  anchor so their visual top matches collision.
- [x] **F3 collision diagnostics missing.** Added `CollisionDebugOverlay.js`: cyan AABB feet,
  green tile-render floor, magenta sprite anchor/frame bounds, nearby enemy boxes and a legend. F3
  toggles it with the existing debug overlay.
- [x] **Top-right phase text was identical in every zone.** Added zone-specific phase labels for all
  five zones and both languages; HUD and phase-change toasts now resolve through `zone.phaseKeys`.
- [x] **A small white line appeared ~50px above chests.** Root cause: random 1×1 additive glow
  particles emitted above every interaction. Removed; chests now rely on their pulsing tint only.
- [x] **Dungeon armor statue looked hollow/transparent and ground body had no tiles.** Cropped statue
  rendering now anchors at the floor and uses full alpha plus a brighter dungeon prop grade; dungeon
  body/deep tile frames now reuse the brick floor strip with a darker grade instead of flat wall
  interior crops.
- [x] **Swamp background looked like flat color bands.** All four supplied swamp layers are now used
  (background, mid-layer-02, mid-layer-01, trees), aligned to the same world ground line with distinct
  parallax speeds and a foreground tree silhouette.
- [x] **Church background had hard black gaps and a translucent rectangle.** Root cause: the 624×192
  five-panel sheet was repeated whole, including its 16px transparent separators, and overlaid twice.
  Replaced with a single cropped 160×192 window-panel layer aligned to the world ground.

## Known issues — round 2 playtest fixes (2026-11-02)

- [x] **Enemies walked backwards / sprites faced the wrong way.** `ASSET_MANIFEST.json` now declares
  `"facing": "left" | "right"` for every player, enemy and boss sprite, verified against the source
  PNG poses. `AssetLibrary.shouldFlipSprite()` combines that source facing with the actor's movement
  facing (velocity when moving, logical facing during windup/strike).
- [x] **Enemy idle/walk/attack/hurt states were mostly unbound.** Every normal enemy now resolves
  idle/walk/attack/hurt through explicit clips or documented fallbacks. Attacks have a windup pose and
  a strike pose; hurt poses squash; death is a squash-and-fade using the existing death palette/particles.
  Frame timings live in `src/config/animations.js`.
- [x] **Some enemy feet sat at different heights.** Sprite foot anchors are now stable per sprite:
  the lowest opaque row across all clips is used as a single foot anchor, so animation frames cannot
  move the visible feet away from the collision-box bottom. The F3 overlay still displays the anchor.
- [x] **Dungeon looked like a flat gray gradient.** The room now uses the supplied floor strip for
  top/body/deep floor tiles, the two opaque wall-panel crops as stacked background layers, animated
  torch frames, and deterministic knight/robed statues. There is no dedicated column sprite in the
  ThePixelist sheet; this is reported in `ASSET_REPORT.md` and statues/wall pilasters are used instead.
- [x] **Enemies stacked on one another.** Added a simple horizontal separation pass for non-boss
  enemies with geometry checks; flying enemies also receive a small vertical separation.
- [x] **Turkish Nyx labels.** Audited all EN/TR keys and added `tests/strings.test.js`; Shadow Blades
  is `Gölge Bıçakları`, Shadow Step is `Gölge Adımı`. All TR keys are present and no weapon/ability
  value contains a zone placeholder.

## Enemy animation map

Frame timing config: `src/config/animations.js` — idle `0 fps` (hold first frame), walk `10 fps`,
attack `14 fps`, hurt `10 fps` for `0.2s`, death squash/fade `0.45s`.

| Enemy | Idle | Walk | Attack / windup | Hurt | Death |
|---|---|---|---|---|---|
| Bone Thrall | `walk` frame 0 held | `walk` | `attack` 2f | `hurt` 1f + squash | squash/fade + bone burst |
| Grave Wight | `walk` frame 0 held | `walk` | `attack` 2f | `hurt` 1f + squash | squash/fade + bone burst |
| Cinder Hound | `run` frame 0 held | `run` | `attack` 2f | `hurt` 1f + squash | squash/fade + ember burst |
| Mourning Wisp | `float` frame 0 held | `float` | `attack` 2f | `hurt` 1f + squash | squash/fade + soul burst |
| Burning Ghoul | `walk` frame 0 held | `walk` | `attack` 2f | `hurt` 1f + squash | squash/fade + fire burst |
| Blight Cultist | `idle` frame 0 held | `walk` | `cast` 10f | `hurt` 1f + squash | squash/fade + soul burst |
| Venom Spider | `walk` frame 0 held | `walk` | `attack` 2f | `hurt` 1f + squash | squash/fade + venom burst |
| Bog Brute | `walk` frame 0 held | `walk` | `attack` 2f | `hurt` 1f + squash | squash/fade + mud burst |
| Mire Wraith | `float` frame 0 held | `float` | `attack` 2f | `hurt` 1f + squash | squash/fade + soul burst |
| Moss Slime | `bounce` frame 0 held | `bounce` | `attack` 2f | `hurt` 1f + squash | squash/fade + venom burst |
| Pale Revenant | `wight` clips | `wight` | `wight attack` 2f | `wight hurt` | squash/fade |
| Alpha Hound | `hellgato` clips | `hellgato` | `hellgato attack` 2f | `hellgato hurt` | squash/fade |

Bosses: Mourning Maw uses `run` for idle and attack (no separate attack clip in the pack); Seraph of
Ash uses `idle`/`attack`; Drowned Choir uses `float` for idle and attack. All three use flash for hurt
and shard/death bursts rather than a death sprite. No enemy pack contains death frames; death is
therefore consistently procedural, and this is the documented fallback.

Missing before this fix: wight had only `walk`; wisp only `float`; hell-gato only `run`; burning ghoul,
spider and bog brute only `walk`; mire wraith only `float`; moss slime only `bounce`. Dedicated attack
and hurt clips were assembled from their native frames; idle holds the first native frame. No death
frames exist in any supplied pack, so death cannot be a sprite clip without inventing art.

## Known issues — alignment pass (2026-11-02)

- [x] **All actors/props floated above the painted ground.** Measured each zone's top tile alpha
  with a 60% horizontal-fill threshold; the first qualifying row becomes `surfaceOffset` in
  `ASSET_MANIFEST.json`. Physics, tilemap collision, spawn, checkpoints, props, chests, altars and
  gates now use `tileTop - surfaceOffset`.
- [x] **Props used the frame bottom instead of the alpha-derived foot.** `drawDecorations` now passes
  each prop's measured `anchorY`; generated chest/altar/gate/portal/hazard frames also measure their
  opaque bottom row and use it.
- [x] **Church ground tiles were wrong crops.** The old top frames included transparent padding and a
  blank frame; the body/deep frames came from small standalone ground chunks (the chess/side-lip
  look). Church now uses one fully opaque 16×16 stone block from the large purple wall slab for
  top/body/deep (`groupWidth: 1`, `surfaceOffset: 0`), so the background bottom and floor meet.
- [x] **Chests/props were generated over pits and raised blocks.** `addChest` now requires a solid or
  one-way support below the target tile; `addDecor` skips columns with raised secret/fake walls;
  dungeon statues skip pits. The map is created before room dressing so these checks are real.
  One-way ledges shorter than 3 tiles are rejected by alignment validation.
- [x] **`npm run validate:alignment`** added. It measures top/body alpha, checks physics/tilemap
  surface within ±1px, checks every placed prop/chest/altar/gate/checkpoint against its support,
  and fails with zone/object names.

Measured alignment:

| Zone | Top fill rows | `surfaceOffset` | `footSink` | Physics surface |
|---|---|---:|---:|---:|
| Cemetery | 11 / 11 / 9 / 11 | 10 | 5 | 129 |
| Church | 0 | 0 | 0 | 144 |
| Swamp | 7 / 6 / 7 / 6 / 7 | 7 | 5 | 132 |
| Dungeon | 0 / 0 / 0 / 0 | 0 | 1 | 143 |
| Forest | 0 | 0 | 5 | 139 |

`npm run validate:alignment` result:

```text
cemetery  route=0 surface=129 painted=134 footSink=5 manifestOffset=10 measuredRows=11/9 props=11
church    route=1 surface=144 painted=144 footSink=0 manifestOffset=0 measuredRows=0/0 props=6
swamp     route=2 surface=132 painted=137 footSink=5 manifestOffset=7 measuredRows=6/7/6 props=11
dungeon   route=-1 surface=143 painted=144 footSink=1 manifestOffset=0 measuredRows=0/0/0/0 props=9
forest    route=3 surface=139 painted=144 footSink=5 manifestOffset=0 measuredRows=0/0 props=13

✓ Alignment validation passed: 5 zones, 50 props, 124 placed objects, footSink applied, ±1px tolerance.
  ground props checked: 50; one-way ledges are at least 3 tiles wide.
```

## Known issues — facing audit and pit AI (2026-11-02)

- [x] **Facing audit page added at `?debug=facing`.** `src/ui/FacingDebugPage.js` renders every
  player/enemy/boss sprite as raw frame + manifest facing, then through the game's own atlas,
  `SpriteBatch` and `shouldFlipSprite` path for `target LEFT` and `target RIGHT`. No facing values
  were guessed or changed in this pass; the user can compare the cards and name the wrong ones.
- [x] **Ground enemies no longer walk into pits.** `Enemy.probeGap()` checks the first tile ahead and
  scans up to `PHYSICS_BOUNDS.maxGapTiles` for a same-height landing. Jump-capable species leap when
  a landing exists; others stop/retreat instead of accumulating at the edge.
- [x] **Chargers check pits during their strike.** A charger that reaches a gap either clears it with
  a pit jump or cancels into recovery; it does not run into the pit.
- [x] **Spike damage:** `CombatDirector.applySpikeDamage()` damages enemies on `kind: 'spikes'`
  hazards with `GAME.hazards.spikeDamage * enemyDamageMultiplier`; the multiplier and hit interval
  are in `src/config/game.js`.
- [x] **Despawn + spawn budget refund:** enemies that fall below `pitFallDepth` or make no forward
  progress for `pitStuckSeconds` are despawned without kill/XP rewards; `SpawnDirector.refund()`
  returns their spawn cost to the budget.
- [x] **Separation respects pits:** `Game.canSeparateTo()` now requires same-level ground support, so
  the push cannot shove an enemy over a gap.
- [x] **Deterministic 1D pit simulation:** `tests/pit-ai.test.js` verifies a jump-capable enemy
  crosses a two-tile pit and a non-jumping enemy either crosses or safely despawns inside 10 seconds.

## Known issues — world seating, occupancy and dev inspection (2026-11-02)

- [x] **Dev-only URL parameters:** `?zone=...`, `?seed=N`, `?peaceful=1`, `?fly=1` and
  `?debug=gallery` auto-start the selected zone. `peaceful` blocks spawns/bosses; `fly` gives
  immortal free flight; gallery auto-scrolls the zone and `N` / `P` switch zones. Parsing is gated by
  `import.meta.env.DEV`; production builds ignore these gameplay parameters.
- [x] **Foot sink:** per-zone `GAME.footSink` values (cemetery 5, church 0, swamp 5, dungeon 1,
  forest 5) are added to the alpha `surfaceOffset`. Physics, spawn, player/enemy feet, props, chests,
  gates and collision all use the effective surface. F3 prints `FOOT SINK`.
- [x] **Foreground grass fringe:** `TileChunks` builds a separate 5-px strip from the visible top
  tile rows (not the transparent frame padding), using the same tile material, rendered at order 2.6
  in front of actors. Cemetery, swamp and forest use it; church/dungeon use zero fringe.
- [x] **Occupancy layout:** `LayoutGrid` stores prop/platform/structure/chest/gate footprints per
  zone. Props shift/omit on collision; large props (>56px) avoid platforms/structures; chests require
  solid/one-way support, two clear tiles above and no gate/chest/structure overlap; enemy spawn
  candidates stay 4 tiles away from chests.
- [x] **Layout validation:** `npm run validate:layout` checks 100 seeds × 5 zones for prop/platform/
  chest/gate overlaps, floating or clearance-bad chests, and unsupported single-tile structures.
- [x] **Facing page controls:** every sprite card has a `TERS` button; it flips only the page-local
  facing, redraws both game-path states, and updates the copyable JSON at the bottom.
- [x] **Skeleton facing fix:** `bone_thrall` and `wight` source sheets face left; their manifest
  `facing` values were corrected from `right` to `left`, so they walk toward the player instead of
  away from them. Remaining sprites still use the audit page before any further manifest change.
- [x] **Walker hop removed:** ground chasers no longer roll a random jump while approaching from
  range. Bone thralls/wights now stay grounded and only jump when the pit AI detects a crossable gap;
  bouncer slimes keep their intentional jump behavior.
- [x] **Pit/trap hardening:** ground enemies probe gaps and jump within the physics envelope or
  retreat/despawn; spikes damage both player and enemies; despawns refund spawn budget; separation
  requires same-level support. `tests/pit-ai.test.js` covers the 10-second outcome.
- [x] **Crowd variation:** every enemy instance gets a random animation phase, a speed multiplier
  inside ±8% and a ±5% per-channel tint jitter (`GAME.enemyAI.crowd`). The spawn director keeps at
  most 3 same-type enemies within one 640px screen of the player, filtering both normal and elite
  picks and re-checking before placement.

## Known issues — tilemap audit and all-zone map dressing (2026-11-02)

- [x] **Tile size/spacing audit:** every terrain sheet is 16x16 with source `margin: 0`,
  `spacing: 0`. `npm run validate:tiles` checks all frame rectangles and reads the cemetery Tiled
  reference map (300x14, 16x16, three layers). Dungeon remains a named-region sheet, not a guessed
  uniform grid.
- [x] **Edge-aware tile catalog:** each zone now has left/right top, body and deep frames. TileChunks
  chooses them from horizontal neighbours, so pits and ledge ends close with the proper source edge
  instead of repeating a middle brush. Hazard-filled tiles no longer put a grass top at the bottom
  of a shaft.
- [x] **Explicit layer order:** background, tile, prop, generated, actor, fringe, XP and particle
  orders live in `GAME.rendering.layers`; the renderer no longer relies on scattered magic numbers.
- [x] **Boot regression fixed:** `TileChunks` used `GAME.rendering.layers` without importing
  `GAME`, causing a menu-scene `ReferenceError`. The generic boot overlay hid it as an asset error;
  the config import is restored and `npm run build`/tests pass.
- [x] **Outdoor composition:** cemetery/church/swamp pits and floating shelves are reduced. Ground
  chest fallbacks keep loot available when a room has no shelf. The forest keeps more platforming.
- [x] **Source-density decor:** cemetery gains seeded tree/bush backdrops; church gains the supplied
  column and balustrade as non-colliding background pieces, matching the pack's reference scene.
- [x] **Camera composition:** `GAME.camera.offsetY` moved the world ground line from ~56% to ~70%
  of the 360px viewport. The extra vertical space exposes the new dungeon depth layers.
- [x] **Dungeon floor depth:** body and deep dungeon tiles now darken by depth (about 26% -> 14%)
  instead of using one flat bright brick value for the whole lower half.
- [x] **Surface dressing:** seeded moss, puddle, crack, rubble and broken-brick decals are composed
  from supplied dungeon floor/wall crops. They stay out of gate/chest proximity and do not collide.
- [x] **Six handcrafted dungeon rooms:** `src/data/dungeonRooms.js` defines torch procession,
  cellblock, throne dais, chain pit, treasury and collapsed steps. Five are selected/ordered per
  seed; four or more set-piece types are guaranteed.
- [x] **Dungeon backgrounds:** seven layers use supplied wall-panel crops with separate parallax/tint.
  The 128x117 wall crop is split around its four transparent separator rows and stacked on matching
  lower/upper block cadence, removing the horizontal band seen in the old screenshot. No new raster
  assets.
- [x] **Set pieces:** cellblock, throne/altar, chain-pit, torch corridor and treasury arrangements use
  wall panels, statues, torches, pits, ledges and chests. Statues are filtered against platform/chest/
  gate occupancy; they are no longer placed under platforms.
- [x] **Platform bodies:** every static one-way ledge gets a two-row body, end supports and a forest
  log / swamp root underlay where the atlas provides one. Dungeon ledges use brick body rows and end
  consoles; moving platforms receive an underside as well.
- [x] **Doors:** generated doors are framed by a stepped stone arch assembled from the active zone's
  tile body frames. Dungeon gates draw an iron portcullis grid. Entering plays a short gate lift/
  fade animation; the existing `E` prompt names the target zone.
- [x] **Atmosphere:** dungeon torches emit additive orange glow with flicker, the dungeon vignette is
  slightly stronger and dust now drifts slowly upward instead of falling like debris.
- [x] **Foot seating:** grass zones use footSink 5 and the foreground fringe now samples the visible
  top rows of the tile (not transparent padding), so the character's ankles sit inside the grass line.
  This also fixes the previous fringe being invisible on cemetery/swamp tiles.
- [ ] **Missing supplied art (reported, not invented):** dedicated dungeon arch/chain/column/cell-bar/
  chest/altar/door sprites and a surface-decal sheet do not exist. `ASSET_REPORT.md` section 12 records
  the pieces and the atlas-crop fallbacks used instead.

Layout validation result after the map-dressing pass (100 seeds × 5 zones):

```text
zone      props  chests gates  platforms overlaps floatingChests clearanceBad tinyStructures
cemetery  1017   591    300    3272      0        0              0            0
church    498    588    200    3196      0        0              0            0
swamp     1073   610    200    3302      0        0              0            0
dungeon   2503   999    100    3990      0        0              0            0
forest    1226   781    100    5205      0        0              0            0

✓ Layout validation passed: 100 seeds × 5 zones; zero overlaps, floating chests,
  clearance violations or unsupported single-tile structures.
```

## Completed phases

### Phase 0 — Discovery and planning
- Recursive asset audit, PNG dimension scan, alpha-component and 16px occupancy analysis.
- Visual inspection of all tilesets, player sheets, enemies, backgrounds and props.
- Confirmed `three@0.187.0`; Vite + Vitest + local Pixelify Sans installed.
- Produced `ASSET_MANIFEST.json`, `ASSET_REPORT.md`, `ARCHITECTURE.md`, `CREDITS.md`.
- Established three style families and five zone mappings with fade transitions.

### Phase 1 — Core
- Pixel-perfect 640×360 WebGLRenderer with integer stage scaling and letterboxing.
- Fixed 60 Hz loop with interpolation and tab-hide spiral-of-death protection.
- Keyboard input with edge detection; coyote time, jump buffer, variable jump, dash i-frames.
- Camera rig with bounded follow, integer snapping and configurable screen shake.
- Runtime per-family canvas atlases with 2px bleed gutters and nearest filtering.
- Instanced sprite batch with per-instance UV, flip, tint, flash and alpha.
- Chunk-merged static tile rendering with camera culling.
- Seeded room-based cemetery generation, parallax backdrop, decorations, main menu, character select,
  HUD, settings shell, toasts and debug scaffold.
- Verified in headless Chrome: no console errors, no failed requests, movement/jump/dash work.

### Phase 2 — Combat and playable slice
- Basic/heavy/special attacks, projectiles, melee arcs, cooldowns, dash i-frames and hurt states.
- Hitstop, knockback, crits, tint/flash feedback, screen shake, pooled particles and damage numbers.
- Synthesized WebAudio SFX for attacks, hits, pickups, UI and deaths.
- Enemy state machines (walker, charger, flyer, ranged, burrower/brute variants), health bars, death
  fragments and reward drops.
- Player death/respawn, checkpoints and the first playable combat loop.

### Phase 3 — Roster, progression and bosses
- Four playable characters with distinct stats, weapons, heavies, abilities, passives and evolutions.
- XP crystals with magnetic attraction, level-up overlay, 13 capped upgrades and weapon-level scaling.
- 10 normal enemy types + 2 elites with zone pools and adaptive spawn director.
- Three phased bosses: Mourning Maw, Seraph of Ash, Drowned Choir.
- Boss arenas lock the exit, telegraph attacks, expose a health bar, drop shards and guaranteed chests.
- 12 achievements and persistent meta currency/unlocks/bonuses.

### Phase 4 — World and zones
- Five seeded zones: cemetery, church, swamp, dungeon, forest.
- Seed-generated main route `cemetery → shuffled(church, swamp) → forest` plus optional cemetery crypt
  door to the dungeon.
- Room templates, jumpable gaps, one-way platforms, moving platforms, spike/water hazards, checkpoints.
- Breakable walls, fake walls, hidden chests, altars, gates/portals and the Final Gate.
- Animated water shader and zone-specific parallax/fog/weather.

### Phase 5 — UI, settings and result flow
- Main menu, character select with unlock costs, HUD, pause, settings, achievements, seed entry,
  level-up cards, credits, boss bar, damage layer, toasts and result screen.
- English/Turkish localization in one strings file; language switch persists.
- Audio volume/mute, screen shake, flash, damage numbers, fullscreen and reset settings.
- Result screen with time, kills, bosses, level, XP, shards, strongest upgrades and achievements.
- Run summary is persisted through `SaveStore.recordRun`.

### Phase 6 — Polish and performance
- Spatial hash for enemy queries, object pools for projectiles/particles/XP orbs, instanced batches and
  merged tile chunks.
- Stress test: 150 enemies and ~939 particles at 11 draw calls with no console errors.
- Pixel-snapped camera/sprites/shake; integer-only sprite scales; nearest filtering throughout.
- F3 debug overlay reported FPS, draw calls, entities, particles, spawn budget, zone/seed, position and
  state.
- Procedural interactable icons for assets absent from packs; style-family isolation and zone tinting.

### Phase 7 — Validation and delivery
- `scripts/validate-world.js` validates reachability, transitions, checkpoints, chests, arenas and map
  bounds for seeds 1..100; custom seed ranges supported.
- Vitest suites cover RNG determinism, upgrade caps/evolutions, seeded world generation and all 12
  achievements (including duplicate-unlock protection).
- Documentation reconciled with final implementation (`README.md`, `ARCHITECTURE.md`, `ASSET_REPORT.md`,
  `CREDITS.md`, `PROGRESS.md`).
- Production preview smoke-tested end to end with zero console errors or bad requests.

## Commit log

- `fb29b34` — phase 0: asset audit and project scaffold.
- `24457a7` — phase 1: pixel-perfect core, movement and cemetery scene.
- `033e671` — phases 2–7 implementation: combat, roster, bosses, world, UI, meta and polish.
- `f0a9df8` — phases 2–7 QA: seed-world validator and Vitest coverage.
- A following docs commit reconciles README/architecture/asset/progress documentation with the final
  implementation and records the known scope limits.

## Decisions / assumptions

- Render resolution is 640×360 (not ~480×270) because the supplied forest backgrounds are native
  640×360; integer scaling preserves pixel density.
- Gothicvania cemetery/church/swamp form one art family; dungeon and forest are isolated zones with
  palette/tint grading and fade transitions.
- Kael uses the swamp hunter sprite (ranged poses); Nyx uses the cemetery hero sword sprite.
  Brakk uses the church monk; Seraphine uses the church wizard as a levitating caster.
- Bosses: Mourning Maw = hell-gato, Seraph of Ash = church angel, Drowned Choir = clustered swamp
  ghosts.
- No chest/altar/gate/spike/moving-platform art exists in the packs; these use documented procedural 1×
  pixel icons. No supplied asset is imitated or redistributed.
- Achievements unlock immediately and are saved at run end with the currency total.
- Continue is not a persistent mid-run save; each descent starts fresh (roguelite behavior). Settings,
  unlocks, achievements and meta currency persist.
- Phase 2–7 work was completed in continuous sessions rather than a separate commit per phase; the final
  snapshot is buildable and fully verified.

## Known limitations / stretch goals not implemented

- No separate final boss encounter after the Final Gate; the gate ends the run in victory.
- No world-map screen.
- No animated waterfalls (no suitable frames in supplied packs).
- No mid-run save/continue.
- No external music/SFX files; all audio is synthesized.
- The swamp background composition can look murky at native tile edges; the water shader and tinting are
  functional but deliberately restrained.
- The map is five wide rooms per zone (room-based, not a full metroidvania); this matches the approved
  scope and the 100-seed validator.
