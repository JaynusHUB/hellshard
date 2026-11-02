import * as THREE from 'three';
import { GAME } from '../config/game.js';
import { RNG, combineSeed, clamp } from '../core/RNG.js';
import { COLORS } from '../render/ParticleSystem.js';

const ORB_VERTEX = /* glsl */ `
  attribute vec2 iPosition;
  attribute vec2 iSize;
  attribute vec3 iColor;
  attribute float iAlpha;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 world = iPosition + position.xy * iSize;
    vUv = uv;
    vColor = iColor;
    vAlpha = iAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
  }
`;

const ORB_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = vUv - 0.5;
    float diamond = abs(p.x) + abs(p.y);
    if (diamond > 0.5) discard;
    float edge = smoothstep(0.34, 0.51, diamond);
    vec3 color = mix(vec3(1.0), vColor, edge);
    float core = 1.0 - smoothstep(0.0, 0.18, diamond);
    color = mix(color, vec3(1.0), core * 0.45);
    gl_FragColor = vec4(color, vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function toLinear(rgb) {
  return rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

export class XPOrbSystem {
  constructor({ scene, particles, glowParticles, maxOrbs = 220 }) {
    this.maxOrbs = maxOrbs;
    this.orbs = new Array(maxOrbs);
    for (let i = 0; i < maxOrbs; i++) {
      this.orbs[i] = {
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        value: 0, age: 0, life: 30,
        phase: 0, size: 4, color: COLORS.soul, attracted: false,
      };
    }
    this.particles = particles;
    this.glowParticles = glowParticles;
    this.count = 0;
    this.positions = new Float32Array(maxOrbs * 2);
    this.sizes = new Float32Array(maxOrbs * 2);
    this.colors = new Float32Array(maxOrbs * 3);
    this.alphas = new Float32Array(maxOrbs);
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
      vertexShader: ORB_VERTEX,
      fragmentShader: ORB_FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = GAME.rendering.layers.orbs;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.rng = new RNG(combineSeed(1, 'xp'));
    this.gainHandler = null;
  }

  setSeed(seed) {
    this.rng = new RNG(combineSeed(seed, 'xp'));
  }

  acquire() {
    for (let i = 0; i < this.maxOrbs; i++) {
      if (!this.orbs[i].active) return this.orbs[i];
    }
    return null;
  }

  spawn(value, x, y, { big = false, burst = true } = {}) {
    const orb = this.acquire();
    if (!orb) return null;
    orb.active = true;
    orb.x = x + (this.rng.next() - 0.5) * 10;
    orb.y = y + 10 + this.rng.next() * 8;
    orb.vx = burst ? (this.rng.next() - 0.5) * 80 : 0;
    orb.vy = burst ? 70 + this.rng.next() * 70 : 0;
    orb.value = value;
    orb.age = 0;
    orb.life = 28;
    orb.phase = this.rng.next() * Math.PI * 2;
    orb.size = big ? 7 : 4;
    orb.color = big ? COLORS.gold : COLORS.soul;
    orb.attracted = false;
    orb.grounded = false;
    return orb;
  }

  spawnFromEnemy(x, y, totalValue) {
    const orbs = totalValue >= 30 ? 3 : totalValue >= 15 ? 2 : 1;
    const each = Math.max(1, Math.round(totalValue / orbs));
    for (let i = 0; i < orbs; i++) {
      this.spawn(each, x, y, { big: each >= 20 });
    }
  }

  update(dt, player, map, onGain) {
    this.gainHandler = onGain;
    for (const orb of this.orbs) {
      if (!orb.active) continue;
      orb.age += dt;
      if (orb.age >= orb.life) {
        orb.active = false;
        continue;
      }
      const dx = player.x - orb.x;
      const dy = player.y + player.height * 0.45 - orb.y;
      const dist = Math.hypot(dx, dy);
      const magnet = player.magnetRange ?? GAME.power.magnetRangeBase;
      if (dist < magnet) {
        orb.attracted = true;
        const speed = GAME.combat.xpMagnetSpeed * (1 - clamp(dist / magnet, 0, 0.9) * 0.4);
        const len = dist || 1;
        orb.x += (dx / len) * speed * dt;
        orb.y += (dy / len) * speed * dt;
      } else {
        orb.attracted = false;
        if (!orb.grounded) {
          orb.vy -= 800 * dt;
          orb.x += orb.vx * dt;
          orb.y += orb.vy * dt;
          orb.vx *= Math.max(0, 1 - 3 * dt);
          const groundY = map.getGroundYAtWorld(orb.x, orb.y + 8);
          if (groundY !== null && orb.y <= groundY + 1) {
            orb.y = groundY + 1;
            orb.vy = 0;
            orb.vx = 0;
            orb.grounded = true;
          }
        } else {
          orb.y += Math.sin((orb.age + orb.phase) * 4) * 6 * dt;
        }
      }
      if (dist < player.width / 2 + 6) {
        orb.active = false;
        onGain(orb.value, orb);
        this.glowParticles.burst([orb.color, COLORS.white], orb.x, orb.y, 7, {
          speed: 40,
          spread: Math.PI * 2,
          life: 0.25,
          gravity: -40,
          drag: 2,
          size: 1.5,
        });
        orb.active = false;
      }
    }
    this.render();
  }

  render() {
    let count = 0;
    for (const orb of this.orbs) {
      if (!orb.active) continue;
      const i2 = count * 2;
      const i3 = count * 3;
      const bob = orb.grounded ? Math.sin((orb.age + orb.phase) * 5) * 3 : 0;
      this.positions[i2] = Math.round(orb.x);
      this.positions[i2 + 1] = Math.round(orb.y + bob);
      this.sizes[i2] = orb.size;
      this.sizes[i2 + 1] = orb.size * 1.35;
      const lin = toLinear(orb.color);
      this.colors[i3] = lin[0];
      this.colors[i3 + 1] = lin[1];
      this.colors[i3 + 2] = lin[2];
      this.alphas[count] = clamp((orb.life - orb.age) / 2, 0, 1) * (0.55 + 0.45 * Math.abs(Math.sin((orb.age + orb.phase) * 3)));
      count++;
    }
    this.count = count;
    this.geometry.instanceCount = count;
    this.geometry.getAttribute('iPosition').needsUpdate = true;
    this.geometry.getAttribute('iSize').needsUpdate = true;
    this.geometry.getAttribute('iColor').needsUpdate = true;
    this.geometry.getAttribute('iAlpha').needsUpdate = true;
    this.mesh.visible = count > 0;
  }

  clear() {
    for (const orb of this.orbs) orb.active = false;
    this.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
