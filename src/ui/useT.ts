import { useStore } from '../store/store';
import { t, tm, tmDeep, type Lang, type MessageKey, type Msg, type Params } from '../i18n';

export function useT(): {
  lang: Lang;
  t: (key: MessageKey, params?: Params) => string;
  tm: (m: Msg) => string;
  tmDeep: (m: Msg) => string;
} {
  const lang = useStore((s) => s.ui.lang);
  return {
    lang,
    t: (key, params) => t(lang, key, params),
    tm: (m) => tm(lang, m),
    tmDeep: (m) => tmDeep(lang, m),
  };
}
