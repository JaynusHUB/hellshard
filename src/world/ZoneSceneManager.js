import { GAME } from '../config/game.js';
import { ZONES } from '../data/zones.js';
import { generateZone } from '../world/WorldGen.js';
import { clamp } from '../core/RNG.js';
import { BackgroundLayers } from '../render/BackgroundLayers.js';
import { TileChunkManager } from '../render/TileChunks.js';
import { TiledBackdrop } from '../render/TiledBackdrop.js';
import { TiledLights } from '../render/TiledLights.js';
import { TiledTileChunks } from '../render/TiledTileChunks.js';
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
    // The packaged Cinder Cemetery is the cinematic menu backdrop. The camera
    // drifts across its painted graveyard, moon and parallax sky.
    const menuZoneId = 'cemetery';
    game.menuZoneId = menuZoneId;
    game.menuWorld = generateZone(game.seed, menuZoneId, {
      packagedMaps: game.packagedMaps,
    });
    game.activeZoneId = menuZoneId;
    game.activeZone = ZONES[menuZoneId];
    game.activeWorld = game.menuWorld;
    this.applyCameraProfile(game.menuWorld, false);
    this.buildScenery(menuZoneId, game.menuWorld);
    game.ui?.setZoneTheme(game.activeZone);
    game.menuCameraBase = { x: game.menuWorld.spawn.x + 280, y: 214, drift: 90, driftY: 8 };
    game.camera.setBounds(
      0,
      game.menuWorld.width * GAME.tile,
      0,
      game.menuWorld.playableTop ?? game.menuWorld.height * GAME.tile,
    );
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
    this.applyCameraProfile(world, false);
    this.buildScenery(zoneId, world);
    game.camera.setBounds(
      0,
      world.width * GAME.tile,
      0,
      world.playableTop ?? world.height * GAME.tile,
    );
    const point = spawn ?? world.spawn;
    game.player.setWorld(world);
    game.player.setPosition(point.x, point.y);
    game.run.checkpoint = { x: point.x, y: point.y };
    game.spawnAuthoredEnemies?.(world);
    this.snapCameraToPlayer();
    game.ui?.setZoneTheme(zone);
    game.audio.startAmbient(zoneId);
    game.sceneVersion = (game.sceneVersion ?? 0) + 1;
  }

  applyCameraProfile(world, menu = false) {
    const game = this.game;
    const zoom = menu ? 1 : Number(world.cameraZoom ?? 1);
    const anchor = menu ? 'follow' : (world.cameraAnchor ?? 'follow');
    game.camera.setZoom(zoom);
    game.camera.setVerticalAnchor(anchor);
    game.renderer.setZoom(zoom);
  }

  snapCameraToPlayer() {
    const game = this.game;
    if (!game.player) return;
    const zoom = game.camera.zoom || 1;
    const halfW = GAME.internalWidth / (2 * zoom);
    const halfH = GAME.internalHeight / (2 * zoom);
    const top = game.activeWorld.playableTop ?? game.activeWorld.height * GAME.tile;
    const x = clamp(
      game.player.x + game.player.facing * GAME.camera.lookAhead,
      halfW,
      Math.max(halfW, game.activeWorld.width * GAME.tile - halfW),
    );
    const desiredY = game.camera.verticalAnchor === 'bottom'
      ? halfH
      : game.player.y + GAME.camera.offsetY;
    const y = clamp(desiredY, halfH, Math.max(halfH, top - halfH));
    game.camera.snapTo(x, y);
  }

  buildScenery(zoneId, world) {
    const game = this.game;
    if (world.tiled?.imageLayers?.length) {
      game.background = new TiledBackdrop({
        scene: game.renderer.scene,
        world,
      });
    } else {
      game.background = new BackgroundLayers({
        scene: game.renderer.scene,
        assets: game.assets,
        zoneId,
      });
    }
    if (world.tiled) {
      game.tileChunks = new TiledTileChunks({
        scene: game.renderer.scene,
        world,
      });
      game.tiledLights = new TiledLights({
        scene: game.renderer.scene,
        world,
      });
      game.water = null;
    } else {
      game.tileChunks = new TileChunkManager({
        scene: game.renderer.scene,
        map: world.map,
        atlas: game.assets.getAtlas(world.atlas),
        assets: game.assets,
        zoneId,
        chunkTiles: GAME.world.chunkTiles,
        tileSize: GAME.tile,
        fringeHeight: world.fringeHeight ?? 0,
        surfaceInset: world.paintedOffset ?? 0,
      });
      game.water = new WaterLayer({
        scene: game.renderer.scene,
        assets: game.assets,
        zoneId,
        hazards: world.hazards,
      });
    }
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
    if (game.tiledLights) {
      game.tiledLights.dispose();
      game.tiledLights = null;
    }
    if (game.water) {
      game.water.dispose();
      game.water = null;
    }
  }
}
