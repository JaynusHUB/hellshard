# HELLSHARD

![HELLSHARD — a dark fantasy descent](docs/banner.png)

A pixel-perfect dark-fantasy action roguelite built with Three.js and vanilla ES modules.
Descend from the packaged cemetery through the Ashen Cathedral to the hand-authored
Dungeon Gate, claim three Hellshards, and open the last door.

## Requirements

- Node.js 20+
- A desktop browser with WebGL2 and WebAudio support

## Commands

```bash
npm install
npm run dev              # Vite dev server (http://127.0.0.1:5173)
npm run build            # production build into dist/
npm run preview          # serve the production build
npm test                 # Vitest logic tests
npm run validate:world   # validate seeded procedural worlds 1..100
npm run validate:world -- 1 300
npm run import:animations # regenerate Aseprite frame lists/durations from church JSON
npm run validate:tiles     # 16x16 frame, margin/spacing and source-bounds audit
npm run validate:maps      # packaged Tiled maps: GIDs, collision, spawn, objects
npm run validate:alignment # alpha-painted surface + prop/support alignment
npm run validate:layout    # 100 seeds × procedural zones prop/platform/chest occupancy
```

Dev-only inspection URLs (`npm run dev`):

```text
http://127.0.0.1:5173/?zone=cemetery&seed=20261102&peaceful=1
http://127.0.0.1:5173/?zone=dungeon_gate&fly=1
http://127.0.0.1:5173/?zone=dungeon_gate&x=1780&y=80&fly=1
http://127.0.0.1:5173/?map=cemetery_demo&peaceful=1&fly=1
http://127.0.0.1:5173/?screen=characters
http://127.0.0.1:5173/?screen=settings
http://127.0.0.1:5173/?debug=gallery&zone=church
http://127.0.0.1:5173/?debug=facing
```

Gallery mode: `N` / `P` switch zones. Fly mode: `WASD`/arrows, `Space` up, `S`/Down down.

Facing audit page (dev or preview):

```text
http://127.0.0.1:5173/?debug=facing
http://127.0.0.1:4173/?debug=facing
```

All runtime assets are local under `public/assets`; there are no CDN requests.

## Controls

| Action | Keys |
|---|---|
| Move | `A` / `D` or arrow keys |
| Jump | `Space`, `W`, or `Up` |
| Dash (i-frames) | `Shift` |
| Basic attack | `J` |
| Heavy attack | `K` |
| Character ability | `L` |
| Interact | `E` |
| Pause | `Esc` |
| Choose level-up card | `1`, `2`, `3` |
| Debug overlay | `F3` |

## Features

- **Four playable characters** with unique weapons, abilities, stats, unlock costs and evolutions:
  Kael the Frostbow, Brakk the Berserker, Seraphine the Frostweaver, Nyx the Shadowblade.
- **Combat:** basic/heavy/special attacks, projectiles, melee arcs, i-frame dashes, hitstop,
  knockback, crits, status effects, pooled particles, screen shake, damage numbers and synthesized SFX.
- **Enemies:** 10 normal enemy types plus 2 elites with distinct movement and attack state machines.
  Ground enemies probe pits, jump when their physics envelope permits, retreat/reposition otherwise,
  and safely despawn with spawn-budget refunds. Spike hazards damage enemies too, using configured
  multipliers.
- **Three phased bosses in the active route:** Mourning Maw, Seraph of Ash and the Gate Warden.
  Each drops a Hellshard and a guaranteed upgrade chest. The Drowned Choir remains authored for the
  disabled swamp.
- **Progression:** XP crystals, magnetic pickup, level-up choices, 13 capped upgrades, weapon levels,
  and one evolution per character.
- **Three active zones:** cemetery (packaged Tiled map), church (procedural) and the Dungeon Gate
  (hand-authored 160×12 Tiled map). Swamp, dungeon and forest generation is disabled because those
  maps were reported broken; their source assets remain in `public/assets` but they are not part of
  the active campaign route.
- **Dungeon Gate:** native 320×180 composition at 2× camera zoom, five parallax image layers,
  animated torches/lava/water tiles, 20 authored light halos, checkpoints, a moving lava lift,
  authored enemies, coins/potions, an iron key chest, a locked final gate and the Gate Warden boss.
- **World content:** handcrafted-by-generator rooms, platforming gaps, moving platforms, spikes, animated
  water, breakable walls, fake-wall secrets, hidden chests, altars, checkpoints and the Final Gate.
- **Meta progression:** persistent Hellshards, character unlocks, three permanent boon tracks,
  run history and 13 achievements. Saved in `localStorage`.
