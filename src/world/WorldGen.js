import { GAME, PHYSICS_BOUNDS } from '../config/game.js';
import { RNG, combineSeed } from '../core/RNG.js';
import { ZONES, ZONE_ORDER } from '../data/zones.js';
import { TILE, Tilemap } from './Tilemap.js';

const T = GAME.tile;
const ROOM_W = GAME.world.roomWidth;
const ROOMS = GAME.world.roomsPerZone;
const WIDTH = ROOM_W * ROOMS;
const ROWS = GAME.world.rows;
const FLOOR_ROW = 8;
const SURFACE = (FLOOR_ROW + 1) * T;
const BOSS_ROOM = 3;

export function buildZoneRoute(seed) {
  const rng = new RNG(combineSeed(seed, 'zone-route'));
  return ['cemetery', ...rng.shuffle(['church', 'swamp']), 'forest'];
}

function idx(x, y) {
  return y * WIDTH + x;
}

function fillGround(data) {
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y <= FLOOR_ROW; y++) {
      data[idx(x, y)] = TILE.SOLID;
    }
  }
}

function carvePit(data, startX, width) {
  for (let x = startX; x < startX + width; x++) {
    for (let y = FLOOR_ROW - 1; y <= FLOOR_ROW; y++) {
      data[idx(x, y)] = TILE.EMPTY;
    }
    data[idx(x, FLOOR_ROW - 1)] = TILE.HAZARD;
    if (width > 1) data[idx(x, FLOOR_ROW)] = TILE.HAZARD;
  }
}

function setSolidRect(data, x, y, w, h, type = TILE.SOLID) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || xx >= WIDTH || yy < 0 || yy >= ROWS) continue;
      data[idx(xx, yy)] = type;
    }
  }
}

function setPlatform(data, x, y, w) {
  for (let xx = x; xx < x + w; xx++) {
    if (xx < 0 || xx >= WIDTH) continue;
    data[idx(xx, y)] = TILE.ONE_WAY;
  }
}

function addBreakableSecret(data, roomStart, rng, interactions, secrets) {
  const baseX = roomStart + 6 + rng.int(0, 2);
  const ground = FLOOR_ROW + 1;
  const height = 3;
  // Exterior mass with a 2-tile-high chamber hollowed into it.
  setSolidRect(data, baseX, FLOOR_ROW + 1, 6, height, TILE.SOLID);
  for (let y = FLOOR_ROW + 1; y < FLOOR_ROW + height; y++) {
    for (let x = baseX + 1; x < baseX + 5; x++) {
      data[idx(x, y)] = TILE.EMPTY;
    }
  }
  for (let x = baseX; x < baseX + 6; x++) {
    data[idx(x, FLOOR_ROW + height)] = TILE.SOLID;
  }
  for (let y = FLOOR_ROW + 1; y < FLOOR_ROW + height; y++) {
    data[idx(baseX, y)] = TILE.BREAKABLE;
  }
  interactions.push({
    id: `chest-secret-${roomStart}`,
    type: 'chest',
    x: (baseX + 3) * T,
    y: ground,
    secret: true,
    opened: false,
  });
  secrets.push({
    type: 'breakable',
    x: baseX * T,
    y: (FLOOR_ROW + 1) * T,
    w: T,
    h: (height - 1) * T,
  });
}

function addFakeWallSecret(data, roomStart, rng, interactions, secrets) {
  const baseX = roomStart + 24 + rng.int(0, 2);
  const baseY = FLOOR_ROW + 1;
  // A thin false facade, deliberately non-solid. A chest sits just beyond it.
  for (let y = baseY; y <= baseY + 2; y++) {
    data[idx(baseX, y)] = TILE.FAKE;
    data[idx(baseX + 1, y)] = TILE.FAKE;
  }
  interactions.push({
    id: `chest-hidden-${roomStart}`,
    type: 'chest',
    x: (baseX + 3.1) * T,
    y: baseY * T,
    secret: true,
    opened: false,
  });
  secrets.push({ type: 'fake', x: baseX * T, y: baseY * T, w: T * 2, h: T * 3 });
}

function addChest(interactions, id, tileX, tileY, secret = false) {
  interactions.push({
    id,
    type: 'chest',
    x: tileX * T + T / 2,
    y: tileY * T,
    secret,
    opened: false,
  });
}

