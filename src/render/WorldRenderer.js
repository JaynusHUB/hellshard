import { GAME } from '../config/game.js';
import { COLORS } from './ParticleSystem.js';
import { SpriteBatch } from './SpriteBatch.js';
import { EntityRenderer } from './EntityRenderer.js';
import { createGeneratedSprites, createGeneratedBatch } from './GeneratedSprites.js';

function sliceFrame(frame, x, y, w, h) {
  if (!frame) return null;
  const uScale = (frame.u1 - frame.u0) / frame.w;
  const vScale = (frame.v1 - frame.v0) / frame.h;
  return {
    ...frame,
    u0: frame.u0 + x * uScale,
    u1: frame.u0 + (x + w) * uScale,
    v1: frame.v1 - y * vScale,
    v0: frame.v1 - (y + h) * vScale,
    w,
    h,
  };
}

export class WorldRenderer {
  constructor(game) {
    this.game = game;
    this.scene = game.renderer.scene;
    this.assets = game.assets;
    this.batchEntries = {};
    this.entityRenderer = new EntityRenderer(game);
    this.createBatches();
    this.generated = createGeneratedSprites();
    this.generatedBatch = createGeneratedBatch(this.generated.texture);
    this.generatedBatch.mesh.renderOrder = GAME.rendering.layers.generated;
    this.scene.add(this.generatedBatch.mesh);
  }

  createBatches() {
    for (const [family, atlas] of Object.entries(this.assets.atlases)) {
      const propBatch = new SpriteBatch(atlas.texture, GAME.rendering.maxSpriteInstances);
      propBatch.mesh.renderOrder = GAME.rendering.layers.props;
      this.scene.add(propBatch.mesh);
      const actorBatch = new SpriteBatch(atlas.texture, GAME.rendering.maxSpriteInstances);
      actorBatch.mesh.renderOrder = GAME.rendering.layers.actors + (family === 'gothic' ? 0.1 : 0);
      this.scene.add(actorBatch.mesh);
      this.batchEntries[family] = { prop: propBatch, actor: actorBatch };
    }
  }

  prepare(alpha, dt, includePlayer) {
    const game = this.game;
    if (!game.background || !game.tileChunks) return;
    const cameraPos = { x: game.camera.x, y: game.camera.y };
    game.background.update(cameraPos.x, cameraPos.y, game.time);
    game.tiledLights?.update(game.time);
    game.water?.update(game.time);
    game.tileChunks.update?.(game.time);
    const halfW = GAME.internalWidth / (2 * (game.camera.zoom || 1));
    const halfH = GAME.internalHeight / (2 * (game.camera.zoom || 1));
    game.tileChunks.cull(
      cameraPos.x - halfW,
      cameraPos.x + halfW,
      cameraPos.y - halfH,
      cameraPos.y + halfH,
    );
    for (const family of Object.keys(this.batchEntries)) {
      this.batchEntries[family].prop.mesh.visible = false;
      this.batchEntries[family].actor.mesh.visible = false;
    }
    const propBatch = this.batchEntries[game.activeWorld.atlas]?.prop;
    if (propBatch) {
      propBatch.begin();
      this.drawSurfaceDecals(propBatch);
      this.drawBackdrops(propBatch);
      this.drawInteractionBases(propBatch);
      this.drawDecorations(propBatch);
      this.drawPlatformBodies(propBatch);
      this.drawGateFrames(propBatch);
      if (game.activeZoneId === 'dungeon') this.drawDungeonPlatforms(propBatch);
      propBatch.end();
    }
    if (includePlayer && game.player) {
      this.generatedBatch.begin();
      this.drawInteractables(this.generatedBatch);
      this.drawTiledObjects(this.generatedBatch);
      this.drawMovingPlatforms(this.generatedBatch);
      this.drawHazards(this.generatedBatch);
      this.generatedBatch.end();
      this.entityRenderer.render(this.batchEntries, alpha);
    }
  }

