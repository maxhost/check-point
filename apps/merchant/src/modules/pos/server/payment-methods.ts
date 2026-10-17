import { withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import { paymentStorageReady } from "../../../server/business/storage";
import * as core from "../../../server/business/payment-methods";
import * as legacy from "./payment-legacy-methods";
export type {
  PaymentMethod,
  PaymentShape,
} from "../../../server/business/payment-methods";
export const PAYMENT_SHAPES = core.PAYMENT_SHAPES;
export const listPaymentMethods = (id: string, status: string | null = null) =>
  withDbTransaction(async (tx) =>
    (await paymentStorageReady(tx))
      ? core.listPaymentMethods(id, status, tx)
      : legacy.listPaymentMethods(id, status),
  );
export const paymentMethodsForClose = async (
  tx: DbTransaction,
  id: string,
  ids: string[],
) =>
  (await paymentStorageReady(tx))
    ? core.paymentMethodsForClose(tx, id, ids)
    : legacy.paymentMethodsForClose(tx, id, ids);
export { listPaymentCatalog } from "../../../server/business/payment-catalog";
/** Pre-cut bridge only: new/core businesses initialize at creation, never on enable. */
export async function initializePaymentMethods(
  tx: DbTransaction,
  args: { businessId: string },
) {
  if (!(await paymentStorageReady(tx)))
    await legacy.initializePaymentMethods(tx, args);
}
