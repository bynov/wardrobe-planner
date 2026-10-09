import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Units } from '../units';
import { useNumberInput } from './fields';

/** Glyphs for the stepper buttons (U+2212 minus, not a hyphen). */
const MINUS = '−';
const PLUS = '+';
/** Gap between a trigger and its menu, px. */
const MENU_GAP = 6;

/** `value + delta` kept inside `[min, max]`; a `max` below `min` yields `min`. */
export function clampStep(value: number, delta: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value + delta));
}

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

export function Segmented<T extends string>({ value, options, onChange, size = 'md', mono, ariaLabel }: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  mono?: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('seg', `seg-${size}`, mono && 'mono')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={o.value === value ? 'on' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, step, min, max, units = 'mm', ariaLabel }: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  units?: Units;
  ariaLabel: string;
}) {
  const input = useNumberInput(value, onChange, units);
  return (
    <div className="stepper mono" role="group" aria-label={ariaLabel}>
      <button type="button" aria-label={`${ariaLabel} ${MINUS}`} onClick={() => onChange(clampStep(value, -step, min, max))}>
        {MINUS}
      </button>
      <input type="text" inputMode="decimal" aria-label={ariaLabel} {...input} />
      <button type="button" aria-label={`${ariaLabel} ${PLUS}`} onClick={() => onChange(clampStep(value, step, min, max))}>
        {PLUS}
      </button>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden />
      <span className="switch-label">{label}</span>
    </label>
  );
}

export function IconButton({ label, onClick, disabled, children }: {
  label: string; onClick: () => void; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button type="button" className="icon" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/**
 * A popover that closes on outside mousedown and on Escape. The Escape is swallowed in the capture
 * phase so `useKeyboard` (on window) does not also clear the selection underneath. The parent
 * should wrap the trigger and the menu in a `position: relative` box and treat clicks on the
 * trigger as its own toggle (the trigger is outside the menu, so mousedown on it calls `onClose`).
 */
export function Menu({ open, onClose, anchor, width, children }: {
  open: boolean; onClose: () => void; anchor: 'left' | 'right'; width: number; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div ref={ref} className="menu" role="menu" style={{ width, top: '100%', marginTop: MENU_GAP, [anchor]: 0 }}>
      {children}
    </div>
  );
}

export function MenuItem({ onClick, children, meta, danger, active }: {
  onClick: () => void; children: ReactNode; meta?: ReactNode; danger?: boolean; active?: boolean;
}) {
  return (
    <button type="button" role="menuitem" className={cx('menu-item', danger && 'danger', active && 'on')} onClick={onClick}>
      <span>{children}</span>
      {meta !== undefined && <span className="meta">{meta}</span>}
    </button>
  );
}
