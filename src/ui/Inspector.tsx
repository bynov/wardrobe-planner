import { useState } from 'react';
import { segmentFree, wallSegments } from '../geometry/frames';
import { layoutUnit, type ZoneLayout } from '../geometry/layout';
import { wallName } from '../drawing/views';
import { tmDeep, type Lang } from '../i18n';
import { makeZone } from '../model/factory';
import { ROD_DIRS, ROD_REFS, ZONE_TYPES, type Project, type RodDir, type RodRef, type Unit, type ValidationError, type Wall, type Zone, type ZoneType } from '../model/types';
import { findColumn, useStore, type Selection } from '../store/store';
import { NumberField, NumberInput } from './fields';
import { useT } from './useT';

const COUNTED: ZoneType[] = ['shelves', 'drawers'];
/** Both zone kinds count openings, but a shelves zone's openings are compartments, not boards. */
const countKey = (type: ZoneType) => (type === 'shelves' ? 'ui.compartments' : 'ui.count');

// `walls.<wall>[.segments.<segment>.<index>][...]` — the paths validate() emits.
const WALL_PATH = /^walls\.(back|right|front|left)(?:\.segments\.([01])\.(\d+))?/;

/** What an error's path points at, so clicking it can take the user there. */
function errorTarget(p: Project, path: string): Partial<Selection> | null {
  const m = WALL_PATH.exec(path);
  if (!m) return null;
  const wall = m[1] as Wall;
  if (m[2] === undefined) return { wall, columnId: null, zoneId: null };
  const column = p.wardrobe.walls[wall].segments[Number(m[2]) as 0 | 1][Number(m[3])];
  return { wall, columnId: column?.id ?? null, zoneId: null };
}

/** One entry per distinct rendered text; repeats collapse into a ×N count. */
function dedupeErrors(lang: Lang, errors: ValidationError[]): { text: string; path: string; count: number }[] {
  const out = new Map<string, { text: string; path: string; count: number }>();
  for (const e of errors) {
    const text = tmDeep(lang, e.message);
    const seen = out.get(text);
    if (seen) seen.count += 1;
    else out.set(text, { text, path: e.path, count: 1 });
  }
  return [...out.values()];
}

/** A long list pushed the whole inspector off-screen, so it collapses past this many entries. */
const MAX_ERRORS_SHOWN = 6;

function ErrorList() {
  const project = useStore((s) => s.project);
  const errors = useStore((s) => s.errors);
  const select = useStore((s) => s.select);
  const { lang, t } = useT();
  const [expanded, setExpanded] = useState(false);
  const all = dedupeErrors(lang, errors);
  if (all.length === 0) return null;
  const collapsible = all.length > MAX_ERRORS_SHOWN;
  const hidden = collapsible && !expanded ? all.length - MAX_ERRORS_SHOWN : 0;
  const shown = hidden > 0 ? all.slice(0, MAX_ERRORS_SHOWN) : all;
  return (
    <div className="errors">
      {shown.map((e) => {
        const target = errorTarget(project, e.path);
        return (
          <button key={e.text} disabled={!target} onClick={() => target && select(target)}>
            {e.text}
            {e.count > 1 && <span className="times"> ×{e.count}</span>}
          </button>
        );
      })}
      {collapsible && (
        <button className="toggle" onClick={() => setExpanded((v) => !v)}>
          {hidden > 0 ? t('ui.moreErrors', { n: hidden }) : t('ui.lessErrors')}
        </button>
      )}
    </div>
  );
}

/** The rail line of a hanging zone: the automatic height, or an offset from either end of it. */
function RailFields({ unit, zone, zl }: { unit: Unit; zone: Zone; zl: ZoneLayout }) {
  const updateZone = useStore((s) => s.updateZone);
  const { t } = useT();
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
          <NumberInput min={0} step={10} value={rod.offset} title={t('ui.rail')} onChange={(offset) => setRod({ from: rod.from, offset })} />
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
          <span className="rail-eff">{t('ui.railHeight', { n: Math.round(rodY) })}</span>
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
  const { t } = useT();
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
            disabled={auto}
            value={zone.height ?? Number.NaN}
            placeholder={String(effective)}
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
          // A shelves count is compartments (bays), a drawers count is drawers — the label says which.
          <label title={t(countKey(zone.type))}>
            <span>{t(countKey(zone.type))}</span>
            <NumberInput min={1} step={1} value={zone.count} onChange={(count) => updateZone(unit.id, zone.id, { count })} />
          </label>
        )}
      </div>
      {zone.type === 'hanging' && zl && <RailFields unit={unit} zone={zone} zl={zl} />}
      <div className="zone-eff">{t('ui.zoneEffective', { n: effective })}</div>
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
  const { lang, t } = useT();

  const ref = selection.columnId ? findColumn(project, selection.columnId) : null;

  if (!ref) {
    return (
      <aside className="inspector">
        <ErrorList />
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
    <aside className="inspector">
      <ErrorList />
      <h3>
        {t(unit ? 'ui.column' : 'ui.gapColumn', { n })} <span className="sub">{t('ui.onWall', { wall: wallName(lang, wall) })}</span>
      </h3>
      {/* the unit is selected as a whole: say how to reach a single zone, and what Delete hits */}
      {unit && !selection.zoneId && <div className="zonehint">{t('ui.zoneHint')}</div>}

      <NumberField label={t('ui.width')} value={column.width} min={1} step={10} onChange={(width) => updateColumn(column.id, { width })} />

      <div className="row btns">
        <button disabled={index === 0} onClick={() => moveColumn(column.id, -1)}>{t('ui.moveLeft')}</button>
        <button disabled={index === siblings.length - 1} onClick={() => moveColumn(column.id, 1)}>{t('ui.moveRight')}</button>
        <button disabled={free < column.width} title={free < column.width ? t('ui.noRoom') : undefined} onClick={() => duplicateColumn(column.id)}>
          {t('ui.duplicate')}
        </button>
        <button className="danger" onClick={() => removeColumn(column.id)}>{t('ui.remove')}</button>
      </div>

      {unit && ul && (
        <>
          <div className="derived">
            {t('ui.interior', { w: Math.round(ul.interiorWidth), h: Math.round(ul.interiorHeight), d: Math.round(ul.interiorDepth) })}
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