function buildRoom(zone, roomIndex, data, rng, world) {
  const start = roomIndex * ROOM_W;
  const surface = SURFACE;
  const isBossRoom = roomIndex === BOSS_ROOM;
  const isChallengeRoom = roomIndex === zone.challengeRoom;

  if (isBossRoom && zone.boss) {
    // A clean, wide arena with no pits; telegraph space is sacred.
    for (let x = start + 2; x < start + ROOM_W - 2; x += 9) {
      setPlatform(data, x, FLOOR_ROW + 5, Math.min(4, start + ROOM_W - x - 2));
    }
  } else {
    // Pit patterns are bounded by the shared jump envelope (max 3 tiles for comfort).
    const pitCount = roomIndex === 0 ? 0 : rng.int(1, 2);
    for (let i = 0; i < pitCount; i++) {
      const minX = start + 12 + i * 10;
      const maxX = start + ROOM_W - 12;
      if (minX >= maxX) continue;
      const px = rng.int(minX, maxX);
      const pw = rng.int(2, Math.min(3, PHYSICS_BOUNDS.maxGapTiles - 1));
      carvePit(data, px, pw);
      world.hazards.push({
        x: px * T,
        y: (FLOOR_ROW - 1) * T,
        w: pw * T,
        h: T * 2,
        kind: zone.hazards,
      });
    }
    const shelfCount = roomIndex === 4 ? 1 : rng.int(1, 2);
    for (let i = 0; i < shelfCount; i++) {
      const sx = start + 8 + i * 12 + rng.int(0, 2);
      const sy = FLOOR_ROW + rng.int(4, 5);
      const sw = rng.int(4, 6);
      setPlatform(data, sx, sy, sw);
      if (i === 0) addChest(world.interactions, `chest-${zone.id}-${roomIndex}`, sx + 2, sy + 1);
    }
  }

  if (roomIndex === 1) {
    addFakeWallSecret(data, start, rng, world.interactions, world.secrets);
    addChest(world.interactions, `chest-${zone.id}-1b`, start + ROOM_W - 8, FLOOR_ROW + 1);
    const mx = (start + 16) * T;
    const my = SURFACE + 56;
    if (!isBossRoom) {
      world.movingPlatforms.push({
        id: `${zone.id}-lifter-1`,
        baseX: mx,
        baseY: my,
        x: mx,
        y: my,
        w: 48,
        h: 10,
        axis: rng.chance(0.5) ? 'x' : 'y',
        range: rng.int(22, 38),
        speed: 0.55,
        phase: rng.float(0, Math.PI * 2),
        dx: 0,
        dy: 0,
      });
    }
  }
  if (roomIndex === 2) {
    addBreakableSecret(data, start, rng, world.interactions, world.secrets);
    if (!isChallengeRoom) {
      const altarX = start + ROOM_W - 5;
      world.interactions.push({
        id: `altar-${zone.id}`,
        type: 'altar',
        x: altarX * T,
        y: surface,
        used: false,
      });
    }
    setPlatform(data, start + ROOM_W - 12, FLOOR_ROW + 4, 4);
    addChest(world.interactions, `chest-${zone.id}-2`, start + ROOM_W - 10, FLOOR_ROW + 5);
  }

  if (roomIndex === BOSS_ROOM && zone.boss) {
    world.arena = {
      left: start * T,
      right: (start + ROOM_W) * T,
      triggerX: (start + 4) * T,
      active: false,
      cleared: false,
    };
  } else if (roomIndex === BOSS_ROOM && !isChallengeRoom) {
    setPlatform(data, start + 8, FLOOR_ROW + 5, 6);
    addChest(world.interactions, `chest-${zone.id}-3`, start + 10, FLOOR_ROW + 6);
  }

  if (isChallengeRoom) {
    for (let i = 0; i < 3; i++) {
      setPlatform(data, start + 7 + i * 8, FLOOR_ROW + 4 + (i % 2), 4);
    }
    world.challenge = {
      room: roomIndex,
      x: (start + 8) * T,
      y: surface,
      cleared: false,
    };
  }

  world.checkpoints.push({ x: (start + 3) * T, y: surface, room: roomIndex });
}

