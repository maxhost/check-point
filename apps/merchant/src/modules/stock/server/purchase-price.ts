import { ModuleError } from "../../errors";

/** Public purchases require an explicit price; zero is a known, valid price.
 * Numeric/shape validation stays in the existing purchase writer. Historical
 * purchases and internal callers may still represent an unknown cost. */
export function requirePurchasePrice(
  body: Record<string, unknown>,
  line?: number,
): void {
  const price = body.totalCost;
  if (
    price === null ||
    price === undefined ||
    (typeof price === "string" && !price.trim())
  ) {
    throw new ModuleError(
      422,
      "price_required",
      `${line === undefined ? "" : `Línea ${line + 1}: `}Completa el precio total. Si fue gratis, escribe 0.`,
      line === undefined ? {} : { line },
    );
  }
}

export function requireEntryPrices(body: Record<string, unknown>): void {
  if (!Array.isArray(body.lines)) return;
  body.lines.forEach((line: unknown, index) => {
    // Leave malformed entries to the existing payload validation.
    if (line && typeof line === "object" && !Array.isArray(line))
      requirePurchasePrice(line as Record<string, unknown>, index);
  });
}
