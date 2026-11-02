# HELLSHARD — Architecture

## Overview

HELLSHARD is a vanilla ES-module game rendered with Three.js r187. All visuals are 2D quads on an
orthographic camera. Gameplay simulation is fixed at 60 Hz and uses a 16-unit world tile. The internal
render resolution is 640×360 because the largest supplied background material is native 640×360; the
canvas is scaled by an integer factor and letterboxed. This keeps every sprite pixel aligned and avoids
blur or fractional scaling.

```
index.html
└─ src/main.js
   ├─ core/Game.js              orchestration hub, scene lifecycle, frame update
   ├─ core/Loop.js              fixed 60 Hz + interpolated rendering
   ├─ core/Input.js             keyboard state and edge detection
   ├─ core/AudioManager.js      WebAudio synthesis and ambience
   ├─ core/SaveStore.js         localStorage meta/settings persistence
   ├─ core/RNG.js               seeded PRNG and seed combination
   ├─ render/Renderer.js        WebGLRenderer, integer stage scaling, camera
   ├─ render/AssetLibrary.js    manifest loading, runtime canvas atlases
   ├─ render/SpriteBatch.js     one InstancedMesh per atlas + tint/flash shader
   ├─ render/TileChunks.js      merged static tile geometry + front grass fringe
   ├─ render/WorldRenderer.js   terrain, decor, interactions, water, backgrounds
   ├─ render/BackgroundLayers.js parallax background quads
   ├─ render/EntityRenderer.js  player/enemy/boss/pickup/projectile sprite batching
   ├─ render/ParticleSystem.js  pooled additive and normal particle meshes
   ├─ render/WaterLayer.js      animated water shader
   ├─ render/GeneratedSprites.js procedural 1× interactable icons
   ├─ render/CollisionDebugOverlay.js F3 AABB/sprite/tile anchor diagnostics
   ├─ render/CameraRig.js       bounded follow camera, snap and shake
   ├─ world/WorldGen.js         seeded rooms, route, secrets, validation metadata
   ├─ world/Tilemap.js          collision queries, one-way platforms, breakables
   ├─ world/LayoutGrid.js       per-zone occupancy for props/platforms/chests/gates
   ├─ world/SpatialHash.js      active-enemy spatial queries
   ├─ world/ZoneSceneManager.js zone scene build/teardown and transitions
   ├─ entities/Player.js        movement, damage, dash, interaction state
   ├─ entities/PlayerCombat.js  attacks, abilities, projectiles, player VFX
   ├─ entities/Enemy.js         data-driven enemy state machine
   ├─ entities/Boss.js          phased boss state machine and patterns
   ├─ systems/SpawnDirector.js  budgeted off-screen spawns and difficulty pacing
   ├─ systems/Progression.js    XP, levels, upgrade offers, evolutions
   ├─ systems/CombatSystem.js   damage resolution, hitstop, knockback, feedback
   ├─ systems/CombatDirector.js hit routing, VFX, breakables, traps, death rewards
   ├─ systems/ProjectileSystem.js pooled player/hostile projectiles
   ├─ systems/XPOrbSystem.js    pooled magnetic XP crystals
   ├─ systems/InteractionSystem.js chests, altars, gates, checkpoints
   ├─ systems/BossController.js arena triggers, phases, shard/chest rewards
   ├─ systems/RunController.js  run lifecycle, summary, meta save
   ├─ systems/WorldLifeSystem.js moving platforms and ambient emitters
   ├─ systems/AchievementSystem.js achievements and meta rewards
   ├─ ui/UIManager.js           screens, HUD orchestration, input routing
   ├─ ui/MenuScreens.js         menu/char-select/settings/achievements HTML
   ├─ ui/SettingsViews.js       settings and achievements behavior
   ├─ ui/FeedbackLayer.js       toasts, damage numbers, debug overlay
   ├─ ui/FacingDebugPage.js    ?debug=facing raw/Batch left/right audit
   ├─ ui/HUD.js                 in-run HUD
   └─ ui/strings.js             every user-facing string in en/tr
```

## Render pipeline

1. `WebGLRenderer` internal buffer is fixed at `640×360` (`setPixelRatio(1)`).
2. CSS dimensions are `640×s` and `360×s` where `s = floor(min(vw/640, vh/360))`, centered in a
   black letterbox. `image-rendering: pixelated` is used. DOM UI shares the same virtual stage and is
   scaled with the same integer factor.
3. `OrthographicCamera(-320, 320, 180, -180, 0.1, 100)`. Camera positions are floored to integer
   pixels. Camera shake adds integer pixel offsets only.
4. Sprite frames are packed at boot into one canvas atlas per style family. Atlas textures use
   `SRGBColorSpace`, `NearestFilter` min/mag, `generateMipmaps=false`, and 2px transparent gutters.
5. One `InstancedMesh` plus a custom shader per atlas. Instance attributes carry center, size, UV rect,
   flip, tint, flash and alpha. Entities never create per-instance materials or geometry.
