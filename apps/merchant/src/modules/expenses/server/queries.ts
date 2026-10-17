import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb, type DbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  expenseConcepts,
  expenses,
} from "@mi-pasaporte/db/schema";
import { minorUnitForCurrency } from "@mi-pasaporte/domain/financial";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  type ExpenseConcept,
  type ExpenseContext,
} from "../types";
import { invalidExpense, parseLocation, validDay } from "./validation";
export async function listConcepts(
  businessId: string,
  db: DbTransaction | ReturnType<typeof getDb> = getDb(),
): Promise<ExpenseConcept[]> {
  return (await db
    .select({
      id: expenseConcepts.id,
      category: expenseConcepts.category,
      name: expenseConcepts.name,
      normalizedName: expenseConcepts.normalizedName,
    })
    .from(expenseConcepts)
    .where(eq(expenseConcepts.businessId, businessId))
    .orderBy(asc(expenseConcepts.normalizedName))) as ExpenseConcept[];
}
export async function getContext(
  businessId: string,
  activeLocation?: unknown,
): Promise<ExpenseContext> {
  const [business] = await getDb()
    .select({
      currencyCode: businesses.currencyCode,
      timeZone: businesses.timezone,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business) invalidExpense();
  const available = await getDb()
    .select({
      id: locations.id,
      name: locations.name,
      status: locations.status,
    })
    .from(locations)
    .where(eq(locations.businessId, businessId))
    .orderBy(asc(locations.name), asc(locations.id));
  const active = available.filter((l) => l.status === "active");
  let selected: string | null = active.length === 1 ? active[0].id : null;
  if (activeLocation !== undefined && activeLocation !== null) {
    const id = parseLocation(activeLocation);
    if (id === null || !available.some((l) => l.id === id))
      invalidExpense("Ese local no está disponible.");
    selected = id;
  }
  return {
    ...business,
    minorUnit: minorUnitForCurrency(business.currencyCode),
    defaultLocationId: selected,
    locations: available,
    categories: EXPENSE_CATEGORIES,
  };
}
export function toExpense(
  row: typeof expenses.$inferSelect,
  concept: { name: string; normalizedName: string },
): Expense {
  return {
    id: row.id,
    revision: row.revision,
    revisionId: row.revisionId,
    paidOn: row.paidOn,
    paymentTimeZone: row.paymentTimeZone,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    minorUnit: row.minorUnit as 0 | 2,
    category: row.category as ExpenseCategory,
    conceptId: row.conceptId,
    conceptName: concept.name,
    conceptNormalizedName: concept.normalizedName,
    name: row.name,
    isFixed: row.isFixed,
    locationId: row.locationId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
export async function listExpenses(
  businessId: string,
  query: URLSearchParams,
): Promise<Expense[]> {
  const from = query.get("from"),
    to = query.get("to"),
    local = query.get("locationId");
  if (
    (from !== null && !validDay(from)) ||
    (to !== null && !validDay(to)) ||
    (from && to && from > to)
  )
    invalidExpense("El rango de fechas no es válido.");
  const location =
    local === null
      ? undefined
      : local === "business"
        ? null
        : parseLocation(local);
  if (location) {
    const [found] = await getDb()
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(eq(locations.businessId, businessId), eq(locations.id, location)),
      );
    if (!found) invalidExpense();
  }
  const rows = await getDb()
    .select({
      expense: expenses,
      concept: {
        name: expenseConcepts.name,
        normalizedName: expenseConcepts.normalizedName,
      },
    })
    .from(expenses)
    .innerJoin(
      expenseConcepts,
      and(
        eq(expenseConcepts.businessId, expenses.businessId),
        eq(expenseConcepts.id, expenses.conceptId),
      ),
    )
    .where(
      and(
        eq(expenses.businessId, businessId),
        isNull(expenses.deletedAt),
        from ? gte(expenses.paidOn, from) : undefined,
        to ? lte(expenses.paidOn, to) : undefined,
        location === undefined
          ? undefined
          : location === null
            ? isNull(expenses.locationId)
            : eq(expenses.locationId, location),
      ),
    )
    .orderBy(desc(expenses.paidOn), asc(expenses.id));
  return rows.map((r) => toExpense(r.expense, r.concept));
}
