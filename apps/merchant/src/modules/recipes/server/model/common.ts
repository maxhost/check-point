import { getDb, type DbTransaction } from "@mi-pasaporte/db";
import { products, recipeEntities } from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { ModuleError } from "../../../errors";

export type Db = DbTransaction | ReturnType<typeof getDb>;
export const notFound = (kind: "recipe" | "product" | "item") =>
  new ModuleError(404, `${kind}_not_found`, "Ese registro no existe.");
export function ownId(raw: unknown, kind: "recipe" | "product" | "item") {
  if (!isUuid(raw)) throw notFound(kind);
  return (raw as string).trim().toLowerCase();
}
export async function lockRecipes(tx: DbTransaction, businessId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"recipes-r1/" + businessId},0))`,
  );
}
export async function ownRecipe(db: Db, businessId: string, rawId: unknown) {
  const [recipe] = await db
    .select()
    .from(recipeEntities)
    .where(
      and(
        eq(recipeEntities.businessId, businessId),
        eq(recipeEntities.id, ownId(rawId, "recipe")),
      ),
    );
  if (!recipe) throw notFound("recipe");
  return recipe;
}
export async function ownProduct(db: Db, businessId: string, rawId: unknown) {
  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        eq(products.id, ownId(rawId, "product")),
      ),
    );
  if (!product) throw notFound("product");
  return product;
}
export function expectRevision(raw: unknown, current: string | null) {
  if (raw !== current)
    throw new ModuleError(
      409,
      "revision_conflict",
      "Cambió desde que lo abriste. Actualiza y vuelve a intentarlo.",
    );
}
export function activeRecipe(status: string) {
  if (status !== "active")
    throw new ModuleError(409, "recipe_archived", "Esa receta está archivada.");
}
export function compareName(
  a: { id: string; name: string },
  b: { id: string; name: string },
) {
  const x = a.name.toLowerCase(),
    y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
export function page<T extends { id: string }>(
  rows: T[],
  businessId: string,
  kind: string,
  query: URLSearchParams,
) {
  const raw = query.get("limit") ?? "50";
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 100)
    throw new ModuleError(
      422,
      "invalid_body",
      "El límite tiene que estar entre 1 y 100.",
    );
  const q = query.get("q") ?? "";
  if (q.length > 120)
    throw new ModuleError(
      422,
      "invalid_body",
      "La búsqueda es demasiado larga.",
    );
  const context = JSON.stringify([
    businessId,
    kind,
    q,
    query.get("status") ?? "",
  ]);
  let offset = 0;
  const cursor = query.get("cursor");
  if (cursor) {
    try {
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString()) as {
        context: string;
        id: string;
      };
      if (value.context !== context || typeof value.id !== "string")
        throw new Error();
      const index = rows.findIndex((row) => row.id === value.id);
      if (index < 0) throw new Error();
      offset = index + 1;
    } catch {
      throw new ModuleError(
        422,
        "invalid_cursor",
        "Ese cursor no es válido para esta consulta.",
      );
    }
  }
  const limit = Number(raw),
    items = rows.slice(offset, offset + limit);
  return {
    items,
    nextCursor:
      offset + limit < rows.length
        ? Buffer.from(
            JSON.stringify({ context, id: items.at(-1)!.id }),
          ).toString("base64url")
        : null,
  };
}
