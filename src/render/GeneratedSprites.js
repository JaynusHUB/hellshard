import * as THREE from 'three';
import { SpriteBatch } from './SpriteBatch.js';

const PALETTE = {
  ink: '#120d10',
  ink2: '#24171b',
  wood: '#4c2925',
  woodHi: '#8a4e36',
  iron: '#3f4049',
  gold: '#c99a53',
  goldHi: '#efd18a',
  bone: '#d9c8a5',
  stone: '#34313a',
  stoneHi: '#5b5564',
  frost: '#8fd8f2',
  blood: '#8f2732',
  void: '#1b1122',
};

function drawChest(ctx, x, y, open = false) {
  const p = PALETTE;
  ctx.fillStyle = p.ink;
  ctx.fillRect(x, y + (open ? 2 : 3), 18, 10);
  ctx.fillStyle = p.wood;
  ctx.fillRect(x + 1, y + 4, 16, 8);
  ctx.fillStyle = p.woodHi;
  if (open) {
    ctx.fillRect(x + 2, y, 14, 4);
    ctx.fillStyle = p.ink;
    ctx.fillRect(x + 2, y + 4, 14, 2);
    ctx.fillStyle = p.goldHi;
    ctx.fillRect(x + 5, y + 3, 8, 1);
  } else {
    ctx.fillRect(x + 1, y + 3, 16, 2);
    ctx.fillStyle = p.ink;
    ctx.fillRect(x + 2, y + 5, 14, 1);
  }
  ctx.fillStyle = p.iron;
  ctx.fillRect(x + 3, y + 6, 2, 6);
  ctx.fillRect(x + 13, y + 6, 2, 6);
  ctx.fillStyle = p.gold;
  ctx.fillRect(x + 5, y + 9, 8, 2);
  ctx.fillStyle = p.ink2;
  ctx.fillRect(x + 8, y + 8, 2, 3);
  ctx.fillStyle = p.goldHi;
  ctx.fillRect(x + 8, y + 8, 1, 1);
}

function drawAltar(ctx, x, y) {
  const p = PALETTE;
  ctx.fillStyle = p.ink;
  ctx.fillRect(x + 3, y + 13, 18, 6);
  ctx.fillStyle = p.stone;
  ctx.fillRect(x + 5, y + 14, 14, 5);
  ctx.fillStyle = p.stoneHi;
  ctx.fillRect(x + 6, y + 14, 12, 1);
  ctx.fillStyle = p.ink2;
  ctx.fillRect(x + 7, y + 8, 10, 6);
  ctx.fillStyle = p.stone;
  ctx.fillRect(x + 8, y + 9, 8, 5);
  ctx.fillStyle = p.blood;
  ctx.fillRect(x + 9, y + 10, 6, 1);
  ctx.fillRect(x + 11, y + 10, 2, 3);
  ctx.fillStyle = p.gold;
  ctx.fillRect(x + 6, y + 7, 12, 1);
  ctx.fillStyle = p.goldHi;
  ctx.fillRect(x + 11, y + 5, 2, 2);
}

function drawGate(ctx, x, y, portal = false) {
  const p = PALETTE;
  const glow = portal ? p.frost : p.gold;
  ctx.fillStyle = p.ink;
  ctx.fillRect(x + 1, y + 4, 30, 44);
  ctx.fillStyle = p.stone;
  ctx.fillRect(x + 3, y + 6, 4, 38);
  ctx.fillRect(x + 25, y + 6, 4, 38);
  ctx.fillStyle = p.stoneHi;
  ctx.fillRect(x + 3, y + 6, 1, 38);
  ctx.fillRect(x + 25, y + 6, 1, 38);
  ctx.fillStyle = p.stone;
  ctx.fillRect(x + 6, y + 42, 20, 4);
  ctx.fillStyle = p.ink2;
  ctx.fillRect(x + 6, y + 36, 20, 7);
  ctx.fillStyle = p.void;
  ctx.fillRect(x + 7, y + 8, 18, 30);
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.28;
  ctx.fillRect(x + 9, y + 10, 14, 27);
  ctx.fillStyle = p.gold;
  ctx.globalAlpha = 1;
  ctx.fillRect(x + 15, y + 4, 2, 40);
  ctx.fillRect(x + 10, y + 7, 12, 1);
  ctx.fillStyle = p.goldHi;
  ctx.fillRect(x + 15, y + 20, 2, 2);
  ctx.fillRect(x + 12, y + 32, 8, 1);
}

