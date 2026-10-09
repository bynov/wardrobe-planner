import type { ZoneLayout } from '../geometry/layout';
import { ROD_DIRS, ROD_REFS, ZONE_TYPES, type RodDir, type RodRef, type Unit, type Zone, type ZoneType } from '../model/types';
import { useStore } from '../store/store';
import { formatLen } from '../units';
import { Segmented, Stepper, Switch } from './controls';
import { COUNT_MAX, LENGTH_MAX, nextZonePatch } from './zonePatch';
import { useT } from './useT';

const ZONE_HEIGHT_STEP = 10;
const RAIL_STEP = 10;
const COUNTED: ZoneType[] = ['shelves', 'drawers', 'shoes'];
/** All three count something different: shelves count compartments, drawers fronts, shoes boards. */
const countKey = (type: ZoneType) =>
  type === 'shelves' ? 'ui.compartments' : type === 'shoes' ? 'ui.shoeShelves' : 'ui.drawers';

/** Stepper button names: "Decrease · Height", so a screen reader knows which number moves. */
export function useStepLabels() {
  const { t } = useT();
  return (label: string) => ({ down: `${t('ui.decrease')} · ${label}`, up: `${t('ui.increase')} · ${label}` });
}

/** The rail line of a hanging zone: the automatic height, or an offset from either end of it. */
function RailFields({ unit, zone, zl }: { unit: Unit; zone: Zone; zl: ZoneLayout }) {
  const updateZone = useStore((s) => s.updateZone);
  const { t, u, units } = useT();
  const stepLabels = useStepLabels();
  const rod = zone.rod;
  const rodY = zl.rodY ?? zl.yTop;
  /** The offset that keeps the rail exactly where it is now, measured from `from`. */
  const offsetFrom = (from: RodRef) => Math.max(0, Math.round(from === 'top' ? zl.yTop - rodY : rodY - zl.yBot));
  const setRod = (next: Zone['rod']) => updateZone(unit.id, zone.id, { rod: next });
  // 'along' is the absence of the field, so picking it drops the key rather than writing a default.
  const setRodDir = (next: RodDir) => updateZone(unit.id, zone.id, { rodDir: next === 'along' ? undefined : next });

  return (
    <div className="rail">
      <Segmented<RodDir>
        size="sm"
        ariaLabel={t('ui.rodDir')}
        value={zl.rodDir}
        options={ROD_DIRS.map((d) => ({ value: d, label: t(`ui.rodDir.${d}`) }))}
        onChange={setRodDir}
      />
      <div className="field-row">
        <span className="field-label">{t('ui.rail')}</span>
        <Switch
          label={t('ui.auto')}
          checked={zl.rodAuto}
          // Unticking auto pins the rail at the height it already has, so nothing moves until the
          // user changes a number; ticking it hands the height back to the automatic rule.
          onChange={(auto) => setRod(auto ? undefined : { from: 'top', offset: offsetFrom('top') })}
        />
      </div>
      {rod && (
        <>
          <div className="field-row">
            <Stepper
              step={RAIL_STEP}
              min={0}
              max={LENGTH_MAX}
              units={units}
              value={rod.offset}
              ariaLabel={t('ui.rail')}
              stepLabels={stepLabels(t('ui.rail'))}
              onChange={(offset) => setRod({ from: rod.from, offset })}
            />
            <Segmented<RodRef>
              size="sm"
              ariaLabel={t('ui.rail')}
              value={rod.from}
              options={ROD_REFS.map((r) => ({ value: r, label: t(`ui.rodFrom.${r}`) }))}
              // Switching ends re-measures the same rail rather than moving it.
              onChange={(from) => setRod({ from, offset: offsetFrom(from) })}
            />
          </div>
          <span className="meta mono">{t('ui.railHeight', { n: formatLen(Math.round(rodY), units), u })}</span>
        </>
      )}
    </div>
  );
}

/** Collapsed: type glyph, name, height, AUTO badge. The selected zone expands into its editing fields. */
export function ZoneCard({ unit, zone, zl, count, active }: { unit: Unit; zone: Zone; zl: ZoneLayout | undefined; count: number; active: boolean }) {
  const select = useStore((s) => s.select);
  const updateZone = useStore((s) => s.updateZone);
  const removeZone = useStore((s) => s.removeZone);
  const moveZone = useStore((s) => s.moveZone);
  const { t, u, units } = useT();
  const stepLabels = useStepLabels();
  const effective = Math.round(zl?.height ?? 0);
  const auto = zone.height === null;
  const open = () => select({ columnId: unit.id, zoneId: zone.id });

  return (
    <div className={`zonecard${active ? ' on' : ''}`}>
      <button type="button" className="zonehead" aria-expanded={active} onClick={open}>
        <span className={`glyph glyph-${zone.type} glyph-zone`} aria-hidden="true" />
        <span className="zonename">{t(`zone.${zone.type}`)}</span>
        {auto && <span className="badge">{t('ui.autoBadge')}</span>}
        <span className="mono zoneh">{t('ui.zoneEffective', { n: formatLen(effective, units), u })}</span>
      </button>

      {active && (
        <div className="zonebody">
          <Segmented<ZoneType>
            size="sm"
            ariaLabel={t('ui.zoneType')}
            value={zone.type}
            options={ZONE_TYPES.map((z) => ({ value: z, label: t(`zone.${z}`) }))}
            onChange={(type) => updateZone(unit.id, zone.id, nextZonePatch(zone, type))}
          />
          <div className="field-row">
            <Switch
              label={t('ui.autoHeight')}
              checked={auto}
              onChange={(on) => updateZone(unit.id, zone.id, { height: on ? null : effective })}
            />
            <Stepper
              step={ZONE_HEIGHT_STEP}
              min={1}
              max={LENGTH_MAX}
              units={units}
              disabled={auto}
              value={zone.height ?? effective}
              ariaLabel={t('ui.zoneHeight')}
              stepLabels={stepLabels(t('ui.zoneHeight'))}
              onChange={(height) => updateZone(unit.id, zone.id, { height })}
            />
          </div>
          {COUNTED.includes(zone.type) && (
            // A shelves count is compartments (bays); a drawers count is drawers and a shoes count is
            // boards — the label says which.
            <div className="field-row">
              <span className="field-label">{t(countKey(zone.type))}</span>
              <Stepper
                step={1}
                min={1}
                max={COUNT_MAX}
                value={zone.count}
                ariaLabel={t(countKey(zone.type))}
                stepLabels={stepLabels(t(countKey(zone.type)))}
                onChange={(n) => updateZone(unit.id, zone.id, { count: n })}
              />
            </div>
          )}
          {zone.type === 'hanging' && zl && <RailFields unit={unit} zone={zone} zl={zl} />}
          <div className="zonefoot">
            <button type="button" className="btn ghost" disabled={zl === undefined || zl.index === count - 1} onClick={() => moveZone(unit.id, zone.id, 1)}>
              {t('ui.moveUp')}
            </button>
            <button type="button" className="btn ghost" disabled={zl === undefined || zl.index === 0} onClick={() => moveZone(unit.id, zone.id, -1)}>
              {t('ui.moveDown')}
            </button>
            <button type="button" className="btn ghost danger" disabled={count <= 1} onClick={() => removeZone(unit.id, zone.id)}>
              {t('ui.removeZone')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
