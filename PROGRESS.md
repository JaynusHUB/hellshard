# HELLSHARD — Progress

## Current phase
Phase 2 — Combat core (in progress)

## Completed
### Phase 0 — Discovery and planning
- Recursive asset audit, PNG dimension scan, alpha component and 16px occupancy analysis.
- Visual inspection of all tilesets, player sheets, enemies, backgrounds and props.
- Confirmed `three@0.187.0`; Vite + Vitest + local Pixelify Sans installed.
- Produced `ASSET_MANIFEST.json`, `ASSET_REPORT.md`, `ARCHITECTURE.md`, `CREDITS.md`.
- Established three style families and five zone mappings with fade transitions.

### Phase 1 — Core
- Pixel-perfect 640×360 WebGLRenderer with integer stage scaling and letterboxing.
- Fixed 60 Hz loop with interpolation, tab-hide spiral-of-death protection.
- Keyboard input with edge detection; coyote time, jump buffer, variable jump, dash i-frames.
- Camera rig with bounded follow, integer snapping, configurable screen shake.
- Runtime per-family canvas atlases with 2px bleed gutters and nearest filtering.
- Instanced sprite batch with per-instance UV, flip, tint, flash and alpha.
- Chunk-merged static tile rendering with camera culling.
- Seeded room-based cemetery generation, parallax backdrop, decorations, main menu, character select, HUD, settings shell, toasts and debug scaffold.
- Verified in headless Chrome: no console errors, no failed requests, movement/jump/dash work, 8 draw calls.

## Phase log
- Phase 0 commit: asset audit and scaffold.
- Phase 1 commit: pixel renderer, fixed loop, player movement, cemetery scene, menu flow.

## Assumptions / decisions
- Render resolution is 640×360 (adjusted from the suggested ~480×270) because the supplied
  forest backgrounds are native 640×360. Integer scaling preserves pixel density.
- Gothicvania cemetery/church/swamp form one art family; dungeon and forest are isolated zones.
- No chest sprite exists in the packs. Chest visuals will use a clearly designed procedural relic
  or the supplied dungeon crate rather than an unmarked placeholder.
- Seraphine uses the wizard sprite as a levitating caster because it has no walk cycle.
- Continue functionality is not persistent mid-run; each descent starts fresh (roguelite behavior).

## Next
- Implement full basic/heavy/special attacks, feedback stack, enemy core, skeleton/wisp enemies,
  health/death, hitstop, damage numbers and synthesized SFX.