6. Static terrain is baked into merged BufferGeometry chunks (16×16 tiles). Only chunks intersecting
   the camera frustum are rendered.
7. Particles use pooled instanced meshes (normal + additive), capped at 720. Death fragments sample
   cached palette colors from the dying sprite frame.
8. The animated water layer is a single shader mesh per zone. The swamp uses the supplied static water
   tile plus a time uniform for scrolling/ripples; other zones use the procedural variant.
9. Backgrounds are repeat-wrapped quads scrolled by integer pixel amounts; style families never share a
   hard scene cut.

## Simulation

- Fixed timestep `1/60`. `Loop` clamps accumulated time, discards stale time after tab hide, and caps
  substeps to avoid the spiral of death. Rendering interpolates and snaps visual positions.
- Input edges are latched and cleared after each fixed update. UI screens can disable gameplay input.
- Hitstop freezes world simulation for 1-4 frames while rendering/UI/audio continue.
- Ground AI probes pits with `Enemy.probeGap`; jump-capable types use the configured jump envelope,
  others retreat and eventually despawn. Despawns refund the spawn budget. Spike damage uses
  `GAME.hazards` multipliers and is applied by `CombatDirector.applySpikeDamage`.
- Enemy instances randomize animation phase, ±8% movement speed and tint within
  `GAME.enemyAI.crowd`. `SpawnDirector` keeps each species at or below the configured
  same-type-per-screen cap before picking or placing a spawn.
- Collision is AABB vs. tilemap. One-way platforms collide only when falling. A spatial hash answers
  melee/projectile queries against active enemies.
- World layout is deterministic from `seed + zone + room`. Gameplay RNG is a separate stream, so
  replaying a seed reproduces the map but not necessarily every combat roll.
- Movement envelope constants live in `src/config/game.js`. Generation and `scripts/validate-world.js`
  import the same constants, so reachability validation cannot drift from the real jump physics.
- `ASSET_MANIFEST.json` stores a per-zone `surfaceOffset`: the first top-tile alpha row with at least
  60% horizontal fill. `GAME.footSink` lowers that surface by a further 0-3 pixels. `WorldGen` and
  `Tilemap` use `tileTop - surfaceOffset - footSink` as the physical floor; props, chests, gates and
  spawns are placed against that same line. `scripts/validate-alignment.js` verifies the painted rows,
  footSink and prop support.
- `LayoutGrid` records every prop/platform/chest/gate footprint. Decorations and chests are shifted or
  omitted on collision; `scripts/validate-layout.js` checks 100 seeds × 5 zones.
- Hollow Keep uses six hand-authored room templates in `src/data/dungeonRooms.js`; five are selected
  and ordered per seed. Steps, podiums, pits, ledges and set pieces are generated as data, then the
  occupancy grid verifies every chest and statue.
- Dungeon rendering uses a depth-graded brick floor, atlas-crop surface decals, six parallax layers
  (including screen-edge foreground pillars) and torch ember particles. Static and moving platforms
  receive underbodies/supports from their active biome tile family; gates get a stepped tile arch,
  an iron portcullis and a short lift animation before the fade.
- `GAME.camera.offsetY` places the ground line near 70% of the viewport so background vault layers
  remain visible without covering the player.
- Dev-only queries (`import.meta.env.DEV`) set zone/seed/peaceful/fly/gallery inspection modes; the
  gallery auto-scrolls a zone and `N`/`P` switch zones.

## Data / config boundary

- `src/data`: characters, enemies, bosses, zones and achievements. No Three.js imports.
- `src/config`: physics, progression, difficulty timeline, upgrade caps, loot and UI tunables.
- `ASSET_MANIFEST.json`: the only place asset paths, tile regions, animation frames and presentation
  data are defined. A new pack requires manifest + zone data changes, not renderer edits.
- `src/ui/strings.js`: every user-facing string in `en` and `tr`; English is the default.

## Game flow / states

`BOOT → MAIN_MENU → CHARACTER_SELECT → PLAYING → (PAUSED | LEVEL_UP) → RESULT`

Additional overlays: settings, achievements, seed input, credits. Meta data persists in localStorage
(`hellshard.meta.v1`, `hellshard.settings.v1`). A run is fully reset at start; the seed is selectable
from the main menu/settings and is stored for the next run.

Route: `cemetery → shuffled(church, swamp) → forest`. A crypt door in the cemetery opens the optional
dungeon. Boss arenas lock the camera and gate; each boss drops a shard and a guaranteed chest. Three
shards open the Final Gate in the cemetery, which ends the run in victory. There is intentionally no
separate final boss or map screen; those were stretch goals.

## QA / phase gates

- `npm run build` must succeed.
- `npm test` covers RNG determinism, upgrade caps/evolution gating, world generation and achievements.
- `npm run validate:world` checks reachability, transitions, checkpoints, chest presence and arena
  presence for seeds 1..100 (500 zones).
- Browser smoke tests verify menu → character select → gameplay → pause/settings → level-up →
  boss route → Final Gate → result with no console errors or failed requests.
- Known scope limits are recorded in `README.md` and `PROGRESS.md`.
