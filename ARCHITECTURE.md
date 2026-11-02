# HELLSHARD — Architecture

## Overview

HELLSHARD is a vanilla ES-module game rendered with Three.js. All visuals are 2D quads on an
orthographic camera, all fixed simulation happens at 60 Hz, and all gameplay uses a 16-unit world
tile. The render resolution is 640×360 by default because the largest provided background material is
native 640×360; the canvas is scaled by an integer factor and letterboxed. This keeps every sprite
pixel exactly aligned and avoids blur or fractional scales.

```
index.html
└─ src/main.js
   ├─ core/Game.js          orchestrates states and systems
   ├─ core/Loop.js          fixed 60 Hz + interpolated rendering
   ├─ core/Input.js         keyboard state edge detection
   ├─ core/AudioManager.js  WebAudio synth
   ├─ core/SaveStore.js     localStorage
   ├─ render/Renderer.js    WebGLRenderer, integer scaling, camera
   ├─ render/SpriteAtlas.js runtime canvas atlas + frame registry
   ├─ render/SpriteBatch.js one InstancedMesh per atlas, UV/tint/flash attrs
   ├─ render/TileChunks.js  merged static tile geometry per chunk
   ├─ render/Background.js  parallax layers
   ├─ render/Particles.js   one pooled instanced particle mesh
   ├─ world/WorldGen.js     seeded rooms, zones, secrets, validation metadata
   ├─ world/Tilemap.js      collision queries, one-way platforms, breakables
   ├─ world/ZoneManager.js  transitions and boss arenas
   ├─ entities/Player.js    input + movement + attacks + abilities
   ├─ entities/Enemy.js     shared state machine
   ├─ entities/Boss.js      phased bosses
   ├─ entities/Projectile.js pooled hostile/player projectiles
   ├─ entities/Pickup.js    XP, chests, shards
   ├─ systems/SpawnDirector.js budgeted off-screen spawns
   ├─ systems/Progression.js XP, levels, upgrades, evolutions
   ├─ systems/Achievements.js
   ├─ systems/Combat.js     damage, hitstop, knockback, death feedback
   ├─ ui/UIManager.js       DOM overlays and menus
   └─ ui/Strings.js         all en/tr strings
```

## Render pipeline

1. `WebGLRenderer` internal buffer is fixed at `640×360` (`renderer.setPixelRatio(1)`).
2. CSS dimensions are `640×s` and `360×s` where `s = floor(min(vw/640, vh/360))`, centered in a black
   letterbox. `image-rendering: pixelated` is set. All UI shares a same-size virtual stage and is scaled
   with the same integer factor.
3. `OrthographicCamera(-320, 320, 180, -180, 0.1, 100)`. Camera positions are floored to integer
   pixels each frame. Camera shake adds integer pixel offsets only.
4. Sprite frame sources are packed at runtime into one canvas atlas per style family. Atlas textures:
   `SRGBColorSpace`, `NearestFilter` for min/mag, `generateMipmaps=false`, `ClampToEdgeWrapping`.
   Every frame is padded by 2 transparent pixels as bleed protection.
5. One `InstancedMesh` + custom shader per atlas. Instance attributes: center, size, UV rect, flip,
   tint, flash, alpha. No per-entity material or geometry is created.
6. Static terrain is baked into merged BufferGeometry chunks (16×16 tiles) using the same atlas.
   Only chunks intersecting the camera frustum are rendered.
7. Particles use a single pooled instanced mesh and a color-only shader, 700 max. Death fragments pull
   colors from the atlas pixels of the dying frame (cached palette).
8. Backgrounds are separate repeat-wrapped textures on quads, scrolled by whole pixels.

## Simulation

- Fixed timestep `1/60`. `Loop` clamps accumulated time to avoid spiral-of-death and discards stale
  time after tab hide. Renderer receives interpolation alpha and snaps visual positions.
- Input edge states are latched and cleared after each fixed update.
- `Hitstop` freezes world simulation for 1–4 frames. Camera, UI, and audio still run.
- Collision: AABB vs. tilemap. One-way platforms only collide when falling. A spatial hash holds active
  enemies for projectile/melee queries.
- World generation is deterministic by `seed + zone + room`; no global RNG use during play that would
  make the layout non-reproducible. Gameplay RNG is a separate stream.
- Movement envelope constants live in `src/config/game.js`; generation and validation both import the
  same constants. Reachability is validated by `scripts/validate-world.js` for seeds 1..100.

## Data / config boundary

- `src/data`: characters, enemies, bosses, zones, achievements. Data only, no Three.js.
- `src/config`: physics, camera, difficulty timeline, upgrade limits, loot, UI colors. No entity logic.
- `ASSET_MANIFEST.json`: the only place asset paths, tile regions and animation frames are defined.
  New packs require only manifest + zone data changes, not renderer edits.
- `src/ui/strings.js`: every user-facing string in `en` and `tr`.

## Game flow / states

`BOOT → MAIN_MENU → CHARACTER_SELECT → PLAYING → (PAUSED | LEVEL_UP) → RESULT`
Additional overlays: settings, achievements, seed input, credits. Meta data persists in localStorage
(`hellshard.meta.v1`, `hellshard.settings.v1`). A run is fully reset at start and on death; world seed
selection is exposed in settings and on character select.

## Phase gates

Every phase must produce `npm run build` success, a clean console, updated `PROGRESS.md`, and a git
commit. The first playable slice is Phase 2. World validation and tests are expanded in Phases 5–7.
