import { GAME, PHYSICS_BOUNDS } from '../config/game.js';
import { RNG, combineSeed } from '../core/RNG.js';
import { ZONES, GENERATED_ZONE_ORDER } from '../data/zones.js';
import { DUNGEON_ROOM_TEMPLATES } from '../data/dungeonRooms.js';
import { TILE, Tilemap } from './Tilemap.js';
import { LayoutGrid } from './LayoutGrid.js';
import { buildTiledWorld } from './tiledLoader.js';
import manifest from '../../ASSET_MANIFEST.json' with { type: 'json' };

const T = GAME.tile;
const ROOM_W = GAME.world.roomWidth;
const ROOMS = GAME.world.roomsPerZone;
const WIDTH = ROOM_W * ROOMS;
const ROWS = GAME.world.rows;
const FLOOR_ROW = 8;
const SURFACE = (FLOOR_ROW + 1) * T;
const BOSS_ROOM = 3;

export function buildZoneRoute(seed) {
  return ['cemetery', 'church', 'dungeon_gate'];
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

function addStairway(data, platformX, platformRow, side = -1) {
  const rise = platformRow - FLOOR_ROW;
  if (rise <= 1) return false;
  const build = (direction) => {
    const positions = [];
    for (let height = 1; height < rise; height++) {
      positions.push({ x: platformX + direction * (rise - height), height });
    }
    const supported = positions.every(({ x }) => (
      x >= 0 && x < WIDTH && data[idx(x, FLOOR_ROW)] === TILE.SOLID
    ));
    if (!supported) return false;
    for (const { x, height } of positions) {
      setSolidRect(data, x, FLOOR_ROW + 1, 1, height);
    }
    return true;
  };
  return build(side) || (side < 0 && build(1));
}

function addStepAccess(data, roomStart, step) {
  if (step.h <= 1) return;
  for (const offset of [-1, step.w]) {
    const x = roomStart + step.x + offset;
    if (x < 0 || x >= WIDTH) continue;
    setSolidRect(data, x, FLOOR_ROW + 1, 1, 1);
  }
}

function addChest(world, id, tileX, tileY, secret = false) {
  const supportType = world.map?.getType(tileX, tileY - 1);
  if (supportType !== TILE.SOLID && supportType !== TILE.ONE_WAY) return;
  for (let ox = -1; ox <= 1; ox++) {
    if (world.map?.getType(tileX + ox, tileY) !== TILE.EMPTY) return;
    if (world.map?.getType(tileX + ox, tileY + 1) !== TILE.EMPTY) return;
  }
  const x = tileX * T + T / 2;
  const supportRow = tileY - 1;
  const flushOffset = supportRow === world.map.surfaceRow || supportType === TILE.ONE_WAY
    ? (world.surfaceOffset ?? 0)
    : 0;
  const y = tileY * T - flushOffset;
  const rect = { x: x - 9, y, w: 18, h: 16 };
  if (world.layout?.overlaps(rect, (entry) => (
    entry.kind === 'gate' || entry.kind === 'chest' || entry.kind === 'chestClear' || entry.kind === 'structure'
  ))) return;
  world.interactions.push({
    id,
    type: 'chest',
    x,
    y,
    secret,
    opened: false,
  });
  world.layout?.mark(rect, 'chest', id);
  world.layout?.mark({ x: x - 12, y, w: 24, h: T * 2 }, 'chestClear', `${id}:clear`);
}

function levelTopY(world, level) {
  if (level <= 0) return world.surface;
  return (FLOOR_ROW + 1 + level) * T;
}

function buildDungeonRoom(zone, roomIndex, data, rng, world, template) {
  const start = roomIndex * ROOM_W;
  const surface = world.surface;
  const maxRise = GAME.world.platformMaxRise;
  for (const pit of template.pits) {
    carvePit(data, start + pit.x, pit.w);
    world.hazards.push({
      x: (start + pit.x) * T,
      y: (FLOOR_ROW - 1) * T,
      w: pit.w * T,
      h: T * 2,
      kind: 'spikes',
    });
  }
  for (const step of template.steps) {
    setSolidRect(data, start + step.x, FLOOR_ROW + 1, step.w, step.h);
    addStepAccess(data, start, step);
  }
  for (const ledge of template.ledges) {
    const row = FLOOR_ROW + Math.min(ledge.y, maxRise);
    setPlatform(data, start + ledge.x, row, ledge.w);
    addStairway(data, start + ledge.x, row);
  }
  template.chests.forEach((chest, index) => {
    addChest(
      world,
      `chest-dungeon-${roomIndex}-${index}`,
      start + chest.x,
      FLOOR_ROW + 1 + Math.min(chest.level, maxRise),
    );
  });
  if (template.altar) {
    world.interactions.push({
      id: `altar-dungeon-${roomIndex}`,
      type: 'altar',
      x: (start + template.altar.x) * T,
      y: levelTopY(world, template.altar.level),
      used: false,
    });
  }
  if (roomIndex === zone.challengeRoom) {
    world.challenge = {
      room: roomIndex,
      x: (start + 16) * T,
      y: surface,
      cleared: false,
    };
  }
  world.dungeonRooms[roomIndex] = {
    id: template.id,
    setPiece: template.setPiece,
    start,
    chests: template.chests.length,
  };
  world.checkpoints.push({ x: (start + 3) * T, y: surface, room: roomIndex });
}

function buildRoom(zone, roomIndex, data, rng, world) {
  const start = roomIndex * ROOM_W;
  const surface = world.surface;
  const isBossRoom = roomIndex === BOSS_ROOM;
  const isChallengeRoom = roomIndex === zone.challengeRoom;

  if (zone.id === 'dungeon') {
    buildDungeonRoom(zone, roomIndex, data, rng, world, world.dungeonTemplateOrder[roomIndex]);
    return;
  }

  if (isBossRoom && zone.boss) {
    // A clean, wide arena with no pits and no unreachable ceiling ledges.
  } else {
    // Pit patterns are bounded by the shared jump envelope. The outdoor
    // Gothicvania maps are mostly ground-hugging, so only the forest keeps a
    // regular pit cadence; other zones get at most one shallow break.
    const pitCount = roomIndex === 0
      ? 0
      : zone.id === 'forest'
        ? rng.int(1, 2)
        : rng.int(0, 1);
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
    const shelfCount = zone.id === 'forest'
      ? rng.int(1, 2)
      : roomIndex === 4 ? 1 : rng.int(0, 1);
    for (let i = 0; i < shelfCount; i++) {
      const sx = start + 8 + i * 12 + rng.int(0, 2);
      const sy = FLOOR_ROW + rng.int(2, GAME.world.platformMaxRise);
      const sw = rng.int(4, 6);
      setPlatform(data, sx, sy, sw);
      addStairway(data, sx, sy);
      if (i === 0) addChest(world, `chest-${zone.id}-${roomIndex}`, sx + 2, sy + 1);
    }
    if (shelfCount === 0) {
      addChest(world, `chest-${zone.id}-${roomIndex}-floor`, start + ROOM_W - 7, FLOOR_ROW + 1);
    }
  }

  if (roomIndex === 1) {
    addChest(world, `chest-${zone.id}-1b`, start + ROOM_W - 8, FLOOR_ROW + 1);
    const mx = (start + 16) * T;
    const my = surface + 56;
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
    // Keep the room readable: the old six-tile breakable tower read as a
    // floating grass column. A ground chest preserves the reward without
    // creating an unreachable silhouette.
    addChest(world, `chest-${zone.id}-2b`, start + 8, FLOOR_ROW + 1);
    if (!isChallengeRoom) {
      const altarX = start + ROOM_W - 5;
      if (world.map?.isSolidAt(altarX, FLOOR_ROW)) {
        world.interactions.push({
          id: `altar-${zone.id}`,
          type: 'altar',
          x: altarX * T,
          y: surface,
          used: false,
        });
      }
    }
  }

  if (roomIndex === BOSS_ROOM && zone.boss) {
    world.arena = {
      left: start * T,
      right: (start + ROOM_W) * T,
      triggerX: (start + 4) * T,
      active: false,
      cleared: false,
    };
  }

  if (isChallengeRoom) {
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
  world.layout?.mark({ x: x - 18, y, w: 36, h: 52 }, 'gate', id, { zone: zone.id });
}

function propRect(zoneId, prop, x, y, yOffset = 0) {
  const def = manifest.props[zoneId]?.frames?.[prop];
  const w = Number(def?.w ?? T);
  const h = Number(def?.h ?? T);
  return { x: x - w / 2, y: y + yOffset, w, h };
}

function addDecor(world, zone, rng, start, surface) {
  const count = zone.id === 'swamp' || zone.id === 'forest' ? rng.int(2, 4) : rng.int(2, 4);
  for (let i = 0; i < count; i++) {
    const prop = rng.pick(zone.decor);
    if (!prop) continue;
    const def = manifest.props[zone.id]?.frames?.[prop];
    if (!def) continue;
    const yOffset = prop.startsWith('torch') ? 38 : 0;
    const height = Number(def.h ?? T);
    const large = height > GAME.player.height * 2;
    let placed = false;
    for (let attempt = 0; attempt < 4 && !placed; attempt++) {
      const tileX = start + rng.int(3, ROOM_W - 4);
      const x = tileX * T;
      if (!world.map?.isSolidAt(tileX, FLOOR_ROW)) continue;
      const blockedAbove = [TILE.SOLID, TILE.BREAKABLE, TILE.FAKE, TILE.ONE_WAY].some(
        (type) => world.map.getType(tileX, FLOOR_ROW + 1) === type,
      );
      if (blockedAbove) continue;
      if (world.transitions.some((tr) => Math.abs(tr.x - x) < 64)) continue;
      const rect = propRect(zone.id, prop, x, surface, yOffset);
      if (world.layout?.overlaps(rect, (entry) => (
        large
          ? ['platform', 'movingPlatform', 'chest', 'chestClear', 'gate', 'prop', 'structure'].includes(entry.kind)
          : true
      ))) continue;
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
      world.layout?.mark(rect, 'prop', `${zone.id}:${prop}:${start + attempt}`, { prop });
      placed = true;
    }
  }
}

function addCemeteryBackdrops(world, seed) {
  const rng = new RNG(combineSeed(seed, 'cemetery-backdrops'));
  for (let room = 0; room < ROOMS; room++) {
    const start = room * ROOM_W;
    const tree = rng.pick(['tree1', 'tree2', 'tree3']);
    world.backdrops.push({
      prop: tree,
      x: (start + rng.int(9, 25)) * T,
      y: world.surface,
      tint: [0.32, 0.27, 0.38],
      alpha: 0.62,
      flip: rng.chance(0.5),
    });
    world.backdrops.push({
      prop: 'bushLarge',
      x: (start + rng.int(7, 27)) * T,
      y: world.surface,
      tint: [0.3, 0.35, 0.28],
      alpha: 0.54,
      flip: rng.chance(0.5),
    });
  }
}

function addChurchBackdrops(world) {
  for (let room = 0; room < ROOMS; room++) {
    const start = room * ROOM_W;
    world.backdrops.push({
      prop: 'column',
      x: (start + 17) * T,
      y: world.surface,
      tint: [0.62, 0.58, 0.82],
      alpha: 0.72,
      flip: room % 2 === 0,
    });
    world.backdrops.push({
      prop: 'balustrade',
      x: (start + 17) * T,
      y: world.surface,
      tint: [0.5, 0.47, 0.68],
      alpha: 0.62,
      flip: room % 2 === 1,
    });
  }
}

function addDungeonSetPieces(world) {
  const place = (prop, tileX, level, flip, options = {}) => {
    const x = tileX * T + T / 2;
    const y = level > 0 ? levelTopY(world, level) : world.surface;
    const yOffset = options.yOffset ?? 0;
    const rect = propRect('dungeon', prop, x, y, yOffset);
    if (world.layout?.overlaps(rect, (entry) => (
      ['platform', 'movingPlatform', 'chest', 'chestClear', 'gate', 'prop', 'structure'].includes(entry.kind)
    ))) return false;
    if (yOffset === 0 && !world.map?.isSolidAt(tileX, FLOOR_ROW + level)) return false;
    world.decorations.push({
      prop,
      x,
      y,
      yOffset,
      flip,
      layer: 'back',
      scale: 1,
      alpha: options.alpha ?? 1,
      tint: options.tint ?? null,
      glow: Boolean(options.glow),
    });
    world.layout?.mark(rect, 'prop', `dungeon:${prop}:${tileX}:${level}`, { prop });
    return true;
  };

  for (let room = 0; room < ROOMS; room++) {
    const start = room * ROOM_W;
    const template = world.dungeonTemplateOrder[room];
    for (const panel of template.panels) {
      const x = (start + panel) * T;
      for (const level of [0, 3]) {
        world.backdrops.push({
          prop: 'wallLarge',
          x,
          y: world.surface + level * T,
          yOffset: 0,
          layer: 'back',
          alpha: 0.64,
          tint: [0.24, 0.26, 0.34],
        });
      }
    }
    for (const tileX of template.torches) {
      place('torch0', start + tileX, 0, tileX >= 17, {
        yOffset: 72,
        tint: [1.18, 1.12, 1.02],
        glow: true,
      });
    }
    for (const statue of template.statues) {
      // Statues live in the wall niche, not in the player's walking lane.
      world.backdrops.push({
        prop: statue.prop,
        x: (start + statue.x) * T + T / 2,
        y: world.surface,
        tint: [0.62, 0.63, 0.72],
        alpha: 0.62,
        flip: (statue.x + room) % 2 === 0,
      });
    }
    world.setPieces.push({
      room,
      type: template.setPiece,
      x: (start + 16) * T,
    });
  }
}

function addDungeonSurfaceDecals(world, seed) {
  const rng = new RNG(combineSeed(seed, 'dungeon-decals'));
  const kinds = ['moss', 'puddle', 'crack', 'rubble', 'broken'];
  for (let room = 0; room < ROOMS; room++) {
    const start = room * ROOM_W;
    let placedDecals = 0;
    for (let x = start + 5; x < start + 29; x++) {
      if (world.map.getType(x, FLOOR_ROW) !== TILE.SOLID) continue;
      if (world.map.getType(x, FLOOR_ROW + 1) !== TILE.EMPTY) continue;
      if (!rng.chance(0.24)) continue;
      if (world.transitions.some((transition) => Math.abs(transition.x - x * T) < 28)) continue;
      if (world.interactions.some((interaction) => Math.abs(interaction.x - x * T) < 24)) continue;
      world.surfaceDecals.push({
        kind: kinds[(room * 3 + placedDecals) % kinds.length],
        x: x * T + T / 2,
        y: world.paintedSurface,
        variant: rng.int(0, 3),
        flip: rng.chance(0.5),
        alpha: 0.24 + rng.float(0, 0.2),
      });
      placedDecals++;
    }
  }
}

function collectPlatformRuns(world) {
  const runs = [];
  for (let y = 0; y < world.map.height; y++) {
    let start = -1;
    for (let x = 0; x <= world.map.width; x++) {
      const oneWay = x < world.map.width && world.map.getType(x, y) === TILE.ONE_WAY;
      if (oneWay && start < 0) start = x;
      if (!oneWay && start >= 0) {
        runs.push({
          x: start * T,
          y: (y + 1) * T - world.surfaceOffset,
          row: y,
          w: (x - start) * T,
        });
        start = -1;
      }
    }
  }
  return runs;
}

function indexLayout(world) {
  for (let y = 0; y < world.map.height; y++) {
    for (let x = 0; x < world.map.width; x++) {
      const type = world.map.getType(x, y);
      if (type === TILE.ONE_WAY) {
        world.layout.markTile(x, y, 'platform', `${x}:${y}`, { x, y });
      } else if (y > FLOOR_ROW && (type === TILE.SOLID || type === TILE.BREAKABLE || type === TILE.FAKE)) {
        world.layout.markTile(x, y, 'structure', `${x}:${y}`, { x, y });
      }
    }
  }
  for (const platform of world.movingPlatforms) {
    world.layout.mark({
      x: platform.x - platform.w / 2,
      y: platform.y,
      w: platform.w,
      h: platform.h,
    }, 'movingPlatform', platform.id);
  }
}

function registerSecretChests(world) {
  const known = new Set(world.layout.entries.filter((entry) => entry.kind === 'chest').map((entry) => entry.id));
  for (const interaction of world.interactions) {
    if (interaction.type !== 'chest' || known.has(interaction.id)) continue;
    const rect = { x: interaction.x - 9, y: interaction.y, w: 18, h: 16 };
    if (world.layout.overlaps(rect, (entry) => (
      ['structure', 'gate', 'prop', 'chest', 'chestClear'].includes(entry.kind)
    ))) {
      interaction.opened = true;
      interaction.removed = true;
      continue;
    }
    const support = world.map.getGroundYAtWorld(interaction.x, interaction.y - 1);
    if (support === null || Math.abs(support - interaction.y) > 1) {
      interaction.opened = true;
      interaction.removed = true;
      continue;
    }
    world.layout.mark(rect, 'chest', interaction.id);
    world.layout.mark({ x: interaction.x - 12, y: interaction.y, w: 24, h: T * 2 }, 'chestClear', `${interaction.id}:clear`);
  }
  world.interactions = world.interactions.filter((interaction) => !interaction.removed);
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
      world.surface,
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
      world.surface,
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
      world.surface,
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
      y: world.surface,
      requiresShards: 3,
    };
    world.layout?.mark(
      { x: 24 * T - 18, y: world.surface, w: 36, h: 52 },
      'gate',
      'final-gate',
      { zone: zone.id },
    );
  }
}

