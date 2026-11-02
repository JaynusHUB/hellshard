import { GAME } from '../config/game.js';
import { TILE } from '../world/Tilemap.js';
import { computeSpriteRect } from './SpriteBatch.js';

const COLORS = {
  hitbox: '#63e6ff',
  physics: '#8df59a',
  painted: '#ff5fd2',
  sprite: '#ffe27a',
  enemy: '#ffb05c',
  panel: 'rgba(5, 7, 10, 0.82)',
  text: '#d9e7df',
};

export class CollisionDebugOverlay {
  constructor(game) {
    this.game = game;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'collision-debug';
    this.canvas.width = GAME.internalWidth;
    this.canvas.height = GAME.internalHeight;
    this.canvas.setAttribute('aria-hidden', 'true');
    document.getElementById('stage')?.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.visible = false;
    this.setVisible(false);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.canvas.style.display = this.visible ? 'block' : 'none';
    if (!this.visible) this.clear();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(alpha) {
    this.clear();
    if (!this.visible) return;
    const game = this.game;
    const player = game.player;
    const world = game.activeWorld;
    const map = world?.map;
    if (!player || !world || !map || ['menu', 'characters', 'result'].includes(game.state)) return;

    const ctx = this.ctx;
    const camera = game.camera.getRenderPosition(alpha);
    const halfW = GAME.internalWidth / 2;
    const halfH = GAME.internalHeight / 2;
    const screenX = (worldX) => Math.round(worldX - camera.x + halfW);
    const screenY = (worldY) => Math.round(camera.y - worldY + halfH);
    const t = (key) => game.ui?.t?.(key) ?? key;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '6px "Pixelify Sans", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const bounds = player.getBounds();
    const collisionY = bounds.y;
    const tileY = this.findTileFloor(map, player.x, player.y + 2);
    const pos = player.getRenderPosition(alpha);
    const frame = player.animator?.frame;
    const hover = player.characterId === 'seraphine'
      ? Math.round(Math.sin(player.animTime * 3) * 1)
      : 0;
    const spriteY = pos.y + hover;
    const dashLean = player.dashTimer > 0 ? 1 : 0;
    const spriteRect = computeSpriteRect(frame, pos.x + dashLean * player.facing, spriteY, {
      anchorY: frame?.anchorY ?? 1,
      flip: player.facing < 0,
    });

    // Alpha-derived painted surface: top row above the 60% alpha fill threshold.
    if (tileY !== null) {
      this.drawLine(ctx, screenX(player.x - 56), screenY(tileY), screenX(player.x + 56), screenY(tileY), COLORS.painted);
      this.label(ctx, `${t('debug.tileFloor')} ${tileY.toFixed(0)}`, screenX(player.x) + 20, screenY(tileY) - 8, COLORS.painted);
    }

    // Physics floor: the actor AABB bottom (feet).
    this.drawLine(ctx, screenX(player.x - 42), screenY(collisionY), screenX(player.x + 42), screenY(collisionY), COLORS.physics);
    this.label(ctx, `${t('debug.collisionFloor')} ${collisionY.toFixed(0)}`, screenX(player.x) + 20, screenY(collisionY) + 3, COLORS.physics);

    // Sprite anchor and full frame bounds, including any transparent padding.
    if (spriteRect) {
      const x = screenX(spriteRect.left);
      const y = screenY(spriteRect.top);
      ctx.strokeStyle = COLORS.sprite;
      ctx.globalAlpha = 0.8;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(x, y, Math.round(spriteRect.width), Math.round(spriteRect.height));
      ctx.setLineDash([]);
      this.cross(ctx, screenX(pos.x + dashLean * player.facing), screenY(spriteY), COLORS.sprite);
      this.label(ctx, `${t('debug.spriteAnchor')} ${spriteY.toFixed(0)}`, screenX(player.x) + 20, screenY(spriteY) - 15, COLORS.sprite);
      ctx.globalAlpha = 1;
    }

    // Player collision box.
    ctx.strokeStyle = COLORS.hitbox;
    ctx.strokeRect(
      screenX(bounds.x),
      screenY(bounds.y + bounds.h),
      Math.round(bounds.w),
      Math.round(bounds.h),
    );
    this.cross(ctx, screenX(player.x), screenY(collisionY), COLORS.physics);

    // Nearby enemy collision boxes and sprite feet for comparison.
    ctx.globalAlpha = 0.65;
    for (const enemy of game.enemies ?? []) {
      if (enemy.dead || Math.abs(enemy.x - player.x) > 220) continue;
      const b = enemy.getBounds();
      ctx.strokeStyle = COLORS.enemy;
      ctx.strokeRect(screenX(b.x), screenY(b.y + b.h), Math.round(b.w), Math.round(b.h));
      this.cross(ctx, screenX(enemy.x), screenY(b.y), COLORS.enemy);
      const enemyFrame = enemy.animator?.frame;
      const enemyPos = enemy.getRenderPosition(alpha);
      const rect = computeSpriteRect(enemyFrame, enemyPos.x, enemyPos.y, {
        anchorY: enemyFrame?.anchorY ?? 1,
        flip: enemy.facing < 0,
      });
      if (rect) {
        ctx.strokeStyle = 'rgba(255, 176, 92, 0.55)';
        ctx.setLineDash([1, 2]);
        ctx.strokeRect(
          screenX(rect.left),
          screenY(rect.top),
          Math.round(rect.width),
          Math.round(rect.height),
        );
        ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;

    this.drawLegend(ctx, t, {
      hit: collisionY,
      tile: tileY,
      sprite: spriteY,
      footSink: world.footSink ?? 0,
    });
    ctx.restore();
  }

  findTileFloor(map, worldX, fromWorldY) {
    const tx = Math.max(0, Math.min(map.width - 1, Math.floor(worldX / map.tileSize)));
    const fromTy = Math.max(0, Math.min(map.height - 1, Math.floor(fromWorldY / map.tileSize)));
    for (let ty = fromTy; ty >= 0; ty--) {
      const type = map.getType(tx, ty);
      if (type === TILE.SOLID || type === TILE.ONE_WAY || type === TILE.BREAKABLE) {
        const surfaceTile = ty === map.surfaceRow || type === TILE.ONE_WAY;
        return (ty + 1) * map.tileSize - (surfaceTile ? map.surfaceOffset : 0);
      }
    }
    return null;
  }

  drawLine(ctx, x0, y0, x1, y1, color) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, y0 + 0.5);
    ctx.lineTo(x1 + 0.5, y1 + 0.5);
    ctx.stroke();
  }

  cross(ctx, x, y, color) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 0.5);
    ctx.lineTo(x + 3, y + 0.5);
    ctx.moveTo(x + 0.5, y - 3);
    ctx.lineTo(x + 0.5, y + 3);
    ctx.stroke();
  }

  label(ctx, text, x, y, color) {
    const width = Math.ceil(ctx.measureText(text).width) + 4;
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x - 2, y - 1, width, 8);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  drawLegend(ctx, t, values) {
    const x = 8;
    const y = 58;
    const width = 150;
    const height = 34;
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(160, 200, 180, 0.28)';
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    ctx.font = '6px "Pixelify Sans", monospace';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(t('debug.collisionLegend'), x + 4, y + 3);
    const rows = [
      [COLORS.physics, `${t('debug.hitbox')} ${values.hit.toFixed(0)}`],
      [COLORS.painted, `${t('debug.tileFloor')} ${values.tile === null ? t('debug.noFloor') : values.tile.toFixed(0)}`],
      [COLORS.sprite, `${t('debug.spriteAnchor')} ${values.sprite.toFixed(0)}`],
      [COLORS.text, `${t('debug.footSink')} ${values.footSink}px`],
    ];
    rows.forEach(([color, text], index) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + 4, y + 11 + index * 5, 3, 3);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(text, x + 10, y + 10 + index * 5);
    });
  }

  dispose() {
    this.canvas.remove();
  }
}