function addTransition(world, zone, id, type, x, y, target, labelKey, extra = {}) {
  world.transitions.push({
    id,
    type,
    x,
    y,
    target,
    labelKey,
    requiresBoss: false,
    ...extra,
  });
}

function addDecor(world, zone, rng, start, surface) {
  const count = zone.id === 'swamp' || zone.id === 'forest' ? rng.int(2, 4) : rng.int(2, 4);
  for (let i = 0; i < count; i++) {
    const prop = rng.pick(zone.decor);
    if (!prop) continue;
    const x = (start + rng.int(3, ROOM_W - 4)) * T;
    const nearTransition = world.transitions.some((tr) => Math.abs(tr.x - x) < 64);
    if (nearTransition) continue;
    const nearOther = world.decorations.some((decor) => Math.abs(decor.x - x) < 90 && Math.abs(decor.y - surface) < 16);
    if (nearOther) continue;
    const yOffset = prop.startsWith('torch') ? 38 : 0;
    world.decorations.push({
      prop,
      x,
      y: surface,
      flip: rng.chance(0.5),
      layer: 'back',
      scale: 1,
      alpha: 0.72 + rng.float(0, 0.28),
      yOffset,
    });
  }
}

function addDungeonProps(world) {
  for (let room = 0; room < ROOMS; room++) {
    const start = room * ROOM_W;
    const torchXs = [start + 5, start + 29];
    for (const tileX of torchXs) {
      world.decorations.push({
        prop: 'torch0',
        x: tileX * T + T / 2,
        y: SURFACE,
        yOffset: 72,
        flip: tileX >= start + 17,
        layer: 'back',
        scale: 1,
        alpha: 1,
      });
    }
    const statueProp = room % 2 === 0 ? 'knight' : 'robed';
    world.decorations.push({
      prop: statueProp,
      x: (start + 12) * T + T / 2,
      y: SURFACE,
      yOffset: 0,
      flip: room % 3 === 0,
      layer: 'back',
      scale: 1,
      alpha: 1,
    });
    if (room === 0 || room === 4) {
      world.decorations.push({
        prop: room === 0 ? 'robed' : 'knight',
        x: (start + 23) * T + T / 2,
        y: SURFACE,
        yOffset: 0,
        flip: room !== 0,
        layer: 'back',
        scale: 1,
        alpha: 1,
      });
    }
  }
}

function addInteractions(zone, world, route) {
  const routeIndex = route.indexOf(zone.id);
  if (routeIndex > 0) {
    const previous = route[routeIndex - 1];
    addTransition(
      world,
      zone,
      `left-${zone.id}`,
      zone.id === 'forest' || previous === 'forest' ? 'portal' : 'gate',
      2.5 * T,
      SURFACE,
      previous,
      'zone.return',
      { labelZone: previous, entrySide: 'right' },
    );
  }
  if (routeIndex >= 0 && routeIndex < route.length - 1) {
    const next = route[routeIndex + 1];
    addTransition(
      world,
      zone,
      `right-${zone.id}`,
      next === 'forest' || zone.id === 'forest' ? 'portal' : 'gate',
      (WIDTH - 3) * T,
      SURFACE,
      next,
      'action.usePortal',
      {
        labelZone: next,
        entrySide: 'left',
        requiresBoss: Boolean(zone.boss),
      },
    );
  }
  for (const door of zone.doors) {
    if (zone.id === 'forest') continue;
    const x = (door.room * ROOM_W + Math.floor(ROOM_W * door.offset)) * T;
    addTransition(
      world,
      zone,
      `door-${door.id}`,
      door.style === 'portal' ? 'portal' : 'door',
      x,
      SURFACE,
      door.target,
      'action.usePortal',
      { labelZone: door.target, entrySide: 'door', doorId: door.id, targetDoor: door.id },
    );
  }
  if (zone.hasFinalGate) {
    world.finalGate = {
      id: 'final-gate',
      type: 'finalGate',
      x: 24 * T,
      y: SURFACE,
      requiresShards: 3,
    };
  }
}

