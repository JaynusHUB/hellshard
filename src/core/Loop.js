export class FixedLoop {
  constructor({ step = 1 / 60, maxDelta = 0.25, maxSubSteps = 6, update, render }) {
    this.step = step;
    this.maxDelta = maxDelta;
    this.maxSubSteps = maxSubSteps;
    this.update = update;
    this.render = render;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.rafId = 0;
    this.fpsSamples = new Float32Array(60);
    this.fpsIndex = 0;
    this.fpsAverage = 60;
    this.frameMs = 0;
    this.simMs = 0;
    this.elapsed = 0;
    this.tick = 0;
    this._frame = (now) => this.frame(now);
    this._visibility = () => {
      this.lastTime = performance.now();
      this.accumulator = 0;
    };
    document.addEventListener('visibilitychange', this._visibility);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  frame(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._frame);
    if (document.hidden) {
      this.lastTime = now;
      this.accumulator = 0;
      return;
    }
    let delta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    delta = Math.min(delta, this.maxDelta);
    this.frameMs = delta * 1000;
    const fps = delta > 0 ? 1 / delta : 60;
    this.fpsSamples[this.fpsIndex] = fps;
    this.fpsIndex = (this.fpsIndex + 1) % this.fpsSamples.length;
    let sum = 0;
    for (let i = 0; i < this.fpsSamples.length; i++) sum += this.fpsSamples[i];
    this.fpsAverage = sum / this.fpsSamples.length;

    this.accumulator += delta;
    let steps = 0;
    const simStart = performance.now();
    while (this.accumulator >= this.step && steps < this.maxSubSteps) {
      this.update(this.step);
      this.accumulator -= this.step;
      this.elapsed += this.step;
      this.tick++;
      steps++;
    }
    if (steps === this.maxSubSteps) {
      this.accumulator = Math.min(this.accumulator, this.step);
    }
    this.simMs = performance.now() - simStart;
    const alpha = this.accumulator / this.step;
    this.render(alpha, delta);
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this._visibility);
  }
}
