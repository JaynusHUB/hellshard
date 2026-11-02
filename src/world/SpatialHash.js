export class EnemySpatialHash {
  constructor(width, height, cellSize, maxEntities = 512) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.heads = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(maxEntities).fill(-1);
    this.visited = new Uint32Array(maxEntities);
    this.stamp = 1;
    this.maxEntities = maxEntities;
  }

  clear() {
    this.heads.fill(-1);
  }

  cellIndex(tx, ty) {
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return -1;
    return ty * this.cols + tx;
  }

  insert(index, entity) {
    if (index >= this.maxEntities) return;
    const minX = Math.floor((entity.x - entity.width / 2) / this.cellSize);
    const maxX = Math.floor((entity.x + entity.width / 2) / this.cellSize);
    const minY = Math.floor(entity.y / this.cellSize);
    const maxY = Math.floor((entity.y + entity.height) / this.cellSize);
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const cell = this.cellIndex(tx, ty);
        if (cell < 0) continue;
        this.next[index] = this.heads[cell];
        this.heads[cell] = index;
      }
    }
  }

  query(x, y, w, h, visit) {
    const minX = Math.floor(x / this.cellSize);
    const maxX = Math.floor((x + w) / this.cellSize);
    const minY = Math.floor(y / this.cellSize);
    const maxY = Math.floor((y + h) / this.cellSize);
    const stamp = ++this.stamp;
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const cell = this.cellIndex(tx, ty);
        if (cell < 0) continue;
        let index = this.heads[cell];
        while (index !== -1) {
          if (this.visited[index] !== stamp) {
            this.visited[index] = stamp;
            visit(index);
          }
          index = this.next[index];
        }
      }
    }
  }
}
