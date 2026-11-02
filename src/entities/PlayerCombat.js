import { GAME } from '../config/game.js';

export function handleActions(p, input, world) {
    if (p.heavyPhase !== 'none' || p.dashTimer > 0) return;
    const pressedHeavy = input.wasPressed('heavy');
    const pressedSpecial = input.wasPressed('special');
    const pressedBasic = input.wasPressed('attack') || (input.isDown('attack') && p.basicCooldown <= 0);
    if (pressedSpecial && p.specialCooldown <= 0) {
      useSpecial(p, world);
      return;
    }
    if (pressedHeavy && p.heavyCooldown <= 0) {
      p.heavyPhase = 'windup';
      p.heavyTimer = p.character.weapon.heavy.windup ?? 0.3;
      p.heavyStrikeFired = false;
      p.attackAnim = p.heavyTimer + (p.character.weapon.heavy.recover ?? 0.3) + 0.1;
      p.animator.play(p.character.weapon.style === 'melee' ? pickAnim(p, 'heavy', 'attack') : pickAnim(p, 'attack', 'cast'), { restart: true });
      p.emit({ type: 'heavyWindup', characterId: p.characterId });
      return;
    }
    if (pressedBasic && p.basicCooldown <= 0) {
      p.basicCooldown = p.stats.attackCooldown;
      p.basicAnimTimer = Math.min(0.3, p.stats.attackCooldown * 0.8);
      p.attackAnim = p.basicAnimTimer;
      p.animator.play(pickAnim(p, 'attack', 'cast'), { restart: true });
      emitBasicStrike(p);
    }
  }

export function pickAnim(p, ...names) {
    for (const name of names) {
      if (p.assets.getAnimation(p.character.sprite, name)) return name;
    }
    return 'idle';
  }

export function emitBasicStrike(p) {
    const weapon = p.character.weapon;
    if (weapon.style === 'melee') {
      const evolved = p.evolved && p.characterId === 'brakk';
      p.emit({
        type: 'meleeStrike',
        x: p.x,
        y: p.y,
        facing: p.facing,
        range: weapon.range * p.stats.area * (evolved ? 1.32 : 1),
        arcHeight: weapon.arcHeight,
        damage: weapon.damage * p.stats.damageMultiplier * (p.rageTimer > 0 ? 1.5 : 1) * (evolved ? 1.18 : 1),
        knockback: weapon.knockback,
        color: evolved ? '#ff5a52' : p.character.accent,
        heavy: false,
        evolved,
      });
    } else {
      emitProjectiles(p, false);
    }
  }

export function emitProjectiles(p, heavy) {
    const weapon = p.character.weapon;
    const heavyDef = weapon.heavy;
    const count = heavy ? 1 : p.stats.projectileCount;
    const projectileDamageBase = heavy ? heavyDef.damage : weapon.damage;
    const evolvedBonus = p.evolved ? 1.1 : 1;
    const frostMultiplier = weapon.element === 'frost' ? p.stats.frostPower : 1;
    const damage = projectileDamageBase * p.stats.damageMultiplier * evolvedBonus * frostMultiplier * (p.rageTimer > 0 ? 1.5 : 1);
    const speed = heavy ? heavyDef.speed : weapon.projectileSpeed;
    const evolvedPierce = p.evolved && p.characterId === 'kael' ? 3 : 0;
    const pierce = heavy ? heavyDef.pierce : weapon.pierce + evolvedPierce;
    const spread = count > 1 ? weapon.spread : 0;
    let aoe = heavy ? (weapon.style === 'projectile' ? weapon.aoe : 0) : weapon.aoe * p.stats.area;
    if (p.evolved && p.characterId === 'kael' && !heavy) aoe = Math.max(aoe, 24 * p.stats.area);
    if (p.evolved && p.characterId === 'seraphine') aoe *= 1.65;
    const projectileColor = p.evolved
      ? (p.characterId === 'kael' ? '#d8f7ff' : '#d7b7ff')
      : p.character.accent;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const vx = p.facing * speed;
      const vy = offset * 60;
      p.emit({
        type: 'spawnProjectile',
        owner: 'player',
        x: p.x + p.facing * 15,
        y: p.y + 16 + offset * 4,
        vx,
        vy,
        damage,
        pierce,
        aoe,
        element: weapon.element,
        color: projectileColor,
        trailColor: p.evolved ? projectileColor : weapon.trailColor,
        life: heavy ? weapon.projectileLife * 1.2 : weapon.projectileLife,
        heavy,
        evolved: p.evolved,
        characterId: p.characterId,
        knockback: weapon.knockback,
        weaponId: weapon.id,
        ricochet: p.evolved && p.characterId === 'nyx' ? 2 : 0,
      });
    }
    const projEvent = {
      type: 'muzzle',
      x: p.x + p.facing * 16,
      y: p.y + 16,
      facing: p.facing,
      color: weapon.accent ?? p.character.accent,
      heavy,
    };
    p.emit(projEvent);
  }

