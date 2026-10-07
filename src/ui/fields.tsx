import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { formatLen, parseLen, type Units } from '../units';

/**
 * What a typed draft is worth in millimetres, or null while it is not (yet) a length. In `mm` the
 * box is a native number input, so anything JS reads as a finite number is taken as typed; in `in`
 * the text is a shop measurement (`23`, `23.625`, `23 5/8`, `5/8`) parsed by `parseLen`.
 */
export function commitDraft(text: string, units: Units): number | null {
  if (units === 'in') return parseLen(text, 'in');
  if (text.trim() === '') return null;
  const v = Number(text);
  return Number.isFinite(v) ? v : null;
}

/**
 * Numeric input behaviour shared by every number field: a local string draft is kept while the
 * input has focus, so clearing it or typing a half-finished value ("", "-", "1e") leaves the box
 * as the user typed it instead of snapping the old number back. The value is committed as soon as
 * the text parses to a length; on blur — and whenever the prop moves while the input is not
 * focused (undo, a preset insert, an edit from another panel) — the draft is resynced from the prop.
 * `value` and the committed number are always millimetres; `units` only decides how it is shown.
 */
export function useNumberInput(value: number, onChange: (v: number) => void, units: Units = 'mm') {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(null);
  }, [value, units]);

  return {
    // a non-finite value (an auto zone height) formats to '', i.e. an empty box
    value: draft ?? (units === 'in' ? formatLen(value, 'in') : Number.isFinite(value) ? String(value) : ''),
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      setDraft(null);
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setDraft(text);
      const v = commitDraft(text, units);
      if (v !== null) onChange(v);
    },
  };
}

/** `min`/`step` are millimetres, so they only reach the native number input of `mm` mode; an inch
 * box is free text (fractions), left for the model's validation to judge. */
const numProps = (units: Units, min: number | undefined, step: number) =>
  units === 'in' ? ({ type: 'text', inputMode: 'decimal' } as const) : ({ type: 'number', min, step } as const);

export interface NumberInputProps {
  value: number; // a non-finite value renders as an empty box (e.g. an auto zone height)
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  units?: Units;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
}

/** A bare number input (no label wrapper) for inline use, e.g. the inspector's zone rows. */
export function NumberInput({ value, onChange, min, step = 1, units = 'mm', disabled, placeholder, title }: NumberInputProps) {
  const input = useNumberInput(value, onChange, units);
  return <input {...numProps(units, min, step)} disabled={disabled} placeholder={placeholder} title={title} {...input} />;
}

export function NumberField({ label, value, onChange, min, step = 1, units = 'mm' }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number; units?: Units;
}) {
  const input = useNumberInput(value, onChange, units);
  return (
    <label className="field">
      <span>{label}</span>
      <input {...numProps(units, min, step)} {...input} />
    </label>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