- **Presentation:** 640×360 internal resolution, integer letterbox scaling, nearest filtering,
  one texture atlas per art family, instanced sprite batches and merged tile chunks. F3 shows a
  collision overlay with the green physics floor, magenta alpha-painted surface and yellow
  sprite-anchor marker. Physics and props use per-zone `surfaceOffset` and `footSink` values measured
  from tile alpha; a foreground 5-px grass strip is drawn in front of cemetery/swamp/forest actors.
- **Hollow Keep dressing:** six hand-authored dungeon room templates, seeded floor decals, a
  depth-graded brick floor, six parallax background layers, torch glow, platform underbodies and
  tile-framed iron gates. Missing dedicated dungeon art is recorded in `ASSET_REPORT.md`.
- **Tilemap audit:** all five terrain catalogs are 16x16 with zero source margin/spacing and
  left/middle/right edge frames. `npm run validate:tiles` checks every crop rectangle and the
  supplied Tiled cemetery reference map.
- **Layout / inspection:** occupancy-grid placement prevents props, platforms, chests and gates from
  overlapping. Ledges are jump-reachable (max 3 tiles) and gain supported stairs; ground enemies
  spawn only on continuous base-floor runs. `npm run validate:layout` checks 100 seeds × 2 procedural zones for
  overlaps, floating chests, unreachable platforms and unsupported single tiles. Dev-only `?zone`,
  `?seed`, `?peaceful`, `?fly` and `?debug=gallery` parameters support world inspection.
- **UI:** main menu, character select, HUD, pause, settings, achievements, level-up cards,
  seed entry, credits, boss bar and result screen. English and Turkish localization.
- **Determinism / QA:** fixed 60 Hz simulation with interpolation, seeded generation and a
  seed-range validator. Vitest covers RNG, upgrade caps, world generation and achievements.

## Project structure

- `src/config` — gameplay, difficulty, upgrade and progression tunables.
- `src/data` — characters, enemies, bosses, zones and achievements.
- `src/core` — game orchestration, fixed loop, input, save data, audio, RNG.
- `src/render` — renderer, atlases, sprite batching, tile chunks, backgrounds, particles, water.
- `src/world` — seeded generation, collision, spatial hash and zone transitions.
- `src/entities` — player, enemies, bosses and player combat.
- `src/systems` — spawn director, progression, combat, bosses, interactions, run lifecycle, achievements.
- `src/ui` — DOM screens, HUD, strings and feedback.
- `public/assets` — local third-party art packs plus the authored `pool` dungeon-gate map.
- `scripts/validate-world.js` — seed-range reachability and integrity validation.
- `tests/` — Vitest suites.

Detailed decisions and content mappings are in `HELLSHARD_SPEC.md`, `ARCHITECTURE.md`,
`ASSET_REPORT.md`, `ASSET_MANIFEST.json`, `PROGRESS.md` and `CREDITS.md`. If you want to
build another Tiled map, start with `MAP_AUTHORING.md`.

## Scope and known limitations

- The Dungeon Gate's Final Gate ends the run with a victory result after the Gate Warden and the iron
  key are secured. There is **no world-map screen** and no post-gate dungeon level.
- There is no mid-run save/continue. Runs restart from the beginning; meta progression persists.
- Waterfalls are not implemented because the supplied packs contain no suitable animated waterfall
  frames.
- Chests, altars, gates, spikes and moving platforms are rendered with small procedural 1× pixel icons
  created for this project, because those interactables are absent from the approved art packs.
  Their native pixel size matches the 16px world scale and they are batched separately.
- The swamp and forest are isolated art families and remain disabled until their maps are re-authored;
  their assets remain in `public/assets`, and actors receive per-zone tint grading so styles never share
  a hard cut when they return.
- No external audio files are used for the other zones. Cemetery plays the packaged demo's five OGG
  effects and music loop; everything else is synthesized at runtime.

## Deploy

The build is a static Vite bundle; no environment variables or server code are required.

### Vercel

1. Import the repository at vercel.com.
2. Framework preset: **Vite**.
3. Build command: `npm run build`; output directory: `dist`.

`vite.config.js` uses a relative base, so the build also works from a subpath.

## Credits and license

See `CREDITS.md` for asset sources. The original HELLSHARD project — code, UI, game design, Dungeon Gate
map assembly, generated sprites and visual direction — is **© JAYNUS, all rights reserved**. It is
source-available, not open source.

Original repository: https://github.com/JaynusHUB/hellshard

If you use or reference any part of this project, you must credit **JAYNUS** and link to the original
repository. Copying, cloning, commercial use, redistribution, resale, original-asset reuse and
tutorial/course reproduction require written permission. See `LICENSE`.

The third-party art packs remain the property of their authors and keep their own licenses; do not
redistribute the dungeon or forest source art as standalone asset packs.
