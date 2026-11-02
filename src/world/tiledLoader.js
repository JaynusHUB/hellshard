import { GAME } from '../config/game.js';
import { ZONES } from '../data/zones.js';
import { Tilemap, TILE } from './Tilemap.js';
import { LayoutGrid } from './LayoutGrid.js';

const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const GID_MASK = 0x1fffffff;

export function decodeTileGid(value) {
  const raw = Number(value) >>> 0;
  return {
    id: raw & GID_MASK,
    h: (raw & FLIP_H) !== 0,
    v: (raw & FLIP_V) !== 0,
    d: (raw & FLIP_D) !== 0,
  };
}

function decodeBase64Bytes(value) {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }
  throw new Error('No base64 decoder available');
}

export function decodeTiledLayer(layer) {
  if (!layer || layer.type !== 'tilelayer') {
    throw new Error(`Tiled layer is not a tile layer: ${layer?.name ?? 'unknown'}`);
  }
  if (Array.isArray(layer.data)) return layer.data.map((value) => Number(value) >>> 0);
  if (typeof layer.data !== 'string') {
    throw new Error(`Unsupported tile data in layer ${layer.name}`);
  }
  if (layer.encoding === 'base64' || layer.data.startsWith('H4sI') || layer.data.startsWith('eJ')) {
    if (layer.compression) {
      throw new Error(
        `Compressed Tiled layers are not supported (${layer.compression}); export with CSV/no compression`,
      );
    }
    const bytes = decodeBase64Bytes(layer.data);
    const values = [];
    for (let i = 0; i + 3 < bytes.length; i += 4) {
      values.push(
        (bytes[i]
          | (bytes[i + 1] << 8)
          | (bytes[i + 2] << 16)
          | (bytes[i + 3] << 24)) >>> 0,
      );
    }
    return values;
  }
  if (layer.encoding === 'csv' || layer.data.includes(',')) {
    return layer.data
      .split(',')
      .map((value) => Number(value.trim()) || 0)
      .map((value) => value >>> 0);
  }
  throw new Error(`Unsupported Tiled layer encoding in layer ${layer.name}`);
}

function normalizeTileset(def, baseUrl, firstgid = def.firstgid) {
  const imageUrl = def.image ? new URL(def.image, baseUrl).href : null;
  const tiles = (def.tiles ?? []).map((tile) => ({
    ...tile,
    imageUrl: tile.image ? new URL(tile.image, baseUrl).href : null,
  }));
  return {
    ...def,
    firstgid,
    imageUrl,
    tiles,
    imageCollection: !imageUrl,
  };
}

export function normalizeEmbeddedTilesets(map, mapUrl) {
  return (map.tilesets ?? []).map((def) => {
    if (def.source) {
      throw new Error(
        `External tileset ${def.source} needs loadTiledMap(); TSX is unsupported, use TSJ/JSON`,
      );
    }
    return normalizeTileset(def, mapUrl);
  });
}

async function loadExternalTileset(def, mapUrl, fetchImpl) {
  const sourceUrl = new URL(def.source, mapUrl).href;
  if (/\.tsx(?:$|\?)/i.test(def.source)) {
    throw new Error(`TSX tilesets are not supported; export ${def.source} as TSJ/JSON`);
  }
  const response = await fetchImpl(sourceUrl);
  if (!response.ok) throw new Error(`Failed to load tileset ${sourceUrl}`);
  const tileset = await response.json();
  return normalizeTileset({ ...tileset, sourceUrl }, sourceUrl, def.firstgid);
}

