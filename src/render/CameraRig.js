import { GAME } from '../config/game.js';
import { clamp, damp } from '../core/RNG.js';

export class CameraRig {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.bounds = { left: 0, right: 10000, bottom: 0, top: 1000 };
    this.shakeAmount = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTime = 0;
    this.shakeSetting = 0.7;
    this.lookAhead = GAME.camera.lookAhead;
    this.initialized = false;
  }

  setBounds(left, right, bottom, top) {
    this.bounds.left = left;
    this.bounds.right = right;
    this.bounds.bottom = bottom;
    this.bounds.top = top;
  }

  snapTo(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.initialized = true;
  }

  follow(targetX, targetY, facing, dt) {
    const halfW = GAME.internalWidth / 2;
    const halfH = GAME.internalHeight / 2;
    const desiredX = targetX + facing * this.lookAhead;
    const desiredY = targetY + GAME.camera.offsetY;
    this.targetX = clamp(desiredX, this.bounds.left + halfW, Math.max(this.bounds.left + halfW, this.bounds.right - halfW));
    this.targetY = clamp(desiredY, this.bounds.bottom + halfH, Math.max(this.bounds.bottom + halfH, this.bounds.top - halfH));
    if (!this.initialized) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.initialized = true;
    } else {
      this.x = damp(this.x, this.targetX, GAME.camera.horizontalSmooth, dt);
      this.y = damp(this.y, this.targetY, GAME.camera.verticalSmooth, dt);
    }
  }

  addShake(amount) {
    const adjusted = amount * this.shakeSetting;
    this.shakeAmount = Math.min(GAME.camera.shakeMax, Math.max(this.shakeAmount, adjusted));
  }

  updateShake(dt, time) {
    this.shakeAmount = damp(this.shakeAmount, 0, GAME.camera.shakeDecay, dt);
    if (this.shakeAmount < 0.15) {
      this.shakeAmount = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    const phase = time * 43;
    this.shakeX = Math.round(Math.sin(phase * 1.7) * this.shakeAmount);
    this.shakeY = Math.round(Math.cos(phase * 2.3) * this.shakeAmount * 0.7);
  }

  getRenderPosition(alpha) {
    return {
      x: Math.round(this.x + this.shakeX),
      y: Math.round(this.y + this.shakeY),
    };
  }

  setShakeSetting(value) {
    this.shakeSetting = clamp(value, 0, 1);
  }
}
