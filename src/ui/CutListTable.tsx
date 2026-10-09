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
    <div className="cutlist-page">
      <h2>{t('ui.cutlistTitle')}</h2>
      <div className="cutlist-head">
        <p className="meta">{t('ui.cutlistSummary', { parts: total, sizes: rows.length })}</p>
        <p className="meta">{t('ui.cutlistExcludes')}</p>
      </div>
      <div className="card tablewrap">
        <table>
          <thead>
            <tr className="label">
              <th>{t('table.part')}</th><th>{t('table.location')}</th><th className="num">{t('table.qty')}</th>
              {/* the size columns name the unit once, so every cell below is a bare figure */}
              <th className="num">{t('table.length', { u })}</th><th className="num">{t('table.width', { u })}</th><th className="num">{t('table.thk', { u })}</th>
              <th>{t('table.material')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {/* the notes ride along as a hover so the dropped Notes column loses nothing */}
                <td title={r.notes.map((n) => noteText(lang, n, units)).join('; ') || undefined}>{t(`part.${r.nameKey}` as MessageKey)}</td>
                {/* the tags printed on the drawings ("B1, B2"); the full names stay a hover away */}
                <td className="tag" title={r.locations.map((l) => t('location.unit', { wall: wallName(lang, l.wall), n: l.columnIndex + 1 })).join(', ')}>
                  {r.locations.map((l) => locationTag(lang, l)).join(', ')}
                </td>
                <td className="num mono">{r.qty}</td>
                <td className="num mono">{formatLen(r.length, units)}</td>
                <td className="num mono">{formatLen(r.width, units)}</td>
                <td className="num mono">{formatLen(r.thickness, units)}</td>
                <td>{t(`material.${r.material}` as MessageKey)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={2}>{t('table.total')}</td><td className="num mono">{total}</td><td colSpan={4} /></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
