// Fixed-size pool for one-shot sprite effects. Instances are drawn through the
// existing gothic actor SpriteBatch, so no extra draw calls are introduced.
export class EffectPool {
  constructor({ assets, size = 24 }) {
    this.assets = assets;
    this.slots = Array.from({ length: size }, () => ({
      active: false,
      animation: null,
      sprite: null,
      atlas: 'gothic',
      x: 0,
      y: 0,
      age: 0,
      duration: 0,
      frameIndex: 0,
      fps: 12,
      tint: null,
      alpha: 1,
      flip: false,
    }));
    this.next = 0;
  }

  spawn({ sprite, animation, x, y, fps = 12, tint = null, alpha = 1, flip = false }) {
    const clip = this.assets.getAnimation(sprite, animation);
    if (!clip?.frames?.length) return null;
    const slot = this.slots[this.next];
    this.next = (this.next + 1) % this.slots.length;
    slot.active = true;
    slot.animation = clip;
    slot.sprite = sprite;
    slot.atlas = this.assets.getSpriteAtlas(sprite);
    slot.x = Math.round(x);
    slot.y = Math.round(y);
    slot.age = 0;
    slot.fps = Math.max(1, fps);
    slot.duration = clip.frames.length / slot.fps;
    slot.frameIndex = 0;
    slot.tint = tint;
    slot.alpha = alpha;
    slot.flip = flip;
    return slot;
  }

  update(dt) {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += dt;
      if (slot.age >= slot.duration) {
        slot.active = false;
        continue;
      }
      slot.frameIndex = Math.min(
        slot.animation.frames.length - 1,
        Math.floor(slot.age * slot.fps),
      );
    }
  }

  render(batch, family) {
    for (const slot of this.slots) {
      if (!slot.active || slot.atlas !== family) continue;
      const frame = slot.animation.frames[slot.frameIndex];
      if (!frame) continue;
      batch.draw(frame, slot.x, slot.y, {
        anchorY: 0.5,
        flip: slot.flip,
        tint: slot.tint ?? [1, 1, 1],
        alpha: slot.alpha,
      });
    }
  }

  clear() {
    for (const slot of this.slots) slot.active = false;
    this.next = 0;
  }
}
