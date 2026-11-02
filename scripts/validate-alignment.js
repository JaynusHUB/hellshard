import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';
import manifest from '../ASSET_MANIFEST.json' with { type: 'json' };
import { GAME } from '../src/config/game.js';
import { TILE } from '../src/world/Tilemap.js';
import { generateWorld, buildZoneRoute } from '../src/world/WorldGen.js';

const { PNG } = pngjs;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE_SIZE = GAME.tile;
const FILL_THRESHOLD = 0.6;
const TOLERANCE = 1;

const imageCache = new Map();
const failures = [];
let groundProps = 0;
let placedProps = 0;
let checkedObjects = 0;

function image(assetPath) {
  if (!imageCache.has(assetPath)) {
    const file = path.join(ROOT, 'public', assetPath);
    imageCache.set(assetPath, PNG.sync.read(fs.readFileSync(file)));
  }
  return imageCache.get(assetPath);
}

function alphaAt(png, x, y) {
  return png.data[(y * png.width + x) * 4 + 3];
}

function frameRows(imagePath, rect) {
  const png = image(imagePath);
  const [rx, ry, rw, rh] = rect;
  const rows = [];
  for (let y = 0; y < rh; y++) {
    let count = 0;
    for (let x = 0; x < rw; x++) {
      if (alphaAt(png, rx + x, ry + y) >= 8) count++;
    }
    rows.push(count);
  }
  return { rows, width: rw, height: rh, png, rect };
}

function paintedSurfaceRow(frame) {
  const threshold = Math.ceil(frame.width * FILL_THRESHOLD);
  return frame.rows.findIndex((count) => count >= threshold);
}

function propBottom(zoneId, propName) {
  const group = manifest.props[zoneId];
  const def = group?.frames?.[propName];
  if (!def) return null;
  const png = image(def.image);
  const rect = def.rect ?? [0, 0, png.width, png.height];
  const [rx, ry, rw, rh] = rect;
  let maxY = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (alphaAt(png, rx + x, ry + y) >= 8) maxY = y;
    }
  }
  return { maxY, rect, bottomInset: rh - (maxY + 1) };
}

function supportAt(world, x, fromY) {
  const map = world.map;
  const tx = Math.max(0, Math.min(map.width - 1, Math.floor(x / map.tileSize)));
  let ty = Math.min(map.height - 1, Math.floor(fromY / map.tileSize));
  for (; ty >= 0; ty--) {
    const type = map.getType(tx, ty);
    if (type !== TILE.SOLID && type !== TILE.ONE_WAY && type !== TILE.BREAKABLE) continue;
    const painted = ty === map.surfaceRow || type === TILE.ONE_WAY;
    return (ty + 1) * map.tileSize - (painted ? map.surfaceOffset : 0);
  }
  return null;
}

function checkPlacement(zoneId, label, x, y, world) {
  checkedObjects++;
  const support = supportAt(world, x, y - 1);
  if (support === null) {
    failures.push(`${zoneId}: ${label} has no support at x=${x.toFixed(0)} y=${y.toFixed(0)}`);
    return;
  }
  if (Math.abs(y - support) > TOLERANCE) {
    failures.push(`${zoneId}: ${label} base ${y.toFixed(1)} != support ${support} (Δ${(y - support).toFixed(1)})`);
  }
}

const world = generateWorld(20261102);
const route = buildZoneRoute(20261102);

