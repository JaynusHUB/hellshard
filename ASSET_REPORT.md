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

## 9. Playtest corrections (2026-11-02)

- **Church background:** the 624×192 sheet is a strip of five separate panels with 16px transparent
  separators. The old renderer repeated the whole sheet and stacked it twice, producing black seams and
  a translucent rectangle. The final background uses one cropped 160×192 window panel, aligned to the
  world ground line and repeated without separators.
- **Swamp background:** the supplied `background.png`, `mid-layer-02.png`, `mid-layer-01.png` and
  `trees.png` are four depth layers. All four are now used, bottom-aligned to the world ground with
  separate parallax speeds. Previously only three were used at arbitrary viewport offsets, leaving
  flat bands.
- **Dungeon floor body:** the old body/deep crops came from flat interior sections of the wall panel and
  read as empty black. Body and deep frames now reuse the native brick floor strip (`y=187`) with a
  darker runtime grade so the ground body has visible masonry.
- **Dungeon statues:** the knight/robed props were being drawn with the inverted sprite anchor and a
  dark, semi-transparent dungeon tint. The corrected anchor and a full-alpha, brighter dungeon prop
  grade restore their silhouettes.
- **Sprite anchors:** all sprite frames are now bottom-anchored by the measured opaque foot instead of
  being placed with the frame top at the world foot point. A stable per-sprite foot row is derived from
  the lowest opaque row across all clips, so animation frames share one ground line.

## 10. Round 2 playtest corrections (2026-11-02)

- **Source facing:** added `facing` metadata to every player/enemy/boss sprite in `ASSET_MANIFEST.json`.
  Verified against the PNGs: players, wisp and the wizard face right; skeletons, hell-gato, burning
  ghoul, bog brute and mire wraith use the left-facing source pose; angel/slime/spider are
  front-facing and default to right. Flipping is applied only when the movement/logical direction
  disagrees with the source facing.
- **Dungeon environment:** the room uses the native 128×16 brick floor strip for top/body/deep tiles.
  The wall is built from the two opaque wall panels at `[162,5,128,117]` and `[162,128,128,48]`,
  stacked from the world ground line with a darker far grade and a lighter base grade. Fixed torches
  use all four supplied torch frames; knight/robed statues provide vertical accents.
- **No dungeon column asset:** the supplied ThePixelist sheet contains torches, knight/robed statues,
  wall panels, a brick floor strip and spikes, but no standalone column. No column was invented; the
  wall panels and statues are the only vertical architecture used.
- **Enemy animation coverage:** dedicated attack frames were added for wight, wisp, hell-gato, burning
  ghoul, spider, bog brute, mire wraith and moss slime by reusing appropriate native frames. Hurt
  one-frame clips were added for every normal enemy. Death frames do not exist in the packs, so death
  uses squash/fade plus the existing palette/particle burst.

## 11. Alpha surface alignment (2026-11-02)

- **Painted surface measurement:** every zone's top tile rows were scanned from the PNG alpha channel.
  The first row with at least 60% horizontal opaque coverage is the painted surface. The measured
  offsets are stored per-zone as `tiles.<zone>.surfaceOffset` in `ASSET_MANIFEST.json`:
  cemetery 10px, church 0px, swamp 7px, dungeon 0px, forest 0px.
- **Church floor correction:** the old church top crops `(0,160)`, `(48,160)`, `(96,160)` included
  transparent top padding, one blank frame and standalone ground-chunk side lips; the body/deep
  crops were mostly transparent or split. The large purple slab at `(64,112)` is 32×32 and fully
  opaque, and its `(64,128)` lower half continues seamlessly. Church now uses one 16×16 top/body/deep
  column from that slab (`groupWidth: 1`), with `surfaceOffset: 0`.
- **Prop feet:** supplied prop frames use their measured opaque-bottom anchor; generated chest,
  altar, gate, portal, spike and moving-platform icons measure the same value from their runtime
  canvas. `drawDecorations`, interaction rendering and hazard rendering now pass that anchor.
