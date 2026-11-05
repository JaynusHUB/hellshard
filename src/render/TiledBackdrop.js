import * as THREE from 'three';
import { GAME } from '../config/game.js';

/**
 * Renders Tiled image layers (parallax backgrounds + foreground fog) using the
 * exact Tiled parallax formula recorded in the map package reference.
 */
export class TiledBackdrop {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;
    this.tiled = world.tiled;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.layers = [];
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
    const zoom = this.world.cameraZoom ?? 1;
    const viewWidth = GAME.internalWidth / zoom;
    let order = 0;
    for (const layer of this.tiled.imageLayers ?? []) {
      if (!layer.width || !layer.height) continue;
      const texture = this.textureFor(layer.imageUrl);
      if (!texture) continue;
      const count = layer.repeat
        ? Math.max(2, Math.ceil((viewWidth + layer.width * 2) / layer.width))
        : 1;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: layer.opacity,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const meshes = [];
      for (let i = 0; i < count; i++) {
        const geometry = new THREE.PlaneGeometry(layer.width, layer.height);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = layer.role === 'fog'
          ? GAME.rendering.layers.particles + 0.5
          : GAME.rendering.layers.background + 0.1 + order * 0.05;
        this.group.add(mesh);
        meshes.push(mesh);
      }
      this.layers.push({ layer, meshes, count, material });
      order++;
    }
    this.update(0, 0, 0);
  }

  update(cameraX, cameraY, timeSeconds = 0) {
    const tiled = this.tiled;
    const zoom = this.world.cameraZoom ?? 1;
    const halfW = GAME.internalWidth / (2 * zoom);
    const camLeft = cameraX - halfW;
    const mapTop = tiled.mapTop ?? (tiled.rowOffset + tiled.mapHeight) * GAME.tile;
    const camMapY = mapTop - cameraY;
    const originX = tiled.parallaxOriginX ?? 0;
    const originY = tiled.parallaxOriginY ?? 0;
    for (const entry of this.layers) {
      const { layer, meshes } = entry;
      const posX = layer.offsetX
        + (cameraX - originX) * (1 - layer.parallaxX)
        + layer.autoScrollX * timeSeconds;
      const posY = layer.offsetY + (camMapY - originY) * (1 - layer.parallaxY);
      const worldBottom = mapTop - posY - layer.height;
      if (layer.repeat) {
        const start = camLeft
          + (((posX - camLeft) % layer.width) + layer.width) % layer.width
          - layer.width;
        for (let i = 0; i < entry.count; i++) {
          meshes[i].position.set(
            start + i * layer.width + layer.width / 2,
            worldBottom + layer.height / 2,
            0,
          );
        }
      } else {
        meshes[0].position.set(posX + layer.width / 2, worldBottom + layer.height / 2, 0);
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const entry of this.layers) {
      for (const mesh of entry.meshes) mesh.geometry.dispose();
      entry.material.dispose();
    }
    for (const texture of this.textures.values()) texture.dispose();
    this.layers = [];
    this.textures.clear();
  }
}
