import { GAME } from '../config/game.js';

// Packaged Tiled maps are deliberately data-driven: layer roles and collision
// GIDs live here, never in the renderer or generator.
export const PACKAGED_MAPS = {
  cemetery_demo: {
    id: 'cemetery_demo',
    zoneId: 'cemetery',
    url: 'assets/cemetery/demo/assets/maps/map.json',
    layers: {
      collision: 'Collisions Layer',
      render: ['Back Layer', 'Main Layer'],
    },
    collisionGids: {
      1: 'solid',
      2: 'oneWay',
    },
    worldHeight: GAME.world.rows,
    verticalPlacement: 'bottom',
    spawnTileX: 6,
    exitTileOffset: 3,
    exitTarget: 'routeNext',
  },
};

export const PACKAGED_MAP_KEYS = Object.keys(PACKAGED_MAPS);
