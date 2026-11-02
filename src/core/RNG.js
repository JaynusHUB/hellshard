export function hashSeed(seed, salt = 0) {
  let h = (seed | 0) ^ 0x9e3779b9 ^ Math.imul(salt | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h ^= h >>> 15;
  return h >>> 0;
}

export function combineSeed(seed, ...parts) {
  let h = hashSeed(seed);
  for (const part of parts) {
    const numeric = typeof part === 'number' ? part : hashString(String(part));
    h = hashSeed(h ^ numeric, 0x9e3779b9);
  }
  return h >>> 0;
}

export function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this._next = mulberry32(this.seed);
  }

  next() {
    return this._next();
  }

  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    if (max < min) return min;
    return Math.floor(this.float(min, max + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(array) {
    if (!array.length) return undefined;
    return array[this.int(0, array.length - 1)];
  }

  weighted(entries) {
    let total = 0;
    for (const entry of entries) total += entry.weight;
    let roll = this.next() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.value;
    }
    return entries[entries.length - 1]?.value;
  }

  shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  derive(salt) {
    return new RNG(combineSeed(this.seed, salt));
  }
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function approach(current, target, delta) {
  if (current < target) return Math.min(current + delta, target);
  return Math.max(current - delta, target);
}

export function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