export async function loadTiledMap(mapUrl, { fetchImpl = fetch, loadImage = null } = {}) {
  const response = await fetchImpl(mapUrl);
  if (!response.ok) throw new Error(`Failed to load Tiled map ${mapUrl}`);
  const map = await response.json();
  if (map.infinite) throw new Error(`Infinite Tiled maps are not supported: ${mapUrl}`);
  if (map.tilewidth !== GAME.tile || map.tileheight !== GAME.tile) {
    throw new Error(
      `Tiled map tile size ${map.tilewidth}x${map.tileheight} != game tile ${GAME.tile}`,
    );
  }
  const tilesets = [];
  for (const def of map.tilesets ?? []) {
    if (def.source) tilesets.push(await loadExternalTileset(def, mapUrl, fetchImpl));
    else tilesets.push(normalizeTileset(def, mapUrl));
  }
  const images = new Map();
  if (loadImage) {
    const urls = new Set();
    for (const tileset of tilesets) {
      if (tileset.imageUrl) urls.add(tileset.imageUrl);
      for (const tile of tileset.tiles) if (tile.imageUrl) urls.add(tile.imageUrl);
    }
    await Promise.all([...urls].map(async (url) => {
      images.set(url, await loadImage(url));
    }));
  }
  return { map, mapUrl, tilesets, images };
}

function collisionTypeFor(gid, config) {
  const role = config.collisionGids?.[String(gid)] ?? 'solid';
  if (role === 'oneWay') return TILE.ONE_WAY;
  if (role === 'hazard') return TILE.HAZARD;
  if (role === 'empty' || role === 'none') return TILE.EMPTY;
  return TILE.SOLID;
}

function findSolidRow(mapData, width, height, tx, allowOneWay = false) {
  for (let ty = height - 1; ty >= 0; ty--) {
    const type = mapData[ty * width + tx];
    if (type === TILE.SOLID) return ty;
    if (allowOneWay && type === TILE.ONE_WAY) return ty;
  }
  return -1;
}

function findRoomCount(width) {
  return Math.max(1, Math.ceil(width / GAME.world.roomWidth));
}

export function buildTiledWorld({
  map,
  mapUrl,
  tilesets,
  images = new Map(),
  config,
  route = [],
  seed = 1,
}) {
  if (!config) throw new Error('buildTiledWorld needs a map config');
  const zoneId = config.zoneId;
  const zone = ZONES[zoneId];
  if (!zone) throw new Error(`Unknown zone: ${zoneId}`);
  const width = map.width;
  const mapHeight = map.height;
  const worldHeight = config.worldHeight ?? Math.max(mapHeight, GAME.world.rows);
  const collisionLayer = map.layers.find((layer) => layer.name === config.layers.collision);
  if (!collisionLayer) throw new Error(`Missing collision layer ${config.layers.collision}`);
  const collisionData = decodeTiledLayer(collisionLayer);
  const mapData = new Uint8Array(width * worldHeight);
  const rowOffset = config.verticalPlacement === 'top'
    ? worldHeight - mapHeight
    : 0;
  let collisionCount = 0;
  for (let y = 0; y < mapHeight; y++) {
    const targetY = rowOffset + mapHeight - 1 - y;
    for (let x = 0; x < width; x++) {
      const gid = decodeTileGid(collisionData[y * width + x]).id;
      if (!gid) continue;
      mapData[targetY * width + x] = collisionTypeFor(gid, config);
      collisionCount++;
    }
  }
  const spawnTx = Math.max(1, Math.min(width - 2, config.spawnTileX ?? 6));
  const spawnRow = findSolidRow(mapData, width, worldHeight, spawnTx, true);
  if (spawnRow < 0) throw new Error(`Tiled map has no floor at spawn tile ${spawnTx}`);
  const surface = (spawnRow + 1) * GAME.tile;
  const tilemap = new Tilemap(width, worldHeight, mapData, {
    surfaceOffset: 0,
    surfaceRow: spawnRow,
  });
  const layout = new LayoutGrid({ width, height: worldHeight, tileSize: GAME.tile });
  const rooms = [];
  const roomCount = findRoomCount(width);
  for (let index = 0; index < roomCount; index++) {
    rooms.push({
      index,
      start: index * GAME.world.roomWidth,
      width: Math.min(GAME.world.roomWidth, width - index * GAME.world.roomWidth),
    });
  }
  const world = {
    zoneId,
    seed,
    width,
    height: worldHeight,
    rows: worldHeight,
    rowOffset,
    mapHeight,
    surface,
    surfaceOffset: 0,
    paintedOffset: 0,
    footSink: 0,
    fringeHeight: 0,
    floorRow: spawnRow,
    spawn: { x: spawnTx * GAME.tile, y: surface },
    spawnRoom: 0,
    checkpoints: [{ x: spawnTx * GAME.tile, y: surface, room: 0 }],
    transitions: [],
    interactions: [],
    decorations: [],
    backdrops: [],
    surfaceDecals: [],
    setPieces: [],
    platformRuns: [],
    dungeonRooms: [],
    dungeonTemplateOrder: [],
    hazards: [],
    secrets: [],
    propsAnimated: [],
    movingPlatforms: [],
    arena: null,
    challenge: null,
    finalGate: null,
    rooms,
    bossRoom: -1,
    styleFamily: zone.family,
    atlas: zone.atlas,
    palette: zone.palette,
    enemyPool: zone.enemyPool,
    elitePool: zone.elitePool,
    bossKey: null,
    ambient: zone.weather,
    route,
    map: tilemap,
    layout,
    tiled: {
      mapUrl,
      width,
      height: mapHeight,
      rowOffset,
      layers: config.layers.render.map((name, order) => {
        const layer = map.layers.find((candidate) => candidate.name === name);
        if (!layer) throw new Error(`Missing visual layer ${name}`);
        return {
          name,
          order,
          opacity: layer.opacity ?? 1,
          visible: layer.visible !== false,
          data: decodeTiledLayer(layer),
        };
      }),
      collisionLayer: config.layers.collision,
      collisionGids: config.collisionGids,
      tilesets,
      images,
      mapWidth: width,
      mapHeight,
    },
    reachability: { ok: true, gaps: [], badGaps: [], unreachable: [] },
    tiledMapConfig: config,
  };
  const next = route[route.indexOf(zoneId) + 1];
  if (next && config.exitTarget !== null) {
    const exitX = (width - (config.exitTileOffset ?? 3)) * GAME.tile;
    const exitTx = Math.floor(exitX / GAME.tile);
    const exitRow = findSolidRow(mapData, width, worldHeight, exitTx, true);
    if (exitRow >= 0) {
      const exitY = (exitRow + 1) * GAME.tile;
      world.transitions.push({
        id: `right-${zoneId}`,
        type: 'portal',
        x: exitX,
        y: exitY,
        target: next,
        labelKey: 'action.usePortal',
        requiresBoss: false,
        entrySide: 'left',
      });
      layout.mark({ x: exitX - 18, y: exitY, w: 36, h: 52 }, 'gate', `right-${zoneId}`);
    }
  }
  return world;
}