export function generateZone(seed, zoneId, options = {}) {
  const zone = ZONES[zoneId];
  if (!zone) throw new Error(`Unknown zone: ${zoneId}`);
  const route = options.route ?? buildZoneRoute(seed);
  const data = new Uint8Array(WIDTH * ROWS);
  fillGround(data);
  const worldRng = new RNG(combineSeed(seed, 'zone', zoneId));
  const world = {
    zoneId,
    seed,
    width: WIDTH,
    height: ROWS,
    rows: ROWS,
    surface: SURFACE,
    floorRow: FLOOR_ROW,
    spawn: { x: 4 * T, y: SURFACE },
    spawnRoom: zone.spawnRoom,
    checkpoints: [],
    transitions: [],
    interactions: [],
    decorations: [],
    hazards: [],
    secrets: [],
    propsAnimated: [],
    movingPlatforms: [],
    arena: null,
    challenge: null,
    finalGate: null,
    rooms: [],
    bossRoom: zone.bossRoom,
    styleFamily: zone.family,
    atlas: zone.atlas,
    palette: zone.palette,
    enemyPool: zone.enemyPool,
    elitePool: zone.elitePool,
    bossKey: zone.boss,
    ambient: zone.weather,
  };

  for (let room = 0; room < ROOMS; room++) {
    const roomRng = new RNG(combineSeed(seed, 'room', zoneId, room));
    world.rooms.push({ index: room, start: room * ROOM_W, width: ROOM_W });
    buildRoom(zone, room, data, roomRng, world);
  }

  addInteractions(zone, world, route);
  world.route = route;
  // Dungeon is reached by a crypt door at the start; keep entry safe and centered.
  world.spawn = zone.id === 'dungeon' || zone.id === 'forest'
    ? { x: 10 * T, y: SURFACE }
    : { x: 6 * T, y: SURFACE };
  for (let room = 0; room < ROOMS; room++) {
    addDecor(world, zone, new RNG(combineSeed(seed, 'decor', zoneId, room)), room * ROOM_W, SURFACE);
  }
  if (zone.id === 'dungeon') addDungeonProps(world);
  for (const transition of world.transitions) {
    if (Math.abs(transition.x - world.spawn.x) < 52) {
      transition.x += 64;
    }
  }
  const map = new Tilemap(WIDTH, ROWS, data);
  world.map = map;
  world.reachability = analyzeReachability(world);
  return world;
}

function gapRunsAtFloor(world) {
  const runs = [];
  let run = 0;
  for (let x = 0; x < WIDTH; x++) {
    const floorOk = world.map.isSolidAt(x, FLOOR_ROW);
    if (!floorOk) {
      run++;
    } else if (run > 0) {
      runs.push({ end: x, length: run });
      run = 0;
    }
  }
  if (run > 0) runs.push({ end: WIDTH, length: run });
  return runs;
}

export function analyzeReachability(world) {
  const gaps = gapRunsAtFloor(world);
  const badGaps = gaps.filter((gap) => gap.length > PHYSICS_BOUNDS.maxGapTiles);
  const targets = [];
  for (const transition of world.transitions) {
    targets.push({ id: transition.id, x: transition.x });
  }
  if (world.finalGate) targets.push({ id: 'final-gate', x: world.finalGate.x });
  if (world.arena) targets.push({ id: 'arena', x: world.arena.triggerX });
  const unreachable = [];
  for (const target of targets) {
    const tileX = Math.round(target.x / T);
    const blockers = gaps.filter((gap) => gap.end > world.spawn.x / T && gap.end < tileX);
    // Every floor gap in front of a target must be jumpable.
    if (blockers.some((gap) => gap.length > PHYSICS_BOUNDS.maxGapTiles)) {
      unreachable.push(target.id);
    }
    if (tileX < 2 || tileX >= WIDTH - 1) unreachable.push(target.id);
  }
  return {
    ok: badGaps.length === 0 && unreachable.length === 0,
    gaps,
    badGaps,
    unreachable,
  };
}

export function generateWorld(seed) {
  const zones = {};
  const route = buildZoneRoute(seed);
  for (const zoneId of ZONE_ORDER) {
    zones[zoneId] = generateZone(seed, zoneId, { route });
  }
  return zones;
}

export { WIDTH as WORLD_WIDTH, ROWS as WORLD_ROWS, SURFACE as WORLD_SURFACE, FLOOR_ROW };
