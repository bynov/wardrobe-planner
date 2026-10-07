export type Units = 'mm' | 'in';
export const UNITS: Units[] = ['mm', 'in'];
export const isUnits = (v: unknown): v is Units => v === 'mm' || v === 'in';
export const IN_MM = 25.4;
const SIXTEENTHS = 16;

const fmtMm = (n: number): string => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Fractional inches the way a shop reads them: whole number plus a reduced sixteenth. No feet. */
export function formatLen(mm: number, units: Units, opts: { suffix?: boolean } = {}): string {
  // An auto zone height reaches a field as NaN: it renders as an empty box, in either unit.
  if (!Number.isFinite(mm)) return '';
  if (units === 'mm') return fmtMm(mm);
  const total = Math.round((mm / IN_MM) * SIXTEENTHS);
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(total);
  const whole = Math.floor(abs / SIXTEENTHS);
  let num = abs % SIXTEENTHS, den = SIXTEENTHS;
  const g = num ? gcd(num, den) : 1;
  num /= g; den /= g;
  const body = num === 0 ? String(whole) : whole === 0 ? `${num}/${den}` : `${whole} ${num}/${den}`;
  return `${sign}${body}${opts.suffix ? '″' : ''}`;
}

/** A decimal the way it is typed mid-edit: `23`, `23.6`, `.5`, `5.` — never a sign or an exponent. */
const DEC = String.raw`(?:\d+\.?\d*|\.\d+)`;
const MM_RE = new RegExp(`^${DEC}$`);
const IN_RE = new RegExp(String.raw`^(?:(${DEC})(?:[\s-]+(\d+)\/(\d+))?|(\d+)\/(\d+))$`);

/** Millimetres are stored to the micron: an inch fraction times 25.4 is otherwise a repeating
 * binary product (`23 5/8` → 600.0749999999999) that would reach the project file verbatim. */
const MM_PRECISION = 1000;
const quantise = (mm: number): number => Math.round(mm * MM_PRECISION) / MM_PRECISION;

/** Parses a typed length in `units` and returns millimetres; null when the text is not a length. */
export function parseLen(text: string, units: Units): number | null {
  const s = text.trim();
  if (units === 'mm') {
    if (!MM_RE.test(s)) return null;
    return quantise(Number(s));
  }
  const m = IN_RE.exec(s);
  if (!m) return null;
  let inches: number;
  if (m[4] !== undefined) { const d = Number(m[5]); if (d === 0) return null; inches = Number(m[4]) / d; }
  else { inches = Number(m[1]); if (m[2] !== undefined) { const d = Number(m[3]); if (d === 0) return null; inches += Number(m[2]) / d; } }
  return quantise(inches * IN_MM);
}

/** The US is the only locale this planner meets that reads inches; everything else gets mm. */
export function detectUnits(navLang: string | undefined): Units {
  return navLang?.toLowerCase() === 'en-us' ? 'in' : 'mm';
}

export const stepFor = (units: Units): number => (units === 'mm' ? 1 : 1 / SIXTEENTHS);
export const toDisplay = (mm: number, units: Units): number => (units === 'mm' ? mm : mm / IN_MM);
export const fromDisplay = (v: number, units: Units): number => (units === 'mm' ? v : v * IN_MM);
