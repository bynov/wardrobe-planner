import { unitTag, wallName } from '../drawing/views';
import { findColumn, useStore } from '../store/store';
import { formatLen } from '../units';
import { IconButton } from './controls';
import { ErrorBanner } from './ErrorBanner';
import { Inspector } from './Inspector';
import { PresetTray } from './PresetTray';
import { useT } from './useT';

/**
 * The phone's bottom sheet. Collapsed it summarises the selected column (title, size, zone chips)
 * and offers Edit; expanded it holds the inspector, or the preset tray after a "+" tap. Selecting
 * a unit never changes `sheetOpen`: only the grabber, Edit, a "+" and an insert do.
 */
export function BottomSheet() {
  const project = useStore((s) => s.project);
  const columnId = useStore((s) => s.ui.selection.columnId);
  const open = useStore((s) => s.ui.sheetOpen);
  const view = useStore((s) => s.ui.sheetView);
  const hasErrors = useStore((s) => s.errors.length > 0);
  const setUi = useStore((s) => s.setUi);
  const { lang, t, u, units } = useT();

  const ref = columnId ? findColumn(project, columnId) : null;
  const toggle = () => setUi(open ? { sheetOpen: false } : { sheetOpen: true, sheetView: 'inspector' });

  let title = t('ui.nothingSelected');
  let meta = t('ui.nothingSelectedHint');
  if (ref) {
    const { wall, segment, index, column } = ref;
    const plan = project.wardrobe.walls[wall];
    // Unit numbers run across both segments of the wall, as in the inspector and the drawings.
    const tag = unitTag(lang, wall, (segment === 1 ? plan.segments[0].length : 0) + index);
    title = t(column.kind === 'unit' ? 'ui.unitTitle' : 'ui.gapTitle', { tag });
    meta = t('ui.sheetMeta', { w: `${formatLen(column.width, units)} ${u}`, wall: wallName(lang, wall) });
  }
  const zones = ref?.column.kind === 'unit' ? [...ref.column.zones].reverse() : [];

  return (
    <div className={`sheet${open ? ' open' : ''}`}>
      <button type="button" className="grabber" aria-label={t(open ? 'ui.close' : 'ui.edit')} aria-expanded={open} onClick={toggle}>
        <span />
      </button>
      {open ? (
        <div className="sheet-body">
          <div className="sheet-close"><IconButton label={t('ui.close')} onClick={toggle}>×</IconButton></div>
          {view === 'tray' ? (
            <PresetTray />
          ) : (
            <>
              {hasErrors && <ErrorBanner />}
              <Inspector />
            </>
          )}
        </div>
      ) : (
        <div className="sheet-summary">
          <div className="sheet-head">
            <div className="sheet-titles">
              <span className="sheet-title">{title}</span>
              <span className="mono meta">{meta}</span>
            </div>
            {ref && <button type="button" className="btn" onClick={toggle}>{t('ui.edit')}</button>}
          </div>
          <div className="sheet-chips">
            {zones.map((z) => (
              <span key={z.id} className="chip">
                <span className={`glyph glyph-${z.type} glyph-chip`} aria-hidden="true" />
                {t(`zone.${z.type}`)}
                {z.count > 1 && z.type !== 'hanging' ? ` ×${z.count}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
