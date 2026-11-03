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
    this.durations = null;
  }

  play(name, { restart = false, speed = 1, fps = null, loop = null, phase = 0 } = {}) {
    const next = this.assets.getAnimation(this.spriteId, name);
    if (!next) return false;
    if (this.animationName === name && !restart) {
      this.speed = speed;
      if (fps !== null) {
        this.fps = fps;
        this.durations = null;
      }
      if (loop !== null) this.loop = loop;
      return false;
    }
    this.animation = next;
    this.animationName = name;
    this.time = 0;
    this.frameIndex = 0;
    this.finished = false;
    this.speed = speed;
    this.fps = fps ?? next.fps ?? 8;
    this.loop = loop ?? next.loop ?? true;
    // Aseprite timing is honoured for clips without an explicit fps override.
    // Enemy AI passes a tuned fps so combat cadence stays readable.
    this.durations = fps === null
      && Array.isArray(next.durations)
      && next.durations.length === next.frames.length
      ? next.durations
      : null;
    const frameDuration = this.fps > 0 ? 1 / this.fps : 0;
    if (this.loop && phase > 0 && frameDuration > 0 && this.animation.frames.length > 0) {
      this.time = (phase % 1) * this.animation.frames.length * frameDuration;
      this.frameIndex = Math.floor(this.time / frameDuration) % this.animation.frames.length;
    }
    return true;
  }

  get totalDuration() {
    if (!this.durations) return 0;
    return this.durations.reduce((sum, value) => sum + value, 0);
  }

  frameIndexAt(time) {
    let cursor = 0;
    for (let index = 0; index < this.durations.length; index++) {
      cursor += this.durations[index];
      if (time < cursor) return index;
    }
    return this.durations.length - 1;
  }

  update(dt) {
    if (!this.animation) return;
    this.time += dt * this.speed;
    if (this.durations) {
      const total = this.totalDuration;
      if (total <= 0) return;
      if (this.loop ?? this.animation.loop) {
        this.time %= total;
        this.frameIndex = this.frameIndexAt(this.time);
        this.finished = false;
      } else if (this.time >= total) {
        if (!this.finished) this.onFinished?.();
        this.finished = true;
        this.frameIndex = this.animation.frames.length - 1;
      } else {
        this.frameIndex = this.frameIndexAt(this.time);
      }
      return;
    }
    if ((this.fps ?? this.animation.fps ?? 8) <= 0) {
      this.frameIndex = 0;
      this.finished = false;
      return;
    }
    const frameDuration = 1 / (this.fps ?? this.animation.fps ?? 8);
    const rawIndex = Math.floor(this.time / frameDuration);
    if (this.loop ?? this.animation.loop) {
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
    if (this.durations) {
      const total = this.totalDuration;
      return total > 0 ? Math.min(1, this.time / total) : 0;
    }
    const fps = this.fps || this.animation.fps || 8;
    if (fps <= 0) return 0;
    const total = this.animation.frames.length / fps;
    return Math.min(1, this.time / total);
  }
}
