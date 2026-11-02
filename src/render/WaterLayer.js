import * as THREE from 'three';
import { GAME } from '../config/game.js';

const WATER_VERTEX = /* glsl */ `
  attribute vec2 aLocal;
  varying vec2 vUv;
  varying vec2 vWorld;
  varying vec2 vLocal;
  void main() {
    vUv = uv;
    vWorld = position.xy;
    vLocal = aLocal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTint;
  uniform vec3 uGlow;
  uniform sampler2D uMap;
  uniform float uProcedural;
  varying vec2 vUv;
  varying vec2 vWorld;
  varying vec2 vLocal;
  void main() {
    float wave = sin(uTime * 1.8 + vWorld.x * 0.14 + vWorld.y * 0.21) * 0.5 + 0.5;
    float ripple = sin(uTime * 3.2 + vWorld.x * 0.32 - vWorld.y * 0.11) * 0.5 + 0.5;
    float edge = smoothstep(0.0, 0.12, vLocal.y) * smoothstep(0.0, 0.05, vLocal.x) * smoothstep(0.0, 0.05, 1.0 - vLocal.x);
    vec3 base;
    float alpha;
    if (uProcedural > 0.5) {
      base = uTint * (0.72 + wave * 0.28);
      alpha = 0.78;
      if (fract((vWorld.y + uTime * 8.0) / 16.0) < 0.16) base += uGlow * 0.35;
    } else {
      vec4 tex = texture2D(uMap, vUv);
      if (tex.a < 0.05) discard;
      base = tex.rgb * uTint * (0.8 + wave * 0.3);
      alpha = tex.a * 0.82;
      if (fract((vWorld.y + uTime * 9.0) / 20.0) < 0.12) base += uGlow * 0.22;
      base += uGlow * ripple * 0.08;
    }
    if (vLocal.y > 0.86) {
      base += uGlow * (0.35 + sin(uTime * 3.0 + vWorld.x * 0.2) * 0.12);
      alpha = min(1.0, alpha + 0.12);
    }
    gl_FragColor = vec4(base, alpha * edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class WaterLayer {
  constructor({ scene, assets, zoneId, hazards }) {
    this.scene = scene;
    this.zoneId = zoneId;
    this.hazards = hazards.filter((hazard) => hazard.kind === 'water');
    this.mesh = null;
    this.material = null;
    this.frame = assets.getTileFrame('swamp', 'water');
    this.procedural = zoneId !== 'swamp';
    if (!this.hazards.length) return;
    this.build(assets);
  }

  build(assets) {
    const positions = [];
    const uvs = [];
    const locals = [];
    const indices = [];
    const tile = GAME.tile;
    const frame = this.frame;
    for (const hazard of this.hazards) {
      for (let y = hazard.y; y < hazard.y + hazard.h; y += tile) {
        for (let x = hazard.x; x < hazard.x + hazard.w; x += tile) {
          const base = positions.length / 3;
          const x0 = (x - hazard.x) / Math.max(1, hazard.w);
          const y0 = (y - hazard.y) / Math.max(1, hazard.h);
          const x1 = (x + tile - hazard.x) / Math.max(1, hazard.w);
          const y1 = (y + tile - hazard.y) / Math.max(1, hazard.h);
          positions.push(x, y, 0, x + tile, y, 0, x + tile, y + tile, 0, x, y + tile, 0);
          locals.push(x0, y0, x1, y0, x1, y1, x0, y1);
          if (frame && !this.procedural) {
            const sx = (Math.round(x) % 64) / 64;
            const sy = (Math.round(y) % 32) / 32;
            const u0 = frame.u0 + (frame.u1 - frame.u0) * sx;
            const v0 = frame.v1 - (frame.v1 - frame.v0) * (sy + 0.5);
            const u1 = frame.u1;
            const v1 = Math.min(frame.v1, v0 + (frame.v1 - frame.v0) * 0.5);
            uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
          } else {
            uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('aLocal', new THREE.Float32BufferAttribute(locals, 2));
    geometry.setIndex(indices);
    const tint = this.zoneId === 'forest' ? [0.22, 0.42, 0.33] : [0.35, 0.48, 0.3];
    const glow = this.zoneId === 'forest' ? [0.55, 0.9, 0.62] : [0.55, 0.75, 0.4];
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: assets.getAtlas('gothic').texture },
        uTint: { value: new THREE.Vector3(tint[0], tint[1], tint[2]) },
        uGlow: { value: new THREE.Vector3(glow[0], glow[1], glow[2]) },
        uProcedural: { value: this.procedural ? 1 : 0 },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = 0.8;
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  update(time) {
    if (this.material) this.material.uniforms.uTime.value = time;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.removeFromParent();
      this.mesh.geometry.dispose();
      this.material.dispose();
    }
  }
}
