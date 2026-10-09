import { useState } from 'react';
import { WALLS } from '../geometry/frames';
import { DOOR_HINGES, DOOR_SWINGS } from '../model/types';
import { useStore } from '../store/store';
import { formatLen } from '../units';
import { Segmented } from './controls';
import { NumberField } from './fields';
import { useT } from './useT';

/** Room / Door / Carcass defaults. Styled by `.room-form` (stacked labels, 42px mono inputs). */
export function RoomForm() {
  const room = useStore((s) => s.project.room);
  const door = useStore((s) => s.project.door);
  const wardrobe = useStore((s) => s.project.wardrobe);
  const setRoom = useStore((s) => s.setRoom);
  const setDoor = useStore((s) => s.setDoor);
  const setWardrobe = useStore((s) => s.setWardrobe);
  const { t, u, units } = useT();
  const [editing, setEditing] = useState(false);

  const fmt = (mm: number) => formatLen(mm, units);

  return (
    <div className="room-form">
      <section>
        <h3>{t('ui.section.room', { u })}</h3>
        <div className="grid3 lg">
          <NumberField label={t('ui.width')} value={room.width} min={1} step={10} units={units} onChange={(width) => setRoom({ width })} />
          <NumberField label={t('ui.depth')} value={room.depth} min={1} step={10} units={units} onChange={(depth) => setRoom({ depth })} />
          <NumberField label={t('ui.height')} value={room.height} min={1} step={10} units={units} onChange={(height) => setRoom({ height })} />
        </div>
      </section>

      <section>
        <h3>{t('ui.section.door', { u })}</h3>
        <div className="field-stack">
          <span>{t('ui.doorWall')}</span>
          <Segmented
            size="md"
            ariaLabel={t('ui.doorWall')}
            value={door.wall}
            options={WALLS.map((w) => ({ value: w, label: t(`wall.${w}`) }))}
            onChange={(wall) => setDoor({ wall })}
          />
        </div>
        <div className="grid3">
          <NumberField label={t('ui.doorOffset')} value={door.offset} min={0} step={10} units={units} onChange={(offset) => setDoor({ offset })} />
          <NumberField label={t('ui.doorWidth')} value={door.width} min={1} step={10} units={units} onChange={(width) => setDoor({ width })} />
          <NumberField label={t('ui.doorHeight')} value={door.height} min={1} step={10} units={units} onChange={(height) => setDoor({ height })} />
        </div>
        <div className="grid2">
          <div className="field-stack">
            <span>{t('ui.doorOpens')}</span>
            <Segmented
              size="sm"
              ariaLabel={t('ui.doorSwing')}
              value={door.swing}
              options={DOOR_SWINGS.map((v) => ({ value: v, label: t(`ui.swingOpt.${v}`) }))}
              onChange={(swing) => setDoor({ swing })}
            />
          </div>
          <div className="field-stack">
            <span>{t('ui.hingeFromInside')}</span>
            <Segmented
              size="sm"
              ariaLabel={t('ui.doorHinge')}
              value={door.hinge}
              options={DOOR_HINGES.map((v) => ({ value: v, label: t(`ui.hinge.${v}`) }))}
              onChange={(hinge) => setDoor({ hinge })}
            />
          </div>
        </div>
      </section>

      <div className="card carcass">
        <div className="carcass-head">
          <h3>{t('ui.carcassDefaults')}</h3>
          <button type="button" className="link" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>{t('ui.edit')}</button>
        </div>
        <span className="mono meta">
          {t('ui.carcassSummary', { gap: fmt(wardrobe.topGap), plinth: fmt(wardrobe.plinthHeight), panel: fmt(wardrobe.panelThickness) })}
        </span>
        {editing && (
          <div className="grid2 carcass-fields">
            <NumberField label={t('ui.topGap')} value={wardrobe.topGap} min={0} step={10} units={units} onChange={(topGap) => setWardrobe({ topGap })} />
            <NumberField label={t('ui.plinthHeight')} value={wardrobe.plinthHeight} min={0} step={10} units={units} onChange={(plinthHeight) => setWardrobe({ plinthHeight })} />
            <NumberField label={t('ui.panelThickness')} value={wardrobe.panelThickness} min={1} units={units} onChange={(panelThickness) => setWardrobe({ panelThickness })} />
            <NumberField label={t('ui.backThickness')} value={wardrobe.backThickness} min={1} units={units} onChange={(backThickness) => setWardrobe({ backThickness })} />
            <NumberField label={t('ui.doorMargin')} value={wardrobe.doorMargin} min={0} step={10} units={units} onChange={(doorMargin) => setWardrobe({ doorMargin })} />
          </div>
        )}
      </div>
    </div>
  );
}
