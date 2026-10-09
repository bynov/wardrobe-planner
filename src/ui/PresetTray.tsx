import { minUnitWidth } from '../geometry/frames';
import { unitTag } from '../drawing/views';
import { PRESET_KEYS, type PresetKey } from '../model/presets';
import { useStore } from '../store/store';
import { insertTarget } from './insertTarget';
import { trayState } from './trayState';
import { formatLen } from '../units';
import { NumberField } from './fields';
import { PresetGlyph } from './PresetGlyph';
import { useT } from './useT';

/** Smallest depth a wall's units may have; mirrors `error.wallDepth`. */
const MIN_WALL_DEPTH = 200;
const DEPTH_STEP = 10;

/** The shelf of presets below the canvas: where the next unit goes, how much room is there, and the cards. */
export function PresetTray() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.ui.selection);
  const insertAt = useStore((s) => s.ui.insertAt);
  const insertPreset = useStore((s) => s.insertPreset);
  const setInsertAt = useStore((s) => s.setInsertAt);
  const setWall = useStore((s) => s.setWall);
  const { lang, t, u, units } = useT();

  const plan = project.wardrobe.walls[selection.wall];
  const target = insertTarget(project, selection, insertAt);
  const { wallOff, free } = trayState(project, target);

  const l = target.label;
  const where =
    l.kind === 'slot'
      ? t('ui.atSlot', { n: l.n })
      : l.kind === 'after'
        ? t('ui.afterUnit', { label: l.isGap ? t('ui.gapColumn', { n: l.tagIndex + 1 }) : unitTag(lang, target.wall, l.tagIndex) })
        : t('ui.atEnd');

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
          <span className={`mono tray-free${!wallOff && free < 0 ? ' danger' : ''}`}>
            {wallOff ? t('ui.trayWallOff') : free < 0 ? t('ui.overflowBy', { n: formatLen(Math.round(-free), units), u }) : t('ui.freeWidth', { n: formatLen(Math.round(free), units), u })}
          </span>
        </span>
      </div>
      <div className="tray-grid">
        {PRESET_KEYS.map((key) => {
          const disabled = wallOff || (key === 'gap' ? free <= 0 : free < minUnitWidth(project.wardrobe));
          return (
            <button key={key} className="preset" disabled={disabled} title={disabled ? (wallOff ? t('ui.trayWallOff') : t('ui.noRoom')) : undefined} onClick={() => pick(key)}>
              <PresetGlyph preset={key} />
              {t(`preset.${key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