  drawSurfaceDecals(batch) {
    const game = this.game;
    if (game.activeZoneId !== 'dungeon' || !game.activeWorld.surfaceDecals?.length) return;
    const wall = this.assets.getPropFrame('dungeon', 'wallLarge');
    for (const decal of game.activeWorld.surfaceDecals) {
      const tile = this.assets.getTileFrame('dungeon', 'top', decal.variant);
      let frame = null;
      let tint = [1, 1, 1];
      if (decal.kind === 'moss') {
        frame = sliceFrame(tile, 0, 10, 16, 6);
        tint = [0.32, 0.46, 0.3];
      } else if (decal.kind === 'puddle') {
        frame = sliceFrame(tile, 0, 12, 16, 4);
        tint = [0.28, 0.4, 0.52];
      } else if (decal.kind === 'crack') {
        frame = sliceFrame(wall, 12, 28, 16, 2);
        tint = [0.05, 0.04, 0.04];
      } else if (decal.kind === 'rubble') {
        frame = sliceFrame(tile, 4, 12, 8, 4);
        tint = [0.5, 0.48, 0.45];
      } else {
        frame = sliceFrame(tile, 0, 10, 16, 5);
        tint = [0.34, 0.33, 0.32];
      }
      if (!frame) continue;
      batch.draw(frame, Math.round(decal.x), Math.round(decal.y), {
        anchorY: 0,
        flip: decal.flip,
        tint,
        alpha: decal.alpha,
      });
    }
  }

  drawBackdrops(batch) {
    const game = this.game;
    if (!game.activeWorld.backdrops?.length) return;
    for (const backdrop of game.activeWorld.backdrops) {
      const frame = this.assets.getPropFrame(game.activeZoneId, backdrop.prop);
      if (!frame) continue;
      batch.draw(frame, Math.round(backdrop.x), Math.round(backdrop.y), {
        anchorY: frame.anchorY ?? 1,
        tint: backdrop.tint ?? [0.35, 0.36, 0.44],
        alpha: backdrop.alpha ?? 0.7,
        flip: backdrop.flip,
      });
    }
  }

  drawInteractionBases(batch) {
    const game = this.game;
    const zoneId = game.activeZoneId;
    const baseFrame = sliceFrame(
      this.assets.getTileFrame(zoneId, 'body', 0),
      0, 0, 16, 4,
    );
    if (!baseFrame) return;
    const tint = zoneId === 'dungeon' ? [0.2, 0.2, 0.24] : [0.3, 0.27, 0.22];
    for (const interaction of game.activeWorld.interactions) {
      if (interaction.type !== 'chest' && interaction.type !== 'altar') continue;
      batch.draw(baseFrame, Math.round(interaction.x), Math.round(interaction.y + 1), {
        anchorY: 0,
        tint,
        alpha: 0.62,
      });
    }
  }

  drawDecorations(batch) {
    const game = this.game;
    const zoneTint = this.assets.getPresentation().zoneTints[game.activeZoneId] ?? [1, 1, 1];
    const isDungeon = game.activeZoneId === 'dungeon';
    const tint = isDungeon ? [1.36, 1.38, 1.52] : zoneTint.map((v) => v * 0.84);
    for (const decoration of game.activeWorld.decorations) {
      let frame = this.assets.getPropFrame(game.activeZoneId, decoration.prop);
      if (decoration.prop.startsWith('torch')) {
        const torchIndex = Math.floor(game.time * 6 + decoration.x * 0.01) % 4;
        frame = this.assets.getFrame('dungeon', `prop:dungeon:torch${torchIndex}`) ?? frame;
      }
      if (!frame) continue;
      const drawTint = decoration.tint
        ? [0, 1, 2].map((i) => decoration.tint[i] * zoneTint[i])
        : tint;
      batch.draw(frame, Math.round(decoration.x), Math.round(decoration.y + (decoration.yOffset ?? 0)), {
        anchorY: frame.anchorY ?? 1,
        flip: decoration.flip,
        tint: drawTint,
        alpha: isDungeon ? (decoration.alpha ?? 1) : (decoration.alpha ?? 0.8),
      });
      if (isDungeon && decoration.glow && Math.random() < 0.035) {
        const flicker = 0.7 + Math.sin(game.time * 18 + decoration.x) * 0.3;
        game.glowParticles.emit({
          x: decoration.x + (Math.random() - 0.5) * 5,
          y: decoration.y + (decoration.yOffset ?? 0) + 42,
          vx: 0,
          vy: 5,
          gravity: -2,
          drag: 1,
          life: 0.55,
          sizeX: 3,
          sizeY: 3,
          color: COLORS.ember,
          alpha: 0.16 * flicker,
        });
      }
    }
  }

