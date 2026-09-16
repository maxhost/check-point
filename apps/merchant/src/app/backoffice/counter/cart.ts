import type { CartLine, CounterProduct } from "./types";

/**
 * The cart of the detailed sale, as PURE transitions over the line list. Lifted out of
 * `counter-console.tsx` when phase C of spec 0065 pushed that file past the 300-line
 * budget — and it is the right half to lift: these three functions are the only part of
 * the console that is a data transformation rather than a fetch or a stage change, so
 * they are the only part that a unit test can pin without a browser.
 */

/** Adding a product already in the cart bumps its quantity instead of duplicating the
 * line — otherwise the same coffee scanned twice reads as two separate items. */
export function addLine(
  lines: CartLine[],
  product: CounterProduct,
): CartLine[] {
  if (lines.some((line) => line.productId === product.id))
    return lines.map((line) =>
      line.productId === product.id
        ? { ...line, quantity: line.quantity + 1 }
        : line,
    );
  return [
    ...lines,
    {
      productId: product.id,
      name: product.name,
      unitPrice: product.unitPrice ?? 0,
      // A product with NO stored price is not free: the operator has to type one, and
      // `canConfirm` refuses the sale until they do.
      hasStoredPrice: product.unitPrice !== null,
      quantity: 1,
    },
  ];
}

/** Dropping to zero REMOVES the line: a line of quantity 0 would be an invisible item
 * that still renders in the cart. */
export function changeQuantity(
  lines: CartLine[],
  productId: string,
  delta: number,
): CartLine[] {
  return lines
    .map((line) =>
      line.productId === productId
        ? { ...line, quantity: line.quantity + delta }
        : line,
    )
    .filter((line) => line.quantity > 0);
}

/** A typed price that is not a positive finite number lands as 0, which `canConfirm`
 * then refuses — never as `NaN`, which would travel into the request body. */
export function setLineUnitPrice(
  lines: CartLine[],
  productId: string,
  value: number,
): CartLine[] {
  return lines.map((line) =>
    line.productId === productId
      ? {
          ...line,
          unitPrice: Number.isFinite(value) && value > 0 ? value : 0,
        }
      : line,
  );
}
