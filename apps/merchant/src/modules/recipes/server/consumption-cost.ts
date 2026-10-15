import { withDbTransaction } from "@mi-pasaporte/db";
import {
  moduleEvents,
  moduleEventDeliveries,
  recipeRevisions,
} from "@mi-pasaporte/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { SaleClosedEvent } from "../../../server/module-events/types";
import { expandRecipes } from "./consumption-snapshot";
import {
  readConsumptionCost,
  type ConsumptionDelivery,
  type ExpectedCostLine,
} from "../../stock/server/consumption-cost";

export type SaleCostContext = {
  lines: { sourceLineId: string; productId: string | null }[];
};

/** Internal server API; its future caller authenticates/authorizes the business.
 * No current recipe, POS table, module toggle or current price participates in this read.
 */
export async function readSaleConsumptionCost(args: {
  businessId: string;
  locationId: string;
  sourceOrderId: string;
  saleContext?: SaleCostContext;
}) {
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    const [event] = await tx
      .select()
      .from(moduleEvents)
      .where(
        and(
          eq(moduleEvents.businessId, args.businessId),
          eq(moduleEvents.locationId, args.locationId),
          eq(moduleEvents.sourceId, args.sourceOrderId),
          eq(moduleEvents.eventType, "sale.closed"),
        ),
      );
    let expectedLines: ExpectedCostLine[] = (args.saleContext?.lines ?? []).map(
      (line) => ({
        ...line,
        recipe: "unknown",
        consumptions: [],
      }),
    );
    let delivery: ConsumptionDelivery = { state: "unknown" };
    if (event) {
      const [storedDelivery] = await tx
        .select()
        .from(moduleEventDeliveries)
        .where(
          and(
            eq(moduleEventDeliveries.eventId, event.id),
            eq(moduleEventDeliveries.subscriberId, "recipes"),
          ),
        );
      if (storedDelivery)
        delivery = {
          state: storedDelivery.state as ConsumptionDelivery["state"],
          terminalReason: storedDelivery.terminalReason,
        };
      const payload = event.payload as SaleClosedEvent;
      const ids = [
        ...new Set(
          payload.lines.flatMap((line) =>
            line.resourceVersions
              .filter(
                (ref) => ref.providerId === "recipes" && ref.slot === "recipe",
              )
              .map((ref) => ref.versionId),
          ),
        ),
      ];
      const revisions = ids.length
        ? await tx
            .select()
            .from(recipeRevisions)
            .where(
              and(
                eq(recipeRevisions.businessId, args.businessId),
                inArray(recipeRevisions.id, ids),
              ),
            )
        : [];
      const byId = new Map(
        revisions.map((revision) => [revision.id, revision]),
      );
      expectedLines = payload.lines.map((line): ExpectedCostLine => {
        const empty = {
          sourceLineId: line.sourceLineId,
          productId: line.productId,
          consumptions: [],
        };
        if (
          delivery.state === "skipped" &&
          delivery.terminalReason === "modules_disabled"
        )
          return { ...empty, recipe: "absent" };
        const ref = line.resourceVersions.find(
          (ref) => ref.providerId === "recipes" && ref.slot === "recipe",
        );
        if (!line.productId || !ref) return { ...empty, recipe: "absent" };
        const revision = byId.get(ref.versionId);
        if (!revision || revision.productId !== line.productId)
          return { ...empty, recipe: "unknown" };
        const expanded = expandRecipes({ ...payload, lines: [line] }, [
          revision,
        ]);
        return {
          ...empty,
          recipe: expanded.length ? "present" : "absent",
          consumptions: expanded.map(({ itemId, quantity }) => ({
            itemId,
            quantity,
          })),
        };
      });
    }
    return readConsumptionCost(tx, { ...args, expectedLines, delivery });
  });
}
