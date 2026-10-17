import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import { and, eq, inArray } from "drizzle-orm";
import { posOrders } from "@mi-pasaporte/db/schema";
import type { ModuleResourceProvider } from "../../route-table";

/** Public metadata only, available to authorized consumers even when POS is off. */
export const paymentResourceProviders: readonly ModuleResourceProvider[] = [
  {
    resourceType: "sale_settlement",
    read: async (tx, businessId, ids) => {
      if (!ids.length) return [];
      const rows = await tx
        .select({
          id: posOrders.id,
          status: posOrders.status,
          locationId: posOrders.locationId,
          settlement: posOrders.settlement,
        })
        .from(posOrders)
        .where(
          and(
            eq(posOrders.businessId, businessId),
            inArray(posOrders.id, [...ids]),
          ),
        );
      return rows.map((row) => {
        let snapshot = null;
        if (row.status === "closed" && row.settlement !== null) {
          try {
            assertFinancialSettlement(row.settlement);
            snapshot = row.settlement;
          } catch {
            // Invalid historical evidence must never manufacture a certain zero.
          }
        }
        return {
          resourceId: row.id,
          metadata: {
            sourceOrderId: row.id,
            locationId: row.locationId,
            snapshotPresent: snapshot !== null,
            collectedTotal: snapshot?.collected ?? null,
            currencyCode: snapshot?.currencyCode ?? null,
            minorUnit: snapshot?.minorUnit ?? null,
          },
        };
      });
    },
  },
];
