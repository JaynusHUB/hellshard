# HELLSHARD — Progress

## Current status

**Complete.** Phases 0–7 are implemented. The game boots into the main menu, supports a full run from
the cemetery through the seeded church/swamp route to the Final Gate, and persists meta progression.

## Verification (final pass)

- `npm run build` — passes after the post-playtest fixes (60 modules, no errors).
- `npm test` — **20/20 tests passing** in 4 suites (RNG, upgrades/evolutions, world generation,
  achievements).
- `npm run validate:world` — **passed for seeds 1..100**: 100 worlds, 500 zones, max gap 4 tiles,
  max jump 70.5px, max distance 92.0px.
- `npm run build` — production build succeeds (atlases are generated at runtime; JS ~800 kB / 211 kB gzip).
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