- **Generator support rule:** ground decorations are skipped when a raised secret/fake wall occupies
  the column above them. Chests require solid or one-way support directly beneath their tile.
  Dungeon statues skip pits. One-way platforms shorter than three tiles are treated as invalid
  unsupported ledges by `validate:alignment`.

## 12. Hollow Keep map dressing pass (2026-11-02)

- **Room templates:** `src/data/dungeonRooms.js` defines six hand-authored Hollow Keep room layouts:
  torch procession, cellblock, throne dais, chain-pit hall, treasury and collapsed steps. Five are
  selected and ordered per seed. They add one-tile steps, raised podiums, pits, one-way ledges, chests
  and a dais altar while keeping the entry/exit columns free.
- **Floor depth:** dungeon body tiles now darken by distance below the surface row (about 26% at the
  first body row down to 14% after four rows). The lower half of the screen is no longer the same
  flat bright brick value as the walking surface.
- **Surface decals:** moss, puddle, crack, rubble and broken-brick marks are seeded along the top
  floor row. They are composed from slices of the supplied dungeon floor/wall crops, not separate
  painted assets, and do not affect collision.
- **Depth layers:** the dungeon background now uses seven manifest layers. The supplied 128x117 wall
  crop contains a four-pixel transparent separator, so it is split into a 64px lower block and a 47px
  upper block; those are stacked on the same 64/47px cadence with identical parallax to make a
  continuous wall without the horizontal black band. A far copy, plus two screen-edge foreground
  pillar silhouettes, add depth. The pillar positions stay outside the player's normal path.
- **Set pieces:** cellblock, throne/altar, chain-pit, torch corridor and treasury arrangements are
  used across the five rooms. Statues are checked against platform/chest/gate occupancy and are only
  placed in open wall space. Torches emit the existing additive ember particles with a slow flicker;
  the dungeon uses a slightly stronger vignette and slow floating dust.
- **Platform dressing:** every static one-way ledge now gets a two-row body in its biome material,
  end supports and forest/swamp log or root underlays. Dungeon ledges use brick body rows plus end
  consoles; moving platforms receive the same underside treatment.
- **Doors:** the generated gate keeps its generated atlas frame but is now surrounded by a stone arch
  assembled from the active zone's tile body frames. Dungeon gates draw an iron bar grid inside the
  opening. Approaching a door shows the existing `E` prompt with the target zone name; entering
  animates the gate upward/outward before the existing fade transition.
- **Still missing from the supplied art:** no dedicated dungeon arch, chain, column, cell-bar,
  treasure-chest, altar or door sprite exists. The cellblock and chain-pit set pieces therefore use
  the available wall panels/statues/torches and generated door/chest/altar icons. No new raster
  asset was added to `public/assets`; the missing pieces are recorded here instead of being painted
  into the packs.

## 13. Tilemap audit and edge-aware catalog (2026-11-02)

- **Authoritative grid:** every terrain sheet is on a 16x16 grid. `npm run validate:tiles` checks the
  five manifests and reports `16x16 margin=0 spacing=0` for cemetery, church, swamp, dungeon and
  forest. The cemetery demo's Tiled `map.json` independently confirms `tilewidth: 16`,
  `tileheight: 16`, `margin: 0`, `spacing: 0`, with the layer order `Collisions Layer`, `Back Layer`,
  `Main Layer`.
- **Frame cropping:** all tile frames are explicit source rectangles; no guessed grid slicing is
  performed for the non-uniform dungeon sheet. The runtime atlas still uses 2px transparent gutters
  for WebGL bleeding protection, but those gutters are outside each frame UV and are not part of the
  source tile crop.
