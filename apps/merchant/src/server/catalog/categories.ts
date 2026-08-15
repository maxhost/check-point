import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { productCategories } from "../schema";
import { CatalogError, type OwnerBusiness, uuidPattern } from "./core";
import { validateCategoryName } from "./validation";

/** Postgres unique-violation (23505), including errors that wrap it in `.cause`. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

const duplicate = new CatalogError(
  422,
  "Ya existe una categoría con ese nombre.",
);

export async function createCategory(business: OwnerBusiness, value: unknown) {
  const name = validateCategoryName(value);
  try {
    const [row] = await getDb()
      .insert(productCategories)
      .values({ businessId: business.id, name })
      .returning({ id: productCategories.id, name: productCategories.name });
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate;
    throw error;
  }
}

export async function renameCategory(
  business: OwnerBusiness,
  categoryId: string,
  value: unknown,
) {
  if (!uuidPattern.test(categoryId)) {
    throw new CatalogError(404, "Categoría no encontrada.");
  }
  const name = validateCategoryName(value);
  try {
    const [row] = await getDb()
      .update(productCategories)
      .set({ name })
      .where(
        and(
          eq(productCategories.id, categoryId),
          eq(productCategories.businessId, business.id),
        ),
      )
      .returning({ id: productCategories.id, name: productCategories.name });
    if (!row) throw new CatalogError(404, "Categoría no encontrada.");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate;
    throw error;
  }
}

/** Deleting a category leaves its products uncategorized (FK on delete set null). */
export async function deleteCategory(
  business: OwnerBusiness,
  categoryId: string,
) {
  if (!uuidPattern.test(categoryId)) {
    throw new CatalogError(404, "Categoría no encontrada.");
  }
  const [row] = await getDb()
    .delete(productCategories)
    .where(
      and(
        eq(productCategories.id, categoryId),
        eq(productCategories.businessId, business.id),
      ),
    )
    .returning({ id: productCategories.id });
  if (!row) throw new CatalogError(404, "Categoría no encontrada.");
  return { ok: true };
}
