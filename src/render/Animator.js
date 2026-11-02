export class Animator {
  constructor(assets, spriteId) {
    this.assets = assets;
    this.spriteId = spriteId;
    this.animation = null;
    this.animationName = null;
    this.time = 0;
    this.frameIndex = 0;
    this.finished = false;
    this.speed = 1;
  }

  play(name, { restart = false, speed = 1 } = {}) {
    const next = this.assets.getAnimation(this.spriteId, name);
    if (!next) return false;
    if (this.animationName === name && !restart) {
      this.speed = speed;
      return false;
    }
    this.animation = next;
    this.animationName = name;
    this.time = 0;
    this.frameIndex = 0;
    this.finished = false;
    this.speed = speed;
    return true;
  }

  update(dt) {
    if (!this.animation) return;
    this.time += dt * this.speed;
    const frameDuration = 1 / (this.animation.fps || 8);
    const rawIndex = Math.floor(this.time / frameDuration);
    if (this.animation.loop) {
      this.frameIndex = rawIndex % this.animation.frames.length;
      this.finished = false;
    } else if (rawIndex >= this.animation.frames.length) {
      if (!this.finished) this.onFinished?.();
      this.finished = true;
      this.frameIndex = this.animation.frames.length - 1;
    } else {
      this.frameIndex = rawIndex;
    }
  }

  get frame() {
    return this.animation?.frames[this.frameIndex] ?? null;
  }

  get progress() {
    if (!this.animation) return 0;
    const total = this.animation.frames.length / (this.animation.fps || 8);
    return Math.min(1, this.time / total);
  }
}
