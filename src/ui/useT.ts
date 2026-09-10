import { useStore } from '../store/store';
import { t, tmDeep, type Lang, type MessageKey, type Msg, type Params } from '../i18n';
import type { Units } from '../units';

/** `units` is the display unit of every length field; `u` is its translated name, for labels
 * that name their unit ("Room, mm"). Lengths themselves stay millimetres everywhere. */
export function useT(): {
  lang: Lang;
  units: Units;
  u: string;
  t: (key: MessageKey, params?: Params) => string;
  tmDeep: (m: Msg) => string;
} {
  const lang = useStore((s) => s.ui.lang);
  const units = useStore((s) => s.ui.units);
  return {
    lang,
    units,
    u: t(lang, `ui.units.${units}` as MessageKey),
    t: (key, params) => t(lang, key, params),
    tmDeep: (m) => tmDeep(lang, m),
  };
}
