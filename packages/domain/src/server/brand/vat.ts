import { BrandError } from "./core";

export type BrandVat = {
  chargesVat: boolean;
  saleVatRate: string | null;
  recoversPurchaseVat: boolean;
};

/** Percentages stay decimal strings: reject precision before numeric(5,2) can round it. */
export function canonicalVatRate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new BrandError(
      422,
      "Ingresa una tasa de IVA entre 0 y 100, con hasta dos decimales.",
    );
  }
  const [whole, fraction = ""] = value.split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  const decimals = fraction.padEnd(2, "0");
  if (
    integer.length > 3 ||
    (integer.length === 3 && (integer > "100" || decimals !== "00"))
  ) {
    throw new BrandError(
      422,
      "Ingresa una tasa de IVA entre 0 y 100, con hasta dos decimales.",
    );
  }
  return `${integer}.${decimals}`;
}

export function validateVatPatch(
  input: Record<string, unknown>,
): Partial<BrandVat> {
  const patch: Partial<BrandVat> = {};
  for (const key of ["chargesVat", "recoversPurchaseVat"] as const) {
    if (!(key in input)) continue;
    if (typeof input[key] !== "boolean") {
      throw new BrandError(422, "Elige Sí o No para los datos fiscales.");
    }
    patch[key] = input[key];
  }
  if ("saleVatRate" in input)
    patch.saleVatRate = canonicalVatRate(input.saleVatRate);
  return patch;
}

export function resultingBrandVat(
  current: BrandVat,
  patch: Partial<BrandVat>,
): BrandVat {
  const result = { ...current, ...patch };
  if (result.chargesVat && result.saleVatRate === null) {
    throw new BrandError(422, "Ingresa la tasa de IVA de venta para guardar.");
  }
  return result;
}
