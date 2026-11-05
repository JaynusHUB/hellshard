import * as THREE from 'three';
import { GAME } from '../config/game.js';
import { clamp } from '../core/RNG.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(GAME.internalWidth, GAME.internalHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -GAME.internalWidth / 2,
      GAME.internalWidth / 2,
      GAME.internalHeight / 2,
      -GAME.internalHeight / 2,
      0.1,
      1000,
    );
    this.camera.position.set(0, 0, 500);
    this.zoom = 1;
    this.stage = document.getElementById('stage');
    this.scale = 1;
    this.quality = 1;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const scale = Math.max(
      1,
      Math.floor(Math.min(viewportW / GAME.internalWidth, viewportH / GAME.internalHeight)),
    );
    this.scale = scale;
    if (this.stage) {
      this.stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
      this.stage.style.setProperty('--ui-scale', String(scale));
    }
    const el = this.renderer.domElement;
    el.style.width = `${GAME.internalWidth}px`;
    el.style.height = `${GAME.internalHeight}px`;
    el.style.imageRendering = 'pixelated';
  }

  setZoom(zoom) {
    const value = Math.max(0.5, Number(zoom) || 1);
    if (this.zoom === value) return;
    this.zoom = value;
    this.camera.zoom = value;
    this.camera.updateProjectionMatrix();
  }

  render(camera, alpha, time) {
    const pos = camera.getRenderPosition(alpha);
    this.camera.position.x = pos.x;
    this.camera.position.y = pos.y;
    this.camera.position.z = 500;
    this.renderer.render(this.scene, this.camera);
  }

  add(object) {
    this.scene.add(object);
  }

  remove(object) {
    this.scene.remove(object);
  }

  clearScene() {
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      this.scene.remove(child);
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material?.dispose?.();
    }
  }

  getInfo() {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      textures: this.renderer.info.memory.textures,
    };
  }

  setQuality(value) {
    this.quality = clamp(value, 0.5, 1);
  }

  dispose() {
    window.removeEventListener('resize', this.resize);
    this.clearScene();
    this.renderer.dispose();
  }
}
