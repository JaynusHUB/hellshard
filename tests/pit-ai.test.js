import { describe, expect, it, vi } from 'vitest';
import { GAME } from '../src/config/game.js';
import { ENEMY_BY_ID } from '../src/data/enemies.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Tilemap, TILE } from '../src/world/Tilemap.js';

const T = GAME.tile;
const WIDTH = 40;
const HEIGHT = 16;
const FLOOR_ROW = 8;

function makeWorld() {
  const data = new Uint8Array(WIDTH * HEIGHT);
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y <= FLOOR_ROW; y++) data[y * WIDTH + x] = TILE.SOLID;
  }
  // Two-tile pit. Ground is still present beneath it.
  for (const x of [18, 19]) {
    data[7 * WIDTH + x] = TILE.EMPTY;
    data[8 * WIDTH + x] = TILE.EMPTY;
  }
  const map = new Tilemap(WIDTH, HEIGHT, data, { surfaceOffset: 0, surfaceRow: FLOOR_ROW });
  return {
    zoneId: 'test',
    width: WIDTH,
    height: HEIGHT,
    surface: 144,
    surfaceOffset: 0,
    map,
    hazards: [],
  };
}

function makeAssets() {
  const frame = {
    id: 'test:frame',
    w: 16,
    h: 16,
    u0: 0,
    v0: 0,
    u1: 1,
    v1: 1,
    anchorY: 1,
  };
  const animation = { frames: [frame, frame], fps: 8, loop: true };
  return {
    getAnimation: () => animation,
    getFrame: () => frame,
  };
}

function simulate(enemyId) {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  try {
    const world = makeWorld();
    const assets = makeAssets();
    const enemy = new Enemy(ENEMY_BY_ID[enemyId], assets, 10 * T, 144);
    enemy.spawnCost = 1;
    const player = { x: 30 * T, y: 144, width: 12, height: 28, dead: false };
    const game = {
      player,
      enemies: [enemy],
      activeWorld: world,
      spawnDirector: { refund() {} },
      combat: { damageEnemy() {} },
      despawnEnemy(target, reason) {
        target.dead = true;
        target.despawned = true;
        target.despawnReason = reason;
      },
    };
    let crossed = false;
    let steps = 0;
    for (; steps < 600; steps++) {
      enemy.update(1 / 60, world, player, game);
      if (enemy.dead || enemy.despawned) break;
      if (enemy.x >= 20 * T && enemy.onGround) {
        crossed = true;
        break;
      }
    }
    return { enemy, crossed, steps, seconds: steps / 60 };
  } finally {
    random.mockRestore();
  }
}

describe('pit AI', () => {
  it('lets a jump-capable enemy cross a reachable pit within ten seconds', () => {
    const result = simulate('bone_thrall');
    expect(result.crossed).toBe(true);
    expect(result.seconds).toBeLessThan(10);
  });

  it('makes a non-jumping enemy leave the edge safely or despawn within ten seconds', () => {
    const result = simulate('bog_brute');
    expect(result.crossed || result.enemy.despawned).toBe(true);
    expect(result.seconds).toBeLessThan(10);
  });
});
