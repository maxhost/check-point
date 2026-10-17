import type { DbTransaction } from "@mi-pasaporte/db";
import {
  products,
  productCompositions,
  recipeSaleResolutions,
  independentRecipeRevisions,
  stockItemLocations,
} from "@mi-pasaporte/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { defineEventSubscription } from "../../../server/module-events/types";
import { appendModuleEvent } from "../../../server/module-events/append";
import type { PurchaseRecorded } from "../../stock/server/analytics-facts";
import { formatDecimal, fromDb, roundDiv } from "../../decimal";
import { expandComposition } from "./model/expand";
export type ProductCostChanged = {
  eventVersion: 1;
  purchaseId: string;
  locationId: string;
  occurredAt: string;
  itemId: string;
  itemLabel: string;
  itemUnit: string;
  itemUnitCostBefore: string | null;
  itemUnitCostAfter: string | null;
  currencyCode: string;
  minorUnit: number;
  products: {
    productId: string;
    productLabel: string;
    unitCostBefore: string | null;
    unitCostAfter: string | null;
  }[];
};
export const purchaseSubscription = defineEventSubscription({
  eventType: "stock.purchase.recorded",
  resourceType: "item",
  slot: "cost",
  requiredModules: ["stock"],
  decode(payload, version): PurchaseRecorded {
    const p = payload as PurchaseRecorded;
    if (
      version !== 1 ||
      p.eventVersion !== 1 ||
      !p.movementId ||
      !p.itemId ||
      !p.locationId ||
      !p.itemLabel
    )
      throw new Error("Invalid purchase event");
    return p;
  },
  async handler(tx: DbTransaction, event) {
    const p = event.payload;
    if (
      p.unitCostBefore === p.unitCostAfter ||
      (p.unitCostBefore !== null &&
        p.unitCostAfter !== null &&
        fromDb(p.unitCostBefore, 6) === fromDb(p.unitCostAfter, 6))
    )
      return;
    const rows = await tx
      .select({
        productId: products.id,
        productLabel: products.name,
        components: recipeSaleResolutions.components,
      })
      .from(productCompositions)
      .innerJoin(
        products,
        and(
          eq(products.id, productCompositions.productId),
          eq(products.businessId, event.businessId),
        ),
      )
      .innerJoin(
        recipeSaleResolutions,
        and(
          eq(recipeSaleResolutions.id, productCompositions.resolutionId),
          eq(recipeSaleResolutions.businessId, event.businessId),
        ),
      )
      .where(eq(productCompositions.businessId, event.businessId));
    const revisionIds = [
      ...new Set(
        rows.flatMap((r) => r.components.map((c) => c.recipeRevisionId)),
      ),
    ];
    if (!revisionIds.length) return;
    const revisions = await tx
      .select()
      .from(independentRecipeRevisions)
      .where(
        and(
          eq(independentRecipeRevisions.businessId, event.businessId),
          inArray(independentRecipeRevisions.id, revisionIds),
        ),
      );
    const expanded = rows
      .map((r) => ({
        ...r,
        ingredients: expandComposition(r.components, revisions).ingredients,
      }))
      .filter((r) => r.ingredients.some((i) => i.itemId === p.itemId));
    const ids = [
      ...new Set(expanded.flatMap((r) => r.ingredients.map((i) => i.itemId))),
    ];
    if (!ids.length) return;
    const averages = await tx
      .select({
        itemId: stockItemLocations.itemId,
        cost: stockItemLocations.weightedAverageUnitCost,
      })
      .from(stockItemLocations)
      .where(
        and(
          eq(stockItemLocations.businessId, event.businessId),
          eq(stockItemLocations.locationId, p.locationId),
          inArray(stockItemLocations.itemId, ids),
        ),
      );
    const costs = new Map(averages.map((r) => [r.itemId, r.cost]));
    const changed: ProductCostChanged["products"] = [];
    for (const row of expanded) {
      let before: bigint | null = 0n,
        after: bigint | null = 0n;
      for (const i of row.ingredients) {
        const current =
          i.itemId === p.itemId ? p.unitCostAfter : costs.get(i.itemId);
        const prior = i.itemId === p.itemId ? p.unitCostBefore : current;
        const quantity = fromDb(i.quantity, 3);
        if (quantity === 0n) continue;
        if (current === null || current === undefined) after = null;
        else if (after !== null) after += quantity * fromDb(current, 6);
        if (prior === null || prior === undefined) before = null;
        else if (before !== null) before += quantity * fromDb(prior, 6);
      }
      // Unknown is never zero; an entirely unknown pair provides no change fact.
      if (before === null && after === null) continue;
      changed.push({
        productId: row.productId,
        productLabel: row.productLabel,
        unitCostBefore:
          before === null ? null : formatDecimal(roundDiv(before, 1000n), 6),
        unitCostAfter:
          after === null ? null : formatDecimal(roundDiv(after, 1000n), 6),
      });
    }
    if (!changed.length) return;
    const payload: ProductCostChanged = {
      eventVersion: 1,
      purchaseId: p.movementId,
      locationId: p.locationId,
      occurredAt: p.occurredAt,
      itemId: p.itemId,
      itemLabel: p.itemLabel,
      itemUnit: p.itemUnit,
      itemUnitCostBefore: p.unitCostBefore,
      itemUnitCostAfter: p.unitCostAfter,
      currencyCode: p.currencyCode,
      minorUnit: p.minorUnit,
      products: changed.sort((a, b) => a.productId.localeCompare(b.productId)),
    };
    await appendModuleEvent(tx, {
      businessId: event.businessId,
      eventType: "recipes.product_cost.changed",
      eventVersion: 1,
      sourceId: p.movementId,
      locationId: p.locationId,
      causationEventId: event.id,
      payload,
    });
  },
});
