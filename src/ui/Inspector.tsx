import { useEffect, useRef } from 'react';
import { segmentFree, wallSegments } from '../geometry/frames';
import { defaultGapRailHeight, layoutUnit, type ZoneLayout } from '../geometry/layout';
import { wallName } from '../drawing/views';
import { makeZone } from '../model/factory';
import { ROD_DIRS, ROD_REFS, ZONE_TYPES, type Gap, type RodDir, type RodRef, type Unit, type Zone, type ZoneType } from '../model/types';
import { findColumn, useStore } from '../store/store';
import { formatLen } from '../units';
import { NumberField, NumberInput, SelectField } from './fields';
import { useT } from './useT';
import { NARROW_QUERY, useMediaQuery } from './useMediaQuery';

const COUNTED: ZoneType[] = ['shelves', 'drawers', 'shoes'];
/** All three count something different: shelves count compartments, drawers fronts, shoes boards. */
const countKey = (type: ZoneType) =>
  type === 'shelves' ? 'ui.compartments' : type === 'shoes' ? 'ui.shoeShelves' : 'ui.count';

/** The rail line of a hanging zone: the automatic height, or an offset from either end of it. */
function RailFields({ unit, zone, zl }: { unit: Unit; zone: Zone; zl: ZoneLayout }) {
  const updateZone = useStore((s) => s.updateZone);
  const { t, u, units } = useT();
  const rod = zone.rod;
  const rodY = zl.rodY ?? zl.yTop;
  /** The offset that keeps the rail exactly where it is now, measured from `from`. */
  const offsetFrom = (from: RodRef) => Math.max(0, Math.round(from === 'top' ? zl.yTop - rodY : rodY - zl.yBot));
  const setRod = (next: Zone['rod']) => updateZone(unit.id, zone.id, { rod: next });
  // 'along' is the absence of the field, so picking it drops the key rather than writing a default.
  const setRodDir = (next: RodDir) => updateZone(unit.id, zone.id, { rodDir: next === 'along' ? undefined : next });

  return (
    <div className="zone-fields rail">
      <select
        value={zl.rodDir}
        title={t('ui.rodDir')}
        onChange={(e) => setRodDir(e.target.value as RodDir)}
      >
        {ROD_DIRS.map((d) => (
          <option key={d} value={d}>{t(`ui.rodDir.${d}`)}</option>
        ))}
      </select>
      <span className="rail-label">{t('ui.rail')}</span>
      <label className="chk">
        <input
          type="checkbox"
          checked={zl.rodAuto}
          // Unticking auto pins the rail at the height it already has, so nothing moves until the
          // user changes a number; ticking it hands the height back to the automatic rule.
          onChange={(e) => setRod(e.target.checked ? undefined : { from: 'top', offset: offsetFrom('top') })}
        />
        <span>{t('ui.auto')}</span>
      </label>
      {rod && (
        <>
          <NumberInput min={0} step={10} units={units} value={rod.offset} title={t('ui.rail')} onChange={(offset) => setRod({ from: rod.from, offset })} />
          <select
            value={rod.from}
            title={t('ui.rail')}
            // Switching ends re-measures the same rail rather than moving it.
            onChange={(e) => setRod({ from: e.target.value as RodRef, offset: offsetFrom(e.target.value as RodRef) })}
          >
            {ROD_REFS.map((r) => (
              <option key={r} value={r}>{t(`ui.rodFrom.${r}`)}</option>
            ))}
          </select>
          <span className="rail-eff">{t('ui.railHeight', { n: formatLen(Math.round(rodY), units), u })}</span>
        </>
      )}
    </div>
  );
}

function ZoneRow({ unit, zone, zl, count, active }: { unit: Unit; zone: Zone; zl: ZoneLayout | undefined; count: number; active: boolean }) {
  const select = useStore((s) => s.select);
  const updateZone = useStore((s) => s.updateZone);
  const removeZone = useStore((s) => s.removeZone);
  const moveZone = useStore((s) => s.moveZone);
  const { t, u, units } = useT();
  const effective = Math.round(zl?.height ?? 0);
  const auto = zone.height === null;

  return (
    <div className={`zone-row${active ? ' active' : ''}`} onClick={() => select({ columnId: unit.id, zoneId: zone.id })}>
      <select
        value={zone.type}
        title={t('ui.zoneType')}
        onChange={(e) => updateZone(unit.id, zone.id, { type: e.target.value as ZoneType })}
      >
        {ZONE_TYPES.map((z) => (
          <option key={z} value={z}>{t(`zone.${z}`)}</option>
        ))}
      </select>
      <div className="zone-btns" onClick={(e) => e.stopPropagation()}>
        <button title={t('ui.moveUp')} disabled={zl === undefined || zl.index === count - 1} onClick={() => moveZone(unit.id, zone.id, 1)}>
          {t('ui.moveUp')}
        </button>
        <button title={t('ui.moveDown')} disabled={zl === undefined || zl.index === 0} onClick={() => moveZone(unit.id, zone.id, -1)}>
          {t('ui.moveDown')}
        </button>
        <button className="danger" title={t('ui.remove')} disabled={count <= 1} onClick={() => removeZone(unit.id, zone.id)}>
          ✕
        </button>
      </div>

      <div className="zone-fields">
        <label title={t('ui.zoneHeight')}>
          <span>{t('ui.zoneHeight')}</span>
          <NumberInput
            min={1}
            step={10}
            units={units}
            disabled={auto}
            value={zone.height ?? Number.NaN}
            placeholder={formatLen(effective, units)}
            onChange={(height) => updateZone(unit.id, zone.id, { height })}
          />
        </label>
        <label className="chk">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => updateZone(unit.id, zone.id, { height: e.target.checked ? null : effective })}
          />
          <span>{t('ui.auto')}</span>
        </label>
        {COUNTED.includes(zone.type) && (
          // A shelves count is compartments (bays); a drawers count is drawers and a shoes count is
          // boards — the label says which.
          <label title={t(countKey(zone.type))}>
            <span>{t(countKey(zone.type))}</span>
            <NumberInput min={1} step={1} value={zone.count} onChange={(count) => updateZone(unit.id, zone.id, { count })} />
          </label>
        )}
      </div>
      {zone.type === 'hanging' && zl && <RailFields unit={unit} zone={zone} zl={zl} />}
      <div className="zone-eff">{t('ui.zoneEffective', { n: formatLen(effective, units), u })}</div>
    </div>
  );
}

