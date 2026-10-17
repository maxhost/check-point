import type { DbTransaction } from "@mi-pasaporte/db";
import { appendModuleEvent } from "../../../server/module-events";
import type { Expense } from "../types";
import { validAmount, validDay, validCategory } from "./validation";
export type ExpenseMutation = "recorded" | "updated" | "deleted";
export type ExpenseEvent = Omit<Expense, "id"> & {
  eventVersion: 1;
  expenseId: string;
  operationId: string;
  lineIndex: number;
};
export async function publishExpense(
  tx: DbTransaction,
  businessId: string,
  mutation: ExpenseMutation,
  expense: Expense,
  operationId: string,
  lineIndex: number,
) {
  const { id, ...snapshot } = expense;
  const payload: ExpenseEvent = {
    eventVersion: 1,
    expenseId: id,
    ...snapshot,
    operationId,
    lineIndex,
  };
  if (
    !validAmount(payload.amountMinor) ||
    !validDay(payload.paidOn) ||
    !validCategory(payload.category) ||
    typeof payload.isFixed !== "boolean" ||
    !payload.conceptName ||
    !payload.conceptNormalizedName ||
    (mutation === "deleted") !== (payload.deletedAt !== null)
  )
    throw new Error("Invalid expense event");
  return appendModuleEvent(tx, {
    businessId,
    eventType: `expense.${mutation}`,
    eventVersion: 1,
    sourceId: expense.revisionId,
    locationId: expense.locationId,
    payload,
  });
}
