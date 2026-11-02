# HELLSHARD — Agent Guide

Before any work: read `HELLSHARD_SPEC.md` (single source of truth) and `PROGRESS.md`.
Update `PROGRESS.md` after each phase and commit the working game.

## Stack
- Three.js 0.187.0, Vite, vanilla ES modules (no framework).
- Vitest for pure-logic tests.
- All runtime assets are local under `public/assets`. No CDN requests.
- Turkish conversation, English code/comments/file names.

## Commands
- `npm install`
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview build
- `npm test` — Vitest
- `npm run validate:world` — generate and validate seeds 1..100
- `npm run validate:world -- 1 300` — custom seed range

## Architecture rules
- `src/config` contains tunables only. No magic gameplay numbers elsewhere.
- `src/data` contains pure data (characters, enemies, bosses, zones, achievements).
- `src/core` owns loop, input, RNG, save, audio, event bus.
- `src/render` owns WebGL, atlasing, sprite batching, camera, particles, tile chunks.
- `src/world` owns world generation, collision, zones, atlas definitions.
- `src/entities` owns player, enemies, bosses, projectiles, pickups.
- `src/combat` owns damage/hitstop/feedback.
- `src/systems` owns spawn director, progression, achievements.
- `src/ui` owns DOM overlays only. Never fake a mechanic in UI.
- Keep modules under ~400 lines. Use config constants, no inline magic values.
- Simulation is fixed 60 Hz; rendering interpolates and snaps to whole pixels.
- Do not mix asset style families inside one zone. Visual scale differences are normalized
  through `ASSET_MANIFEST.json`; gameplay physics always uses one 16-unit world tile.
- No non-integer sprite scale. No blurry filtering. No texture bleeding.
- Do not add assets outside the five approved `public/assets` folders.
- The game must boot without console errors after every phase.