  drawPlatformBodies(batch) {
    const game = this.game;
    const zoneId = game.activeZoneId;
    const runs = game.activeWorld.platformRuns;
    if (!runs?.length) return;
    const width = this.assets.getGroupWidth(zoneId);
    const bodyFrames = Array.from({ length: width }, (_, index) => (
      this.assets.getTileFrame(zoneId, 'body', index)
    )).filter(Boolean);
    const bodyLeft = this.assets.getTileFrame(zoneId, 'bodyLeft') ?? bodyFrames[0];
    const bodyRight = this.assets.getTileFrame(zoneId, 'bodyRight') ?? bodyFrames.at(-1);
    if (!bodyFrames.length) return;
    const tints = {
      cemetery: [0.62, 0.58, 0.46],
      church: [0.62, 0.6, 0.72],
      swamp: [0.38, 0.5, 0.35],
      dungeon: [0.52, 0.51, 0.58],
      forest: [0.45, 0.52, 0.44],
    };
    const bodyTint = tints[zoneId] ?? [1, 1, 1];
    const supportTint = bodyTint.map((v) => v * 0.66);
    const logFrame = zoneId === 'forest' ? this.assets.getPropFrame('forest', 'log') : null;
    const rootFrame = zoneId === 'swamp' ? this.assets.getPropFrame('swamp', 'root') : null;
    for (const run of runs) {
      const below = run.row * GAME.tile;
      for (let row = 0; row < 2; row++) {
        for (let x = run.x; x < run.x + run.w; x += GAME.tile) {
          const atLeft = x === run.x;
          const atRight = x + GAME.tile >= run.x + run.w;
          const frame = atLeft ? bodyLeft : atRight ? bodyRight : bodyFrames[Math.floor(x / GAME.tile) % bodyFrames.length];
          batch.draw(frame, x + GAME.tile / 2, below - row * GAME.tile, {
            anchorY: 0,
            tint: row === 0 ? bodyTint : supportTint,
          });
        }
      }
      const ends = [
        { x: run.x + GAME.tile / 2, frame: bodyLeft },
        { x: run.x + run.w - GAME.tile / 2, frame: bodyRight },
      ];
      const supportDepth = zoneId === 'dungeon' ? 2 : 1;
      for (const end of ends) {
        for (let depth = 0; depth < supportDepth; depth++) {
          batch.draw(end.frame, end.x, below - (2 + depth) * GAME.tile, {
            anchorY: 0,
            tint: supportTint,
          });
        }
      }
      if (logFrame && run.w >= GAME.tile * 3) {
        batch.draw(logFrame, run.x + run.w / 2, below - 30, {
          anchorY: 0,
          tint: [0.34, 0.42, 0.32],
          alpha: 0.9,
        });
      } else if (rootFrame && run.w >= GAME.tile * 3) {
        batch.draw(rootFrame, run.x + run.w / 2, below - 26, {
          anchorY: 0,
          tint: [0.32, 0.43, 0.3],
          alpha: 0.9,
        });
      }
    }
  }

