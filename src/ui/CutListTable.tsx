import { useMemo } from 'react';
import { useStore } from '../store/store';
import { buildParts } from '../geometry/parts';
import { buildCutList, locationTag, noteText } from '../cutlist/cutlist';
import { type MessageKey } from '../i18n';
import { wallName } from '../drawing/views';
import { formatLen } from '../units';
import { useT } from './useT';

export function CutListTable() {
  const project = useStore((s) => s.lastValid);
  const { lang, u, units, t } = useT();
  const rows = useMemo(() => buildCutList(buildParts(project)), [project]);
  const total = rows.reduce((s, r) => s + r.qty, 0);
  return (
    <div className="tablewrap">
      <table className="cutlist">
        <thead>
          <tr>
            <th>{t('table.num')}</th><th>{t('table.part')}</th><th>{t('table.location')}</th><th>{t('table.qty')}</th>
            {/* the size columns name the unit once, so every cell below is a bare figure */}
            <th>{t('table.length', { u })}</th><th>{t('table.width', { u })}</th><th>{t('table.thk', { u })}</th>
            <th>{t('table.material')}</th><th>{t('table.notes')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{t(`part.${r.nameKey}` as MessageKey)}</td>
              {/* the tags printed on the drawings ("B1, B2"); the full names stay a hover away */}
              <td title={r.locations.map((l) => t('location.unit', { wall: wallName(lang, l.wall), n: l.columnIndex + 1 })).join(', ')}>
                {r.locations.map((l) => locationTag(lang, l)).join(', ')}
              </td>
              <td>{r.qty}</td>
              <td>{formatLen(r.length, units)}</td><td>{formatLen(r.width, units)}</td><td>{formatLen(r.thickness, units)}</td>
              <td>{t(`material.${r.material}` as MessageKey)}</td>
              <td>{r.notes.map((n) => noteText(lang, n, units)).join('; ')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>{t('table.total')}</td><td>{total}</td><td colSpan={5} /></tr>
        </tfoot>
      </table>
    </div>
  );
}