function drawBrazier(ctx, x, y) {
  const p = PALETTE;
  ctx.fillStyle = p.ink;
  ctx.fillRect(x + 2, y + 12, 8, 6);
  ctx.fillStyle = p.stone;
  ctx.fillRect(x + 3, y + 13, 6, 5);
  ctx.fillStyle = p.iron;
  ctx.fillRect(x + 4, y + 7, 4, 6);
  ctx.fillStyle = p.frost;
  ctx.fillRect(x + 3, y + 2, 6, 5);
  ctx.fillStyle = p.bone;
  ctx.fillRect(x + 4, y, 3, 3);
}

function drawShard(ctx, x, y) {
  const p = PALETTE;
  ctx.fillStyle = p.goldHi;
  ctx.fillRect(x + 4, y + 1, 4, 1);
  ctx.fillRect(x + 2, y + 2, 8, 5);
  ctx.fillRect(x + 4, y + 7, 4, 4);
  ctx.fillStyle = p.gold;
  ctx.fillRect(x + 3, y + 3, 6, 3);
  ctx.fillStyle = p.bone;
  ctx.fillRect(x + 4, y + 3, 2, 2);
}

function drawPlank(ctx, x, y) {
  const p = PALETTE;
  ctx.fillStyle = p.ink;
  ctx.fillRect(x, y + 2, 48, 6);
  ctx.fillStyle = p.wood;
  ctx.fillRect(x + 1, y + 3, 46, 4);
  ctx.fillStyle = p.woodHi;
  ctx.fillRect(x + 2, y + 3, 44, 1);
  ctx.fillStyle = p.iron;
  ctx.fillRect(x + 5, y + 5, 1, 4);
  ctx.fillRect(x + 41, y + 5, 1, 4);
  ctx.fillStyle = p.gold;
  ctx.fillRect(x + 23, y + 1, 2, 1);
  ctx.fillStyle = p.blood;
  ctx.fillRect(x + 23, y + 2, 2, 1);
}

function drawSpikes(ctx, x, y) {
  const p = PALETTE;
  ctx.fillStyle = p.ink;
  ctx.fillRect(x, y + 7, 16, 3);
  ctx.fillStyle = p.stone;
  ctx.fillRect(x + 1, y + 8, 14, 2);
  const heights = [5, 8, 6, 9, 4];
  let px = x + 1;
  for (const h of heights) {
    ctx.fillStyle = p.stoneHi;
    ctx.fillRect(px, y + 8 - h, 2, h);
    ctx.fillStyle = p.bone;
    ctx.fillRect(px, y + 8 - h, 1, 1);
    px += 3;
  }
  ctx.fillStyle = p.blood;
  ctx.fillRect(x + 6, y + 6, 2, 1);
}

export function createGeneratedSprites() {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const layout = [
    ['chest', 2, 2, 18, 14],
    ['chestOpen', 24, 2, 18, 14],
    ['altar', 46, 2, 24, 20],
    ['gate', 74, 2, 32, 48],
    ['portal', 110, 2, 32, 48],
    ['brazier', 2, 28, 12, 20],
    ['shard', 18, 28, 10, 12],
    ['bossChest', 32, 32, 18, 14],
    ['spikes', 56, 28, 16, 10],
    ['plank', 72, 32, 48, 10],
  ];

  drawChest(ctx, 2, 2, false);
  drawChest(ctx, 24, 2, true);
  // Boss chest gets a golden seal.
  drawChest(ctx, 32, 32, false);
  ctx.fillStyle = PALETTE.goldHi;
  ctx.fillRect(39, 36, 4, 4);
  ctx.fillStyle = PALETTE.blood;
  ctx.fillRect(40, 37, 2, 2);
  drawAltar(ctx, 46, 2);
  drawGate(ctx, 74, 2, false);
  drawGate(ctx, 110, 2, true);
  drawBrazier(ctx, 2, 28);
  drawShard(ctx, 18, 28);
  drawSpikes(ctx, 56, 28);
  drawPlank(ctx, 72, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.needsUpdate = true;

  const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const frames = {};
  for (const [name, x, y, w, h] of layout) {
    let maxY = -1;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (pixelData[((y + yy) * canvas.width + x + xx) * 4 + 3] >= 8) maxY = yy;
      }
    }
    frames[name] = {
      id: `generated:${name}`,
      u0: (x + 0.01) / canvas.width,
      v0: 1 - (y + h - 0.01) / canvas.height,
      u1: (x + w - 0.01) / canvas.width,
      v1: 1 - (y + 0.01) / canvas.height,
      w,
      h,
      sx: x,
      sy: y,
      anchorY: (maxY + 1) / h,
    };
  }
  return { canvas, texture, frames };
}

export function createGeneratedBatch(texture, maxInstances = 128) {
  const batch = new SpriteBatch(texture, maxInstances);
  batch.mesh.renderOrder = 1;
  return batch;
}