  drawGateFrames(batch) {
    const game = this.game;
    if (game.activeWorld.tiled) return;
    const zoneId = game.activeZoneId;
    const width = this.assets.getGroupWidth(zoneId);
    const frames = Array.from({ length: width }, (_, index) => (
      this.assets.getTileFrame(zoneId, 'body', index)
    )).filter(Boolean);
    if (!frames.length) return;
    const stoneTint = zoneId === 'dungeon'
      ? [0.48, 0.49, 0.58]
      : zoneId === 'church'
        ? [0.55, 0.5, 0.7]
        : [0.38, 0.35, 0.32];
    const drawFrame = (x, y, index = 0) => {
      const frame = frames[index % frames.length];
      batch.draw(frame, Math.round(x), Math.round(y), {
        anchorY: 1,
        tint: stoneTint,
      });
    };
    for (const transition of game.activeWorld.transitions) {
      const baseY = transition.y + 1;
      const x = transition.x;
      for (const dx of [-24, 24]) {
        drawFrame(x + dx, baseY + 16, 0);
        drawFrame(x + dx, baseY + 32, 1);
        drawFrame(x + dx, baseY + 48, 2);
      }
      drawFrame(x - 16, baseY + 48, 3);
      drawFrame(x + 16, baseY + 48, 3);
      drawFrame(x, baseY + 48, 2);
      drawFrame(x, baseY + 64, 0);
    }
    if (game.activeWorld.finalGate) {
      const gate = game.activeWorld.finalGate;
      const baseY = gate.y + 1;
      for (const dx of [-28, 28]) {
        drawFrame(gate.x + dx, baseY + 16, 0);
        drawFrame(gate.x + dx, baseY + 32, 1);
        drawFrame(gate.x + dx, baseY + 48, 2);
      }
      drawFrame(gate.x - 16, baseY + 48, 3);
      drawFrame(gate.x + 16, baseY + 48, 3);
      drawFrame(gate.x, baseY + 48, 2);
      drawFrame(gate.x, baseY + 64, 0);
    }
  }

  drawInteractables(batch) {
    const game = this.game;
    const frames = this.generated.frames;
    const t = game.time;
    const zoneTint = this.assets.getPresentation().zoneTints[game.activeZoneId] ?? [1, 1, 1];
    const tintFor = (color) => [
      (color[0] / 255) * zoneTint[0],
      (color[1] / 255) * zoneTint[1],
      (color[2] / 255) * zoneTint[2],
    ];
    for (const interaction of game.activeWorld.interactions) {
      if (interaction.secret && !interaction.opened && game.player && game.player.x < interaction.x - 32) {
        continue;
      }
      let frame = frames.chest;
      if (interaction.type === 'altar') frame = frames.altar;
      else if (interaction.type === 'sign') frame = frames.sign;
      else if (interaction.opened) frame = frames.chestOpen;
      else if (interaction.type === 'chestBoss') frame = frames.bossChest;
      if (!frame) continue;
      const pulse = 0.75 + Math.sin(t * 3 + interaction.x * 0.03) * 0.15;
      batch.draw(frame, Math.round(interaction.x), Math.round(interaction.y + 1), {
        anchorY: frame.anchorY ?? 1,
        tint: tintFor(interaction.type === 'altar' ? [220, 175, 130] : [220, 200, 165]),
        alpha: pulse,
      });
    }
    for (const transition of game.activeWorld.transitions) {
      const frame = transition.type === 'portal' ? frames.portal : frames.gate;
      if (!frame) continue;
      const locked = transition.requiresBoss && !game.zoneStates[game.activeZoneId]?.bossDefeated;
      const opening = game.transition?.gateId === transition.id
        ? Math.max(0, Math.min(1, 1 - game.transition.timer / (game.transition.duration || 0.7)))
        : 0;
      const openTint = opening > 0
        ? [1.2 + opening * 0.3, 1 + opening * 0.2, 0.68]
        : tintFor([205, 180, 140]);
      batch.draw(frame, Math.round(transition.x), Math.round(transition.y + 1 + opening * 7), {
        anchorY: frame.anchorY ?? 1,
        tint: locked ? [0.8, 0.42, 0.4] : openTint,
        alpha: 0.85 - opening * 0.45,
      });
      if (opening > 0 && Math.random() < 0.35) {
        game.glowParticles.emit({
          x: transition.x + (Math.random() - 0.5) * 24,
          y: transition.y + 8 + Math.random() * 40,
          vx: 0,
          vy: 12,
          life: 0.55,
          sizeX: 2,
          sizeY: 2,
          color: COLORS.gold,
          alpha: 0.4 * opening,
        });
      }
    }
    if (game.activeWorld.finalGate) {
      const gate = game.activeWorld.finalGate;
      const hasItem = !gate.requiresItem || Boolean(game.run?.flags?.[gate.requiresItem]);
      const open = game.run.shards.length >= gate.requiresShards && hasItem;
      batch.draw(frames.portal, Math.round(gate.x), Math.round(gate.y + 1), {
        anchorY: frames.portal.anchorY ?? 1,
        tint: open ? [1.2, 1, 0.68] : [0.55, 0.5, 0.6],
        alpha: open ? 0.9 : 0.55,
      });
      if (open && Math.random() < 0.12) {
        game.glowParticles.emit({
          x: gate.x + (Math.random() - 0.5) * 20,
          y: gate.y + 20 + Math.random() * 18,
          vx: 0,
          vy: 16,
          life: 0.5,
          sizeX: 1,
          sizeY: 2,
          color: COLORS.gold,
          alpha: 0.5,
        });
      }
    }
    if (game.boss && !game.boss.dead) {
      for (const gate of game.arenaGatePositions) {
        batch.draw(frames.portal, Math.round(gate.x - 12), Math.round(gate.y + 4), {
          anchorY: frames.portal.anchorY ?? 1,
          tint: [1.2, 0.5, 0.45],
          alpha: 0.35,
        });
        if (Math.random() < 0.22) {
          game.glowParticles.emit({
            x: gate.x + (Math.random() - 0.5) * 10,
            y: gate.y + 30 + Math.random() * 200,
            vx: 0,
            vy: 25,
            life: 0.4,
            sizeX: 1,
            sizeY: 5,
            color: COLORS.blood,
            alpha: 0.25,
          });
        }
      }
    }
  }

