import * as THREE from 'three';
import { GAME } from '../config/game.js';

function radialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Additive torch/window halos authored in the Tiled `Lights` object layer. */
export class TiledLights {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.texture = radialTexture();
    this.lights = [];
    this.build();
  }

  build() {
    for (const light of this.world.tiled?.lights ?? []) {
      const material = new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        opacity: 0.34 * light.intensity,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        color: new THREE.Color(light.color),
      });
      const radius = Math.max(16, light.radius);
      const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(light.x, light.y, 0);
      mesh.frustumCulled = false;
      mesh.renderOrder = GAME.rendering.layers.actors + 0.3;
      this.group.add(mesh);
      this.lights.push({ def: light, mesh, material, radius });
    }
  }

  update(timeSeconds) {
    for (const light of this.lights) {
      const def = light.def;
      const n = 0.5 + 0.5
        * Math.sin(timeSeconds * 17 + def.phase) * Math.sin(timeSeconds * 7.3 + def.phase * 0.73);
      const flicker = 1 - def.flicker * (1 - n);
      light.material.opacity = 0.34 * def.intensity * flicker;
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const light of this.lights) {
      light.mesh.geometry.dispose();
      light.material.dispose();
    }
    this.texture.dispose();
    this.lights = [];
  }
}
