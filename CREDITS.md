# HELLSHARD — Credits and Licenses

Runtime visuals and audio are local files under `public/assets`. No CDN-hosted
visuals or audio are loaded at runtime. The original HELLSHARD code, UI, game
design and generated sprites are © JAYNUS and released under the MIT License.
Third-party packs keep their own terms below.

## Art

### Gothicvania — Cemetery Pack
- Author: Luis Zuno (ansimuz)
- Source: https://opengameart.org/content/gothicvania-cemetery-pack
- License: **CC0 1.0 Universal**. Commercial use allowed. Credit appreciated, not required.
- Used for: cemetery tiles, backgrounds, props, Nyx sprite, skeleton, ghost, hell-gato, death FX.

### GothicVania — Church Pack
- Author: Luis Zuno (ansimuz)
- Source: https://opengameart.org/content/gothicvania-church-pack
- License: **CC0 1.0 Universal**. Credit: "by ansimuz" optional.
- Used for: church tiles, backgrounds, column, Brakk sprite, wizard/cultist, angel boss, burning ghoul,
  fireball and church death FX.

### GothicVania — Swamp Pack
- Author: Luis Zuno (ansimuz)
- Source: https://opengameart.org/content/gotthicvania-swamp
- License: **CC0** as verified from the original OpenGameArt listing / author statements. Commercial
  use permitted; credit appreciated.
- Used for: swamp tiles, parallax layers, trees/props, Kael sprite, spider, swamp thing, ghost, fire.

### 2D Medieval Castle Dungeon Tileset
- Author: TPC / ThePixelist
- Source: https://thepixelistcreator.itch.io/2d-medieval-castle-dungeon-tileset
- Terms: offered free; the author states **"Completely free"** and asks for credit. We credit TPC.
  No explicit license file was bundled. **Do not redistribute the assets as a standalone asset pack.**
- Used for: dungeon floors, masonry chunks, torches, statues, spikes and backdrop.

### Fantasy Forest Pixel Tileset
- Author: KilluaKage
- Source: https://killuakage.itch.io/fantasy-forest-pixel-tileset
- Terms: free for personal and commercial use, modification allowed. **You may not resell or
  redistribute the assets as-is; do not claim the art as your own.** Credit appreciated, not required.
- Used for: forest tiles, backgrounds, trees/props, moss slime.

## Audio

### Cemetery demo sound effects
- Source: bundled Gothicvania Cemetery demo (`public/assets/cemetery/demo/assets/sounds/`)
- Files: `attack.ogg`, `hurt.ogg`, `jump.ogg`, `kill.ogg`, `rise.ogg`
- License: **UNVERIFIED** — shipped inside the demo pack with no separate license file. Treat
  as demo-only until the source terms are confirmed.
- Used for: melee swing, player hurt, jump, enemy death and skeleton rise. Synthesized fallbacks
  remain in `AudioManager` if a file fails to decode.

### Music
- `sci_fi_platformer04_main_loop.ogg` — **UNVERIFIED: music loop, source unknown**.
  Used only for the cemetery zone; the path is a single config entry in `src/config/audio.js`.
- Other zones continue to use the synthesized ambient bed.

## Fonts

- **Pixelify Sans** — bundled locally via `@fontsource/pixelify-sans` (SIL Open Font License 1.1).
  No CDN. Fallback: `monospace`.

## Code / libraries

- **Three.js r187** (`three@0.187.0`) — MIT License.
- **Vite** — MIT License.
- **Vitest** — MIT License.
- **pngjs** (development-only asset analysis and validation) — MIT License.

## Generated art

The supplied packs do not include chests, altars, gates, portals, spikes or moving platforms.
`src/render/GeneratedSprites.js` draws those interactables as small 1× pixel icons at runtime, using an
original palette matched to the gothic zones. No generated icon is derived from or redistributed with
the supplied packs.

## Audio

The cemetery demo's five OGG effects and its music loop are used with synthesized WebAudio fallbacks
(see the Audio section above). Critical hits, dash, level-up, XP, boss warnings and ice/shadow
abilities remain fully synthesized.

## License note

The asset folders as delivered do not contain their own license/readme files. The licenses above were
verified from the original listings on 2026-11-02. If this project is redistributed, keep this file with
it and do not redistribute the dungeon/forest source art as a standalone asset collection.

The original HELLSHARD project — code, UI, game design, generated sprites,
written content and visual direction — is **© JAYNUS** and released under the
**MIT License**. See `LICENSE`. Third-party art and audio keep their own terms
described above; do not redistribute the dungeon or forest source art as a
standalone asset collection.
