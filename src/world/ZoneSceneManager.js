import { GAME } from '../config/game.js';
import { ZONES } from '../data/zones.js';
import { generateZone } from '../world/WorldGen.js';
import { clamp } from '../core/RNG.js';
import { BackgroundLayers } from '../render/BackgroundLayers.js';
import { TileChunkManager } from '../render/TileChunks.js';
import { WaterLayer } from '../render/WaterLayer.js';

export class ZoneSceneManager {
  constructor(game) {
    this.game = game;
  }

  buildMenuScene() {
    const game = this.game;
    this.dispose();
    game.seed = Number(game.save.settings.seed ?? game.seed);
    game.menuSeed = game.seed;
    game.menuWorld = generateZone(game.seed, 'cemetery');
    game.activeZoneId = 'cemetery';
    game.activeZone = ZONES.cemetery;
    game.activeWorld = game.menuWorld;
    this.buildScenery('cemetery', game.menuWorld);
    game.ui?.setZoneTheme(game.activeZone);
    game.menuCameraBase = { x: game.menuWorld.spawn.x + 40, y: 190 };
    game.camera.setBounds(0, game.menuWorld.width * GAME.tile, 0, game.menuWorld.height * GAME.tile);
    game.camera.snapTo(game.menuCameraBase.x, game.menuCameraBase.y);
    game.time = 0;
  }

  setZone(zoneId, spawn = null) {
    const game = this.game;
    const world = game.worlds?.[zoneId];
    const zone = ZONES[zoneId];
    if (!world || !zone) return;
    if (game.tileChunks) this.dispose();
    game.activeZoneId = zoneId;
    game.activeZone = zone;
    game.activeWorld = world;
    this.buildScenery(zoneId, world);
    game.camera.setBounds(0, world.width * GAME.tile, 0, world.height * GAME.tile);
    const point = spawn ?? world.spawn;
    game.player.setWorld(world);
    game.player.setPosition(point.x, point.y);
    game.run.checkpoint = { x: point.x, y: point.y };
    this.snapCameraToPlayer();
    game.ui?.setZoneTheme(zone);
    game.audio.startAmbient(zoneId);
    game.sceneVersion = (game.sceneVersion ?? 0) + 1;
  }

  snapCameraToPlayer() {
    const game = this.game;
    if (!game.player) return;
    const halfW = GAME.internalWidth / 2;
    const halfH = GAME.internalHeight / 2;
    const x = clamp(
      game.player.x + game.player.facing * GAME.camera.lookAhead,
      halfW,
      Math.max(halfW, game.activeWorld.width * GAME.tile - halfW),
    );
    const y = clamp(
      game.player.y + GAME.camera.offsetY,
      halfH,
      Math.max(halfH, game.activeWorld.height * GAME.tile - halfH),
    );
    game.camera.snapTo(x, y);
  }

  buildScenery(zoneId, world) {
    const game = this.game;
    game.background = new BackgroundLayers({
      scene: game.renderer.scene,
      assets: game.assets,
      zoneId,
    });
    game.tileChunks = new TileChunkManager({
      scene: game.renderer.scene,
      map: world.map,
      atlas: game.assets.getAtlas(world.atlas),
      assets: game.assets,
      zoneId,
      chunkTiles: GAME.world.chunkTiles,
      tileSize: GAME.tile,
      fringeHeight: world.fringeHeight ?? 0,
    });
    game.water = new WaterLayer({
      scene: game.renderer.scene,
      assets: game.assets,
      zoneId,
      hazards: world.hazards,
    });
    game.sceneryZoneId = zoneId;
    game.sceneryWorld = world;
  }

  dispose() {
    const game = this.game;
    if (game.background) {
      game.background.dispose();
      game.background = null;
    }
    if (game.tileChunks) {
      game.tileChunks.dispose();
      game.tileChunks = null;
    }
    if (game.water) {
      game.water.dispose();
      game.water = null;
    }
  }
}
