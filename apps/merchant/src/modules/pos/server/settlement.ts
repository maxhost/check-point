import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { posOrderPayments } from "@mi-pasaporte/db/schema";
import {
  FinancialError,
  buildFinancialSettlement,
  type FinancialSettlement,
} from "@mi-pasaporte/domain/financial";
import { CounterError } from "@mi-pasaporte/domain/server/counter/core";
import { PosError } from "./errors";
import type { PaymentMethod } from "./payment-methods";

export function parsePayments(raw: unknown) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 200)
    throw new CounterError(
      422,
      "invalid_payment_amount",
      "Los pagos no son válidos.",
    );
  return raw.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new CounterError(
        422,
        "invalid_payment_amount",
        "Revisa los importes de pago.",
      );
    const entry = value as Record<string, unknown>;
    if (typeof entry.methodId !== "string")
      throw new CounterError(
        404,
        "payment_method_not_found",
        "Ese medio de pago no existe.",
      );
    if (typeof entry.amount !== "string")
      throw new CounterError(
        422,
        "invalid_payment_amount",
        "El importe de pago no es válido.",
      );
    return {
      paymentId: randomUUID(),
      methodId: entry.methodId.trim().toLowerCase(),
      amount: entry.amount,
    };
  });
}

export function settle(
  args: Parameters<typeof buildFinancialSettlement>[0],
): FinancialSettlement {
  try {
    return buildFinancialSettlement(args);
  } catch (error) {
    if (!(error instanceof FinancialError)) throw error;
    throw new PosError(
      422,
      error.code,
      "El importe cambió o los pagos no coinciden. Revisa el cobro y vuelve a confirmar.",
      error.details ?? {},
    );
  }
}

export async function persistPaymentSnapshot(
  tx: DbTransaction,
  businessId: string,
  orderId: string,
  settlement: FinancialSettlement,
  methods: Map<string, PaymentMethod>,
) {
  if (settlement.lines.length) {
    await tx.execute(
      sql`update pos.pos_order_item as item set financial_snapshot=source.snapshot from (values ${sql.join(
        settlement.lines.map(
          (line) =>
            sql`(${line.sourceLineId}::uuid,${JSON.stringify(line)}::jsonb)`,
        ),
        sql`,`,
      )}) as source(id,snapshot) where item.pos_order_id=${orderId}::uuid and item.id=source.id`,
    );
  }
  if (settlement.payments.length)
    await tx.insert(posOrderPayments).values(
      settlement.payments.map((payment) => {
        const method = methods.get(payment.methodId)!;
        return {
          id: payment.paymentId,
          businessId,
          posOrderId: orderId,
          methodId: payment.methodId,
          methodProviderId: "pos",
          position: payment.position,
          methodName: method.name,
          chargeShape: method.chargeShape,
          amount: payment.amount,
          originalAmount: payment.originalAmount,
          normalizationAdjustment: payment.normalizationAdjustment,
        };
      }),
    );
}

export function paymentMetadata(
  settlement: FinancialSettlement,
  methods: Map<string, PaymentMethod>,
) {
  return settlement.payments.map((payment) => {
    const method = methods.get(payment.methodId)!;
    return {
      paymentId: payment.paymentId,
      methodProviderId: "pos",
      methodId: method.id,
      methodName: method.name,
      chargeShape: method.chargeShape,
    };
  });
}
