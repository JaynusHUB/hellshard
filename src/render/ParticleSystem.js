import * as THREE from 'three';

const PARTICLE_VERTEX = /* glsl */ `
  attribute vec2 iPosition;
  attribute vec2 iSize;
  attribute vec3 iColor;
  attribute float iAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 world = iPosition + position.xy * iSize;
    vColor = iColor;
    vAlpha = iAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
  }
`;

const PARTICLE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function srgbToLinear(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export const COLORS = {
  frost: [170, 231, 255],
  frostDeep: [92, 157, 206],
  blood: [181, 53, 55],
  ember: [236, 139, 70],
  bone: [210, 195, 165],
  shadow: [122, 100, 181],
  venom: [136, 193, 91],
  soul: [156, 209, 213],
  gold: [218, 181, 108],
  white: [240, 230, 210],
  mud: [123, 128, 78],
  stone: [123, 113, 95],
};

export class ParticleSystem {
  constructor({ scene, maxParticles = 720, additive = false }) {
    this.maxParticles = maxParticles;
    this.particles = new Array(maxParticles);
    for (let i = 0; i < maxParticles; i++) {
      this.particles[i] = {
        x: 0, y: 0, vx: 0, vy: 0,
        gravity: 0, drag: 0,
        age: 0, life: 1,
        sizeX: 1, sizeY: 1,
        color: [1, 1, 1],
        alpha: 1,
        active: false,
      };
    }
    this.count = 0;
    this.positions = new Float32Array(maxParticles * 2);
    this.sizes = new Float32Array(maxParticles * 2);
    this.colors = new Float32Array(maxParticles * 3);
    this.alphas = new Float32Array(maxParticles);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute('iPosition', new THREE.InstancedBufferAttribute(this.positions, 2));
    geometry.setAttribute('iSize', new THREE.InstancedBufferAttribute(this.sizes, 2));
    geometry.setAttribute('iColor', new THREE.InstancedBufferAttribute(this.colors, 3));
    geometry.setAttribute('iAlpha', new THREE.InstancedBufferAttribute(this.alphas, 1));
    geometry.instanceCount = 0;
    this.geometry = geometry;
    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.additive = additive;
  }

  emit(config) {
    if (this.count >= this.maxParticles) return null;
    const p = this.particles[this.count++];
    p.x = config.x ?? 0;
    p.y = config.y ?? 0;
    p.vx = config.vx ?? 0;
    p.vy = config.vy ?? 0;
    p.gravity = config.gravity ?? 0;
    p.drag = config.drag ?? 0;
    p.age = 0;
    p.life = config.life ?? 0.5;
    p.sizeX = config.sizeX ?? config.size ?? 2;
    p.sizeY = config.sizeY ?? config.size ?? 2;
    p.endSize = config.endSize ?? 0;
    const color = config.color ?? COLORS.white;
    p.color[0] = srgbToLinear(color[0]);
    p.color[1] = srgbToLinear(color[1]);
    p.color[2] = srgbToLinear(color[2]);
    p.alpha = config.alpha ?? 1;
    p.active = true;
    return p;
  }

  burst(colors, x, y, count, options = {}) {
    const speed = options.speed ?? 60;
    const spread = options.spread ?? Math.PI * 2;
    const direction = options.direction ?? 0;
    const life = options.life ?? 0.45;
    const gravity = options.gravity ?? 300;
    const size = options.size ?? 2;
    const endSize = options.endSize ?? 0;
    const drag = options.drag ?? 1;
    const palette = colors.length ? colors : [COLORS.white];
    for (let i = 0; i < count; i++) {
      const angle = direction + (Math.random() - 0.5) * spread;
      const velocity = speed * (0.25 + Math.random() * 0.9);
      this.emit({
        x: x + (Math.random() - 0.5) * (options.radius ?? 4),
        y: y + (Math.random() - 0.5) * (options.radius ?? 4),
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        gravity,
        drag,
        life: life * (0.6 + Math.random() * 0.8),
        sizeX: size * (0.6 + Math.random() * 0.8),
        sizeY: size * (0.6 + Math.random() * 0.8),
        endSize,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: options.alpha ?? 1,
      });
    }
  }

  update(dt) {
    let active = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.swapRemove(i);
        i--;
        continue;
      }
      p.vy -= p.gravity * dt;
      if (p.drag > 0) {
        const factor = Math.max(0, 1 - p.drag * dt);
        p.vx *= factor;
        p.vy *= factor;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      active++;
    }
    this.writeRenderData();
    return active;
  }

  swapRemove(index) {
    const last = this.count - 1;
    if (index !== last) {
      const temp = this.particles[index];
      this.particles[index] = this.particles[last];
      this.particles[last] = temp;
    }
    this.count--;
  }

  writeRenderData() {
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      const t = p.age / p.life;
      const shrink = 1 - t;
      const sizeX = p.endSize > 0 ? p.sizeX + (p.endSize - p.sizeX) * t : p.sizeX * shrink;
      const sizeY = p.endSize > 0 ? p.sizeY + (p.endSize - p.sizeY) * t : p.sizeY * shrink;
      this.positions[i * 2] = Math.round(p.x);
      this.positions[i * 2 + 1] = Math.round(p.y);
      this.sizes[i * 2] = Math.max(1, sizeX);
      this.sizes[i * 2 + 1] = Math.max(1, sizeY);
      this.colors[i * 3] = p.color[0];
      this.colors[i * 3 + 1] = p.color[1];
      this.colors[i * 3 + 2] = p.color[2];
      this.alphas[i] = p.alpha * Math.min(1, (1 - t) * 2.5);
    }
    this.geometry.instanceCount = this.count;
    this.geometry.getAttribute('iPosition').needsUpdate = true;
    this.geometry.getAttribute('iSize').needsUpdate = true;
    this.geometry.getAttribute('iColor').needsUpdate = true;
    this.geometry.getAttribute('iAlpha').needsUpdate = true;
    this.mesh.visible = this.count > 0;
  }

  clear() {
    this.count = 0;
    this.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
