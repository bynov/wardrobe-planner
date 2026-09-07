import { useEffect, useRef } from 'react';
import { GAP_DEFAULT_WIDTH, PRESET_DEFAULT_WIDTH, PRESET_KEYS, type PresetKey } from '../model/presets';
import { useT } from './useT';

export interface SpawnMenuProps {
  x: number;
  y: number;
  free: number;
  minWidth: number;
  onPick: (key: PresetKey) => void;
  onClose: () => void;
}

export function SpawnMenu({ x, y, free, minWidth, onPick, onClose }: SpawnMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useT();

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <div className="menu" ref={ref} style={{ left: x, top: y }}>
      <div className="title">{t('ui.spawnTitle')}</div>
      {PRESET_KEYS.map((k) => {
        const disabled = k === 'gap' ? free <= 0 : free < minWidth;
        const width = Math.min(k === 'gap' ? GAP_DEFAULT_WIDTH : PRESET_DEFAULT_WIDTH, free);
        return (
          <button key={k} disabled={disabled} onClick={() => onPick(k)}>
            <span>{t(`preset.${k}`)}</span>
            <span className="derived">{disabled ? t('ui.noRoom') : t('ui.spawnWidth', { n: Math.round(width) })}</span>
          </button>
        );
      })}
    </div>
  );
}
