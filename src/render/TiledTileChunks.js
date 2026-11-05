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

function sourceForLocal(tileset, localId) {
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

function animationFor(tileset, localId) {
  const tile = tileset.tiles?.find((entry) => entry.id === localId);
  if (!tile?.animation?.length) return null;
  const total = tile.animation.reduce((sum, frame) => sum + Number(frame.duration), 0);
  return { frames: tile.animation, total: Math.max(1, total) };
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
    this.animatedGroups = [];
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

  renderOrderFor(layer, batchIndex = 0) {
    if (layer.front) {
      return GAME.rendering.layers.actors + 0.42 + batchIndex * 0.001;
    }
    return GAME.rendering.layers.tiles + layer.order * 0.01 + batchIndex * 0.001;
  }

  build() {
    const tiled = this.tiled;
    const tileSize = GAME.tile;
    for (const layer of tiled.layers) {
      if (!layer.visible) continue;
      const staticBatches = new Map();
      const animatedBatches = new Map();
      for (let y = 0; y < tiled.mapHeight; y++) {
        for (let x = 0; x < tiled.mapWidth; x++) {
          const value = layer.data[y * tiled.mapWidth + x];
          if (!value) continue;
          const decoded = decodeTileGid(value);
          const tileset = findTileset(tiled.tilesets ?? [], decoded.id);
          if (!tileset) continue;
          const localId = decoded.id - tileset.firstgid;
          const worldRow = tiled.rowOffset + tiled.mapHeight - 1 - y;
          const px = x * tileSize;
          const py = worldRow * tileSize;
          const animation = animationFor(tileset, localId);
          if (animation) {
            const key = `${tileset.name}:${localId}`;
            if (!animatedBatches.has(key)) {
              animatedBatches.set(key, {
                tileset,
                localId,
                animation,
                instances: [],
                frameIndex: -1,
              });
            }
            animatedBatches.get(key).instances.push({ px, py, decoded });
            continue;
          }
          const source = sourceForLocal(tileset, localId);
          if (!source) continue;
          if (!staticBatches.has(source.imageUrl)) staticBatches.set(source.imageUrl, []);
          staticBatches.get(source.imageUrl).push({ source, px, py, decoded });
        }
      }

      let batchIndex = 0;
      for (const [imageUrl, instances] of staticBatches) {
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
        mesh.renderOrder = this.renderOrderFor(layer, batchIndex);
        this.group.add(mesh);
        this.meshes.push(mesh);
        batchIndex++;
      }

      for (const [key, group] of animatedBatches) {
        const texture = this.textureFor(group.tileset.imageUrl);
        if (!texture) continue;
        const imgWidth = texture.image.width;
        const imgHeight = texture.image.height;
        const positions = [];
        const uvs = new Float32Array(group.instances.length * 8);
        const indices = [];
        for (const { px, py } of group.instances) {
          const base = positions.length / 3;
          positions.push(
            px, py, 0,
            px + tileSize, py, 0,
            px + tileSize, py + tileSize, 0,
            px, py + tileSize, 0,
          );
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
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
        mesh.renderOrder = this.renderOrderFor(layer, batchIndex);
        this.group.add(mesh);
        this.meshes.push(mesh);
        this.animatedGroups.push({
          ...group,
          key,
          mesh,
          uvs,
          imgWidth,
          imgHeight,
          frameIndex: -1,
        });
        batchIndex++;
      }
    }
    this.update(0);
  }

  update(timeSeconds) {
    if (!this.animatedGroups.length) return;
    const timeMs = timeSeconds * 1000;
    for (const group of this.animatedGroups) {
      let frameIndex = 0;
      let cursor = ((timeMs % group.animation.total) + group.animation.total) % group.animation.total;
      for (let i = 0; i < group.animation.frames.length; i++) {
        const duration = Number(group.animation.frames[i].duration);
        if (cursor < duration) {
          frameIndex = i;
          break;
        }
        cursor -= duration;
        frameIndex = i;
      }
      if (frameIndex === group.frameIndex) continue;
      group.frameIndex = frameIndex;
      const frame = group.animation.frames[frameIndex];
      const source = sourceForLocal(group.tileset, frame.tileid);
      if (!source) continue;
      const u0 = source.sx / group.imgWidth;
      const u1 = (source.sx + source.w) / group.imgWidth;
      const v0 = 1 - (source.sy + source.h) / group.imgHeight;
      const v1 = 1 - source.sy / group.imgHeight;
      let offset = 0;
      for (const instance of group.instances) {
        const corners = flipCorners([[0, 0], [1, 0], [1, 1], [0, 1]], instance.decoded);
        for (const [u, v] of corners) {
          group.uvs[offset++] = u0 + (u1 - u0) * u;
          group.uvs[offset++] = v0 + (v1 - v0) * v;
        }
      }
      group.mesh.geometry.attributes.uv.needsUpdate = true;
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
    this.animatedGroups = [];
    this.textures.clear();
  }
}
