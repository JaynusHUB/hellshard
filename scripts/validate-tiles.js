import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';
import manifest from '../ASSET_MANIFEST.json' with { type: 'json' };
import { GAME } from '../src/config/game.js';

const { PNG } = pngjs;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_TILE = 16;
const imageCache = new Map();
const failures = [];

function image(assetPath) {
  if (!imageCache.has(assetPath)) {
    imageCache.set(assetPath, PNG.sync.read(fs.readFileSync(path.join(ROOT, 'public', assetPath))));
  }
  return imageCache.get(assetPath);
}

const COMPOSITE_FRAMES = new Set(['water', 'sideLeft', 'sideRight', 'chunk']);

function frameList(frames) {
  const output = [];
  for (const [kind, value] of Object.entries(frames)) {
    if (COMPOSITE_FRAMES.has(kind)) continue;
    if (Array.isArray(value)) {
      value.forEach((frame, index) => output.push([`${kind}:${index}`, frame]));
    } else {
      output.push([kind, value]);
    }
  }
  return output;
}

const tiledPath = path.join(ROOT, 'public/assets/cemetery/demo/assets/maps/map.json');
let tiledSummary = 'not found';
if (fs.existsSync(tiledPath)) {
  const map = JSON.parse(fs.readFileSync(tiledPath, 'utf8'));
  const layerNames = map.layers.map((layer) => layer.name).join(' > ');
  if (map.tilewidth !== EXPECTED_TILE || map.tileheight !== EXPECTED_TILE) {
    failures.push(`cemetery Tiled map uses ${map.tilewidth}x${map.tileheight}, expected 16x16`);
  }
  for (const tileset of map.tilesets ?? []) {
    if ((tileset.margin ?? 0) !== 0 || (tileset.spacing ?? 0) !== 0) {
      failures.push(`cemetery Tiled tileset ${tileset.name} has margin/spacing`);
    }
  }
  for (const layer of map.layers) {
    if (layer.type === 'tilelayer' && layer.data.length !== map.width * map.height) {
      failures.push(`cemetery Tiled layer ${layer.name} data length mismatch`);
    }
  }
  if (!layerNames.includes('Collisions Layer') || !layerNames.includes('Back Layer')
    || !layerNames.includes('Main Layer')) {
    failures.push('cemetery Tiled reference is missing a required layer');
  }
  tiledSummary = `${map.width}x${map.height} tiles, 16x16, margin 0, spacing 0, ${layerNames}`;
}

const rows = [];
for (const [zoneId, group] of Object.entries(manifest.tiles)) {
  const tileWidth = Number(group.tileWidth ?? EXPECTED_TILE);
  const tileHeight = Number(group.tileHeight ?? EXPECTED_TILE);
  const margin = Number(group.margin ?? 0);
  const spacing = Number(group.spacing ?? 0);
  const frames = frameList(group.frames ?? {});
  const sourceSizes = new Set();
  for (const [name, frame] of frames) {
    if (!frame?.image || !Array.isArray(frame.rect)) {
      failures.push(`${zoneId}: ${name} has no image/rect`);
      continue;
    }
    const png = image(frame.image);
    sourceSizes.add(`${png.width}x${png.height}`);
    const [x, y, w, h] = frame.rect;
    if (w !== tileWidth || h !== tileHeight) {
      failures.push(`${zoneId}: ${name} is ${w}x${h}, expected ${tileWidth}x${tileHeight}`);
    }
    if (x < 0 || y < 0 || x + w > png.width || y + h > png.height) {
      failures.push(`${zoneId}: ${name} rect is outside ${frame.image}`);
    }
    if (margin !== 0 || spacing !== 0) {
      failures.push(`${zoneId}: source margin/spacing must be 0, got ${margin}/${spacing}`);
    }
  }
  if (tileWidth !== GAME.tile || tileHeight !== GAME.tile) {
    failures.push(`${zoneId}: manifest tile ${tileWidth}x${tileHeight} != GAME.tile ${GAME.tile}`);
  }
  rows.push({
    zone: zoneId,
    tile: `${tileWidth}x${tileHeight}`,
    margin,
    spacing,
    frames: frames.length,
    sources: [...sourceSizes].join(','),
  });
}

const columns = ['zone', 'tile', 'margin', 'spacing', 'frames', 'sources'];
const widths = [10, 7, 7, 8, 7, 18];
console.log(columns.map((column, index) => column.padEnd(widths[index])).join(''));
for (const row of rows) {
  const values = [row.zone, row.tile, row.margin, row.spacing, row.frames, row.sources];
  console.log(values.map((value, index) => String(value).padEnd(widths[index])).join(''));
}

console.log(`\nCemetery Tiled reference: ${tiledSummary}`);

if (failures.length) {
  console.error(`\n✗ Tile validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('\n✓ Tile validation passed: five 16x16 catalogs, source margin 0, spacing 0, all rects in bounds.');
