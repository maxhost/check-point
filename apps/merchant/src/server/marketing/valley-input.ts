import type { FieldErrors } from "./campaign-input";
import { type CouponDeal, parseCoupon } from "./reward-input";
import type { TemplateDefinition } from "./templates";
import type { ValleyWindow } from "./valley-rules";

/**
 * THE «HORAS VALLE» HALVES OF TWO BODIES (spec 0113 / ADR 0105). PURE.
 *
 * 1. `enable` (`parseTemplateInput`, the mirror of `cross-input.ts`):
 *  - In `valley`: no `channels` (its only surface is «Mis beneficios»), no excluded doors
 *    (an empty list is accepted), no `couponMaxRedemptions` (the brake is the monthly cap)
 *    — present → 400 on that field. The coupon is MANDATORY and it is the ONLY template
 *    that admits `couponKind: "custom"` (V8). `welcome*` and `cross*` are refused by their
 *    own parsers like in any template that is not theirs.
 *  - `valleyMonthlyCap` 1..10000, def. 50 (V5). In ANY OTHER template it is a 400.
 *
 * 2. `PUT /api/marketing/valley/locations/{id}/windows`: the merchant's own windows — at
 *    least one, whole hours of ONE day, not overlapping on the same day.
 */

export type ValleyParams = { valleyMonthlyCap: number | null };

const absent = (raw: unknown) => raw === undefined || raw === null;

/** Only the valley parameter of a wider input, ready for an insert. */
export function pickValley(input: ValleyParams): ValleyParams {
  return { valleyMonthlyCap: input.valleyMonthlyCap };
}

/** The monthly cap, or `undefined` with its error written. */
export function valleyParams(
  errors: FieldErrors,
  body: Record<string, unknown>,
  template: TemplateDefinition,
): ValleyParams | undefined {
  const def = template.valley;
  if (!def) {
    if (absent(body.valleyMonthlyCap)) return { valleyMonthlyCap: null };
    errors.valleyMonthlyCap = "Este campo es solo de la campaña «Horas valle».";
    return undefined;
  }
  const cap = absent(body.valleyMonthlyCap)
    ? def.monthlyCap.default
    : body.valleyMonthlyCap;
  if (
    typeof cap !== "number" ||
    !Number.isInteger(cap) ||
    cap < def.monthlyCap.min ||
    cap > def.monthlyCap.max
  ) {
    errors.valleyMonthlyCap = `El tope mensual tiene que ser un entero entre ${def.monthlyCap.min} y ${def.monthlyCap.max}.`;
    return undefined;
  }
  return { valleyMonthlyCap: cap };
}

/**
 * The shape rules of a `valley` body and its MANDATORY coupon without a redemption cap.
 * Same parser as the composer (spec 0106) with `custom` allowed, fed a placeholder cap
 * that is dropped — exactly as `crossDeal` does.
 */
export function valleyDeal(
  errors: FieldErrors,
  body: Record<string, unknown>,
): CouponDeal | undefined {
  if (!absent(body.channels))
    errors.channels =
      "Horas valle no sale por un canal: aparece en «Mis beneficios».";
  if (
    !absent(body.excludedLocationIds) &&
    !(
      Array.isArray(body.excludedLocationIds) &&
      body.excludedLocationIds.length === 0
    )
  )
    errors.excludedLocationIds = "Horas valle no excluye locales.";
  if (!absent(body.couponMaxRedemptions)) {
    errors.couponMaxRedemptions =
      "Horas valle no lleva tope de canjes: el freno es el tope mensual.";
    return undefined;
  }
  if (absent(body.couponLabel) || absent(body.couponCost)) {
    errors.couponLabel =
      "Horas valle necesita un premio: etiqueta y costo estimado.";
    return undefined;
  }
  const deal = parseCoupon(errors, { ...body, couponMaxRedemptions: 1 }, true);
  return deal && { ...deal, couponMaxRedemptions: null };
}

export type WindowsParse =
  | { ok: true; windows: ValleyWindow[] }
  | { ok: false; fields: Record<string, string> };

const whole = (raw: unknown, min: number, max: number): raw is number =>
  typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= max;

/** The body `{ windows: [{ weekday, startHour, endHour }] }` of the merchant's `PUT`. */
export function parseValleyWindows(value: unknown): WindowsParse {
  const body =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const raw = body.windows;
  if (!Array.isArray(raw) || raw.length === 0)
    return {
      ok: false,
      fields: {
        windows:
          "Cargá al menos una franja (para volver a las de la red, borralas).",
      },
    };
  const fields: Record<string, string> = {};
  const windows: ValleyWindow[] = [];
  raw.forEach((item: unknown, index) => {
    const w = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >;
    if (
      !whole(w.weekday, 1, 7) ||
      !whole(w.startHour, 0, 23) ||
      !whole(w.endHour, 1, 24) ||
      w.endHour <= w.startHour
    ) {
      fields[`windows.${index}`] =
        "Cada franja es un día (1 a 7) y horas enteras de 0 a 24, con el fin después del inicio.";
      return;
    }
    const clash = windows.findIndex(
      (other) =>
        other.weekday === w.weekday &&
        other.startHour < (w.endHour as number) &&
        (w.startHour as number) < other.endHour,
    );
    if (clash >= 0) {
      fields[`windows.${index}`] =
        "Esta franja se pisa con otra del mismo día.";
      return;
    }
    windows.push({
      weekday: w.weekday,
      startHour: w.startHour,
      endHour: w.endHour as number,
    });
  });
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    windows: windows.sort(
      (a, b) => a.weekday - b.weekday || a.startHour - b.startHour,
    ),
  };
}
