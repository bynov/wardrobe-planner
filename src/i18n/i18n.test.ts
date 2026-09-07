import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ru } from './ru';
import { LANGS, detectLang, msg, t, tm } from './index';
import { WALLS } from '../geometry/frames';
import { MATERIALS, PART_NAME_KEYS } from '../geometry/parts';
import { PRESET_KEYS } from '../model/presets';
import { DOOR_HINGES, DOOR_SWINGS, ROD_DIRS, ROD_REFS, ZONE_TYPES } from '../model/types';

describe('i18n', () => {
  it('ru has exactly the en keys', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });
  it('placeholders match between languages', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(ru[k]), k).toEqual(ph(en[k]));
    }
  });
  it('interpolates and falls back', () => {
    expect(t('en', 'ui.freeWidth', { n: 120 })).toBe('free 120 mm');
    expect(tm('ru', msg('ui.freeWidth', { n: 5 }))).toContain('5');
    expect(detectLang('ru-RU')).toBe('ru');
    expect(detectLang(undefined)).toBe('en');
  });

  // Each of these is looked up by building the key from a union value and casting, so a gap
  // would only surface as a raw key on screen. Cover the whole prefix × union product here.
  it.each([
    ['part.', PART_NAME_KEYS],
    ['material.', MATERIALS],
    ['zone.', ZONE_TYPES],
    ['wall.', WALLS],
    ['wall.abbr.', WALLS],
    ['preset.', PRESET_KEYS],
    ['ui.lang.', LANGS],
    ['ui.swing.', DOOR_SWINGS],
    ['ui.swingOpt.', DOOR_SWINGS],
    ['ui.hinge.', DOOR_HINGES],
    ['ui.rodFrom.', ROD_REFS],
    ['ui.rodDir.', ROD_DIRS],
  ])('%s has a key for every value', (prefix, values) => {
    for (const v of values as readonly string[]) {
      const key = `${prefix}${v}`;
      expect(Object.keys(en), key).toContain(key);
      expect(Object.keys(ru), key).toContain(key);
    }
  });
});
