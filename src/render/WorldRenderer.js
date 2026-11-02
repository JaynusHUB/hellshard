import { GAME } from '../config/game.js';
import { COLORS } from './ParticleSystem.js';
import { SpriteBatch } from './SpriteBatch.js';
import { EntityRenderer } from './EntityRenderer.js';
import { createGeneratedSprites, createGeneratedBatch } from './GeneratedSprites.js';

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
    this.generatedBatch.mesh.renderOrder = 1.5;
    this.scene.add(this.generatedBatch.mesh);
  }

  createBatches() {
    for (const [family, atlas] of Object.entries(this.assets.atlases)) {
      const propBatch = new SpriteBatch(atlas.texture, GAME.rendering.maxSpriteInstances);
      propBatch.mesh.renderOrder = 1;
      this.scene.add(propBatch.mesh);
      const actorBatch = new SpriteBatch(atlas.texture, GAME.rendering.maxSpriteInstances);
      actorBatch.mesh.renderOrder = family === 'gothic' ? 2.1 : 2;
      this.scene.add(actorBatch.mesh);
      this.batchEntries[family] = { prop: propBatch, actor: actorBatch };
    }
  }

  prepare(alpha, dt, includePlayer) {
    const game = this.game;
    if (!game.background || !game.tileChunks) return;
    const cameraPos = { x: game.camera.x, y: game.camera.y };
    game.background.update(cameraPos.x, cameraPos.y);
    game.water?.update(game.time);
    game.tileChunks.cull(
      cameraPos.x - GAME.internalWidth / 2,
      cameraPos.x + GAME.internalWidth / 2,
      cameraPos.y - GAME.internalHeight / 2,
      cameraPos.y + GAME.internalHeight / 2,
    );
    for (const family of Object.keys(this.batchEntries)) {
      this.batchEntries[family].prop.mesh.visible = false;
      this.batchEntries[family].actor.mesh.visible = false;
    }
    const propBatch = this.batchEntries[game.activeWorld.atlas]?.prop;
    if (propBatch) {
      propBatch.begin();
      this.drawDecorations(propBatch);
      if (game.activeZoneId === 'dungeon') this.drawDungeonPlatforms(propBatch);
      propBatch.end();
    }
    if (includePlayer && game.player) {
      this.generatedBatch.begin();
      this.drawInteractables(this.generatedBatch);
      this.drawMovingPlatforms(this.generatedBatch);
      this.drawHazards(this.generatedBatch);
      this.generatedBatch.end();
      this.entityRenderer.render(this.batchEntries, alpha);
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
      batch.draw(frame, Math.round(decoration.x), Math.round(decoration.y + (decoration.yOffset ?? 0)), {
        anchorY: frame.anchorY ?? 1,
        flip: decoration.flip,
        tint,
        alpha: isDungeon ? 1 : (decoration.alpha ?? 0.8),
      });
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
      batch.draw(frame, Math.round(transition.x), Math.round(transition.y + 1), {
        anchorY: frame.anchorY ?? 1,
        tint: locked ? [0.8, 0.42, 0.4] : tintFor([205, 180, 140]),
        alpha: 0.85,
      });
    }
    if (game.activeWorld.finalGate) {
      const gate = game.activeWorld.finalGate;
      const open = game.run.shards.length >= gate.requiresShards;
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
    for (const platform of platforms) {
      for (let i = 0; i < 3; i++) {
        batch.draw(frames[i], Math.round(platform.x - 16 + i * 16), Math.round(platform.y), {
          anchorY: 0,
          alpha: 1,
        });
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
      : game.activeZoneId === 'dungeon'
        ? [0.72, 0.75, 0.8]
        : [1, 0.96, 0.86];
    for (const platform of platforms) {
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
