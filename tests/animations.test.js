import { describe, expect, it } from 'vitest';
import manifest from '../ASSET_MANIFEST.json';
import { Animator } from '../src/render/Animator.js';
import { AUDIO } from '../src/config/audio.js';
import { DEATH_EFFECTS } from '../src/data/effects.js';
import { EffectPool } from '../src/render/EffectPool.js';
import { basicAttackClip, heavyAttackClip } from '../src/entities/PlayerCombat.js';

describe('Aseprite animation clips', () => {
  it('imports the church player attack variants with frame durations', () => {
    const clips = manifest.sprites.brakk.animations;
    expect(clips.punch.frames).toEqual([24, 25, 26, 27, 28, 29]);
    expect(clips.kick.frames).toEqual([13, 14, 15, 16, 17]);
    expect(clips.flyingKick.frames).toEqual([4, 5]);
    expect(clips.crouchKick.frames).toEqual([8, 9, 10, 11, 12]);
    for (const name of ['punch', 'kick', 'flyingKick', 'crouchKick']) {
      expect(clips[name].durations, name).toHaveLength(clips[name].frames.length);
    }
  });

  it('keeps every imported clip duration list aligned with its frames', () => {
    for (const [spriteId, sprite] of Object.entries(manifest.sprites)) {
      for (const [clipName, clip] of Object.entries(sprite.animations ?? {})) {
        if (!clip.durations) continue;
        expect(clip.durations, `${spriteId}.${clipName}`).toHaveLength(clip.frames.length);
        expect(clip.durations.every((value) => Number(value) > 0)).toBe(true);
      }
    }
  });

  it('has six-frame rise clips for both skeleton variants', () => {
    expect(manifest.sprites.bone_thrall.animations.rise.images).toHaveLength(6);
    expect(manifest.sprites.wight.animations.rise.images).toHaveLength(6);
    expect(manifest.sprites.bone_thrall.animations.rise.fps).toBe(7);
    expect(manifest.sprites.wight.animations.rise.fps).toBe(7);
  });

  it('selects Brakk punch, kick, flying kick and crouch-kick', () => {
    const brakk = {
      characterId: 'brakk',
      character: { sprite: 'brakk', weapon: { style: 'melee' } },
      assets: { getAnimation: () => ({}) },
      attackKind: 'ground',
    };
    expect(basicAttackClip(brakk)).toBe('punch');
    expect(heavyAttackClip(brakk)).toBe('kick');
    brakk.attackKind = 'air';
    expect(basicAttackClip(brakk)).toBe('flyingKick');
    brakk.attackKind = 'crouch';
    expect(basicAttackClip(brakk)).toBe('crouchKick');
  });

  it('advances frames using per-frame durations', () => {
    const assets = {
      getAnimation: () => ({
        frames: ['a', 'b', 'c'],
        durations: [0.1, 0.2, 0.1],
        fps: 10,
        loop: false,
      }),
    };
    const animator = new Animator(assets, 'test');
    expect(animator.play('clip')).toBe(true);
    animator.update(0.05);
    expect(animator.frame).toBe('a');
    animator.update(0.06);
    expect(animator.frame).toBe('b');
    animator.update(0.2);
    expect(animator.frame).toBe('c');
    animator.update(0.2);
    expect(animator.frame).toBe('c');
    expect(animator.finished).toBe(true);
  });
});

describe('packaged audio bindings', () => {
  it('binds the five demo effects and the cemetery music loop', () => {
    expect(Object.keys(AUDIO.samples).sort()).toEqual(['attack', 'hurt', 'jump', 'kill', 'rise']);
    expect(AUDIO.bindings.swing.sample).toBe('attack');
    expect(AUDIO.bindings.playerHurt.sample).toBe('hurt');
    expect(AUDIO.bindings.jump.sample).toBe('jump');
    expect(AUDIO.bindings.enemyDeath.sample).toBe('kill');
    expect(AUDIO.bindings.rise.sample).toBe('rise');
    expect(AUDIO.music.cemetery).toMatch(/sci_fi_platformer04_main_loop\.ogg$/);
  });
});

describe('zone death effects', () => {
  it('maps all five zones to a pooled death sprite', () => {
    for (const zone of ['cemetery', 'church', 'swamp', 'dungeon', 'forest']) {
      const effect = DEATH_EFFECTS[zone];
      expect(effect, zone).toBeTruthy();
      expect(manifest.sprites[effect.sprite]?.animations?.[effect.animation], zone).toBeTruthy();
    }
    expect(DEATH_EFFECTS.forest.sprite).toBe(DEATH_EFFECTS.cemetery.sprite);
    expect(DEATH_EFFECTS.forest.tint).toBeTruthy();
  });

  it('advances and recycles pooled effect slots', () => {
    const assets = {
      getAnimation: () => ({ frames: [1, 2, 3] }),
      getSpriteAtlas: () => 'gothic',
    };
    const pool = new EffectPool({ assets, size: 2 });
    const slot = pool.spawn({ sprite: 'x', animation: 'burst', x: 14, y: 20, fps: 10 });
    expect(slot.active).toBe(true);
    expect(slot.x).toBe(14);
    pool.update(0.15);
    expect(slot.frameIndex).toBe(1);
    pool.update(0.2);
    expect(slot.active).toBe(false);
  });
});
