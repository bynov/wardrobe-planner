import type { TemplateKey } from '../model/templates';
import type { MessageKey } from '../i18n';
import { useT } from './useT';

export type TemplatePick = TemplateKey | 'empty';

/** Accent bands (the runs of units) on the room rectangle, per card, in a 76 x 62 box. */
const BANDS: Record<TemplatePick, ('back' | 'left' | 'right')[]> = {
  uShape: ['back', 'left', 'right'],
  lShape: ['back', 'left'],
  oneWall: ['back'],
  empty: [],
};
const CARDS: { key: TemplatePick; name: MessageKey; desc: MessageKey }[] = [
  { key: 'uShape', name: 'template.uShape', desc: 'template.desc.uShape' },
  { key: 'lShape', name: 'template.lShape', desc: 'template.desc.lShape' },
  { key: 'oneWall', name: 'template.oneWall', desc: 'template.desc.oneWall' },
  { key: 'empty', name: 'ui.emptyRoom', desc: 'ui.emptyRoomDesc' },
];

export function TemplateCards({ value, onPick }: { value: TemplatePick | null; onPick: (k: TemplatePick) => void }) {
  const { t } = useT();
  return (
    <div className="tcards">
      {CARDS.map((c) => (
        <button key={c.key} type="button" className={`tcard${c.key === value ? ' on' : ''}`} aria-pressed={c.key === value} onClick={() => onPick(c.key)}>
          <span className="tthumb" aria-hidden>
            {BANDS[c.key].map((w) => (
              <i key={w} className={`band ${w}`} />
            ))}
          </span>
          <span className="tinfo">
            <span className="tname">{t(c.name)}</span>
            <span className="tdesc">{t(c.desc)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
