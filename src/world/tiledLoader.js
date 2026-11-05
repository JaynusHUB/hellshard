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

function propsOf(entity) {
  const out = {};
  for (const property of entity?.properties ?? []) out[property.name] = property.value;
  return out;
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
    for (const layer of map.layers ?? []) {
      if (layer.type === 'imagelayer' && layer.image) {
        urls.add(new URL(layer.image, mapUrl).href);
      }
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

/** Nearest standable top at or below a world-space point. */
function supportTopAt(map, worldX, fromY, maxDrop = 40) {
  const tx = Math.max(0, Math.min(map.width - 1, Math.floor(worldX / GAME.tile)));
  const startTy = Math.max(0, Math.min(map.height - 1, Math.floor((fromY + GAME.tile - 1) / GAME.tile)));
  for (let ty = startTy; ty >= 0; ty--) {
    const type = map.getType(tx, ty);
    if (type !== TILE.SOLID && type !== TILE.ONE_WAY) continue;
    const top = (ty + 1) * GAME.tile;
    if (fromY - top <= maxDrop) return top;
  }
  return null;
}

function collectHazards(mapData, width, height) {
  const hazards = [];
  for (let ty = 0; ty < height; ty++) {
    let start = -1;
    for (let tx = 0; tx <= width; tx++) {
      const hazard = tx < width && mapData[ty * width + tx] === TILE.HAZARD;
      if (hazard && start < 0) start = tx;
      if (!hazard && start >= 0) {
        hazards.push({
          x: start * GAME.tile,
          y: ty * GAME.tile,
          w: (tx - start) * GAME.tile,
          h: GAME.tile,
          kind: 'spikes',
        });
        start = -1;
      }
    }
  }
  return hazards;
}

function parseImageLayers(map, mapUrl, rowOffset) {
  const mapTop = (rowOffset + map.height) * GAME.tile;
  const layers = [];
  let order = 0;
  for (const layer of map.layers ?? []) {
    if (layer.type !== 'imagelayer' || layer.visible === false) continue;
    const properties = propsOf(layer);
    const role = properties.draw_above_player ? 'fog' : 'bg';
    layers.push({
      id: layer.id,
      name: layer.name,
      imageUrl: new URL(layer.image, mapUrl).href,
      width: Number(layer.imagewidth ?? 0),
      height: Number(layer.imageheight ?? 0),
      offsetX: Number(layer.offsetx ?? 0),
      offsetY: Number(layer.offsety ?? 0),
      parallaxX: Number(layer.parallaxx ?? 1),
      parallaxY: Number(layer.parallaxy ?? 1),
      opacity: Number(layer.opacity ?? 1),
      repeat: Boolean(layer.repeatx),
      autoScrollX: Number(properties.autoscroll_x ?? 0),
      role,
      order: order++,
      mapTop,
    });
  }
  return layers;
}

function actorMapY(mapTop, object) {
  return mapTop - Number(object.y ?? 0);
}

function parseAuthoredObjects({ map, world, mapTop, objectLayers }) {
  const groups = new Map(
    (map.layers ?? [])
      .filter((layer) => layer.type === 'objectgroup')
      .map((layer) => [layer.name, layer]),
  );
  const objects = objectLayers.flatMap((name) => groups.get(name)?.objects ?? []);
  const byType = (type) => objects.filter((object) => object.type === type);
  const props = (object) => propsOf(object);

  for (const object of byType('Enemy')) {
    const p = props(object);
    const baseX = Number(object.x) + Number(object.width ?? 16) / 2;
    const mapY = actorMapY(mapTop, object);
    const flying = p.ai === 'fly_sine';
    const top = supportTopAt(world.map, baseX, mapY, 40);
    const type = p.enemy_type ?? 'skeleton';
    const hp = Number(p.hp ?? 4);
    const enemyId = type === 'bat'
      ? 'wisp'
      : type === 'ghoul'
        ? 'burning_ghoul'
        : hp >= 5 ? 'wight' : 'bone_thrall';
    world.tiled.enemies.push({
      id: `tiled-enemy-${object.id}`,
      enemyId,
      x: baseX,
      y: flying ? mapY + Number(object.height ?? 16) / 2 : (top ?? mapY),
      health: Math.max(0.7, Math.min(1.45, hp / 4.2)),
      damage: Math.max(0.7, Math.min(1.35, Number(p.damage ?? 1) / 1.4)),
      flying,
    });
  }

  for (const object of byType('Boss')) {
    const p = props(object);
    const left = Number(p.arena_left ?? Number(object.x) - 136);
    const right = Number(p.arena_right ?? Number(object.x) + 136);
    const x = Number(object.x) + Number(object.width ?? 16) / 2;
    const floorY = supportTopAt(world.map, x, actorMapY(mapTop, object), 48)
      ?? world.surface;
    world.arena = {
      left,
      right,
      floorY,
      triggerX: left + 32,
      active: false,
      cleared: false,
      source: 'tiled',
    };
  }

  for (const object of byType('Checkpoint')) {
    const p = props(object);
    const x = Number(object.x) + Number(object.width ?? 16) / 2;
    const top = actorMapY(mapTop, object);
    const y = supportTopAt(world.map, x, top, 40) ?? top;
    if (world.checkpoints.some((checkpoint) => Math.abs(checkpoint.x - x) < 8
      && Math.abs(checkpoint.y - y) < 8)) continue;
    world.checkpoints.push({
      id: p.id ?? object.name,
      x,
      y,
      room: 0,
      heal: Boolean(p.heal),
      activated: false,
      source: 'tiled',
    });
  }

  for (const object of byType('Chest')) {
    const p = props(object);
    const x = Number(object.x) + Number(object.width ?? 16) / 2;
    const top = actorMapY(mapTop, object);
    const y = supportTopAt(world.map, x, top, 40) ?? top;
    world.interactions.push({
      id: `tiled-chest-${object.id}`,
      type: 'chest',
      x,
      y,
      opened: false,
      secret: Boolean(p.hidden),
      loot: p.loot ?? null,
      labelKey: 'action.openChest',
    });
  }

  for (const object of byType('Sign')) {
    const p = props(object);
    const x = Number(object.x) + Number(object.width ?? 16) / 2;
    const top = actorMapY(mapTop, object);
    const y = supportTopAt(world.map, x, top, 40) ?? top;
    const textKey = object.name === 'lore_sign_1'
      ? 'sign.dungeonGate.arch'
      : object.name === 'lore_sign_2' ? 'sign.dungeonGate.warden' : null;
    world.interactions.push({
      id: `tiled-sign-${object.id}`,
      type: 'sign',
      x,
      y,
      text: p.text ?? '',
      textKey,
    });
  }

  for (const object of byType('Pickup')) {
    const p = props(object);
    if (p.hidden) continue;
    const x = Number(object.x) + Number(object.width ?? 16) / 2;
    const top = actorMapY(mapTop, object);
    world.pickups.push({
      id: `tiled-pickup-${object.id}`,
      type: p.item ?? 'coin',
      x,
      y: top + 4,
      value: Number(p.value ?? 1),
      heal: Number(p.heal ?? 0),
      collected: false,
    });
  }

  for (const object of byType('MovingPlatform')) {
    const p = props(object);
    const x = Number(object.x) + Number(object.width ?? 48) / 2;
    const y = actorMapY(mapTop, object);
    const range = Math.max(8, Number(p.distance ?? 48) / 2);
    const linearSpeed = Number(p.speed ?? 28);
    world.movingPlatforms.push({
      id: `tiled-platform-${object.id}`,
      baseX: x,
      baseY: y,
      x,
      y,
      w: Number(object.width ?? 48),
      h: Number(object.height ?? 8),
      axis: p.axis === 'y' ? 'y' : 'x',
      range,
      speed: Math.max(0.2, (Math.PI * linearSpeed) / (2 * range)),
      phase: 0,
      dx: 0,
      dy: 0,
    });
  }

  const exit = byType('LevelExit')[0];
  if (exit) {
    const p = props(exit);
    const exitX = Number(exit.x) + Number(exit.width ?? 48) / 2;
    const exitY = supportTopAt(world.map, exitX, actorMapY(mapTop, exit), 80) ?? world.surface;
    world.finalGate = {
      id: 'tiled-level-exit',
      type: 'finalGate',
      x: exitX,
      y: exitY,
      requiresShards: 3,
      requiresItem: p.requires_item ?? null,
      labelKey: 'action.enterGate',
      targetMap: p.target_map ?? null,
    };
  }

  for (const object of byType('Hint')) {
    const textKey = object.name === 'hint_jump_pits'
      ? 'hint.dungeonGate.pits'
      : object.name === 'hint_lava' ? 'hint.dungeonGate.lava' : null;
    world.triggers.push({
      id: `hint-${object.id}`,
      type: 'hint',
      x: Number(object.x),
      y: mapTop - (Number(object.y) + Number(object.height ?? 0)),
      w: Number(object.width ?? 0),
      h: Number(object.height ?? 0),
      text: props(object).text ?? '',
      textKey,
      shown: false,
    });
  }

  for (const object of byType('KillZone')) {
    world.killZone = {
      x: Number(object.x),
      y: mapTop - Number(object.y),
      w: Number(object.width ?? 0),
      h: Number(object.height ?? 0),
    };
  }

  for (const object of byType('Light')) {
    const p = props(object);
    world.tiled.lights.push({
      x: Number(object.x),
      y: mapTop - Number(object.y),
      color: p.color ?? '#ffb066',
      radius: Number(p.radius ?? 120),
      intensity: Number(p.intensity ?? 1),
      flicker: Number(p.flicker ?? 0),
      phase: Number(object.id) * 1.37,
    });
  }
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
  const rowOffset = config.verticalPlacement === 'top'
    ? Math.max(0, worldHeight - mapHeight)
    : 0;
  const mapTop = (rowOffset + mapHeight) * GAME.tile;
  const collisionLayer = map.layers.find((layer) => layer.name === config.layers.collision);
  if (!collisionLayer) throw new Error(`Missing collision layer ${config.layers.collision}`);
  const collisionData = decodeTiledLayer(collisionLayer);
  const mapData = new Uint8Array(width * worldHeight);
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

  const objectsGroup = map.layers.find((layer) => layer.name === 'Objects');
  const playerStart = objectsGroup?.objects?.find((object) => object.type === 'PlayerStart');
  const spawnTx = Math.max(1, Math.min(
    width - 2,
    playerStart
      ? Math.floor(Number(playerStart.x) / GAME.tile)
      : config.spawnTileX ?? 6,
  ));
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

  const spawnX = playerStart
    ? Number(playerStart.x) + Number(playerStart.width ?? GAME.tile) / 2
    : spawnTx * GAME.tile + GAME.tile / 2;
  const spawn = { x: spawnX, y: surface };
  const allRenderNames = [
    ...(config.layers.render ?? []),
    ...(config.layers.front ?? []),
  ];
  const frontNames = new Set(config.layers.front ?? []);

  const world = {
    zoneId,
    seed,
    width,
    height: worldHeight,
    rows: worldHeight,
    rowOffset,
    mapHeight,
    mapTop,
    playableTop: mapTop,
    surface,
    surfaceOffset: 0,
    paintedOffset: 0,
    paintedSurface: surface,
    footSink: 0,
    fringeHeight: 0,
    floorRow: spawnRow,
    spawn,
    spawnRoom: 0,
    checkpoints: [{ id: 'spawn', x: spawn.x, y: spawn.y, room: 0, activated: true }],
    transitions: [],
    interactions: [],
    decorations: [],
    backdrops: [],
    surfaceDecals: [],
    setPieces: [],
    platformRuns: [],
    dungeonRooms: [],
    dungeonTemplateOrder: [],
    hazards: collectHazards(mapData, width, worldHeight),
    secrets: [],
    propsAnimated: [],
    movingPlatforms: [],
    pickups: [],
    triggers: [],
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
    bossKey: zone.boss ?? null,
    ambient: zone.weather,
    route,
    map: tilemap,
    layout,
    cameraZoom: Number(config.camera?.zoom ?? 1),
    cameraAnchor: config.camera?.anchor ?? 'follow',
    ambientColor: config.ambientColor ?? propsOf(map).ambient_color ?? null,
    ambientStrength: Number(config.ambientStrength ?? 0.25),
    authoredEnemies: Boolean(config.spawnFromObjects),
    noAmbientSpawns: Boolean(config.spawnFromObjects),
    tiled: {
      mapUrl,
      width,
      height: mapHeight,
      rowOffset,
      mapTop,
      layers: allRenderNames.map((name, order) => {
        const layer = map.layers.find((candidate) => candidate.name === name);
        if (!layer) throw new Error(`Missing visual layer ${name}`);
        return {
          name,
          order,
          opacity: layer.opacity ?? 1,
          visible: layer.visible !== false,
          front: frontNames.has(name),
          data: decodeTiledLayer(layer),
        };
      }),
      collisionLayer: config.layers.collision,
      collisionGids: config.collisionGids,
      tilesets,
      images,
      mapWidth: width,
      mapHeight,
      imageLayers: parseImageLayers(map, mapUrl, rowOffset),
      enemies: [],
      lights: [],
      objectLayers: config.objectLayers ?? [],
      ambientColor: config.ambientColor ?? propsOf(map).ambient_color ?? null,
      ambientStrength: Number(config.ambientStrength ?? 0.25),
      parallaxOriginX: Number(config.parallaxOrigin?.[0] ?? (width * GAME.tile) / 2),
      parallaxOriginY: Number(config.parallaxOrigin?.[1] ?? 90),
    },
    reachability: { ok: true, gaps: [], badGaps: [], unreachable: [] },
    tiledMapConfig: config,
  };

  parseAuthoredObjects({
    map,
    world,
    mapTop,
    objectLayers: config.objectLayers ?? ['Objects', 'Triggers', 'Lights'],
  });

  if (!world.arena && zone.boss && config.arena) {
    const triggerX = Number(config.arena.triggerX);
    const floorY = config.arena.floor === 'surface'
      ? world.surface
      : (supportTopAt(world.map, triggerX, world.surface + 48, 96) ?? world.surface);
    world.arena = {
      left: Number(config.arena.left),
      right: Number(config.arena.right),
      floorY,
      triggerX,
      active: false,
      cleared: false,
      source: 'config',
    };
  }

  if (config.returnTarget) {
    const returnX = 24;
    world.transitions.push({
      id: `return-${zoneId}`,
      type: 'door',
      x: returnX,
      y: world.surface,
      target: config.returnTarget,
      labelKey: 'zone.return',
      labelZone: config.returnTarget,
      requiresBoss: false,
      entrySide: 'door',
    });
    layout.mark({ x: returnX - 18, y: world.surface, w: 36, h: 52 }, 'gate', `return-${zoneId}`);
  }

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
        requiresBoss: Boolean(zone.boss),
        entrySide: 'left',
      });
      layout.mark({ x: exitX - 18, y: exitY, w: 36, h: 52 }, 'gate', `right-${zoneId}`);
    }
  }
  return world;
}
