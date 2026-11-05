# Authoring a Tiled map for HELLSHARD

HELLSHARD already supports hand-authored Tiled JSON maps. You do **not** need to
generate a map from code. Build it in [Tiled](https://www.mapeditor.org/), export
JSON, drop it under `public/assets`, and register it in `src/data/maps.js`.

## Hızlı özet (TR)

1. Tiled'da yeni harita: **Orthogonal**, tile size **16×16**, finite map.
2. Çarpışma katmanı adı **`Collisions Layer`** olmalı. GID'ler:
   `1 = solid`, `2 = one-way`, `3 = hazard` (lava/spikes).
3. Görsel katmanlar: **`Back Layer`**, **`Back Decor`**, **`Main Layer`**,
   **`Front Layer`** (`draw_above_player` özelliği ile oyuncunun önünde çizilir).
4. Arka planlar **image layer** olmalı: `Parallax 1 - Sky`, `... Mountains`,
   `... Cliff`, `... Fence`, `... Rocks`, `Parallax Fog (foreground)`.
   `parallaxx`, `repeatx`, `draw_above_player` ve `autoscroll_x` özelliklerini kullan.
5. Nesneler **`Objects`** katmanında, tipleriyle: `PlayerStart`, `Checkpoint`,
   `Enemy`, `Boss`, `Pickup`, `Chest`, `Sign`, `MovingPlatform`, `LevelExit`.
6. Tetikler **`Triggers`** katmanında: `Hint`, `KillZone`, `CameraLock`,
   `MusicZone`, `Secret`. Işıklar **`Lights`** katmanında: `Light`.
7. Haritayı `src/data/maps.js` içindeki `PACKAGED_MAPS`'e ekle; `zoneId` mevcut
   bir bölge olmalı. Yeni bölge ise `src/data/zones.js` + `src/ui/strings.js`.
8. `npm run validate:maps` ve `npm run dev` ile kontrol et.

## 1. Map settings

- Tiled version: 1.10+ (parallax support in 1.5+).
- Orientation: orthogonal, finite, tile size 16×16.
- Export: JSON (`.json` or `.tmj`), embedded tilesets are easiest.
- Do not use layer offsets; keep `offsetx`/`offsety` at 0 unless you are
  deliberately placing a parallax image.

## 2. Layer roles

The loader is data-driven; layer names are configured in `PACKAGED_MAPS`.

| Role | Default layer name | Notes |
|---|---|---|
| Collision | `Collisions Layer` | Tile layer, hidden in game |
| Back tiles | `Back Layer` | Behind terrain |
| Decor tiles | `Back Decor` | Wall/background decoration |
| Main tiles | `Main Layer` | Terrain and props |
| Front tiles | `Front Layer` | Set `draw_above_player: true` |
| Parallax | image layers | `parallaxx`, `repeatx`, `draw_above_player` |
| Objects | `Objects` | Gameplay objects |
| Triggers | `Triggers` | Hints, kill zone, camera lock |
| Lights | `Lights` | Additive point-light halos |

Collision GIDs are declared in `src/data/maps.js`:

```js
collisionGids: { 1: 'solid', 2: 'oneWay', 3: 'hazard' }
```

## 3. Object types

Object coordinates use Tiled's top-left pixel position. The loader probes for a
standable surface below each object, so you do not need pixel-perfect anchoring.

| Type | Supported properties | Result |
|---|---|---|
| `PlayerStart` | `facing` | Spawn point |
| `Checkpoint` | `id`, `heal` | Respawn point; `heal:true` restores 35% |
| `Enemy` | `enemy_type`, `hp`, `damage`, `ai` | Authored enemy spawn |
| `Boss` | `arena_left`, `arena_right`, `hp` | Boss arena + Gate Warden trigger |
| `Pickup` | `item`, `value`, `heal`, `hidden` | Coin XP / potion / key |
| `Chest` | `loot`, `hidden` | Interaction chest; `loot: dungeon_key` |
| `Sign` | `text` | Readable lore sign |
| `MovingPlatform` | `axis`, `distance`, `speed` | Moving lift |
| `LevelExit` | `requires_item`, `target_map` | Keyed Final Gate |
| `Hint` (Triggers) | `text` | One-shot toast when entered |
| `KillZone` (Triggers) | — | Registered kill volume |
| `Light` (Lights) | `color`, `radius`, `intensity`, `flicker` | Torch halo |

Enemy `enemy_type` aliases used by the current pool: `skeleton`, `ghoul`, `bat`.
They map to `bone_thrall`/`wight`, `burning_ghoul` and `wisp`.

## 4. Register the map

```js
// src/data/maps.js
dungeon_gate: {
  id: 'dungeon_gate',
  zoneId: 'dungeon_gate',
  url: 'assets/pool/maps/dungeon_gate.json',
  layers: {
    collision: 'Collisions Layer',
    render: ['Back Layer', 'Back Decor', 'Main Layer'],
    front: ['Front Layer'],
  },
  collisionGids: { 1: 'solid', 2: 'oneWay', 3: 'hazard' },
  worldHeight: GAME.world.rows,
  verticalPlacement: 'bottom',
  camera: { zoom: 2, anchor: 'bottom' },
  parallaxOrigin: [160, 90],
  spawnFromObjects: true,
  objectLayers: ['Objects', 'Triggers', 'Lights'],
  exitTarget: null,
  returnTarget: 'church',
  ambientColor: '#1a1420',
  ambientStrength: 0.25,
}
```

If the map is a new zone, add it to `ZONES`, `ZONE_ORDER`, strings and the
route/boss configuration. If it is a replacement for an existing zone, only the
`PACKAGED_MAPS` entry and zone data need to change.

## 5. Camera composition

The Dungeon Gate was authored for a **320×180** view. HELLSHARD renders a
640×360 stage, so `camera.zoom = 2` reproduces the intended composition while
keeping integer pixel scale. `camera.anchor = 'bottom'` keeps the ground line
stable when the map is only 12 tiles tall.

For a normal 640×360 map, omit `camera` (defaults to zoom 1, follow camera).

## 6. Validation and inspection

```bash
npm run validate:maps
npm run dev
```

Dev URLs:

```text
http://127.0.0.1:5173/?zone=dungeon_gate&seed=1
http://127.0.0.1:5173/?zone=dungeon_gate&x=1780&y=80&fly=1
http://127.0.0.1:5173/?map=dungeon_gate&peaceful=1&fly=1
```

The validator checks: map dimensions, tile size, layer presence, image files,
GID ranges, collision existence, spawn clearance, object layers, enemies/arena,
and the authored LevelExit.

## 7. Art and licensing

Keep a map inside one style family. Do not mix 16px tiles with upscaled art in
the same scene. The Dungeon Gate map assembly is original work by JAYNUS and is
covered by the repository `LICENSE`; its third-party tile/background sources are
listed in `CREDITS.md`.
