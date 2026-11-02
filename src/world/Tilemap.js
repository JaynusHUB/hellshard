import { GAME } from '../config/game.js';

export const TILE = {
  EMPTY: 0,
  SOLID: 1,
  ONE_WAY: 2,
  HAZARD: 3,
  BREAKABLE: 4,
  FAKE: 5,
};

const EPSILON = 0.001;

export class Tilemap {
  constructor(width, height, data = null) {
    this.width = width;
    this.height = height;
    this.tileSize = GAME.tile;
    this.data = data ?? new Uint8Array(width * height);
    this.blockers = [];
    this.version = 0;
  }

  index(x, y) {
    return y * this.width + x;
  }

  getType(x, y) {
    if (x < 0 || x >= this.width || y < 0) return TILE.SOLID;
    if (y >= this.height) return TILE.EMPTY;
    return this.data[this.index(x, y)];
  }

  setType(x, y, type) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.data[this.index(x, y)] = type;
    this.version++;
  }

  clear() {
    this.data.fill(TILE.EMPTY);
    this.version++;
  }

  isSolid(type) {
    return type === TILE.SOLID || type === TILE.BREAKABLE;
  }

  isSolidAt(tx, ty) {
    return this.isSolid(this.getType(tx, ty));
  }

  isStandableTile(tx, ty) {
    const type = this.getType(tx, ty);
    if (type !== TILE.EMPTY && type !== TILE.FAKE) return false;
    const below = this.getType(tx, ty - 1);
    if (!this.isSolid(below) && below !== TILE.ONE_WAY) return false;
    const above = this.getType(tx, ty + 1);
    const above2 = this.getType(tx, ty + 2);
    return above !== TILE.SOLID && above2 !== TILE.SOLID;
  }

  rectHitsSolid(x, y, w, h, includeOneWay = false) {
    const left = Math.floor(x / this.tileSize);
    const right = Math.floor((x + w - EPSILON) / this.tileSize);
    const bottom = Math.floor(y / this.tileSize);
    const top = Math.floor((y + h - EPSILON) / this.tileSize);
    for (let ty = bottom; ty <= top; ty++) {
      for (let tx = left; tx <= right; tx++) {
        const type = this.getType(tx, ty);
        if (this.isSolid(type)) return true;
        if (includeOneWay && type === TILE.ONE_WAY) return true;
      }
    }
    return false;
  }

  rectHitsHazard(x, y, w, h) {
    const left = Math.floor(x / this.tileSize);
    const right = Math.floor((x + w - EPSILON) / this.tileSize);
    const bottom = Math.floor(y / this.tileSize);
    const top = Math.floor((y + h - EPSILON) / this.tileSize);
    for (let ty = bottom; ty <= top; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (this.getType(tx, ty) === TILE.HAZARD) return true;
      }
    }
    return false;
  }

  pointHitsSolid(worldX, worldY) {
    return this.isSolidAt(Math.floor(worldX / this.tileSize), Math.floor(worldY / this.tileSize));
  }

  forEachTileInRect(x, y, w, h, callback) {
    const left = Math.floor(x / this.tileSize);
    const right = Math.floor((x + w - EPSILON) / this.tileSize);
    const bottom = Math.floor(y / this.tileSize);
    const top = Math.floor((y + h - EPSILON) / this.tileSize);
    for (let ty = bottom; ty <= top; ty++) {
      for (let tx = left; tx <= right; tx++) {
        callback(tx, ty, this.getType(tx, ty));
      }
    }
  }

  addBlocker(x, y, w, h, meta = {}) {
    const blocker = { x, y, w, h, enabled: true, meta };
    this.blockers.push(blocker);
    return blocker;
  }

  clearBlockers(tag = null) {
    this.blockers = this.blockers.filter((blocker) => tag !== null && blocker.meta?.tag !== tag);
  }

  moveX(actor, dx) {
    if (dx === 0) return false;
    actor.x += dx;
    const halfW = actor.width / 2;
    const left = Math.floor((actor.x - halfW) / this.tileSize);
    const right = Math.floor((actor.x + halfW - EPSILON) / this.tileSize);
    const bottom = Math.floor(actor.y / this.tileSize);
    const top = Math.floor((actor.y + actor.height - EPSILON) / this.tileSize);
    let hit = false;
    for (let ty = bottom; ty <= top; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (!this.isSolidAt(tx, ty)) continue;
        if (dx > 0) {
          actor.x = tx * this.tileSize - halfW - EPSILON;
          hit = true;
        } else {
          actor.x = (tx + 1) * this.tileSize + halfW + EPSILON;
          hit = true;
        }
      }
    }
    for (const blocker of this.blockers) {
      if (!blocker.enabled) continue;
      if (
        actor.x - halfW < blocker.x + blocker.w &&
        actor.x + halfW > blocker.x &&
        actor.y < blocker.y + blocker.h &&
        actor.y + actor.height > blocker.y
      ) {
        if (dx > 0) actor.x = blocker.x - halfW - EPSILON;
        else actor.x = blocker.x + blocker.w + halfW + EPSILON;
        hit = true;
      }
    }
    return hit;
  }

  moveY(actor, dy) {
    if (dy === 0) return { grounded: false, ceiling: false };
    const previousBottom = actor.y;
    actor.y += dy;
    const halfW = actor.width / 2;
    const left = Math.floor((actor.x - halfW) / this.tileSize);
    const right = Math.floor((actor.x + halfW - EPSILON) / this.tileSize);
    const bottom = Math.floor(actor.y / this.tileSize);
    const top = Math.floor((actor.y + actor.height - EPSILON) / this.tileSize);
    let grounded = false;
    let ceiling = false;
    for (let ty = bottom; ty <= top; ty++) {
      for (let tx = left; tx <= right; tx++) {
        const type = this.getType(tx, ty);
        const solid = this.isSolid(type);
        if (!solid && !(type === TILE.ONE_WAY && dy < 0)) continue;
        if (type === TILE.ONE_WAY) {
          const platformTop = (ty + 1) * this.tileSize;
          if (previousBottom < platformTop - 0.01) continue;
          if (actor.dropThrough && actor.dropThrough > 0) continue;
          actor.y = platformTop + EPSILON;
          actor.vy = 0;
          actor.onGround = true;
          grounded = true;
          continue;
        }
        if (dy > 0) {
          actor.y = ty * this.tileSize - actor.height - EPSILON;
          actor.vy = 0;
          ceiling = true;
        } else {
          actor.y = (ty + 1) * this.tileSize + EPSILON;
          actor.vy = 0;
          actor.onGround = true;
          grounded = true;
        }
      }
    }
    for (const blocker of this.blockers) {
      if (!blocker.enabled) continue;
      if (
        actor.x - halfW < blocker.x + blocker.w &&
        actor.x + halfW > blocker.x &&
        actor.y < blocker.y + blocker.h &&
        actor.y + actor.height > blocker.y
      ) {
        if (dy > 0) {
          actor.y = blocker.y - actor.height - EPSILON;
          actor.vy = 0;
          ceiling = true;
        } else {
          actor.y = blocker.y + blocker.h + EPSILON;
          actor.vy = 0;
          actor.onGround = true;
          grounded = true;
        }
      }
    }
    if (grounded) actor.onGround = true;
    return { grounded, ceiling };
  }

  checkGround(actor) {
    const halfW = Math.max(1, actor.width / 2 - 1);
    const left = Math.floor((actor.x - halfW) / this.tileSize);
    const right = Math.floor((actor.x + halfW - EPSILON) / this.tileSize);
    const footY = actor.y - 1;
    const ty = Math.floor(footY / this.tileSize);
    for (let tx = left; tx <= right; tx++) {
      const type = this.getType(tx, ty);
      if (this.isSolid(type) || type === TILE.ONE_WAY) return true;
    }
    for (const blocker of this.blockers) {
      if (!blocker.enabled) continue;
      if (
        actor.x + halfW > blocker.x &&
        actor.x - halfW < blocker.x + blocker.w &&
        footY <= blocker.y + blocker.h &&
        footY >= blocker.y
      ) {
        return true;
      }
    }
    return false;
  }

  getHighestStandableY(tileX, fromY = this.height - 1) {
    for (let ty = Math.min(fromY, this.height - 2); ty >= 0; ty--) {
      if (this.isStandableTile(tileX, ty + 1)) return ty + 1;
    }
    return null;
  }

  getGroundYAtWorld(worldX, fromWorldY = this.height * this.tileSize) {
    const tx = Math.max(0, Math.min(this.width - 1, Math.floor(worldX / this.tileSize)));
    const fromTy = Math.max(0, Math.min(this.height - 1, Math.floor(fromWorldY / this.tileSize)));
    for (let ty = fromTy; ty >= 0; ty--) {
      if (this.isSolidAt(tx, ty)) return (ty + 1) * this.tileSize;
    }
    return null;
  }

  breakTile(tx, ty) {
    if (this.getType(tx, ty) !== TILE.BREAKABLE) return false;
    this.setType(tx, ty, TILE.EMPTY);
    return true;
  }

  dustTile(tx, ty) {
    if (this.getType(tx, ty) === TILE.FAKE) this.setType(tx, ty, TILE.EMPTY);
  }

  findNearestGround(x, y, maxDistanceTiles = 24) {
    const centerTx = Math.floor(x / this.tileSize);
    const centerTy = Math.floor(y / this.tileSize);
    for (let radius = 0; radius <= maxDistanceTiles; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const tx = centerTx + dx;
          const ty = centerTy + dy;
          if (this.isStandableTile(tx, ty)) {
            return { x: (tx + 0.5) * this.tileSize, y: ty * this.tileSize };
          }
        }
      }
    }
    return null;
  }
}
