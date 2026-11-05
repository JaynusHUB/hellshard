import { GAME, PHYSICS_BOUNDS } from '../src/config/game.js';
import { GENERATED_ZONE_ORDER } from '../src/data/zones.js';
import { generateWorld } from '../src/world/WorldGen.js';
import { TILE } from '../src/world/Tilemap.js';

const T = GAME.tile;
const TOLERANCE = 1;
const stats = {};
const failures = [];

for (const zoneId of GENERATED_ZONE_ORDER) {
  stats[zoneId] = {
    props: 0,
    chests: 0,
    gates: 0,
    platforms: 0,
    overlaps: 0,
    floatingChests: 0,
    clearanceBad: 0,
    tinyStructures: 0,
    unreachablePlatforms: 0,
  };
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function supportInfo(world, entry) {
  const map = world.map;
  const tx = Math.max(0, Math.min(map.width - 1, Math.floor(entry.x / T)));
  let ty = Math.min(map.height - 1, Math.floor((entry.y - 1) / T));
  for (; ty >= 0; ty--) {
    const type = map.getType(tx, ty);
    if (type !== TILE.SOLID && type !== TILE.ONE_WAY && type !== TILE.BREAKABLE) continue;
    const painted = ty === map.surfaceRow || type === TILE.ONE_WAY;
    return {
      ty,
      y: (ty + 1) * T - (painted ? map.surfaceOffset : 0),
      type,
    };
  }
  return null;
}

function scanTinyStructures(world) {
  let count = 0;
  const map = world.map;
  for (let y = 0; y < map.height; y++) {
    let run = 0;
    for (let x = 0; x <= map.width; x++) {
      const oneWay = x < map.width && map.getType(x, y) === TILE.ONE_WAY;
      if (oneWay) run++;
      else {
        if (run === 1 || run === 2) count++;
        run = 0;
      }
    }
  }
  for (let y = world.floorRow + 1; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const type = map.getType(x, y);
      if (type !== TILE.SOLID && type !== TILE.BREAKABLE) continue;
      const below = map.getType(x, y - 1);
      const left = map.getType(x - 1, y);
      const right = map.getType(x + 1, y);
      const supported = below === TILE.SOLID || below === TILE.BREAKABLE;
      const connectedSide = left === TILE.SOLID || right === TILE.SOLID;
      if (!supported && !connectedSide) count++;
    }
  }
  return count;
}

for (let seed = 1; seed <= 100; seed++) {
  const world = generateWorld(seed);
  for (const zoneId of GENERATED_ZONE_ORDER) {
    const zone = world[zoneId];
    const entries = zone.layout?.entries ?? [];
    const props = entries.filter((entry) => entry.kind === 'prop');
    const chests = entries.filter((entry) => entry.kind === 'chest');
    const gates = entries.filter((entry) => entry.kind === 'gate');
    const platforms = entries.filter((entry) => (
      entry.kind === 'platform' || entry.kind === 'movingPlatform'
    ));
    const row = stats[zoneId];
    row.props += props.length;
    row.chests += chests.length;
    row.gates += gates.length;
    row.platforms += platforms.length;
    for (const platform of zone.platformRuns ?? []) {
      const rise = (platform.row - zone.floorRow) * T;
      if (rise > PHYSICS_BOUNDS.maxJumpHeight + 0.5) {
        row.unreachablePlatforms++;
        if (failures.length < 60) {
          failures.push(`${seed}:${zoneId}: platform row ${platform.row} is ${rise}px above floor`);
        }
      }
    }

    for (const prop of props) {
      for (const other of entries) {
        if (other === prop || other.kind === 'chestClear') continue;
        if (!intersects(prop, other)) continue;
        row.overlaps++;
        if (failures.length < 60) {
          failures.push(`${seed}:${zoneId}: prop ${prop.meta?.prop ?? prop.id} overlaps ${other.kind} ${other.id}`);
        }
      }
    }
    for (const chest of chests) {
      for (const other of entries) {
        if (other === chest || other.kind === 'chestClear' || other.kind === 'prop') continue;
        if (other.kind === 'platform' || other.kind === 'movingPlatform') continue;
        if (!intersects(chest, other)) continue;
        row.overlaps++;
        if (failures.length < 60) {
          failures.push(`${seed}:${zoneId}: chest ${chest.id} overlaps ${other.kind} ${other.id}`);
        }
      }
      const support = supportInfo(zone, chest);
      if (!support || Math.abs(chest.y - support.y) > TOLERANCE) {
        row.floatingChests++;
        if (failures.length < 60) failures.push(`${seed}:${zoneId}: floating chest ${chest.id}`);
      } else {
        const map = zone.map;
        for (let step = 1; step <= 2; step++) {
          const tx = Math.floor(chest.x / T);
          const ty = support.ty + step;
          if (map.getType(tx, ty) !== TILE.EMPTY) {
            row.clearanceBad++;
            if (failures.length < 60) failures.push(`${seed}:${zoneId}: chest clearance ${chest.id}`);
            break;
          }
        }
      }
    }
    row.tinyStructures += scanTinyStructures(zone);
  }
}

const columns = ['zone', 'props', 'chests', 'gates', 'platforms', 'overlaps', 'floatingChests', 'clearanceBad', 'tinyStructures', 'unreachablePlatforms'];
const widths = [10, 7, 7, 7, 10, 9, 15, 13, 15, 21];
console.log(columns.map((column, index) => column.padEnd(widths[index])).join(''));
for (const zoneId of GENERATED_ZONE_ORDER) {
  const row = stats[zoneId];
  const values = [zoneId, row.props, row.chests, row.gates, row.platforms, row.overlaps, row.floatingChests, row.clearanceBad, row.tinyStructures, row.unreachablePlatforms];
  console.log(values.map((value, index) => String(value).padEnd(widths[index])).join(''));
}
const totalBad = Object.values(stats).reduce((sum, row) => (
  sum + row.overlaps + row.floatingChests + row.clearanceBad + row.tinyStructures + row.unreachablePlatforms
), 0);
if (totalBad > 0) {
  console.error(`\n✗ Layout validation failed with ${totalBad} issue(s).`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`\n? Layout validation passed: 100 seeds ? ${GENERATED_ZONE_ORDER.length} zones; zero overlaps, floating chests, clearance violations, unsupported single-tile structures or unreachable platforms.`);
