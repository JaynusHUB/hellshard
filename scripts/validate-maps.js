import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGED_MAPS } from '../src/data/maps.js';
import { buildTiledWorld, decodeTileGid, decodeTiledLayer, normalizeEmbeddedTilesets } from '../src/world/tiledLoader.js';
import { TILE } from '../src/world/Tilemap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function fail(message) {
  failures.push(message);
}

function tileInTileset(tilesets, gid) {
  let found = null;
  for (const tileset of tilesets) {
    if (tileset.firstgid <= gid) found = tileset;
    else break;
  }
  if (!found) return false;
  const local = gid - found.firstgid;
  if (found.imageCollection) return (found.tiles ?? []).some((tile) => tile.id === local);
  return local < Number(found.tilecount ?? found.columns * found.rows ?? 0);
}

const lines = [];
for (const config of Object.values(PACKAGED_MAPS)) {
  const mapPath = path.join(ROOT, 'public', config.url);
  if (!fs.existsSync(mapPath)) {
    fail(`${config.id}: map file not found at ${config.url}`);
    continue;
  }
  let map;
  try {
    map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch (error) {
    fail(`${config.id}: map JSON could not be read: ${error.message}`);
    continue;
  }
  if (map.infinite) fail(`${config.id}: infinite Tiled maps are unsupported`);
  if (map.tilewidth !== 16 || map.tileheight !== 16) {
    fail(`${config.id}: map tile size is ${map.tilewidth}x${map.tileheight}, expected 16x16`);
  }
  const mapUrl = new URL(`file:///${mapPath.replace(/\\/g, '/')}`).href;
  let tilesets;
  try {
    tilesets = normalizeEmbeddedTilesets(map, mapUrl);
  } catch (error) {
    fail(`${config.id}: ${error.message}`);
    continue;
  }
  const layerByName = new Map(map.layers.map((layer) => [layer.name, layer]));
  for (const name of [
    config.layers.collision,
    ...(config.layers.render ?? []),
    ...(config.layers.front ?? []),
  ]) {
    if (!layerByName.has(name)) fail(`${config.id}: missing layer ${name}`);
  }
  for (const layer of map.layers) {
    if (layer.type !== 'imagelayer' || !layer.image) continue;
    const imagePath = path.resolve(path.dirname(mapPath), layer.image);
    if (!fs.existsSync(imagePath)) {
      fail(`${config.id}: image layer ${layer.name} points to missing ${layer.image}`);
    }
  }
  let collisionTiles = 0;
  let collisionGids = new Set();
  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer') continue;
    let data;
    try {
      data = decodeTiledLayer(layer);
    } catch (error) {
      fail(`${config.id}: ${error.message}`);
      continue;
    }
    if (data.length !== map.width * map.height) {
      fail(`${config.id}: layer ${layer.name} has ${data.length} cells, expected ${map.width * map.height}`);
    }
    for (const value of data) {
      const { id } = decodeTileGid(value);
      if (!id) continue;
      if (!tileInTileset(tilesets, id)) {
        fail(`${config.id}: GID ${id} in ${layer.name} is outside its tileset`);
      }
      if (layer.name === config.layers.collision) {
        collisionTiles++;
        collisionGids.add(id);
      }
    }
  }
  if (collisionTiles === 0) fail(`${config.id}: collision layer is empty`);
  if (!collisionGids.has(1)) fail(`${config.id}: collision layer has no solid GID 1`);

  let world;
  try {
    world = buildTiledWorld({
      map,
      mapUrl,
      tilesets,
      images: new Map(),
      config,
      route: ['cemetery', 'church', 'dungeon_gate'],
      seed: 1,
    });
  } catch (error) {
    fail(`${config.id}: build failed: ${error.message}`);
    continue;
  }
  const spawnTx = Math.floor(world.spawn.x / 16);
  const spawnRow = world.map.surfaceRow;
  for (let dy = 1; dy <= 2; dy++) {
    if (world.map.getType(spawnTx, spawnRow + dy) === TILE.SOLID) {
      fail(`${config.id}: spawn is inside a solid tile at row ${spawnRow + dy}`);
    }
  }
  if (world.map.getType(spawnTx, spawnRow) !== TILE.SOLID) {
    fail(`${config.id}: spawn has no solid floor`);
  }
  if (config.exitTarget !== null && !world.transitions.length) {
    fail(`${config.id}: no right-edge transition was created`);
  }
  if (config.exitTarget === null && !world.finalGate) {
    fail(`${config.id}: no authored final gate / level exit found`);
  }
  if (config.objectLayers?.length) {
    for (const layerName of config.objectLayers) {
      if (!map.layers.some((layer) => layer.name === layerName)) {
        fail(`${config.id}: missing object layer ${layerName}`);
      }
    }
    if (!world.tiled.enemies.length && !world.arena) {
      fail(`${config.id}: authored map has no enemies or boss arena`);
    }
  }
  lines.push({
    id: config.id,
    size: `${map.width}x${map.height}`,
    pixels: `${map.width * map.tilewidth}x${map.height * map.tileheight}`,
    layers: map.layers.length,
    collisionTiles,
    collisionGids: [...collisionGids].sort().join(','),
    spawn: `${spawnTx},${spawnRow}`,
    transitions: world.transitions.length,
    imageLayers: world.tiled.imageLayers.length,
    enemies: world.tiled.enemies.length,
  });
}

const widths = [18, 10, 12, 7, 15, 15, 10, 12, 13, 9];
const columns = ['map', 'tiles', 'pixels', 'layers', 'collisionTiles', 'collisionGids', 'spawn', 'transitions', 'imageLayers', 'enemies'];
console.log(columns.map((column, index) => column.padEnd(widths[index])).join(''));
for (const line of lines) {
  const values = [
    line.id, line.size, line.pixels, line.layers, line.collisionTiles, line.collisionGids,
    line.spawn, line.transitions, line.imageLayers, line.enemies,
  ];
  console.log(values.map((value, index) => String(value).padEnd(widths[index])).join(''));
}

if (failures.length) {
  console.error(`\n✗ Map validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('\n✓ Map validation passed: packaged Tiled map loads, GIDs resolve, collision exists, spawn is clear.');
