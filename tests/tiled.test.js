import { describe, expect, it } from 'vitest';
import { decodeTileGid, decodeTiledLayer } from '../src/world/tiledLoader.js';

describe('Tiled loader primitives', () => {
  it('decodes H/V/D flip flags without losing the GID', () => {
    expect(decodeTileGid(0x80000001)).toEqual({ id: 1, h: true, v: false, d: false });
    expect(decodeTileGid(0x40000002)).toEqual({ id: 2, h: false, v: true, d: false });
    expect(decodeTileGid(0x20000003)).toEqual({ id: 3, h: false, v: false, d: true });
  });

  it('decodes CSV and uncompressed base64 tile layers', () => {
    expect(decodeTiledLayer({
      name: 'csv',
      type: 'tilelayer',
      encoding: 'csv',
      data: '0, 1, 2, 0',
    })).toEqual([0, 1, 2, 0]);
    const bytes = Buffer.alloc(8);
    bytes.writeUInt32LE(1, 0);
    bytes.writeUInt32LE(2, 4);
    expect(decodeTiledLayer({
      name: 'base64',
      type: 'tilelayer',
      encoding: 'base64',
      data: bytes.toString('base64'),
    })).toEqual([1, 2]);
  });

  it('rejects compressed layers with a clear error', () => {
    expect(() => decodeTiledLayer({
      name: 'compressed',
      type: 'tilelayer',
      encoding: 'base64',
      compression: 'zlib',
      data: 'eJx',
    })).toThrow(/Compressed Tiled layers/);
  });
});
