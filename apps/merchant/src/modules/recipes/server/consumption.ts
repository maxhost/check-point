import { and, eq, inArray } from "drizzle-orm";
import { recipeRevisions } from "@mi-pasaporte/db/schema";
import type { ModuleServer } from "../../route-table";
import { expandRecipes } from "./consumption-snapshot";
import { applyConsumption } from "../../stock/consumption";

/** Resolve only the immutable revisions captured by core; never query POS or today's recipe. */
export const eventSubscriptions: NonNullable<
  ModuleServer["eventSubscriptions"]
> = [
  {
    eventType: "sale.closed",
    resourceType: "product",
    slot: "recipe",
    requiredModules: ["stock"],
    handler: async (tx, event) => {
      const ids = event.payload.lines.flatMap((line) =>
        line.resourceVersions
          .filter(
            (ref) => ref.providerId === "recipes" && ref.slot === "recipe",
          )
          .map((ref) => ref.versionId),
      );
      const revisions = ids.length
        ? await tx
            .select()
            .from(recipeRevisions)
            .where(
              and(
                eq(recipeRevisions.businessId, event.businessId),
                inArray(recipeRevisions.id, ids),
              ),
            )
        : [];
      const lines = expandRecipes(event.payload, revisions);
      await applyConsumption(tx, {
        businessId: event.businessId,
        locationId: event.payload.locationId,
        sourceOrderId: event.payload.sourceOrderId,
        closedAt: new Date(event.payload.closedAt),
        userId: event.payload.userId,
        lines,
      });
    },
  },
];
