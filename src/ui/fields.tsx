import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';

/**
 * Numeric input behaviour shared by every number field: a local string draft is kept while the
 * input has focus, so clearing it or typing a half-finished value ("", "-", "1e") leaves the box
 * as the user typed it instead of snapping the old number back. The value is committed as soon as
 * the text parses to a finite number; on blur — and whenever the prop moves while the input is not
 * focused (undo, a preset insert, an edit from another panel) — the draft is resynced from the prop.
 */
export function useNumberInput(value: number, onChange: (v: number) => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(null);
  }, [value]);

  return {
    value: draft ?? (Number.isFinite(value) ? String(value) : ''),
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
      const v = Number(text);
      if (text.trim() !== '' && Number.isFinite(v)) onChange(v);
    },
  };
}

export interface NumberInputProps {
  value: number; // a non-finite value renders as an empty box (e.g. an auto zone height)
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
}

/** A bare number input (no label wrapper) for inline use, e.g. the inspector's zone rows. */
export function NumberInput({ value, onChange, min, step = 1, disabled, placeholder, title }: NumberInputProps) {
  const input = useNumberInput(value, onChange);
  return <input type="number" min={min} step={step} disabled={disabled} placeholder={placeholder} title={title} {...input} />;
}

export function NumberField({ label, value, onChange, min, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number;
}) {
  const input = useNumberInput(value, onChange);
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={min} step={step} {...input} />
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
