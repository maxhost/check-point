import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { type DbTransaction } from "@mi-pasaporte/db";
import {
  expenseConcepts,
  expenseRevisions,
  locations,
} from "@mi-pasaporte/db/schema";

import { ModuleError } from "../../errors";
import type { Expense, ExpenseLine } from "../types";

import { invalidExpense, normalizeConceptName } from "./validation";
import { publishExpense, type ExpenseMutation } from "./events";

export const notFound = () =>
  new ModuleError(404, "expense_not_found", "Ese gasto no existe.");
export const conflict = () =>
  new ModuleError(
    409,
    "expense_conflict",
    "El gasto cambió. Actualiza los datos y revisa tu edición.",
  );
export function checkCurrency(expected: string, actual: string) {
  if (expected !== actual)
    throw new ModuleError(
      409,
      "currency_conflict",
      "La moneda cambió. Revisa el monto antes de guardar.",
    );
}
export function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export async function replay(
  tx: DbTransaction,
  businessId: string,
  operation: string,
  requestDigest: string,
): Promise<Expense[] | null> {
  // Serialize equal operation UUIDs, including concurrent first attempts with no revision yet.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`expense-operation/${businessId}/${operation}`},0))`,
  );
  const rows = await tx
    .select()
    .from(expenseRevisions)
    .where(
      and(
        eq(expenseRevisions.businessId, businessId),
        eq(expenseRevisions.operationId, operation),
      ),
    )
    .orderBy(asc(expenseRevisions.lineIndex));
  if (!rows.length) return null;
  if (rows.some((r) => r.requestDigest !== requestDigest))
    throw new ModuleError(
      409,
      "operation_conflict",
      "Esta operación ya se usó con otros datos.",
    );
  return rows.map((r) => r.snapshot as Expense);
}
export async function conceptFor(
  tx: DbTransaction,
  businessId: string,
  line: ExpenseLine,
) {
  if (line.locationId !== null) {
    const [local] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.businessId, businessId),
          eq(locations.id, line.locationId),
        ),
      )
      .for("key share");
    if (!local) invalidExpense();
  }
  if (line.conceptId !== null) {
    const [concept] = await tx
      .select()
      .from(expenseConcepts)
      .where(
        and(
          eq(expenseConcepts.businessId, businessId),
          eq(expenseConcepts.id, line.conceptId),
        ),
      );
    if (!concept || concept.category !== line.category)
      invalidExpense("Revisa el concepto y la categoría.");
    return concept;
  }
  const normalizedName = normalizeConceptName(line.conceptName);
  await tx
    .insert(expenseConcepts)
    .values({
      businessId,
      category: line.category,
      name: line.conceptName,
      normalizedName,
    })
    .onConflictDoNothing({
      target: [
        expenseConcepts.businessId,
        expenseConcepts.category,
        expenseConcepts.normalizedName,
      ],
    });
  const [concept] = await tx
    .select()
    .from(expenseConcepts)
    .where(
      and(
        eq(expenseConcepts.businessId, businessId),
        eq(expenseConcepts.category, line.category),
        eq(expenseConcepts.normalizedName, normalizedName),
      ),
    );
  if (!concept) throw new Error("Concept unavailable");
  return concept;
}
export async function recordRevision(
  tx: DbTransaction,
  businessId: string,
  actorUserId: string,
  expense: Expense,
  mutation: ExpenseMutation,
  operation: string,
  requestDigest: string,
  lineIndex: number,
) {
  await tx.insert(expenseRevisions).values({
    id: expense.revisionId,
    businessId,
    expenseId: expense.id,
    revision: expense.revision,
    operationType: mutation,
    operationId: operation,
    lineIndex,
    requestDigest,
    actorUserId,
    snapshot: expense,
  });
  await publishExpense(tx, businessId, mutation, expense, operation, lineIndex);
}
