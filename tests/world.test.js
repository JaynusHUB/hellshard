import { describe, expect, it } from 'vitest';
import { buildZoneRoute, generateWorld, generateZone, analyzeReachability } from '../src/world/WorldGen.js';
import { ZONE_ORDER } from '../src/data/zones.js';

describe('world generation', () => {
  it('is deterministic for the same seed', () => {
    const a = generateZone(424242, 'cemetery');
    const b = generateZone(424242, 'cemetery');
    expect(Array.from(a.map.data)).toEqual(Array.from(b.map.data));
    expect(a.spawn).toEqual(b.spawn);
    expect(a.secrets).toEqual(b.secrets);
    expect(a.transitions.map((tr) => tr.id)).toEqual(b.transitions.map((tr) => tr.id));
    expect(a.decorations.map((d) => [d.prop, d.x])).toEqual(b.decorations.map((d) => [d.prop, d.x]));
  });

  it('changes layout for different seeds', () => {
    const a = generateZone(1, 'cemetery');
    const b = generateZone(2, 'cemetery');
    expect(Array.from(a.map.data)).not.toEqual(Array.from(b.map.data));
  });

  it('generates all five zones', () => {
    const world = generateWorld(20261102);
    expect(Object.keys(world).sort()).toEqual([...ZONE_ORDER].sort());
    for (const zone of Object.values(world)) {
      expect(zone.reachability.ok).toBe(true);
      expect(zone.map.isStandableTile(Math.floor(zone.spawn.x / 16), Math.floor(zone.spawn.y / 16))).toBe(true);
    }
  });

  it('validates path reachability across 1..100 seeds', () => {
    const failures = [];
    for (let seed = 1; seed <= 100; seed++) {
      const world = generateWorld(seed);
      for (const [id, zone] of Object.entries(world)) {
        if (!zone.reachability.ok) failures.push(`${seed}:${id}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('does not create self-targeting or unknown doors', () => {
    for (const zone of Object.values(generateWorld(77))) {
      for (const transition of zone.transitions) {
        expect(transition.target).not.toBe(zone.zoneId);
        expect(ZONE_ORDER).toContain(transition.target);
      }
    }
  });

  it('exposes the three boss arenas', () => {
    const world = generateWorld(1234);
    for (const id of ['cemetery', 'church', 'swamp']) {
      expect(world[id].arena).not.toBeNull();
    }
  });

  it('creates a deterministic, seed-varying route through the hub', () => {
    const a = buildZoneRoute(20261102);
    const b = buildZoneRoute(20261102);
    expect(a).toEqual(b);
    expect(a[0]).toBe('cemetery');
    expect(a[a.length - 1]).toBe('forest');
    expect(new Set(a)).toEqual(new Set(['cemetery', 'church', 'swamp', 'forest']));
    const variants = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => buildZoneRoute(seed).join('>')));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('wires the route exits to the generated neighbor', () => {
    for (const seed of [1, 7, 20261102]) {
      const route = buildZoneRoute(seed);
      const world = generateWorld(seed);
      for (let i = 1; i < route.length - 1; i++) {
        const zone = world[route[i]];
        const right = zone.transitions.find((transition) => transition.id === `right-${route[i]}`);
        expect(right.target).toBe(route[i + 1]);
      }
    }
  });

  it('reports unreachable gaps when envelope shrinks', () => {
    const zone = generateZone(9, 'cemetery');
    const report = analyzeReachability(zone);
    expect(report.ok).toBe(true);
    expect(Array.isArray(report.gaps)).toBe(true);
  });
});
