import type { ProductCostChanged } from "./purchase-cost-event";
import { fromDb, roundDiv } from "../../decimal";
import type {
  MetricTranslator,
  MetricRow,
} from "@mi-pasaporte/domain/analytics/metrics";
import type { ConsumptionApplied } from "./consumption-event";
export const metricTranslators: readonly MetricTranslator[] = [
  {
    eventType: "recipes.product_cost.changed",
    translate(event) {
      const p = event.payload as ProductCostChanged;
      const comparable = p.products.flatMap((product) =>
        product.unitCostBefore !== null && product.unitCostAfter !== null
          ? [
              {
                ...product,
                unitCostBefore: product.unitCostBefore,
                unitCostAfter: product.unitCostAfter,
              },
            ]
          : [],
      );
      return {
        sourceKey: `recipes.product_cost.changed:${p.purchaseId}`,
        sourceRevision: 1,
        rows: comparable.map((product) => ({
          metric: "product_unit_cost_change" as const,
          locationId: p.locationId,
          occurredAt: p.occurredAt,
          dimensionKind: "product" as const,
          dimensionId: product.productId,
          dimensionLabel: product.productLabel,
          amountMinor: String(
            roundDiv(
              fromDb(product.unitCostAfter, 6) -
                fromDb(product.unitCostBefore, 6),
              10n ** BigInt(6 - p.minorUnit),
            ),
          ),
          currencyCode: p.currencyCode,
          minorUnit: p.minorUnit,
          count: 1,
        })),
        facts:
          p.itemUnitCostBefore === null || p.itemUnitCostAfter === null
            ? []
            : comparable.map((product) => ({
                kind: "unit_cost_change" as const,
                locationId: p.locationId,
                occurredAt: p.occurredAt,
                itemId: p.itemId,
                itemLabel: p.itemLabel,
                itemUnit: p.itemUnit,
                itemUnitCostBefore: p.itemUnitCostBefore!,
                itemUnitCostAfter: p.itemUnitCostAfter!,
                ...product,
                currencyCode: p.currencyCode,
                minorUnit: p.minorUnit,
              })),
      };
    },
  },
  {
    eventType: "recipes.consumption.applied",
    translate(event) {
      const p = event.payload as ConsumptionApplied;
      const rows: MetricRow[] = [];
      for (const line of p.lines) {
        if (line.cost) {
          const base = {
            locationId: p.locationId,
            occurredAt: p.closedAt,
            dimensionKind: "product" as const,
            dimensionId: line.productId,
            dimensionLabel: line.productLabel ?? undefined,
          };
          rows.push(
            { ...base, metric: "cost_of_goods", count: 1, ...line.cost },
            { ...base, metric: "units_with_cost", quantity: line.quantity },
          );
          if (
            typeof line.revenueMinor === "string" &&
            p.currencyCode &&
            (p.minorUnit === 0 || p.minorUnit === 2)
          ) {
            const money = {
              currencyCode: p.currencyCode,
              minorUnit: p.minorUnit,
              count: 1,
            };
            rows.push({
              ...base,
              ...money,
              metric: "revenue_with_cost",
              amountMinor: line.revenueMinor,
            });
            if (typeof line.allocatedCommissionMinor === "string")
              rows.push({
                ...base,
                ...money,
                metric: "payment_commission_with_cost",
                amountMinor: line.allocatedCommissionMinor,
              });
          }
        }
      }
      for (const item of p.items)
        rows.push({
          metric: "stock_consumption",
          locationId: p.locationId,
          occurredAt: p.closedAt,
          dimensionKind: "item",
          dimensionId: item.itemId,
          dimensionLabel: item.itemLabel,
          quantity: item.quantity,
        });
      return {
        sourceKey: `recipes.consumption.applied:${p.sourceOrderId}`,
        sourceRevision: 1,
        rows,
        gauges: p.items
          .filter((item) => item.itemUnit && (p.observedAt || event.capturedAt))
          .map((item) => ({
            metric: "stock_on_hand" as const,
            locationId: p.locationId,
            occurredAt: (p.observedAt ?? event.capturedAt)!,
            dimensionKind: "item" as const,
            dimensionId: item.itemId,
            dimensionLabel: item.itemLabel,
            quantity: item.onHandAfter,
            unit: item.itemUnit!,
          })),
      };
    },
  },
];