/**
 * A gap carries no carcass, but the empty space can still hold a wall-mounted rail — the usual
 * answer for the stretch a run has to leave free in a corner.
 */
function GapRailFields({ gap }: { gap: Gap }) {
  const project = useStore((s) => s.project);
  const updateColumn = useStore((s) => s.updateColumn);
  const { t, u, units } = useT();
  const rail = gap.rail;
  const set = (next: Gap['rail']) => updateColumn(gap.id, { rail: next });

  return (
    <div className="gap-rail">
      <label className="chk wide">
        <input
          type="checkbox"
          checked={rail !== undefined}
          // Ticking hangs a rail at the usual reach height; unticking drops the key entirely.
          onChange={(e) => set(e.target.checked ? { dir: 'along', height: defaultGapRailHeight(project) } : undefined)}
        />
        <span>{t('ui.gapRail')}</span>
      </label>
      {rail && (
        <>
          <SelectField<RodDir>
            label={t('ui.rodDir')}
            value={rail.dir}
            options={ROD_DIRS.map((d) => ({ value: d, label: t(`ui.rodDir.${d}`) }))}
            onChange={(dir) => set({ ...rail, dir })}
          />
          <NumberField
            label={t('ui.gapRailHeight', { u })}
            value={rail.height}
            min={0}
            step={10}
            units={units}
            onChange={(height) => set({ ...rail, height })}
          />
        </>
      )}
    </div>
  );
}

export function Inspector() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.ui.selection);
  const rootRef = useRef<HTMLElement>(null);
  const narrow = useMediaQuery(NARROW_QUERY);
  const updateColumn = useStore((s) => s.updateColumn);
  const removeColumn = useStore((s) => s.removeColumn);
  const moveColumn = useStore((s) => s.moveColumn);
  const duplicateColumn = useStore((s) => s.duplicateColumn);
  const addZone = useStore((s) => s.addZone);
  const { lang, t, u, units } = useT();

  const ref = selection.columnId ? findColumn(project, selection.columnId) : null;

  // Stacked on a phone the inspector sits below the elevation, so a selection made up there would
  // otherwise change something off-screen. Wide screens keep all three panes in view already.
  useEffect(() => {
    if (narrow && selection.columnId) rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [narrow, selection.columnId, selection.zoneId]);

  if (!ref) {
    return (
      <aside className="inspector" ref={rootRef}>
        <div className="hint">{t('ui.selectHint')}</div>
      </aside>
    );
  }

  const { wall, segment, index, column } = ref;
  const plan = project.wardrobe.walls[wall];
  const siblings = plan.segments[segment];
  const n = (segment === 1 ? plan.segments[0].length : 0) + index + 1;
  const seg = wallSegments(project, wall)[segment];
  const free = seg ? segmentFree(project, seg) : 0;
  const unit = column.kind === 'unit' ? column : null;
  const ul = unit ? layoutUnit(project, wall, segment, index, unit, 0) : null;

  return (
    <aside className="inspector" ref={rootRef}>
      <h3>
        {t(unit ? 'ui.column' : 'ui.gapColumn', { n })} <span className="sub">{t('ui.onWall', { wall: wallName(lang, wall) })}</span>
      </h3>
      {/* the unit is selected as a whole: say how to reach a single zone, and what Delete hits */}
      {unit && !selection.zoneId && <div className="zonehint">{t('ui.zoneHint')}</div>}

      <NumberField label={t('ui.width')} value={column.width} min={1} step={10} units={units} onChange={(width) => updateColumn(column.id, { width })} />

      <div className="row btns">
        <button disabled={index === 0} onClick={() => moveColumn(column.id, -1)}>{t('ui.moveLeft')}</button>
        <button disabled={index === siblings.length - 1} onClick={() => moveColumn(column.id, 1)}>{t('ui.moveRight')}</button>
        <button disabled={free < column.width} title={free < column.width ? t('ui.noRoom') : undefined} onClick={() => duplicateColumn(column.id)}>
          {t('ui.duplicate')}
        </button>
        <button className="danger" onClick={() => removeColumn(column.id)}>{t('ui.remove')}</button>
      </div>

      {!unit && <GapRailFields gap={column as Gap} />}

      {unit && ul && (
        <>
          <div className="derived">
            {t('ui.interior', {
              w: formatLen(Math.round(ul.interiorWidth), units),
              h: formatLen(Math.round(ul.interiorHeight), units),
              d: formatLen(Math.round(ul.interiorDepth), units),
              u,
            })}
          </div>
          <h4>{t('ui.zones')}</h4>
          {[...unit.zones].reverse().map((z) => (
            <ZoneRow
              key={z.id}
              unit={unit}
              zone={z}
              zl={ul.zones.find((q) => q.zone.id === z.id)}
              count={unit.zones.length}
              active={z.id === selection.zoneId}
            />
          ))}
          <button className="wide" onClick={() => addZone(unit.id, makeZone('open'))}>{t('ui.addZone')}</button>
        </>
      )}
    </aside>
  );
}
