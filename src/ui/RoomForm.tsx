import { WALLS } from '../geometry/frames';
import { DOOR_HINGES, DOOR_SWINGS, type DoorHinge, type DoorSwing, type Wall } from '../model/types';
import { useStore } from '../store/store';
import { NumberField, Section, SelectField } from './fields';
import { useT } from './useT';

export function RoomForm() {
  const room = useStore((s) => s.project.room);
  const door = useStore((s) => s.project.door);
  const wardrobe = useStore((s) => s.project.wardrobe);
  const setRoom = useStore((s) => s.setRoom);
  const setDoor = useStore((s) => s.setDoor);
  const setWardrobe = useStore((s) => s.setWardrobe);
  const { t } = useT();

  const wallOptions = WALLS.map((w) => ({ value: w, label: t(`wall.${w}`) }));
  const swingOptions: { value: DoorSwing; label: string }[] =
    DOOR_SWINGS.map((v) => ({ value: v, label: t(`ui.swingOpt.${v}`) }));
  const hingeOptions: { value: DoorHinge; label: string }[] =
    DOOR_HINGES.map((v) => ({ value: v, label: t(`ui.hinge.${v}`) }));

  return (
    <div className="forms">
      <Section title={t('ui.section.room')}>
        <NumberField label={t('ui.width')} value={room.width} min={1} step={10} onChange={(width) => setRoom({ width })} />
        <NumberField label={t('ui.depth')} value={room.depth} min={1} step={10} onChange={(depth) => setRoom({ depth })} />
        <NumberField label={t('ui.height')} value={room.height} min={1} step={10} onChange={(height) => setRoom({ height })} />
      </Section>

      <Section title={t('ui.section.door')}>
        <SelectField<Wall> label={t('ui.doorWall')} value={door.wall} options={wallOptions} onChange={(wall) => setDoor({ wall })} />
        <NumberField label={t('ui.doorOffset')} value={door.offset} min={0} step={10} onChange={(offset) => setDoor({ offset })} />
        <NumberField label={t('ui.doorWidth')} value={door.width} min={1} step={10} onChange={(width) => setDoor({ width })} />
        <NumberField label={t('ui.doorHeight')} value={door.height} min={1} step={10} onChange={(height) => setDoor({ height })} />
        <SelectField<DoorSwing> label={t('ui.doorSwing')} value={door.swing} options={swingOptions} onChange={(swing) => setDoor({ swing })} />
        <SelectField<DoorHinge> label={t('ui.doorHinge')} value={door.hinge} options={hingeOptions} onChange={(hinge) => setDoor({ hinge })} />
        <NumberField
          label={t('ui.doorMargin')}
          value={wardrobe.doorMargin}
          min={0}
          step={10}
          onChange={(doorMargin) => setWardrobe({ doorMargin })}
        />
      </Section>

      <Section title={t('ui.section.wardrobe')}>
        <NumberField label={t('ui.topGap')} value={wardrobe.topGap} min={0} step={10} onChange={(topGap) => setWardrobe({ topGap })} />
        <NumberField
          label={t('ui.plinthHeight')}
          value={wardrobe.plinthHeight}
          min={0}
          step={10}
          onChange={(plinthHeight) => setWardrobe({ plinthHeight })}
        />
        <NumberField
          label={t('ui.panelThickness')}
          value={wardrobe.panelThickness}
          min={1}
          onChange={(panelThickness) => setWardrobe({ panelThickness })}
        />
        <NumberField
          label={t('ui.backThickness')}
          value={wardrobe.backThickness}
          min={1}
          onChange={(backThickness) => setWardrobe({ backThickness })}
        />
      </Section>
    </div>
  );
}
