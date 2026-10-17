import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { withDbTransaction } from "@mi-pasaporte/db";
import { businesses, expenseConcepts, expenses } from "@mi-pasaporte/db/schema";
import { minorUnitForCurrency } from "@mi-pasaporte/domain/financial";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";

import type { Expense } from "../types";
import { toExpense } from "./queries";
import {
  currency,
  expectedRevision,
  invalidExpense,
  operationId,
  parseLine,
} from "./validation";

import {
  notFound,
  conflict,
  checkCurrency,
  digest,
  replay,
  conceptFor,
  recordRevision,
} from "./write-support";
export async function createExpenses(
  businessId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ expenses: Expense[] }> {
  const operation = operationId(body.operationId),
    expectedCurrencyCode = currency(body.expectedCurrencyCode);
  if (
    !Array.isArray(body.lines) ||
    body.lines.length < 1 ||
    body.lines.length > 30
  )
    invalidExpense();
  const lines = body.lines.map(parseLine);
  const requestDigest = digest({ method: "POST", expectedCurrencyCode, lines });
  return withDbTransaction(async (tx) => {
    const previous = await replay(tx, businessId, operation, requestDigest);
    if (previous) return { expenses: previous };
    const [business] = await tx
      .select({
        currencyCode: businesses.currencyCode,
        timeZone: businesses.timezone,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .for("share");
    if (!business) invalidExpense();
    checkCurrency(expectedCurrencyCode, business.currencyCode);
    const result: Expense[] = [];
    for (const [lineIndex, line] of lines.entries()) {
      const concept = await conceptFor(tx, businessId, line);
      const values = {
        paidOn: line.paidOn,
        amountMinor: line.amountMinor,
        category: line.category,
        name: line.name,
        isFixed: line.isFixed,
        locationId: line.locationId,
      };
      const [row] = await tx
        .insert(expenses)
        .values({
          ...values,
          conceptId: concept.id,
          businessId,
          paymentTimeZone: business.timeZone,
          currencyCode: business.currencyCode,
          minorUnit: minorUnitForCurrency(business.currencyCode),
          createdByUserId: userId,
          revisionId: randomUUID(),
        })
        .returning();
      const expense = toExpense(row, concept);
      await recordRevision(
        tx,
        businessId,
        userId,
        expense,
        "recorded",
        operation,
        requestDigest,
        lineIndex,
      );
      result.push(expense);
    }
    return { expenses: result };
  });
}
export async function mutateExpense(
  businessId: string,
  userId: string,
  id: string,
  mutation: "updated" | "deleted",
  body: Record<string, unknown>,
): Promise<{ expense: Expense }> {
  if (!isUuid(id)) throw notFound();
  id = id.trim().toLowerCase();
  const operation = operationId(body.operationId),
    revision = expectedRevision(body.expectedRevision);
  const line = mutation === "updated" ? parseLine(body) : null;
  const expectedCurrencyCode =
    mutation === "updated" ? currency(body.expectedCurrencyCode) : null;
  const requestDigest = digest({
    method: mutation === "updated" ? "PUT" : "DELETE",
    id,
    expectedRevision: revision,
    ...(line ? { expectedCurrencyCode, line } : {}),
  });
  return withDbTransaction(async (tx) => {
    const previous = await replay(tx, businessId, operation, requestDigest);
    if (previous) return { expense: previous[0] };
    const [current] = await tx
      .select()
      .from(expenses)
      .where(and(eq(expenses.businessId, businessId), eq(expenses.id, id)))
      .for("update");
    if (!current) throw notFound();
    if (current.deletedAt || current.revision !== revision) throw conflict();
    let concept;
    if (line) {
      checkCurrency(expectedCurrencyCode!, current.currencyCode);
      concept = await conceptFor(tx, businessId, line);
    } else {
      [concept] = await tx
        .select()
        .from(expenseConcepts)
        .where(
          and(
            eq(expenseConcepts.businessId, businessId),
            eq(expenseConcepts.id, current.conceptId),
          ),
        );
    }
    if (!concept) throw new Error("Concept unavailable");
    const now = new Date();
    const values = line
      ? {
          paidOn: line.paidOn,
          amountMinor: line.amountMinor,
          category: line.category,
          conceptId: concept.id,
          name: line.name,
          isFixed: line.isFixed,
          locationId: line.locationId,
        }
      : {};
    const [row] = await tx
      .update(expenses)
      .set({
        ...values,
        revision: current.revision + 1,
        revisionId: randomUUID(),
        updatedAt: now,
        deletedAt: mutation === "deleted" ? now : null,
      })
      .where(and(eq(expenses.businessId, businessId), eq(expenses.id, id)))
      .returning();
    const expense = toExpense(row, concept);
    await recordRevision(
      tx,
      businessId,
      userId,
      expense,
      mutation,
      operation,
      requestDigest,
      0,
    );
    return { expense };
  });
}
