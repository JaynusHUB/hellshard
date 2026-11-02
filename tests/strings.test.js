import { describe, expect, it } from 'vitest';
import { EN, TR, translate } from '../src/ui/strings.js';

describe('localization', () => {
  it('keeps English and Turkish key sets in sync', () => {
    expect(Object.keys(TR).sort()).toEqual(Object.keys(EN).sort());
  });

  it('translates Nyx weapon and ability without zone text', () => {
    expect(translate('tr', 'weapon.shadowBlades.name')).toBe('Gölge Bıçakları');
    expect(translate('tr', 'special.shadowStep.name')).toBe('Gölge Adımı');
    expect(translate('tr', 'weapon.shadowBlades.name')).not.toMatch(/bölge/i);
    expect(translate('tr', 'special.shadowStep.name')).not.toMatch(/bölge/i);
  });

  it('does not leave zone placeholders in gameplay labels', () => {
    const keys = [
      'weapon.frostArrows.name',
      'weapon.berserkerCleave.name',
      'weapon.iceOrb.name',
      'weapon.shadowBlades.name',
      'special.frostTrap.name',
      'special.bloodRage.name',
      'special.blinkBurst.name',
      'special.shadowStep.name',
    ];
    for (const key of keys) {
      const value = translate('tr', key);
      expect(value).not.toContain('{zone}');
      expect(value).not.toMatch(/bölge/i);
    }
  });
});