export function emitHeavyStrike(p) {
    const weapon = p.character.weapon;
    if (p.characterId === 'kael') {
      emitProjectiles(p, true);
      p.emit({ type: 'heavyTrail', x: p.x, y: p.y, facing: p.facing, color: '#bfefff' });
    } else if (p.characterId === 'brakk') {
      const range = weapon.heavy.radius * p.stats.area;
      p.emit({
        type: 'meleeStrike',
        x: p.x,
        y: p.y,
        facing: p.facing,
        range,
        arcHeight: 60,
        damage: weapon.heavy.damage * p.stats.damageMultiplier * (p.rageTimer > 0 ? 1.5 : 1),
        knockback: weapon.heavy.knockback,
        color: '#ff7a66',
        heavy: true,
      });
      p.emit({ type: 'shock', x: p.x, y: p.y, facing: p.facing, color: '#d05155', heavy: true });
    } else if (p.characterId === 'seraphine') {
      p.emit({
        type: 'burst',
        x: p.x,
        y: p.y + 16,
        radius: weapon.heavy.radius * p.stats.area,
        damage: weapon.heavy.damage * p.stats.frostPower * p.stats.damageMultiplier,
        color: '#cfadff',
        element: 'frost',
        heavy: true,
      });
      p.emit({ type: 'shock', x: p.x, y: p.y, facing: p.facing, color: '#cdb0ff', heavy: true });
    } else {
      p.emit({
        type: 'meleeStrike',
        x: p.x,
        y: p.y,
        facing: p.facing,
        range: weapon.heavy.range * p.stats.area,
        arcHeight: weapon.heavy.arcHeight,
        damage: weapon.heavy.damage * p.stats.damageMultiplier,
        knockback: weapon.heavy.knockback,
        color: '#a48bff',
        heavy: true,
      });
    }
  }

export function useSpecial(p, world) {
    const special = p.character.special;
    p.specialCooldown = special.cooldown;
    p.attackAnim = 0.3;
    p.animator.play(pickAnim(p, 'cast', 'attack'), { restart: true });
    if (special.type === 'trap') {
      const tx = p.x + p.facing * 38;
      p.emit({
        type: 'specialTrap',
        x: tx,
        y: p.y,
        duration: special.duration,
        damage: special.damage * p.stats.frostPower * p.stats.damageMultiplier,
        radius: special.radius * p.stats.area,
      });
      p.emit({ type: 'castBurst', x: p.x, y: p.y + 16, color: '#9fe4ff' });
    } else if (special.type === 'rage') {
      p.rageTimer = special.duration;
      p.emit({ type: 'rage', x: p.x, y: p.y, duration: special.duration });
    } else if (special.type === 'blinkBurst' || special.type === 'shadowStep') {
      const fromX = p.x;
      const distance = special.distance;
      let nextX = p.x;
      for (let step = 6; step <= distance; step += 6) {
        const candidate = p.x + p.facing * step;
        const testX = Math.floor((candidate + (p.facing > 0 ? 6 : -6)) / GAME.tile);
        const y0 = Math.floor((p.y + 2) / GAME.tile);
        const y1 = Math.floor((p.y + p.height - 2) / GAME.tile);
        let blocked = false;
        for (let ty = y0; ty <= y1; ty++) {
          if (world.map.isSolidAt(testX, ty)) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
        nextX = candidate;
      }
      p.x = nextX;
      p.iframes = Math.max(p.iframes, special.iframes ?? 0.35);
      p.emit({ type: 'blink', fromX, toX: nextX, y: p.y + 16, facing: p.facing });
      if (special.type === 'blinkBurst') {
        p.emit({
          type: 'burst',
          x: p.x,
          y: p.y + 16,
          radius: special.radius * p.stats.area,
          damage: special.damage * p.stats.frostPower * p.stats.damageMultiplier,
          color: '#d5bcff',
          element: 'frost',
          heavy: true,
        });
        p.emit({
          type: 'burst',
          x: fromX,
          y: p.y + 16,
          radius: special.radius * 0.6 * p.stats.area,
          damage: special.damage * 0.5 * p.stats.damageMultiplier,
          color: '#a9e8ff',
          element: 'frost',
          heavy: false,
        });
      } else {
        p.emit({
          type: 'meleeStrike',
          x: fromX,
          y: p.y,
          facing: p.facing,
          range: 46,
          arcHeight: 40,
          damage: special.damage * p.stats.damageMultiplier,
          knockback: 120,
          color: '#9c86ff',
          heavy: false,
        });
      }
    }
    p.emit({ type: 'specialUsed', characterId: p.characterId });
  }
