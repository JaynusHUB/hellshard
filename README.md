# HELLSHARD

A pixel-perfect dark-fantasy action roguelite built with Three.js and vanilla ES modules.
Descend through five seeded zones, claim three Hellshards, and open the Final Gate.

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
npm run validate:world   # validate seeded worlds 1..100
npm run validate:world -- 1 300
npm run validate:alignment # alpha-painted surface + prop/support alignment
```

Facing audit page (dev or preview):

```text
http://127.0.0.1:5173/?debug=facing
http://127.0.0.1:4173/?debug=facing
```
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
- **Three phased bosses:** Mourning Maw, Seraph of Ash and the Drowned Choir. Each drops a Hellshard
  and a guaranteed upgrade chest.
- **Progression:** XP crystals, magnetic pickup, level-up choices, 13 capped upgrades, weapon levels,
  and one evolution per character.
- **Five seeded zones:** cemetery, church, swamp, dungeon and forest. The route is
  `cemetery → church/swamp (seeded order) → forest`, with an optional crypt entrance to the dungeon.
- **World content:** handcrafted-by-generator rooms, platforming gaps, moving platforms, spikes, animated
  water, breakable walls, fake-wall secrets, hidden chests, altars, checkpoints and the Final Gate.
- **Meta progression:** persistent Hellshards, character unlocks, three permanent boon tracks,
  run history and 12 achievements. Saved in `localStorage`.
- **Presentation:** 640×360 internal resolution, integer letterbox scaling, nearest filtering,
  one texture atlas per art family, instanced sprite batches and merged tile chunks. F3 shows a
  collision overlay with the green physics floor, magenta alpha-painted surface and yellow
  sprite-anchor marker. Physics and props use per-zone `surfaceOffset` values measured from tile
  alpha, and `npm run validate:alignment` checks them across all five zones.
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
- `public/assets` — the five approved local art packs.
- `scripts/validate-world.js` — seed-range reachability and integrity validation.
- `tests/` — Vitest suites.

Detailed decisions and content mappings are in `HELLSHARD_SPEC.md`, `ARCHITECTURE.md`,
`ASSET_REPORT.md`, `ASSET_MANIFEST.json`, `PROGRESS.md` and `CREDITS.md`.

## Scope and known limitations

- The Final Gate ends the run with a victory result; there is **no separate final boss encounter**
  or world-map screen. Both were explicitly stretch goals.
- There is no mid-run save/continue. Runs restart from the beginning; meta progression persists.
- Waterfalls are not implemented because the supplied packs contain no suitable animated waterfall
  frames.
- Chests, altars, gates, spikes and moving platforms are rendered with small procedural 1× pixel icons
  created for this project, because those interactables are absent from the approved art packs.
  Their native pixel size matches the 16px world scale and they are batched separately.
- The swamp and forest are intentionally isolated art families and are reached through fades/portals;
  actors receive per-zone tint grading so styles never share a hard cut.
- No external audio files are used. All sound and ambient music are synthesized at runtime.

## Credits

See `CREDITS.md`. The five supplied art packs remain the property of their authors. Do not redistribute
the dungeon or forest source art as standalone asset packs.