export function generateZone(seed, zoneId, options = {}) {
  const zone = ZONES[zoneId];
  if (!zone) throw new Error(`Unknown zone: ${zoneId}`);
  const route = options.route ?? buildZoneRoute(seed);
  const packaged = Object.values(options.packagedMaps ?? {}).find(
    (entry) => entry?.map && entry?.config?.zoneId === zoneId,
  );
  if (packaged) {
    return buildTiledWorld({
      map: packaged.map,
      mapUrl: packaged.mapUrl,
      tilesets: packaged.tilesets,
      images: packaged.images,
      config: packaged.config,
      route,
      seed,
    });
  }
  const data = new Uint8Array(WIDTH * ROWS);
  fillGround(data);
  const footSink = Number(GAME.footSink[zoneId] ?? 0);
  const paintedOffset = Number(manifest.tiles[zoneId]?.surfaceOffset ?? 0);
  const surfaceOffset = paintedOffset + footSink;
  const surface = SURFACE - surfaceOffset;
  const worldRng = new RNG(combineSeed(seed, 'zone', zoneId));
  const world = {
    zoneId,
    seed,
    width: WIDTH,
    height: ROWS,
    rows: ROWS,
    surface,
    surfaceOffset,
    paintedOffset,
    paintedSurface: SURFACE - paintedOffset,
    footSink,
    fringeHeight: Number(GAME.foregroundFringe[zoneId] ?? 0),
    floorRow: FLOOR_ROW,
    spawn: { x: 4 * T, y: surface },
    spawnRoom: zone.spawnRoom,
    checkpoints: [],
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

  const map = new Tilemap(WIDTH, ROWS, data, { surfaceOffset, surfaceRow: FLOOR_ROW });
  world.map = map;
  world.layout = new LayoutGrid({ width: WIDTH, height: ROWS, tileSize: T });
  world.route = route;
  if (zone.id === 'dungeon') {
    const templateRng = new RNG(combineSeed(seed, 'dungeon-room-order'));
    world.dungeonTemplateOrder = templateRng
      .shuffle(DUNGEON_ROOM_TEMPLATES)
      .slice(0, ROOMS);
  }
  // Dungeon and forest use a centered entry; all other zones start at the left.
  world.spawn = zone.id === 'dungeon' || zone.id === 'forest'
    ? { x: 10 * T, y: surface }
    : { x: 6 * T, y: surface };

  addInteractions(zone, world, route);

  for (let room = 0; room < ROOMS; room++) {
    const roomRng = new RNG(combineSeed(seed, 'room', zoneId, room));
    world.rooms.push({ index: room, start: room * ROOM_W, width: ROOM_W });
    buildRoom(zone, room, data, roomRng, world);
  }

  indexLayout(world);
  registerSecretChests(world);
  for (let room = 0; room < ROOMS; room++) {
    addDecor(world, zone, new RNG(combineSeed(seed, 'decor', zoneId, room)), room * ROOM_W, surface);
  }
  if (zone.id === 'cemetery') addCemeteryBackdrops(world, seed);
  if (zone.id === 'church') addChurchBackdrops(world);
  if (zone.id === 'dungeon') {
    addDungeonSetPieces(world);
    addDungeonSurfaceDecals(world, seed);
  }
  world.platformRuns = collectPlatformRuns(world);
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

export function generateWorld(seed, options = {}) {
  const zones = {};
  const route = buildZoneRoute(seed);
  for (const zoneId of GENERATED_ZONE_ORDER) {
    zones[zoneId] = generateZone(seed, zoneId, {
      ...options,
      route,
    });
  }
  return zones;
}
