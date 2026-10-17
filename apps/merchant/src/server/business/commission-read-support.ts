import { toMinor } from "@mi-pasaporte/domain/financial/rational";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  minorUnitForCurrency,
  normalizeMoney,
  type ExactAmount,
} from "@mi-pasaporte/domain/financial";
import {
  exact,
  formatMinor,
  rational,
} from "@mi-pasaporte/domain/financial/rational";
import { SERVER_MODULES } from "../../modules/server-registry";
export type SaleCommissionDTO = {
  state: "completo" | "incompleto" | "pendiente";
  currencyCode: string | null;
  minorUnit: 0 | 2 | null;
  total: string | null;
  originalTotal: ExactAmount | null;
  totalNormalizationAdjustment: ExactAmount | null;
  payments: {
    paymentId: string;
    commission: string | null;
    originalCommission: ExactAmount | null;
    normalizationAdjustment: ExactAmount | null;
    configured: boolean;
    reasons: string[];
  }[];
  reasons: string[];
};
export const absent = (reason: string): SaleCommissionDTO => ({
  state: "incompleto",
  currencyCode: null,
  minorUnit: null,
  total: null,
  originalTotal: null,
  totalNormalizationAdjustment: null,
  payments: [],
  reasons: [reason],
});
export async function settlementMetadata(
  tx: DbTransaction,
  businessId: string,
  sourceOrderId: string,
  locationId: string,
) {
  try {
    const resources = [];
    for (const server of Object.values(SERVER_MODULES))
      for (const provider of server.resourceProviders ?? [])
        if (provider.resourceType === "sale_settlement" && provider.read)
          resources.push(
            ...(await provider.read(tx, businessId, [sourceOrderId])),
          );
    if (resources.length !== 1) return null;
    const m = resources[0].metadata;
    if (
      m.sourceOrderId !== sourceOrderId ||
      m.locationId !== locationId ||
      m.snapshotPresent !== true ||
      typeof m.collectedTotal !== "string" ||
      typeof m.currencyCode !== "string" ||
      minorUnitForCurrency(m.currencyCode) !== m.minorUnit
    )
      return null;
    if (
      normalizeMoney(m.collectedTotal, m.minorUnit as 0 | 2) !==
      m.collectedTotal
    )
      return null;
    return {
      collected: m.collectedTotal,
      currencyCode: m.currencyCode,
      minorUnit: m.minorUnit as 0 | 2,
    };
  } catch {
    return null;
  }
}
export const zero = (
  currencyCode: string,
  minorUnit: 0 | 2,
): SaleCommissionDTO => ({
  state: "completo",
  currencyCode,
  minorUnit,
  total: formatMinor(0n, minorUnit),
  originalTotal: exact(rational(0n)),
  totalNormalizationAdjustment: exact(rational(0n)),
  payments: [],
  reasons: [],
});

/** Result totals may exceed a single input amount; retain the frozen decimal without input caps. */
export function formatResultMoney(value: string, minorUnit: 0 | 2) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error("Invalid frozen commission total");
  const [whole, part = ""] = value.split(".");
  return formatMinor(
    toMinor(
      rational(BigInt(whole) * 100n + BigInt(part.padEnd(2, "0"))),
      minorUnit,
    ),
    minorUnit,
  );
}
