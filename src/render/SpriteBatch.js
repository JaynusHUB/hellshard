import * as THREE from 'three';

const VERTEX = /* glsl */ `
  precision highp float;
  attribute vec2 iOffset;
  attribute vec2 iSize;
  attribute vec4 iUv;
  attribute float iFlip;
  attribute vec3 iTint;
  attribute float iFlash;
  attribute float iAlpha;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vFlash;
  varying float vAlpha;
  void main() {
    vec2 local = position.xy;
    local.x *= iFlip > 0.5 ? -1.0 : 1.0;
    vec2 worldPosition = iOffset + local * iSize;
    vUv = iUv.xy + uv * iUv.zw;
    vTint = iTint;
    vFlash = iFlash;
    vAlpha = iAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 0.0, 1.0);
  }
`;

export function computeSpriteRect(frame, x, y, options = {}) {
  if (!frame) return null;
  const scale = options.scale ?? 1;
  const width = frame.w * (options.scaleX ?? scale);
  const height = frame.h * (options.scaleY ?? scale);
  const anchorX = options.anchorX ?? 0.5;
  const anchorY = options.anchorY ?? 1;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  // anchorY is measured from the top of the frame. Placing the anchor point at
  // world (x, y) puts the frame body above it, with transparent padding below.
  const centerX = x + (0.5 - anchorX) * width + offsetX;
  const centerY = y + (anchorY - 0.5) * height + offsetY;
  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    bottom: centerY - height / 2,
    top: centerY + height / 2,
    width,
    height,
    centerX,
    centerY,
  };
}

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vFlash;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.02) discard;
    vec3 color = mix(tex.rgb * vTint, vec3(1.0), vFlash);
    gl_FragColor = vec4(color, tex.a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class SpriteBatch {
  constructor(texture, maxInstances = 4096) {
    this.texture = texture;
    this.maxInstances = maxInstances;
    this.count = 0;
    this.offset = new Float32Array(maxInstances * 2);
    this.size = new Float32Array(maxInstances * 2);
    this.uv = new Float32Array(maxInstances * 4);
    this.flip = new Float32Array(maxInstances);
    this.tint = new Float32Array(maxInstances * 3);
    this.flash = new Float32Array(maxInstances);
    this.alpha = new Float32Array(maxInstances);

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
    );
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute('iOffset', new THREE.InstancedBufferAttribute(this.offset, 2));
    geometry.setAttribute('iSize', new THREE.InstancedBufferAttribute(this.size, 2));
    geometry.setAttribute('iUv', new THREE.InstancedBufferAttribute(this.uv, 4));
    geometry.setAttribute('iFlip', new THREE.InstancedBufferAttribute(this.flip, 1));
    geometry.setAttribute('iTint', new THREE.InstancedBufferAttribute(this.tint, 3));
    geometry.setAttribute('iFlash', new THREE.InstancedBufferAttribute(this.flash, 1));
    geometry.setAttribute('iAlpha', new THREE.InstancedBufferAttribute(this.alpha, 1));
    geometry.instanceCount = 0;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e7);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.geometry = geometry;
  }

  begin() {
    this.count = 0;
  }

  draw(frame, x, y, options = {}) {
    if (!frame || this.count >= this.maxInstances) return false;
    const rect = computeSpriteRect(frame, x, y, options);
    const i = this.count++;
    const i2 = i * 2;
    const i3 = i * 3;
    const i4 = i * 4;
    this.offset[i2] = rect.centerX;
    this.offset[i2 + 1] = rect.centerY;
    this.size[i2] = rect.width;
    this.size[i2 + 1] = rect.height;
    this.uv[i4] = frame.u0;
    this.uv[i4 + 1] = frame.v0;
    this.uv[i4 + 2] = frame.u1 - frame.u0;
    this.uv[i4 + 3] = frame.v1 - frame.v0;
    this.flip[i] = options.flip ? 1 : 0;
    const tint = options.tint ?? [1, 1, 1];
    this.tint[i3] = tint[0];
    this.tint[i3 + 1] = tint[1];
    this.tint[i3 + 2] = tint[2];
    this.flash[i] = options.flash ?? 0;
    this.alpha[i] = options.alpha ?? 1;
    return true;
  }

  end() {
    this.geometry.instanceCount = this.count;
    const attrs = [
      ['iOffset', this.offset],
      ['iSize', this.size],
      ['iUv', this.uv],
      ['iFlip', this.flip],
      ['iTint', this.tint],
      ['iFlash', this.flash],
      ['iAlpha', this.alpha],
    ];
    for (const [name, array] of attrs) {
      const attr = this.geometry.getAttribute(name);
      attr.array = array;
      attr.needsUpdate = true;
    }
    this.mesh.visible = this.count > 0;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
