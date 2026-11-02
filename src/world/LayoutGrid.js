export class LayoutGrid {
  constructor({ width, height, tileSize }) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.cells = Array.from({ length: width * height }, () => []);
    this.entries = [];
  }

  intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  overlaps(rect, filter = null) {
    const left = Math.max(0, Math.floor(rect.x / this.tileSize));
    const right = Math.min(this.width - 1, Math.floor((rect.x + rect.w - 0.001) / this.tileSize));
    const bottom = Math.max(0, Math.floor(rect.y / this.tileSize));
    const top = Math.min(this.height - 1, Math.floor((rect.y + rect.h - 0.001) / this.tileSize));
    const seen = new Set();
    for (let ty = bottom; ty <= top; ty++) {
      for (let tx = left; tx <= right; tx++) {
        for (const entry of this.cells[ty * this.width + tx]) {
          if (seen.has(entry)) continue;
          seen.add(entry);
          if (filter && !filter(entry)) continue;
          if (this.intersects(rect, entry)) return entry;
        }
      }
    }
    return null;
  }

  mark(rect, kind, id, meta = {}) {
    const entry = { ...rect, kind, id, meta };
    this.entries.push(entry);
    const left = Math.max(0, Math.floor(rect.x / this.tileSize));
    const right = Math.min(this.width - 1, Math.floor((rect.x + rect.w - 0.001) / this.tileSize));
    const bottom = Math.max(0, Math.floor(rect.y / this.tileSize));
    const top = Math.min(this.height - 1, Math.floor((rect.y + rect.h - 0.001) / this.tileSize));
    for (let ty = bottom; ty <= top; ty++) {
      for (let tx = left; tx <= right; tx++) {
        this.cells[ty * this.width + tx].push(entry);
      }
    }
    return entry;
  }

  markTile(tx, ty, kind, id, meta = {}) {
    return this.mark({
      x: tx * this.tileSize,
      y: ty * this.tileSize,
      w: this.tileSize,
      h: this.tileSize,
    }, kind, id, meta);
  }
}
