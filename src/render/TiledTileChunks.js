import * as THREE from 'three';
import { GAME } from '../config/game.js';
import { decodeTileGid } from '../world/tiledLoader.js';

function findTileset(tilesets, gid) {
  let found = null;
  for (const tileset of tilesets) {
    if (tileset.firstgid <= gid) found = tileset;
    else break;
  }
  return found;
}

function imageForTile(tileset, localId) {
  if (tileset.imageCollection) {
    const tile = tileset.tiles?.find((entry) => entry.id === localId);
    if (!tile?.imageUrl) return null;
    return {
      imageUrl: tile.imageUrl,
      w: Number(tile.imagewidth ?? tileset.tilewidth ?? GAME.tile),
      h: Number(tile.imageheight ?? tileset.tileheight ?? GAME.tile),
      sx: 0,
      sy: 0,
    };
  }
  if (!tileset.imageUrl) return null;
  const columns = Math.max(1, Number(tileset.columns) || 1);
  const w = Number(tileset.tilewidth ?? GAME.tile);
  const h = Number(tileset.tileheight ?? GAME.tile);
  const margin = Number(tileset.margin ?? 0);
  const spacing = Number(tileset.spacing ?? 0);
  const col = localId % columns;
  const row = Math.floor(localId / columns);
  return {
    imageUrl: tileset.imageUrl,
    w,
    h,
    sx: margin + col * (w + spacing),
    sy: margin + row * (h + spacing),
  };
}

function flipCorners(corners, decoded) {
  let result = corners;
  if (decoded.h) result = result.map(([u, v]) => [1 - u, v]);
  if (decoded.v) result = result.map(([u, v]) => [u, 1 - v]);
  if (decoded.d) result = result.map(([u, v]) => [v, u]);
  return result;
}

export class TiledTileChunks {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;
    this.tiled = world.tiled;
    this.group = new THREE.Group();
    this.group.renderOrder = GAME.rendering.layers.tiles;
    this.scene.add(this.group);
    this.meshes = [];
    this.textures = new Map();
    this.build();
  }

  textureFor(imageUrl) {
    if (this.textures.has(imageUrl)) return this.textures.get(imageUrl);
    const image = this.tiled.images?.get(imageUrl);
    if (!image) return null;
    const texture = new THREE.Texture(image);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.textures.set(imageUrl, texture);
    return texture;
  }

  build() {
    const tiled = this.tiled;
    const tileSize = GAME.tile;
    for (const layer of tiled.layers) {
      if (!layer.visible) continue;
      const batches = new Map();
      for (let y = 0; y < tiled.mapHeight; y++) {
        for (let x = 0; x < tiled.mapWidth; x++) {
          const value = layer.data[y * tiled.mapWidth + x];
          if (!value) continue;
          const decoded = decodeTileGid(value);
          const tileset = findTileset(tiled.tilesets ?? [], decoded.id);
          if (!tileset) continue;
          const localId = decoded.id - tileset.firstgid;
          const source = imageForTile(tileset, localId);
          if (!source) continue;
          const worldRow = tiled.rowOffset + tiled.mapHeight - 1 - y;
          const px = x * tileSize;
          const py = worldRow * tileSize;
          if (!batches.has(source.imageUrl)) batches.set(source.imageUrl, []);
          batches.get(source.imageUrl).push({ source, px, py, decoded });
        }
      }
      let batchIndex = 0;
      for (const [imageUrl, instances] of batches) {
        const texture = this.textureFor(imageUrl);
        if (!texture) continue;
        const positions = [];
        const uvs = [];
        const indices = [];
        const imgWidth = texture.image.width;
        const imgHeight = texture.image.height;
        for (const { source, px, py, decoded } of instances) {
          const base = positions.length / 3;
          const u0 = source.sx / imgWidth;
          const u1 = (source.sx + source.w) / imgWidth;
          const v0 = 1 - (source.sy + source.h) / imgHeight;
          const v1 = 1 - source.sy / imgHeight;
          const corners = flipCorners([[0, 0], [1, 0], [1, 1], [0, 1]], decoded);
          positions.push(
            px, py, 0,
            px + source.w, py, 0,
            px + source.w, py + source.h, 0,
            px, py + source.h, 0,
          );
          for (const [u, v] of corners) {
            uvs.push(u0 + (u1 - u0) * u, v0 + (v1 - v0) * v);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        if (!indices.length) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: layer.opacity,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = GAME.rendering.layers.tiles + layer.order * 0.01 + batchIndex * 0.001;
        this.group.add(mesh);
        this.meshes.push(mesh);
        batchIndex++;
      }
    }
  }

  cull() {}

  dispose() {
    this.group.removeFromParent();
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const texture of this.textures.values()) texture.dispose();
    this.meshes = [];
    this.textures.clear();
  }
}