- **Edge-aware catalog:** each zone now declares `top`, `body`, `deep`, plus `topLeft`, `topRight`,
  `bodyLeft`, `bodyRight`, `deepLeft` and `deepRight` frames. The renderer chooses the edge piece from
  the tile's horizontal neighbours, so a pit/ledge gets a closed side instead of a cut-off repeating
  middle tile. One-way platforms use the same left/middle/right rule.
- **Ground sources:** cemetery uses the central 4-tile grass/dirt/deep strip from the demo tileset;
  church uses the supplied 2x3 purple slab block; swamp uses the central columns of the large skull
  terrain chunk; forest uses the central columns of its 4x3 moss/soil block; dungeon uses the native
  128x16 brick floor strip with a depth tint.
- **Layer order:** background(-100), tiles(0), props(1), generated interactables(1.5), actors(2),
  foreground grass(2.6), XP orbs(3), particles(4) now live in `GAME.rendering.layers`.
- **Pixel rendering:** the WebGL renderer already uses `antialias: false`, `image-rendering:
  pixelated`, nearest filtering and integer-scaled 640x360 output. This audit did not add smoothing
  or fractional sprite scales.
- **Reference use:** the cemetery `demo/assets/maps/map.json` is treated as a calibration reference
  for tile size, layer order and ground composition. The procedural zones remain seeded, while the
  cemetery package map is now loaded wholesale as the packaged cemetery zone.

## 14. Packaged Tiled maps

Searched all of `public/assets` for `*.tmx`, `*.tmj`, `*.tsx`, `*.tsj` and Tiled-style `*.json`.
There is **no `.tmx`, `.tmj`, `.tsx` or `.tsj`**. There is exactly one packaged Tiled map:

### `public/assets/cemetery/demo/assets/maps/map.json`

- Format: Tiled JSON map (`tiledversion: 1.1.4`, type `map`)
- Orientation: orthogonal, right-down
- Map: **300 × 14 tiles**, **4800 × 224 px**
- Tile size: **16 × 16**
- Infinite: false
- Custom map properties: **none**
- Object layers: **none**
- Image layers / group layers: **none**
- Tile layers, in file order:
  - `Collisions Layer` — collision only, not rendered
  - `Back Layer` — decorative tiles behind the main art
  - `Main Layer` — ground/terrain art
- Layer parallax properties: **none**. The game supplies parallax externally (`BackgroundLayers`).
- Tile layer encoding: **JSON arrays** (CSV-equivalent), no `encoding`/`compression` fields
- Flip flags: **none used** (H/V/D counts all zero)
- Collision GIDs: `0` empty, `1` solid, `2` top-only/one-way (confirmed by the packaged
  `demo/game.js`, which calls `tile.setCollision(false, false, true, false)` for index 2)
- Embedded tilesets:
  - `tileset`: `../environment/tileset.png`, 448 × 160 px, 28 × 10 cells, tile 16 × 16,
    margin 0, spacing 0
  - `objects`: `../environment/objects.png`, 624 × 192 px, 39 × 12 cells, tile 16 × 16,
    margin 0, spacing 0
- External tilesets: none
- Image collection tilesets: none
- Used GID range: 1–748 (both tilesets combined)

The packaged map is used as the cemetery zone. Its raw artist collision is the physics floor;
`GAME.footSink` is deliberately not applied to this map.

### Other packs

- Cemetery: the map above.
- Church: no map; only `ENVIRONMENT/tileset.png`, `column.png` and `backgrounds.png`.
- Swamp: no map; only `tileset.png`, background layers and prop sheet.
- Forest: no map; only `Fantasy-TileSet.png`, decor, backgrounds and mockups.
- Dungeon: no map; only the 305 × 215 composite sheet and `.aseprite` source. Its floor strip is
  128 × 16, but the sheet is not a uniform 16 × 16 tileset. Large props are not grid rectangles.

`npm run validate:maps` loads the packaged map, checks all visual GIDs against the embedded
tileset ranges, checks the collision layer is non-empty, checks the spawn is clear, and builds the
world through `src/world/tiledLoader.js`.
