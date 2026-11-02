# HELLSHARD — Asset Report

All findings below come from recursive scans, alpha-component analysis, pixel occupancy grids,
and direct visual inspection of the PNGs. No external asset pack is referenced or used.

## 1. Package inventory

| Folder | Files | Size | PNG | GIF | Role |
|---|---:|---:|---:|---:|---|
| `public/assets/cemetery` | 136 | 7.28 MB | 95 | 12 | Gothicvania Cemetery pack |
| `public/assets/church` | 136 | 1.25 MB | 101 | 20 | Gothicvania Church pack |
| `public/assets/swamp` | 77 | 843 KB | 63 | 6 | Gothicvania Swamp pack |
| `public/assets/dungeon` | 2 | 12.6 KB | 1 | 0 | ThePixelist castle dungeon sheet + Aseprite source |
| `public/assets/fantasy forest map` | 11 | 239 KB | 11 | 0 | KilluaKage Fantasy Forest tileset, backgrounds, decor, slime |

No license or readme file was bundled inside `public/assets`. License findings were verified on the
original distribution pages and are recorded in `CREDITS.md`.

## 2. Style families

### A. Gothicvania (cemetery + church + swamp)
- Detected tile grid: **16×16 px** in all three packs.
- One artist (ansimuz), shared silhouette language, outlines and pixel density.
- Palette shifts by biome: cemetery olive/rust, church violet/cold blue, swamp moss/sickly green.
- Character frames are drawn at native 1× and their frame sizes differ only because of the pose canvas,
  not because of different pixel density.
- Decision: **one compatible style family**. All three biome palettes are normalized with per-zone
  tints (see `presentation` in `ASSET_MANIFEST.json`). Zone-specific palettes still read distinctly.
- All four player characters and nearly all enemies/bosses are sourced from this family.

### B. Dungeon (ThePixelist)
- One sheet (305×215). It is **not a uniform tile grid**: it is a composite sheet with 16px horizontal
  floor strips, 34×58 torches, 42–44×96 statues, 128×48/65 wall sections, and a 128×16 brick floor.
- Alpha-component analysis found 16 meaningful components. We use them as named 1× sprite regions
  (see `tiles.dungeon` and `props.dungeon`), not as guessed 32×32 cells.
- Palette is flat charcoal/grey and lower saturation than Gothicvania.
- Decision: visually isolated underground zone. Gothicvania actors get a cool, desaturated zone tint
  and the background is heavily darkened by the renderer. No other pack appears in the dungeon.
  The 16px floor strip is compatible with 16px world tiles. Composite masonry is texture, not physics.

### C. Fantasy Forest (KilluaKage)
- Tileset is a 192×112 sheet on a **16×16 grid**, containing 48×48 assembled moss/dirt blocks and
  loose border pieces. Dark red-brown dirt with teal-green moss, muted palette, heavier ambient.
- Also ships four 640×360 parallax backgrounds, one 256×192 decor sheet, and one 64×16 jumping-slime
  sheet (4 frames of 16×16).
- Decision: separate forest zone reached through a fade portal, with its own sustain and green fog.
  Gothicvania actors are tinted cooler/greener; only the forest slime remains 100% native forest art.

## 3. Confirmed dimensions and frame grids (used assets)

### Characters
| Sprite | Source | Frame | Frames / animation |
|---|---|---|---|
| Cemetery hero (Nyx) | individual PNGs | 100×59 | idle 4, run 6, jump 4, attack 5, hurt 1 |
| Church monk (Brakk) | `player.png` 1106×180 | 82×60, 13 cols | 36 frames; tags jump/fall/flying kick/crouch/crouch-kick/kick/hurt/idle/punch/walk |
| Church wizard (Seraphine) | `wizard.png` 1215×66 | 81×66, 15 cols | idle 5, fire 10 |
| Swamp hunter (Kael) | individual PNGs | 62×54 | idle 6, run 14, jump 2, fall 2, hurt 2, shoot 3, crouch 3 |

### Enemies / bosses
| Sprite | Frame | Frames |
|---|---|---|
| Skeleton | 44×52 | 8 |
| Skeleton clothed | 44×52 | 8 |
| Ghost | 37×65 | 4 |
| Hell gato | 96×53 | 4 |
| Burning ghoul | 57×60 | 8 (v1 action frames) |
| Church wizard (cultist reuse) | 81×66 | idle 5 + cast 10 |
| Swamp spider | 32×21 | 4 |
| Swamp thing | 33×45 | 4 |
| Swamp ghost | 31×44 | 4 |
| Forest slime sheet | 16×16 | 4 |
| Church angel | 122×117 | 11; attack 3 + idle 8 |

### FX / props / backgrounds
- Fireball: 78×26 sheet → 3 × 26×26.
- Church enemy death: 729×66 → 9 × 81×66.
- Cemetery props: 10 sliced objects (27×33 to 176×171).
- Church column: 114×190. Church background atlas: 624×192.
- Cemetery background layers: 384×224, 384×123, 192×179.
- Swamp background 96×256, mid layers 208×256, tree mass 288×208, props sheet 176×43.
- Dungeon: torches 34×58/60 (4 variants), statues 42–44×96, wall chunk 128×48, spikes 32×18.
- Forest: backgrounds 640×360, decor 256×192, trees up to 76×78.