  drawTiledObjects(batch) {
    const game = this.game;
    const world = game.activeWorld;
    if (!world?.tiled) return;
    const frames = this.generated.frames;
    const t = game.time;
    for (const checkpoint of world.checkpoints ?? []) {
      if (checkpoint.id === 'spawn' || !frames.brazier) continue;
      const pulse = 0.7 + Math.sin(t * 2.4 + checkpoint.x * 0.02) * 0.18;
      batch.draw(frames.brazier, Math.round(checkpoint.x), Math.round(checkpoint.y + 1), {
        anchorY: frames.brazier.anchorY ?? 1,
        tint: checkpoint.activated ? [0.52, 1.08, 0.92] : [0.92, 0.7, 0.42],
        alpha: pulse,
      });
    }
    for (const pickup of world.pickups ?? []) {
      if (pickup.collected) continue;
      let frame = frames.coin;
      let tint = [1, 1, 1];
      if (pickup.type === 'health_potion') {
        frame = frames.potion;
        tint = [1.15, 0.9, 0.88];
      } else if (pickup.type === 'dungeon_key') {
        frame = frames.key;
        tint = [1.14, 1.02, 0.7];
      }
      if (!frame) continue;
      const bob = Math.round(Math.sin(t * 2.8 + pickup.x * 0.05) * 2);
      batch.draw(frame, Math.round(pickup.x), Math.round(pickup.y + bob), {
        anchorY: frame.anchorY ?? 1,
        tint,
        alpha: 0.92,
      });
    }
  }

