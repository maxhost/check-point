import type { SaleClosedEvent } from "../../../server/module-events/types";
import { formatDecimal, fromDb } from "../../decimal";

type Revision = {
  id: string;
  productId: string;
  lines: { itemId: string; unit: string; quantity: string }[];
};
/** The recipe already stores quantity per product unit. Only multiply by sold units. */
export function expandRecipes(
  event: SaleClosedEvent,
  revisions: readonly Revision[],
) {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  return event.lines.flatMap((line) => {
    if (!line.productId) return [];
    const ref = line.resourceVersions.find(
      (ref) => ref.providerId === "recipes" && ref.slot === "recipe",
    );
    if (!ref) return [];
    const revision = byId.get(ref.versionId);
    if (!revision || revision.productId !== line.productId)
      throw new Error("Captured recipe revision unavailable");
    return revision.lines.map((ingredient) => ({
      sourceLineId: line.sourceLineId,
      productId: line.productId!,
      itemId: ingredient.itemId,
      quantity: formatDecimal(
        fromDb(ingredient.quantity, 3) * BigInt(line.quantity),
        3,
      ),
    }));
  });
}
