import { describe, expect, it } from 'vitest';
import manifest from '../ASSET_MANIFEST.json';
import { ENEMIES } from '../src/data/enemies.js';

describe('sprite manifest', () => {
  it('declares a source facing for every player, enemy and boss sprite', () => {
    const ids = [
      'kael', 'brakk', 'seraphine', 'nyx',
      'bone_thrall', 'wight', 'wisp', 'hellgato', 'burning_ghoul',
      'blight_cultist', 'venom_spider', 'bog_brute', 'mire_wraith',
      'moss_slime', 'angel',
    ];
    for (const id of ids) {
      expect(manifest.sprites[id]?.facing, id).toMatch(/^(left|right)$/);
    }
  });

  it('marks the side-view skeleton sheets as source-left', () => {
    expect(manifest.sprites.bone_thrall.facing).toBe('left');
    expect(manifest.sprites.wight.facing).toBe('left');
  });

  it('gives every normal enemy walk/attack/hurt coverage', () => {
    for (const enemy of ENEMIES) {
      const sprite = manifest.sprites[enemy.sprite];
      const clips = Object.keys(sprite.animations);
      expect(clips.some((clip) => ['walk', 'run', 'float', 'bounce'].includes(clip)), enemy.id).toBe(true);
      expect(clips.some((clip) => ['attack', 'cast'].includes(clip)), enemy.id).toBe(true);
      expect(clips.includes('hurt'), enemy.id).toBe(true);
    }
  });
});
