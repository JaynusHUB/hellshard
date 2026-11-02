import { describe, expect, it } from 'vitest';
import { RNG, combineSeed, hashSeed, mulberry32 } from '../src/core/RNG.js';

describe('RNG', () => {
  it('is deterministic for the same seed', () => {
    const a = new RNG(12345);
    const b = new RNG(12345);
    for (let i = 0; i < 30; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different streams for different seeds', () => {
    const a = new RNG(1);
    const b = new RNG(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('keeps integer draws inside the requested bounds', () => {
    const rng = new RNG(99);
    for (let i = 0; i < 100; i++) {
      const value = rng.int(-3, 7);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThanOrEqual(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('weights picks by their declared weight', () => {
    const rng = new RNG(7);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) {
      counts[rng.weighted([{ value: 'a', weight: 3 }, { value: 'b', weight: 1 }])]++;
    }
    expect(counts.a).toBeGreaterThan(counts.b * 2);
    expect(counts.a + counts.b).toBe(2000);
  });

  it('derives stable, salted child seeds', () => {
    expect(combineSeed(10, 'room', 2)).toBe(combineSeed(10, 'room', 2));
    expect(combineSeed(10, 'room', 2)).not.toBe(combineSeed(10, 'room', 3));
    expect(hashSeed(0, 0)).toBe(0x64625032);
    expect(typeof mulberry32(5)()).toBe('number');
  });
});