## 4. Visual verdict and conflict handling

- Gothicvania church/swamp characters use the same native pixel size as the cemetery characters; they
  can share a scene safely once palette is shifted. The game uses one runtime atlas for this family.
- ThePixelist dungeon art is **not** stylistically identical: flatter stone shading, sharper black
  outlines, no Gothicvania-style colored rim light. It is isolated as an underground region and
  normalized through a cool desaturated palette grade + torchlight. Actors are never displayed over
  forest art without a fade.
- KilluaKage forest art is muted teal and has a different mossy edge language. It is isolated in the
  forest zone behind a portal/fade. Gothic actors receive the forest tint. No tile from another pack
  is used in the forest tilemap.
- Tile size mismatch is handled by using 16px world logic everywhere, and by using source regions
  at native 1× for visual props. No non-integer scales are used for characters.
- There is no dedicated oversized boss sprite except the **angel** (122×117). Bosses therefore use:
  - Mourning Maw — hell gato (96×53), larger than all normal enemies, with aura/telegraphs/phases.
  - Seraph of Ash — church angel (122×117), a true large silhouette.
  - Drowned Choir — three native 1× swamp ghosts rendered as one clustered silhouette plus arena VFX.
  This honors the brief's fallback rule without introducing programmer art.
- Seraphine has no walk cycle. Her role is a levitating frostweaver: idle hover bob + cast frames +
  dash afterimages, rather than fake leg sliding. This is a deliberate mechanical/visual fit.

## 5. Character sprite assignment

| Character | Sprite source | Distinct color / effects |
|---|---|---|
| Kael the Frostbow | Swamp hunter | ice-blue tint, bow poses, frost arrow trails, snow burst |
| Brakk the Berserker | Church monk | ember tint, red slash arc, blood droplet particles |
| Seraphine the Frostweaver | Church wizard | violet-white tint, levitation, orbiting ice motes |
| Nyx the Shadowblade | Cemetery hero | indigo tint, sword poses, shadow afterimages, void wisps |

All four use different attack logic and stats (see `src/data/characters.js`); they are not palette-only
reskins.

## 6. Normalization plan

- World tile: 16 logical units. Character frames drawn at source native resolution (integer 1×).
- Runtime atlas per style family (gothic / dungeon / forest) built in canvas at load time with 2px
  transparent gutters. Nearest filtering, no mipmaps, no bleed.
- Tile visuals are region-based brushes: four/five-variant top/body/deep brushes per biome. Static
  visuals are merged into chunks; collision is a separate tile grid.
- Backgrounds keep native pixel size, repeat horizontally (`RepeatWrapping`, nearest), and are scrolled
  by integer pixel amounts.
- Large dungeon wall pieces are background props, not guessed tiles. Level collision uses the 16×16
  API, while those pieces keep their native art proportions.
- Zone tints: cemetery neutral, church cool violet, swamp moss, dungeon desaturated slate, forest green.
  Tint is applied in the instance shader; no new materials per entity.
- The five supplied packs contain no interactable chest/altar/gate/portal/spike/moving-platform art.
  `src/render/GeneratedSprites.js` draws these as 1× pixel icons into a separate runtime atlas using the
  same gothic palette and integer scale. They are presentation-only; gameplay objects live in world data.
  No generated icon imitates a supplied asset, and the generated atlas is documented here so the
  boundary between supplied and project-made art stays explicit.

## 7. World / transition implementation

- Start: Cemetery (hub and Final Gate).
- Seed-generated route: `cemetery → shuffled(church, swamp) → forest`.
- East gates connect route neighbours with a fade. Forest uses a portal because it belongs to a
  different art family.
- Cemetery ↔ Dungeon: crypt door in room 2 + fade (underground). This is optional and is not part of
  the main route.
- Boss arenas: Cemetery (Mourning Maw), Church (Seraph of Ash), Swamp (Drowned Choir). Each exit gate
  is sealed until its boss is defeated.
- Final gate: Cemetery, opens with three Hellshards and ends the run in victory.
- Same seed reproduces room templates, platform placements, decoration sets, treasures and secrets.
- All assets are loaded locally. Browser QA confirmed zero external requests and zero 404s.

## 8. Known limitations / notes

- The packaged assets did not include local license files. Licenses were verified from their original
  distribution pages (see CREDITS).
- The dungeon sheet's odd pixel dimensions mean no universal tile grid can be assumed; we deliberately
  encoded named regions after visual inspection.
- No forest water animation frames exist. The swamp water tile is a static pack tile; animation is done
  with a single time uniform inside the water shader for pooled water quads (no per-tile JS).
- No animated waterfall frames exist in any supplied pack, so waterfalls are not implemented.
- No chest, altar, gate, portal, spike or moving-platform sprites exist. Small procedural 1× pixel icons
  are generated at runtime (see section 6) instead of unmarked placeholders.
- Boss chests reuse the generated chest icon with a gold/red seal; their upgrade reward is guaranteed by
  the boss controller, not by visual chance.
- All SFX and ambient music are synthesized with WebAudio (no external audio files).
- Font is bundled locally via `@fontsource/pixelify-sans` (OFL).
- The final boss encounter and world-map screen were stretch goals and are not implemented. The Final
  Gate ends the run after the three shard bosses.
