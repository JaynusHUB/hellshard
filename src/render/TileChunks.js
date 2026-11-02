import * as THREE from 'three';

const TILE_VERTEX = /* glsl */ `
  attribute vec4 color;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vUv = uv;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TILE_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.02) discard;
    gl_FragColor = vec4(tex.rgb * vColor.rgb, tex.a * vColor.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class TileChunkManager {
  constructor({ scene, map, atlas, assets, zoneId, chunkTiles = 16, tileSize = 16, fringeHeight = 0 }) {
    this.scene = scene;
    this.map = map;
    this.atlas = atlas;
    this.assets = assets;
    this.zoneId = zoneId;
    this.chunkTiles = chunkTiles;
    this.tileSize = tileSize;
    this.fringeHeight = Math.max(0, Math.min(5, Number(fringeHeight) || 0));
    this.fringeMesh = null;
    this.chunks = new Map();
    this.groupWidth = assets.getGroupWidth(zoneId);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: atlas.texture } },
      vertexShader: TILE_VERTEX,
      fragmentShader: TILE_FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.group = new THREE.Group();
    this.group.renderOrder = 0;
    this.scene.add(this.group);
    this.buildAll();
    this.buildFringe();
  }

  buildFringe() {
    if (this.fringeMesh) {
      this.fringeMesh.removeFromParent();
      this.fringeMesh.geometry.dispose();
      this.fringeMesh = null;
    }
    if (this.fringeHeight <= 0) return;
    const positions = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    const width = this.groupWidth;
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const type = this.map.getType(x, y);
        if (type !== 1 && type !== 2 && type !== 4) continue;
        const above = this.map.getType(x, y + 1);
        if (type !== 2 && (above === 1 || above === 4)) continue;
        const frame = this.assets.getTileFrame(this.zoneId, 'top', x % width);
        if (!frame) continue;
        const wx = x * this.tileSize;
        const top = (y + 1) * this.tileSize;
        const fh = Math.min(this.fringeHeight, frame.h, this.tileSize);
        const bottom = top - fh;
        const vTop = frame.v1;
        const vBottom = frame.v1 - (frame.v1 - frame.v0) * (fh / frame.h);
        const base = positions.length / 3;
        positions.push(
          wx, bottom, 0,
          wx + this.tileSize, bottom, 0,
          wx + this.tileSize, top, 0,
          wx, top, 0,
        );
        uvs.push(
          frame.u0, vBottom,
          frame.u1, vBottom,
          frame.u1, vTop,
          frame.u0, vTop,
        );
        colors.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.renderOrder = 2.6;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.fringeMesh = mesh;
  }

  frameFor(x, y, type) {
    const above = this.map.getType(x, y + 1);
    const above2 = this.map.getType(x, y + 2);
    const solidAbove = above === 1 || above === 4;
    const solidAbove2 = above2 === 1 || above2 === 4;
    const width = this.groupWidth;
    if (type === 2) {
      return { frame: this.assets.getTileFrame(this.zoneId, 'top', x % width), color: [1, 1, 1, 1] };
    }
    if (type === 4) {
      return {
        frame: this.assets.getTileFrame(this.zoneId, solidAbove ? 'body' : 'top', x % width),
        color: [1.18, 0.68, 0.62, 1],
      };
    }
    if (type === 5) {
      return {
        frame: this.assets.getTileFrame(this.zoneId, solidAbove ? 'body' : 'top', (x + 1) % width),
        color: [0.8, 0.72, 0.9, 0.58],
      };
    }
    let kind;
    let index;
    if (!solidAbove) {
      kind = 'top';
      index = x % width;
    } else if (!solidAbove2) {
      kind = 'body';
      index = (x + 1) % width;
    } else {
      kind = 'deep';
      index = x % width;
    }
    const frame = this.assets.getTileFrame(this.zoneId, kind, index);
    let color = [1, 1, 1, 1];
    if (this.zoneId === 'dungeon') {
      if (kind === 'body') color = [0.92, 0.9, 0.9, 1];
      else if (kind === 'deep') color = [0.68, 0.66, 0.7, 1];
    }
    return { frame, color };
  }

  buildChunk(cx, cy) {
    const positions = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    const startX = cx * this.chunkTiles;
    const startY = cy * this.chunkTiles;
    const tileSize = this.tileSize;
    for (let y = startY; y < startY + this.chunkTiles; y++) {
      for (let x = startX; x < startX + this.chunkTiles; x++) {
        const type = this.map.getType(x, y);
        if (type !== 1 && type !== 2 && type !== 4 && type !== 5) continue;
        const visual = this.frameFor(x, y, type);
        const frame = visual.frame;
        if (!frame) continue;
        const wx = x * tileSize;
        const wy = y * tileSize;
        const base = positions.length / 3;
        const [r, g, b, a] = visual.color;
        positions.push(
          wx, wy, 0,
          wx + tileSize, wy, 0,
          wx + tileSize, wy + tileSize, 0,
          wx, wy + tileSize, 0,
        );
        uvs.push(frame.u0, frame.v0, frame.u1, frame.v0, frame.u1, frame.v1, frame.u0, frame.v1);
        colors.push(r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    if (positions.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.frustumCulled = false;
    return mesh;
  }

  buildAll() {
    for (const mesh of this.chunks.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunks.clear();
    const cw = Math.ceil(this.map.width / this.chunkTiles);
    const ch = Math.ceil(this.map.height / this.chunkTiles);
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        const mesh = this.buildChunk(cx, cy);
        if (mesh) {
          this.chunks.set(`${cx},${cy}`, mesh);
          this.group.add(mesh);
        }
      }
    }
  }

  rebuildAtTile(tx, ty) {
    const cx = Math.floor(tx / this.chunkTiles);
    const cy = Math.floor(ty / this.chunkTiles);
    const key = `${cx},${cy}`;
    const old = this.chunks.get(key);
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
    }
    const mesh = this.buildChunk(cx, cy);
    if (mesh) {
      this.chunks.set(key, mesh);
      this.group.add(mesh);
    } else {
      this.chunks.delete(key);
    }
    this.buildFringe();
  }

  cull(cameraLeft, cameraRight, cameraBottom, cameraTop) {
    for (const [key, mesh] of this.chunks) {
      if (!mesh) continue;
      const [cx, cy] = key.split(',').map(Number);
      const left = cx * this.chunkTiles * this.tileSize;
      const bottom = cy * this.chunkTiles * this.tileSize;
      const right = left + this.chunkTiles * this.tileSize;
      const top = bottom + this.chunkTiles * this.tileSize;
      mesh.visible = right > cameraLeft && left < cameraRight && top > cameraBottom && bottom < cameraTop;
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const mesh of this.chunks.values()) mesh?.geometry.dispose();
    this.chunks.clear();
    if (this.fringeMesh) {
      this.fringeMesh.removeFromParent();
      this.fringeMesh.geometry.dispose();
      this.fringeMesh = null;
    }
    this.material.dispose();
  }
}

export function createTileMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: texture } },
    vertexShader: TILE_VERTEX,
    fragmentShader: TILE_FRAGMENT,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