  drawDungeonPlatforms(batch) {
    const game = this.game;
    const platforms = game.activeWorld?.movingPlatforms;
    if (!platforms?.length) return;
    const frames = [
      this.assets.getTileFrame('dungeon', 'top', 0),
      this.assets.getTileFrame('dungeon', 'top', 1),
      this.assets.getTileFrame('dungeon', 'top', 2),
    ].filter(Boolean);
    if (frames.length < 3) return;
    const bodyFrames = [0, 1, 2].map((index) => (
      this.assets.getTileFrame('dungeon', 'body', index)
    )).filter(Boolean);
    const bodyLeft = this.assets.getTileFrame('dungeon', 'bodyLeft') ?? bodyFrames[0];
    const bodyRight = this.assets.getTileFrame('dungeon', 'bodyRight') ?? bodyFrames.at(-1);
    for (const platform of platforms) {
      for (let i = 0; i < 3; i++) {
        batch.draw(frames[i], Math.round(platform.x - 16 + i * 16), Math.round(platform.y), {
          anchorY: 0,
          alpha: 1,
        });
      }
      for (let i = 0; i < 3; i++) {
        const frame = i === 0 ? bodyLeft : i === 2 ? bodyRight : bodyFrames[1];
        if (!frame) continue;
        batch.draw(frame, Math.round(platform.x - 16 + i * 16), Math.round(platform.y - 16), {
          anchorY: 0,
          tint: [0.5, 0.49, 0.56],
        });
      }
      for (const end of [{ x: platform.x - 16, frame: bodyLeft }, { x: platform.x + 16, frame: bodyRight }]) {
        if (end.frame) {
          batch.draw(end.frame, Math.round(end.x), Math.round(platform.y - 32), {
            anchorY: 0,
            tint: [0.38, 0.37, 0.43],
          });
        }
      }
    }
  }

  drawMovingPlatforms(batch) {
    const game = this.game;
    const platforms = game.activeWorld?.movingPlatforms;
    if (!platforms?.length) return;
    if (game.activeZoneId === 'dungeon') return;
    const frame = this.generated.frames.plank;
    if (!frame) return;
    const tint = game.activeZoneId === 'forest'
      ? [0.72, 0.96, 0.78]
      : game.activeZoneId === 'dungeon' || game.activeZoneId === 'dungeon_gate'
        ? [0.72, 0.75, 0.8]
        : [1, 0.96, 0.86];
    for (const platform of platforms) {
      batch.draw(frame, Math.round(platform.x), Math.round(platform.y - 6), {
        anchorY: 0,
        tint: tint.map((value) => value * 0.52),
        alpha: 0.82,
      });
      batch.draw(frame, Math.round(platform.x), Math.round(platform.y), {
        anchorY: 0,
        tint,
        alpha: 0.96,
      });
      if (Math.random() < 0.08) {
        game.glowParticles.emit({
          x: platform.x + (Math.random() - 0.5) * 36,
          y: platform.y - 1,
          vx: 0,
          vy: 7,
          life: 0.32,
          sizeX: 1,
          sizeY: 1,
          color: COLORS.gold,
          alpha: 0.2,
        });
      }
    }
  }

  drawHazards(batch) {
    const game = this.game;
    if (!game.activeWorld?.hazards) return;
    // Tiled hazard tiles already render their own animated lava/spike art.
    if (game.activeWorld.tiled) return;
    for (const hazard of game.activeWorld.hazards) {
      if (hazard.kind === 'water') continue;
      const frame = this.generated.frames.spikes;
      if (!frame) continue;
      for (let x = hazard.x; x < hazard.x + hazard.w; x += 16) {
        const width = Math.min(16, hazard.x + hazard.w - x);
        batch.draw(frame, Math.round(x + width / 2), Math.round(hazard.y), {
          anchorY: frame.anchorY ?? 1,
          tint: game.activeZoneId === 'forest' ? [0.6, 0.85, 0.55] : [0.85, 0.8, 0.72],
          alpha: 0.9,
        });
      }
      if (Math.random() < 0.04) {
        game.glowParticles.emit({
          x: hazard.x + Math.random() * hazard.w,
          y: hazard.y + 4,
          vx: 0,
          vy: 10,
          life: 0.35,
          sizeX: 1,
          sizeY: 1,
          color: COLORS.blood,
          alpha: 0.4,
        });
      }
    }
  }

  dispose() {
    for (const entry of Object.values(this.batchEntries)) {
      entry.prop.dispose();
      entry.actor.dispose();
    }
    this.batchEntries = {};
    this.generatedBatch.dispose();
    this.generated.texture.dispose();
  }
}
