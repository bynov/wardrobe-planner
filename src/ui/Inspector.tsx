import { segmentFree, wallSegments, minUnitWidth } from '../geometry/frames';
import { defaultGapRailHeight, layoutUnit } from '../geometry/layout';
import { unitTag, wallName } from '../drawing/views';
import { makeZone } from '../model/factory';
import { ROD_DIRS, type Gap, type RodDir } from '../model/types';
import { findColumn, useStore } from '../store/store';
import { formatLen } from '../units';
import { Segmented, Stepper, Switch } from './controls';
import { useStepLabels, ZoneCard } from './ZoneCard';
import { LENGTH_MAX, widthRange } from './zonePatch';
import { useT } from './useT';

const WIDTH_STEP = 50;
const RAIL_STEP = 10;

/**
 * A gap carries no carcass, but the empty space can still hold a wall-mounted rail — the usual
 * answer for the stretch a run has to leave free in a corner.
 */
function GapRailFields({ gap }: { gap: Gap }) {
  const project = useStore((s) => s.project);
  const updateColumn = useStore((s) => s.updateColumn);
  const { t, u, units } = useT();
  const stepLabels = useStepLabels();
  const rail = gap.rail;
  const set = (next: Gap['rail']) => updateColumn(gap.id, { rail: next });

  return (
    <div className="card gapcard">
      <Switch
        label={t('ui.gapRail')}
        checked={rail !== undefined}
        // Ticking hangs a rail at the usual reach height; unticking drops the key entirely.
        onChange={(on) => set(on ? { dir: 'along', height: defaultGapRailHeight(project) } : undefined)}
      />
      <p className="meta">{t('ui.gapRailHint')}</p>
      {rail && (
        <>
          <Segmented<RodDir>
            size="sm"
            ariaLabel={t('ui.rodDir')}
            value={rail.dir}
            options={ROD_DIRS.map((d) => ({ value: d, label: t(`ui.rodDir.${d}`) }))}
            onChange={(dir) => set({ ...rail, dir })}
          />
          <div className="field-row">
            <span className="field-label">{t('ui.gapRailHeight', { u })}</span>
            <Stepper
              step={RAIL_STEP}
              min={0}
              max={Math.max(LENGTH_MAX, rail.height)}
              units={units}
              value={rail.height}
              ariaLabel={t('ui.gapRailHeight', { u })}
              stepLabels={stepLabels(t('ui.gapRailHeight', { u }))}
              onChange={(height) => set({ ...rail, height })}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function Inspector() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.ui.selection);
  const updateColumn = useStore((s) => s.updateColumn);
  const removeColumn = useStore((s) => s.removeColumn);
  const moveColumn = useStore((s) => s.moveColumn);
  const duplicateColumn = useStore((s) => s.duplicateColumn);
  const addZone = useStore((s) => s.addZone);
  const { lang, t, u, units } = useT();
  const stepLabels = useStepLabels();

  const ref = selection.columnId ? findColumn(project, selection.columnId) : null;

  if (!ref) {
    return (
      <div className="insp empty-sel">
        <div className="empty-icon" aria-hidden="true" />
        <div className="empty-title">{t('ui.nothingSelected')}</div>
        <div className="empty-hint">{t('ui.nothingSelectedHint')}</div>
      </div>
    );
  }

  const { wall, segment, index, column } = ref;
  const plan = project.wardrobe.walls[wall];
  const siblings = plan.segments[segment];
  // Unit numbers run across both segments of the wall, matching the drawings and the cut list.
  const n = (segment === 1 ? plan.segments[0].length : 0) + index + 1;
  const tag = unitTag(lang, wall, n - 1);
  const seg = wallSegments(project, wall)[segment];
  const free = seg ? segmentFree(project, seg) : 0;
  const unit = column.kind === 'unit' ? column : null;
  const ul = unit ? layoutUnit(project, wall, segment, index, unit, 0) : null;
  const range = widthRange(column, free, minUnitWidth(project.wardrobe));

  return (
    <div className="insp">
      <div className="insp-title">
        <div className="title-row">
          <h2 className="title">{t(unit ? 'ui.unitTitle' : 'ui.gapTitle', { tag })}</h2>
          <span className="sub">{t('ui.onWall', { wall: wallName(lang, wall) })}</span>
        </div>
        {ul && (
          <div className="mono meta">
            {t('ui.interior', {
              w: formatLen(Math.round(ul.interiorWidth), units),
              h: formatLen(Math.round(ul.interiorHeight), units),
              d: formatLen(Math.round(ul.interiorDepth), units),
              u,
            })}
          </div>
        )}
      </div>

      <div className="field-row">
        <span className="field-label">{t('ui.width')}</span>
        <Stepper
          step={WIDTH_STEP}
          min={range.min}
          max={range.max}
          units={units}
          value={column.width}
          ariaLabel={t('ui.width')}
          stepLabels={stepLabels(t('ui.width'))}
          onChange={(width) => updateColumn(column.id, { width })}
        />
      </div>

      <div className="actions">
        <button type="button" className="btn" disabled={index === 0} onClick={() => moveColumn(column.id, -1)}>{t('ui.moveLeft')}</button>
        <button type="button" className="btn" disabled={index === siblings.length - 1} onClick={() => moveColumn(column.id, 1)}>{t('ui.moveRight')}</button>
        <button type="button" className="btn" disabled={free < column.width} title={free < column.width ? t('ui.noRoom') : undefined} onClick={() => duplicateColumn(column.id)}>
          {t('ui.duplicate')}
        </button>
        <button type="button" className="btn danger" onClick={() => removeColumn(column.id)}>{t('ui.remove')}</button>
      </div>

      {!unit && <GapRailFields gap={column as Gap} />}

      {unit && ul && (
        <div className="zones">
          <div className="zones-head">
            <span className="label">{t('ui.zones')}</span>
            <span className="meta">{t('ui.topToBottom')}</span>
            <button type="button" className="link" onClick={() => addZone(unit.id, makeZone('open'))}>{t('ui.addZone')}</button>
          </div>
          {[...unit.zones].reverse().map((z) => (
            <ZoneCard
              key={z.id}
              unit={unit}
              zone={z}
              zl={ul.zones.find((q) => q.zone.id === z.id)}
              count={unit.zones.length}
              active={z.id === selection.zoneId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
