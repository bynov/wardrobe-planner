import { en, type MessageKey } from './en';
import { ru } from './ru';

export type Lang = 'en' | 'ru';
export const LANGS: Lang[] = ['en', 'ru'];
export type { MessageKey };
export type Params = Record<string, string | number>;
export interface Msg { key: MessageKey; params?: Params }

const dicts: Record<Lang, Record<MessageKey, string>> = { en, ru };

export const msg = (key: MessageKey, params?: Params): Msg => (params ? { key, params } : { key });

export function t(lang: Lang, key: MessageKey, params?: Params): string {
  const s = dicts[lang][key] ?? dicts.en[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export const tm = (lang: Lang, m: Msg): string => t(lang, m.key, m.params);

export function tmDeep(lang: Lang, m: Msg): string {
  if (!m.params) return t(lang, m.key);
  const params: Params = {};
  // A param may itself carry a message key (a wall name), so those are translated too.
  const nested = (v: string) => v.startsWith('wall.');
  for (const [k, v] of Object.entries(m.params)) params[k] = typeof v === 'string' && nested(v) ? t(lang, v as MessageKey) : v;
  return t(lang, m.key, params);
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'ru';
}

export function detectLang(navLang: string | undefined): Lang {
  return navLang?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
