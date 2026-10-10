import { en, type MessageKey } from './en';
import { ru } from './ru';
import { formatLen, type Units } from '../units';

export type Lang = 'en' | 'ru';
export const LANGS: Lang[] = ['en', 'ru'];
export type { MessageKey };
/** A length param: millimetres in the model, rendered in the display unit when the text is built. */
export interface Len { mm: number }
export const len = (mm: number): Len => ({ mm });
const isLen = (v: unknown): v is Len => typeof v === 'object' && v !== null && 'mm' in v;
export type Params = Record<string, string | number | Len>;
export interface Msg { key: MessageKey; params?: Params }

const dicts: Record<Lang, Record<MessageKey, string>> = { en, ru };

export const msg = (key: MessageKey, params?: Params): Msg => (params ? { key, params } : { key });

/** Inches carry their own ″ suffix; millimetres get the unit spelled out. */
export const fmtLenParam = (v: Len, units: Units): string =>
  units === 'in' ? formatLen(v.mm, 'in', { suffix: true }) : `${formatLen(v.mm, 'mm')} mm`;

export function t(lang: Lang, key: MessageKey, params?: Params, units: Units = 'mm'): string {
  const s = dicts[lang][key] ?? dicts.en[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in params)) return m;
    const v = params[k];
    return isLen(v) ? fmtLenParam(v, units) : String(v);
  });
}

export const tm = (lang: Lang, m: Msg, units: Units = 'mm'): string => t(lang, m.key, m.params, units);

export function tmDeep(lang: Lang, m: Msg, units: Units = 'mm'): string {
  if (!m.params) return t(lang, m.key);
  const params: Params = {};
  // A param may itself carry a message key (a wall name), so those are translated too.
  const nested = (v: string) => v.startsWith('wall.');
  for (const [k, v] of Object.entries(m.params)) params[k] = typeof v === 'string' && nested(v) ? t(lang, v as MessageKey) : v;
  return t(lang, m.key, params, units);
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'ru';
}

export function detectLang(navLang: string | undefined): Lang {
  return navLang?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
