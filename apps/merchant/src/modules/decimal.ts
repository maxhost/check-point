import { ModuleError } from "./errors";

/**
 * Spec 0210 §Formato de numeros — DECIMALES EXACTOS de los modulos. Un valor es un `bigint` escalado
 * (`"12.50"` con escala 2 es `1250n`): nada de `number` en dinero ni en cantidades, asi una suma de
 * costos no arrastra el error de coma flotante.
 *
 * Entrada: `number` o string decimal (`"1.5"`, `"-2"`). Mas decimales que la columna, exponentes,
 * `NaN`, otro tipo o mas digitos enteros de los que entran en la columna → 422 `invalid_number`.
 */

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

export type DecimalSpec = {
  /** Decimales de la columna (`numeric(p, s)` → `s`). */
  scale: number;
  /** Digitos enteros que entran (`p − s`). */
  intDigits: number;
  /** Como se llama el campo en el mensaje. */
  label: string;
};

export function invalidNumber(label: string): ModuleError {
  return new ModuleError(
    422,
    "invalid_number",
    `${label} tiene que ser un número válido.`,
  );
}

export function parseDecimal(raw: unknown, spec: DecimalSpec): bigint {
  let text: string;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw invalidNumber(spec.label);
    text = String(raw);
  } else if (typeof raw === "string") {
    text = raw.trim();
  } else {
    throw invalidNumber(spec.label);
  }
  const match = DECIMAL.exec(text);
  if (!match) throw invalidNumber(spec.label);
  const [, minus, int, frac = ""] = match;
  if (frac.length > spec.scale) throw invalidNumber(spec.label);
  if (int.replace(/^0+/, "").length > spec.intDigits) {
    throw invalidNumber(spec.label);
  }
  const units = BigInt(int + frac.padEnd(spec.scale, "0"));
  return minus ? -units : units;
}

/** Un `numeric` que devuelve el driver (string) a unidades escaladas. Mas decimales se redondean. */
export function fromDb(value: string, scale: number): bigint {
  const match = DECIMAL.exec(value.trim());
  if (!match) throw new Error(`numeric inesperado de la base: ${value}`);
  const [, minus, int, frac = ""] = match;
  let units: bigint;
  if (frac.length <= scale) {
    units = BigInt(int + frac.padEnd(scale, "0"));
  } else {
    const exact = BigInt(int + frac);
    units = roundDiv(exact, 10n ** BigInt(frac.length - scale));
  }
  return minus ? -units : units;
}

/** `units` con `scale` decimales a string (`1250n`, 2 → `"12.50"`). */
export function formatDecimal(units: bigint, scale: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units)
    .toString()
    .padStart(scale + 1, "0");
  const int = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale);
  return `${negative ? "-" : ""}${int}${scale > 0 ? `.${frac}` : ""}`;
}

/** `num / den` redondeado al entero, mitades lejos del cero (como `round()` de Postgres). */
export function roundDiv(num: bigint, den: bigint): bigint {
  if (den === 0n) throw new RangeError("division por cero");
  const negative = num < 0n !== den < 0n;
  const n = num < 0n ? -num : num;
  const d = den < 0n ? -den : den;
  const q = (2n * n + d) / (2n * d);
  return negative ? -q : q;
}

/** Cambia la escala de `units` (de `from` a `to` decimales), redondeando si achica. */
export function rescale(units: bigint, from: number, to: number): bigint {
  if (to >= from) return units * 10n ** BigInt(to - from);
  return roundDiv(units, 10n ** BigInt(from - to));
}