export function summarizeTiledMap(map) {
  const layers = map.layers.map((layer) => ({
    name: layer.name,
    type: layer.type,
    width: layer.width,
    height: layer.height,
    opacity: layer.opacity ?? 1,
    visible: layer.visible !== false,
    encoding: layer.encoding ?? 'json-array',
    compression: layer.compression ?? null,
    properties: layer.properties ?? null,
  }));
  const gids = new Set();
  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer') continue;
    for (const value of decodeTiledLayer(layer)) {
      const gid = decodeTileGid(value).id;
      if (gid) gids.add(gid);
    }
  }
  return {
    width: map.width,
    height: map.height,
    pixelWidth: map.width * map.tilewidth,
    pixelHeight: map.height * map.tileheight,
    tileWidth: map.tilewidth,
    tileHeight: map.tileheight,
    infinite: Boolean(map.infinite),
    layers,
    objectLayers: map.layers.filter((layer) => layer.type === 'objectgroup').length,
    imageLayers: map.layers.filter((layer) => layer.type === 'imagelayer').length,
    groupLayers: map.layers.filter((layer) => layer.type === 'group').length,
    properties: map.properties ?? null,
    usedGids: [...gids].sort((a, b) => a - b),
    flipFlags: (() => {
      let h = 0;
      let v = 0;
      let d = 0;
      for (const layer of map.layers) {
        if (layer.type !== 'tilelayer') continue;
        for (const value of decodeTiledLayer(layer)) {
          if (value & FLIP_H) h++;
          if (value & FLIP_V) v++;
          if (value & FLIP_D) d++;
        }
      }
      return { h, v, d };
    })(),
  };
}
