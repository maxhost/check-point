import type {
  CouponKind,
  DiscountUnit,
} from "@mi-pasaporte/domain/server/marketing/reward-input";

/**
 * HOW MUCH A COUPON TAKES OFF A SALE (spec 0148 / ADR 0119 §6-§8, §13), PURE and in CENTS —
 * the counter's UI previews with the same rule (contract M4), the server decides:
 *
 *  - `discount` `percent`: `round(total × value / 100)`, half-up;
 *  - `discount` `amount`: `min(value, total)` — a coupon bigger than the sale charges 0 and
 *    the rest is lost (§13); in another currency than the business's → 409;
 *  - `free_product` / `two_for_one` in a DETAILED sale: ONE unit of the line of the coupon's
 *    product — or, when the coupon names none, of the product the counter picked (§7). No
 *    line → 409 `coupon_product_missing`; a 2x1 needs quantity ≥ 2 → 409 `coupon_quantity`;
 *  - `free_product` / `two_for_one` in a QUICK sale, and `custom` always: 0 — the counter
 *    types the value, the label goes as a note (§8);
 *  - `extra_*`: never in a sale (consumed when validated) → 409 `coupon_not_selected`.
 */

export type DiscountLine = {
  productId: string | null;
  unitPrice: string;
  quantity: number;
};

export type CouponDiscountInput = {
  kind: CouponKind;
  discountUnit: DiscountUnit | null;
  discountValue: string | null;
  /** The coupon's own currency snapshot (only an `amount` discount carries one). */
  currencyCode: string | null;
  businessCurrency: string;
  mode: "detailed" | "quick";
  items: DiscountLine[];
  totalCents: number;
  /** The coupon's product, else the one the counter picked (`coupon.productId` of M4). */
  productId: string | null;
};

export type CouponDiscountDecision =
  | { ok: true; discountCents: number }
  | { ok: false; status: 409; code: string; message: string };

const toCents = (value: string) => Math.round(Number(value) * 100);

function no(code: string, message: string): CouponDiscountDecision {
  return { ok: false, status: 409, code, message };
}

export function decideCouponDiscount(
  input: CouponDiscountInput,
): CouponDiscountDecision {
  const { kind, totalCents } = input;
  if (kind === "extra_stamps" || kind === "extra_points")
    return no(
      "coupon_not_selected",
      "Este cupón se canjea al validarlo, no en la venta.",
    );
  if (kind === "custom") return { ok: true, discountCents: 0 };
  if (kind === "discount") {
    const value = Number(input.discountValue ?? 0);
    if (input.discountUnit === "percent")
      return {
        ok: true,
        // Integer arithmetic: `percent` is a whole 1..100, so `+ 50` is the exact half-up.
        discountCents: Math.floor((totalCents * value + 50) / 100),
      };
    if (
      input.currencyCode !== null &&
      input.currencyCode !== input.businessCurrency
    )
      return no(
        "coupon_currency_mismatch",
        "El cupón está en otra moneda que la de tu comercio.",
      );
    return {
      ok: true,
      discountCents: Math.min(toCents(input.discountValue ?? "0"), totalCents),
    };
  }
  // free_product / two_for_one
  if (input.mode === "quick") return { ok: true, discountCents: 0 };
  const line =
    input.productId === null
      ? undefined
      : input.items.find((item) => item.productId === input.productId);
  if (!line)
    return no(
      "coupon_product_missing",
      "El producto del cupón no está en la venta.",
    );
  if (kind === "two_for_one" && line.quantity < 2)
    return no(
      "coupon_quantity",
      "El 2x1 necesita al menos 2 unidades del producto.",
    );
  return { ok: true, discountCents: toCents(line.unitPrice) };
}
