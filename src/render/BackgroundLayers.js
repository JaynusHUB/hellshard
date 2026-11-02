import * as THREE from 'three';
import { GAME } from '../config/game.js';

export class BackgroundLayers {
  constructor({ scene, assets, zoneId }) {
    this.scene = scene;
    this.assets = assets;
    this.zoneId = zoneId;
    this.layers = [];
    this.group = new THREE.Group();
    this.group.renderOrder = -100;
    scene.add(this.group);
    this.initLayers();
  }

  initLayers() {
    const defs = this.assets.backgroundManifest[this.zoneId] ?? [];
    let order = 0;
    for (const def of defs) {
      const source = this.assets.backgrounds.get(def.image);
      if (!source) continue;
      let image = source.img;
      let texture = source.texture;
      let width = image.width;
      let height = image.height;
      if (def.crop) {
        const [cx, cy, cw, ch] = def.crop;
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, cx, cy, cw, ch, 0, 0, cw, ch);
        texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        width = cw;
        height = ch;
      }
      const tileWidth = width;
      const single = Boolean(def.single);
      const count = single ? 1 : Math.ceil(GAME.internalWidth / tileWidth) + 2;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: def.opacity ?? 1,
        depthTest: false,
        depthWrite: false,
        color: new THREE.Color(def.tint?.[0] ?? 1, def.tint?.[1] ?? 1, def.tint?.[2] ?? 1),
      });
      const geometry = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.frustumCulled = false;
      mesh.renderOrder = -100 + order;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const matrix = new THREE.Matrix4();
      const dummy = { x: 0, y: 0, sx: tileWidth, sy: height };
      for (let i = 0; i < count; i++) {
        matrix.compose(
          new THREE.Vector3(0, 0, 0),
          new THREE.Quaternion(),
          new THREE.Vector3(dummy.sx, dummy.sy, 1),
        );
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
      this.layers.push({
        def,
        mesh,
        matrix,
        count,
        width: tileWidth,
        height,
        parallax: def.parallax ?? 0.1,
        y: def.y ?? 0,
        texture,
        ownTexture: Boolean(def.crop),
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        scale: new THREE.Vector3(tileWidth, height, 1),
      });
      order++;
    }
  }

  update(cameraX, cameraY) {
    const halfW = GAME.internalWidth / 2;
    const halfH = GAME.internalHeight / 2;
    for (const layer of this.layers) {
      const scroll = Math.floor(cameraX * layer.parallax);
      const startX = layer.def.single
        ? Math.floor(cameraX + (layer.def.x ?? 0))
        : Math.floor(cameraX - halfW - (((scroll % layer.width) + layer.width) % layer.width));
      const baseY = Number.isFinite(layer.def.worldY)
        ? Math.floor(layer.def.worldY)
        : Math.floor(cameraY - halfH + layer.y);
      for (let i = 0; i < layer.count; i++) {
        const x = layer.def.single ? startX : startX + i * layer.width + layer.width / 2;
        const y = baseY + layer.height / 2;
        layer.position.set(x, y, 0);
        layer.matrix.compose(layer.position, layer.quaternion, layer.scale);
        layer.mesh.setMatrixAt(i, layer.matrix);
      }
      layer.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const layer of this.layers) {
      layer.mesh.geometry.dispose();
      layer.mesh.material.dispose();
      if (layer.ownTexture) layer.texture.dispose();
    }
    this.layers = [];
  }
}
