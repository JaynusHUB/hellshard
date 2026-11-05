/**
 * Measures Final tileset PNGs on a 16×16 grid and matches rects in ASSET_MANIFEST.
 * GIDs are computed, never guessed: collision tiles occupy 1..tilecount,
 * the visual sheet starts at firstgid = collisionTilecount + 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 16;
const FINAL = path.join(ROOT, 'public', 'assets', 'Final');
const COLLISION = path.join(ROOT, 'public', 'assets', 'pool', 'tilesets', 'collision_tiles.png');
const MANIFEST_PATH = path.join(ROOT, 'ASSET_MANIFEST.json');

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function opaque(png, x, y) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return false;
  return png.data[(y * png.width + x) * 4 + 3] > 16;
}

function cellStats(png, col, row) {
  const x0 = col * TILE;
  const y0 = row * TILE;
  let count = 0;
  let minX = TILE;
  let minY = TILE;
  let maxX = -1;
  let maxY = -1;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const px = x0 + x;
      const py = y0 + y;
      if (px >= png.width || py >= png.height) continue;
      const i = (py * png.width + px) * 4;
      if (png.data[i + 3] <= 16) continue;
      count++;
      r += png.data[i];
      g += png.data[i + 1];
      b += png.data[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return {
    count,
    bbox: count ? [minX, minY, maxX - minX + 1, maxY - minY + 1] : null,
    rgb: count ? [Math.round(r / count), Math.round(g / count), Math.round(b / count)] : null,
  };
}

function roleFromColor(rgb) {
  if (!rgb) return 'empty';
  const [r, g, b] = rgb;
  if (g > r + 18 && g > b + 8 && g > 70) return 'foliage';
  if (r > 90 && g > 70 && b < 70 && r - b > 30) return 'dirt';
  if (r > 140 && g > 140 && b > 140) return 'stone-light';
  if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && r < 90) return 'stone-dark';
  if (Math.abs(r - g) < 22 && Math.abs(g - b) < 22) return 'stone';
  if (b > r + 15 && b > g) return 'metal';
  if (r > g + 15 && r > b && g < 90) return 'wood-or-brick';
  return 'mixed';
}

function components(cells, columns) {
  const filled = new Map(cells.filter((cell) => cell.count > 8).map((cell) => [`${cell.col},${cell.row}`, cell]));
  const seen = new Set();
  const groups = [];
  for (const cell of filled.values()) {
    const key = `${cell.col},${cell.row}`;
    if (seen.has(key)) continue;
    const stack = [cell];
    seen.add(key);
    const group = [];
    while (stack.length) {
      const current = stack.pop();
      group.push(current);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextKey = `${current.col + dx},${current.row + dy}`;
        if (seen.has(nextKey) || !filled.has(nextKey)) continue;
        seen.add(nextKey);
        stack.push(filled.get(nextKey));
      }
    }
    const minC = Math.min(...group.map((entry) => entry.col));
    const minR = Math.min(...group.map((entry) => entry.row));
    const maxC = Math.max(...group.map((entry) => entry.col));
    const maxR = Math.max(...group.map((entry) => entry.row));
    groups.push({
      tiles: group.length,
      col: minC,
      row: minR,
      w: maxC - minC + 1,
      h: maxR - minR + 1,
      source: [minC * TILE, minR * TILE, (maxC - minC + 1) * TILE, (maxR - minR + 1) * TILE],
      ids: group
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map((entry) => entry.localId),
      roles: [...new Set(group.map((entry) => entry.role))].join('+'),
    });
  }
  groups.sort((a, b) => a.row - b.row || a.col - b.col);
  return { groups, columns };
}

function manifestRects() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const rects = [];
  const visit = (node, trail) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.rect) && node.rect.length === 4 && typeof node.image === 'string') {
      rects.push({ trail, image: node.image, rect: node.rect });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'rect') continue;
      if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, `${trail}.${key}[${index}]`));
      else visit(value, `${trail}.${key}`);
    }
  };
  visit(manifest, 'manifest');
  return rects;
}

function inspectSheet(label, filePath, firstgid) {
  const png = readPng(filePath);
  const columns = Math.floor(png.width / TILE);
  const rows = Math.floor(png.height / TILE);
  const remainder = [png.width % TILE, png.height % TILE];
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const stats = cellStats(png, col, row);
      const localId = row * columns + col;
      cells.push({
        col,
        row,
        localId,
        gid: firstgid + localId,
        source: [col * TILE, row * TILE, TILE, TILE],
        count: stats.count,
        bbox: stats.bbox,
        rgb: stats.rgb,
        role: roleFromColor(stats.rgb),
      });
    }
  }
  return {
    label,
    file: path.relative(ROOT, filePath).replaceAll('\\', '/'),
    width: png.width,
    height: png.height,
    columns,
    rows,
    remainder,
    tilecount: columns * rows,
    firstgid,
    cells,
    groups: components(cells, columns).groups,
  };
}

const collision = inspectSheet('collision_tiles', COLLISION, 1);
const visualFirst = collision.tilecount + 1;
const tiles = inspectSheet('Tiles', path.join(FINAL, 'Tiles.png'), visualFirst);
const backgrounds = ['Background_0.png', 'Background_1.png', 'Grass_background_1.png', 'Grass_background_2.png', 'Salt.png', 'brush.png']
  .map((name) => {
    const png = readPng(path.join(FINAL, name));
    return { name, width: png.width, height: png.height };
  });

const rects = manifestRects();
const finalRefs = rects.filter((entry) => entry.image.replaceAll('\\', '/').includes('Final/'));
const sameSize = rects.filter((entry) => entry.rect[2] === TILE && entry.rect[3] === TILE);

const used = tiles.cells.filter((cell) => cell.count > 8);
const lines = [];
lines.push('# Tileset inspection');
lines.push('');
lines.push(`Collision sheet: ${collision.width}x${collision.height}, grid ${collision.columns}x${collision.rows}, remainder ${collision.remainder.join('x')}, tilecount ${collision.tilecount}, firstgid ${collision.firstgid}.`);
lines.push(`Visual sheet: ${tiles.width}x${tiles.height}, grid ${tiles.columns}x${tiles.rows}, remainder ${tiles.remainder.join('x')}, tilecount ${tiles.tilecount}, firstgid ${tiles.firstgid}.`);
lines.push(`Non-empty visual cells (opaque>8): ${used.length}.`);
lines.push(`ASSET_MANIFEST Final/ rects: ${finalRefs.length}. 16x16 rects elsewhere: ${sameSize.length}. No Final path is catalogued, so visual GID roles are PNG-only and must stay marked doğrulanmalı where the piece identity is ambiguous.`);
lines.push('');
lines.push('## Background sizes');
for (const bg of backgrounds) lines.push(`- ${bg.name}: ${bg.width}x${bg.height}`);
lines.push('');
lines.push('## Collision cells');
lines.push('| local | GID | source | opaque | role |');
lines.push('|---|---|---|---|---|');
for (const cell of collision.cells.filter((entry) => entry.count > 0)) {
  lines.push(`| ${cell.localId} | ${cell.gid} | ${cell.source.join(',')} | ${cell.count} | ${cell.role} |`);
}
lines.push('');
lines.push('## Visual components');
lines.push('| # | tiles | origin col,row | size | source rect | local ids | color roles |');
lines.push('|---|---|---|---|---|---|---|');
tiles.groups.forEach((group, index) => {
  lines.push(`| ${index + 1} | ${group.tiles} | ${group.col},${group.row} | ${group.w}x${group.h} | ${group.source.join(',')} | ${group.ids.join(' ')} | ${group.roles} |`);
});
lines.push('');
lines.push('## Visual cells');
lines.push('| local | GID | col | row | source | opaque | bbox | rgb | role | manifest |');
lines.push('|---|---|---|---|---|---|---|---|---|');
for (const cell of used) {
  const match = finalRefs.find((entry) => entry.rect[0] === cell.source[0] && entry.rect[1] === cell.source[1]
    && entry.rect[2] === TILE && entry.rect[3] === TILE);
  lines.push(`| ${cell.localId} | ${cell.gid} | ${cell.col} | ${cell.row} | ${cell.source.join(',')} | ${cell.count} | ${cell.bbox?.join(',') ?? ''} | ${cell.rgb.join(',')} | ${cell.role} | ${match ? match.trail : 'yok'} |`);
}

const outDir = path.join(ROOT, 'scripts', '.tileset-inspect');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'), 'utf8');

function crop(png, rect) {
  const [x, y, w, h] = rect;
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, x, y, w, h, 0, 0);
  return out;
}

const sheet = readPng(path.join(FINAL, 'Tiles.png'));
tiles.groups.forEach((group, index) => {
  const image = crop(sheet, group.source);
  fs.writeFileSync(path.join(outDir, `group-${String(index + 1).padStart(2, '0')}.png`), PNG.sync.write(image));
});

const previewScale = 2;
const preview = new PNG({ width: tiles.columns * TILE * previewScale, height: tiles.rows * TILE * previewScale });
for (let y = 0; y < preview.height; y++) {
  for (let x = 0; x < preview.width; x++) {
    const sx = Math.floor(x / previewScale);
    const sy = Math.floor(y / previewScale);
    const i = (y * preview.width + x) * 4;
    const s = (sy * sheet.width + sx) * 4;
    const grid = (sx % TILE === 0 || sy % TILE === 0) ? 1 : 0;
    preview.data[i] = grid ? 255 : sheet.data[s];
    preview.data[i + 1] = grid ? 40 : sheet.data[s + 1];
    preview.data[i + 2] = grid ? 40 : sheet.data[s + 2];
    preview.data[i + 3] = 255;
    if (sheet.data[s + 3] < 16 && !grid) {
      preview.data[i] = (Math.floor(sx / TILE) + Math.floor(sy / TILE)) % 2 ? 18 : 28;
      preview.data[i + 1] = preview.data[i];
      preview.data[i + 2] = preview.data[i] + 6;
    }
  }
}
fs.writeFileSync(path.join(outDir, 'grid-preview.png'), PNG.sync.write(preview));

console.log(lines.slice(0, 40).join('\n'));
console.log(`\nFull report: scripts/.tileset-inspect/report.md`);
console.log(`Groups: ${tiles.groups.length}`);
