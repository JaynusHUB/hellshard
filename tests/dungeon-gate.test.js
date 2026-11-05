import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTiledWorld, normalizeEmbeddedTilesets } from '../src/world/tiledLoader.js';
import { PACKAGED_MAPS } from '../src/data/maps.js';

const mapUrl = new URL('../public/assets/pool/maps/dungeon_gate.json', import.meta.url);
const map = JSON.parse(fs.readFileSync(mapUrl, 'utf8'));
const tilesets = normalizeEmbeddedTilesets(map, mapUrl.href);

function buildGateWorld() {
  return buildTiledWorld({
    map,
    mapUrl: mapUrl.href,
    tilesets,
    images: new Map(),
    config: PACKAGED_MAPS.dungeon_gate,
    route: ['cemetery', 'church', 'dungeon_gate'],
    seed: 1,
  });
}

describe('Dungeon Gate packaged map', () => {
  it('builds the authored 160x12 map at the bottom of the world', () => {
    const world = buildGateWorld();
    expect(world.width).toBe(160);
    expect(world.height).toBe(28);
    expect(world.playableTop).toBe(192);
    expect(world.cameraZoom).toBe(2);
    expect(world.cameraAnchor).toBe('bottom');
    expect(world.spawn.x).toBeGreaterThan(48);
    expect(world.spawn.y).toBe(32);
  });

  it('reads authored objects into gameplay data', () => {
    const world = buildGateWorld();
    expect(world.tiled.imageLayers).toHaveLength(6);
    expect(world.tiled.enemies).toHaveLength(16);
    expect(world.pickups).toHaveLength(39);
    expect(world.checkpoints.length).toBeGreaterThanOrEqual(4);
    expect(world.movingPlatforms).toHaveLength(1);
    expect(world.tiled.lights).toHaveLength(20);
    expect(world.hazards.length).toBeGreaterThan(0);
  });

  it('exposes the Gate Warden arena and the keyed final gate', () => {
    const world = buildGateWorld();
    expect(world.arena).toMatchObject({ left: 1728, right: 2000, floorY: 80 });
    expect(world.finalGate).toMatchObject({
      requiresShards: 3,
      requiresItem: 'dungeon_key',
    });
    expect(world.finalGate.x).toBeGreaterThan(2300);
  });

  it('provides only a return door instead of a generic right-edge portal', () => {
    const world = buildGateWorld();
    expect(world.transitions).toHaveLength(1);
    expect(world.transitions[0]).toMatchObject({ target: 'church', type: 'door' });
  });
});
