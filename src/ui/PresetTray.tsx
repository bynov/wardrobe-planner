import { minUnitWidth, segmentFree, wallSegments } from '../geometry/frames';
import { unitTag } from '../drawing/views';
import { PRESET_KEYS, type PresetKey } from '../model/presets';
import { findColumn, useStore, type InsertSlot } from '../store/store';
import { formatLen } from '../units';
import { NumberField } from './fields';
import { PresetGlyph } from './PresetGlyph';
import { useT } from './useT';

/** Smallest depth a wall's units may have; mirrors `error.wallDepth`. */
const MIN_WALL_DEPTH = 200;
const DEPTH_STEP = 10;

/** The unit-tag index of a column: its position across both segments of its wall. */
const tagIndex = (segment: 0 | 1, index: number, firstSegmentLength: number) => (segment === 1 ? firstSegmentLength : 0) + index;

/** The shelf of presets below the canvas: where the next unit goes, how much room is there, and the cards. */
export function PresetTray() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.ui.selection);
  const insertAt = useStore((s) => s.ui.insertAt);
  const insertPreset = useStore((s) => s.insertPreset);
  const setInsertAt = useStore((s) => s.setInsertAt);
  const setWall = useStore((s) => s.setWall);
  const { lang, t, u, units } = useT();

  const ref = selection.columnId ? findColumn(project, selection.columnId) : null;
  const plan = project.wardrobe.walls[selection.wall];
  // Where a click on a card lands: the chosen slot, else right after the selected column, else the end.
  const target: InsertSlot = insertAt ?? (ref ? { wall: ref.wall, segment: ref.segment, index: ref.index + 1 } : { wall: selection.wall, segment: 0, index: plan.segments[0].length });

  const seg = wallSegments(project, target.wall)[target.segment];
  const free = seg ? segmentFree(project, seg) : 0;

  let where: string;
  if (insertAt) where = t('ui.atSlot', { n: insertAt.index + 1 });
  else if (ref) {
    const n = tagIndex(ref.segment, ref.index, project.wardrobe.walls[ref.wall].segments[0].length);
    where = t('ui.afterUnit', { label: ref.column.kind === 'unit' ? unitTag(lang, ref.wall, n) : t('ui.gapColumn', { n: n + 1 }) });
  } else where = t('ui.atEnd');

  const pick = (key: PresetKey) => {
    insertPreset(target.wall, target.segment, target.index, key);
    setInsertAt(null);
  };

  return (
    <div className="tray">
      <div className="tray-head">
        <span className="tray-title">
          {t('ui.addUnit')} <span className="tray-where">{where}</span>
        </span>
        <span className="tray-right">
          {plan.enabled && (
            <NumberField
              label={t('ui.wallDepth', { u })}
              value={plan.depth}
              min={MIN_WALL_DEPTH}
              step={DEPTH_STEP}
              units={units}
              onChange={(depth) => setWall(selection.wall, { depth })}
            />
          )}
          <span className={`mono tray-free${free < 0 ? ' danger' : ''}`}>{t('ui.freeWidth', { n: formatLen(Math.round(free), units), u })}</span>
        </span>
      </div>
      <div className="tray-grid">
        {PRESET_KEYS.map((key) => {
          const disabled = key === 'gap' ? free <= 0 : free < minUnitWidth(project.wardrobe);
          return (
            <button key={key} className="preset" disabled={disabled} title={disabled ? t('ui.noRoom') : undefined} onClick={() => pick(key)}>
              <PresetGlyph preset={key} />
              {t(`preset.${key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