for (const zoneId of Object.keys(world)) {
  const zone = world[zoneId];
  const tileGroup = manifest.tiles[zoneId];
  const topFrames = Array.isArray(tileGroup?.frames?.top)
    ? tileGroup.frames.top
    : [tileGroup?.frames?.top].filter(Boolean);
  if (!topFrames.length) {
    failures.push(`${zoneId}: no top tile frames`);
    continue;
  }

  const measuredRows = topFrames.map((frame, index) => {
    const result = frameRows(frame.image, frame.rect);
    const row = paintedSurfaceRow(result);
    if (row < 0) {
      failures.push(`${zoneId}: top tile ${index} has no row above ${Math.round(FILL_THRESHOLD * 100)}% alpha fill`);
    }
    return row;
  });
  const offset = Number(tileGroup.surfaceOffset ?? 0);
  for (let i = 0; i < measuredRows.length; i++) {
    if (measuredRows[i] < 0) continue;
    if (Math.abs(measuredRows[i] - offset) > TOLERANCE) {
      failures.push(`${zoneId}: top tile ${i} surface row ${measuredRows[i]} != manifest surfaceOffset ${offset}`);
    }
  }
  const footSink = Number(GAME.footSink[zoneId] ?? 0);
  const paintedSurface = (zone.floorRow + 1) * TILE_SIZE - offset;
  const expectedSurface = paintedSurface - footSink;
  if (Number(zone.footSink ?? 0) !== footSink) {
    failures.push(`${zoneId}: runtime footSink ${zone.footSink} != config ${footSink}`);
  }
  if (Math.abs(zone.surface - expectedSurface) > TOLERANCE) {
    failures.push(`${zoneId}: physics surface ${zone.surface} != painted ${paintedSurface} - footSink ${footSink}`);
  }
  if (Math.abs(zone.map.surfaceY - zone.surface) > TOLERANCE) {
    failures.push(`${zoneId}: tilemap surface ${zone.map.surfaceY} != physics surface ${zone.surface}`);
  }
  if (Math.abs(zone.spawn.y - zone.surface) > TOLERANCE) {
    failures.push(`${zoneId}: spawn foot ${zone.spawn.y} != surface ${zone.surface}`);
  }

  let zoneProps = 0;
  for (const decoration of zone.decorations) {
    const drawY = decoration.y + (decoration.yOffset ?? 0);
    if (decoration.prop.startsWith('torch') || (decoration.yOffset ?? 0) > 0) continue;
    placedProps++;
    zoneProps++;
    const foot = propBottom(zoneId, decoration.prop);
    if (!foot) {
      failures.push(`${zoneId}: missing prop frame ${decoration.prop}`);
      continue;
    }
    if (foot.maxY < 0) {
      failures.push(`${zoneId}: prop ${decoration.prop} has no opaque pixels`);
      continue;
    }
    groundProps++;
    checkPlacement(zoneId, `prop ${decoration.prop}`, decoration.x, drawY, zone);
  }

  for (const interaction of zone.interactions) {
    if (interaction.type !== 'chest' && interaction.type !== 'altar') continue;
    checkPlacement(zoneId, `${interaction.type} ${interaction.id}`, interaction.x, interaction.y, zone);
  }
  for (const transition of zone.transitions) {
    checkPlacement(zoneId, `gate ${transition.id}`, transition.x, transition.y, zone);
  }
  if (zone.finalGate) {
    checkPlacement(zoneId, 'final gate', zone.finalGate.x, zone.finalGate.y, zone);
  }
  for (const checkpoint of zone.checkpoints) {
    checkPlacement(zoneId, `checkpoint room ${checkpoint.room}`, checkpoint.x, checkpoint.y, zone);
  }

  // Single-tile one-way ledges are the only intentional floating platform shape;
  // flag any generated ledge shorter than three tiles so map dressing cannot
  // create unsupported one-tile blocks.
  for (let y = 0; y < zone.map.height; y++) {
    let run = 0;
    for (let x = 0; x <= zone.map.width; x++) {
      const oneWay = x < zone.map.width && zone.map.getType(x, y) === TILE.ONE_WAY;
      if (oneWay) run++;
      else {
        if (run === 1 || run === 2) {
          failures.push(`${zoneId}: unsupported one-way ledge width ${run} at tile ${x - run},${y}`);
        }
        run = 0;
      }
    }
  }

  const rowsText = measuredRows.join('/');
  console.log(
    `${zoneId.padEnd(9)} route=${route.indexOf(zoneId)} surface=${zone.surface} ` +
    `painted=${paintedSurface} footSink=${footSink} manifestOffset=${offset} ` +
    `measuredRows=${rowsText} props=${zoneProps}`,
  );
}

if (failures.length) {
  console.error(`\n✗ Alignment validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\n✓ Alignment validation passed: 5 zones, ${placedProps} props, ${checkedObjects} placed objects, footSink applied, ±${TOLERANCE}px tolerance.`);
console.log(`  ground props checked: ${groundProps}; one-way ledges are at least 3 tiles wide.`);
