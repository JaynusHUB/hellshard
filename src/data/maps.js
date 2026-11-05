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
    // The packaged cemetery has no object layer, so its boss arena is declared
    // here on a wide, flat stretch near the end of the artist map.
    arena: {
      left: 150 * GAME.tile,
      right: 182 * GAME.tile,
      triggerX: 154 * GAME.tile,
      floor: 'surface',
    },
  },
  dungeon_gate: {
    id: 'dungeon_gate',
    zoneId: 'dungeon_gate',
    url: 'assets/pool/maps/dungeon_gate.json',
    layers: {
      collision: 'Collisions Layer',
      render: ['Back Layer', 'Back Decor', 'Main Layer'],
      front: ['Front Layer'],
    },
    collisionGids: {
      1: 'solid',
      2: 'oneWay',
      3: 'hazard',
    },
    worldHeight: GAME.world.rows,
    verticalPlacement: 'bottom',
    camera: { zoom: 2, anchor: 'bottom' },
    parallaxOrigin: [160, 90],
    spawnFromObjects: true,
    objectLayers: ['Objects', 'Triggers', 'Lights'],
    exitTarget: null,
    returnTarget: 'church',
    ambientColor: '#1a1420',
    ambientStrength: 0.25,
  },
};
