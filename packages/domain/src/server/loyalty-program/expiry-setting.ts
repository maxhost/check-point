import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { rowsOf } from "../counter/core";
import { LoyaltyError } from "./core";
import { updateWithEvent } from "./persistence";
import { type ExpiryMonths, isExpiryMonths, nextSince } from "./balance-expiry";

/**
 * The ONLY writer of the balance-expiry rule (spec 0195 §D3 / ADR 0136). Reads the active
 * program, computes the new `since` and writes it with its `expiry_changed` event in one
 * statement (`updateWithEvent`), guarded by the value it read: a concurrent change makes the
 * guard match 0 rows and the caller gets a 409 instead of a lost update. Same value → no
 * write and no event.
 */
export async function setBalanceExpiry(input: {
  userId: string;
  businessId: string;
  months: unknown;
  now?: Date;
}): Promise<{
  balanceExpiryMonths: ExpiryMonths | null;
  balanceExpirySince: string | null;
}> {
  if (input.months !== null && !isExpiryMonths(input.months)) {
    throw new LoyaltyError(
      400,
      "El plazo tiene que ser 3, 6, 9 o 12 meses.",
      "invalid_expiry",
    );
  }
  const next = input.months as ExpiryMonths | null;
  const now = input.now ?? new Date();
  const db = getDb();
  const [program] = rowsOf(
    await db.execute(sql`
    SELECT p.id, p.balance_expiry_months AS months, p.balance_expiry_since AS since
    FROM core.loyalty_program p
    WHERE p.business_id = ${input.businessId} AND p.status = 'active'
    LIMIT 1
  `),
  ) as { id: string; months: number | null; since: string | null }[];
  if (!program) {
    throw new LoyaltyError(
      409,
      "No hay un programa activo.",
      "no_active_program",
    );
  }
  const prev = (program.months ?? null) as ExpiryMonths | null;
  const prevSince = program.since ? new Date(program.since) : null;
  if (prev === next) {
    return {
      balanceExpiryMonths: prev,
      balanceExpirySince: prevSince?.toISOString() ?? null,
    };
  }
  const since = nextSince({
    prevMonths: prev,
    nextMonths: next,
    since: prevSince,
    now,
  });
  const matched = await updateWithEvent(db, {
    set: sql`balance_expiry_months = ${next}::integer, balance_expiry_since = ${since?.toISOString() ?? null}::timestamptz, updated_at = now()`,
    where: sql`id = ${program.id} AND status = 'active' AND balance_expiry_months IS NOT DISTINCT FROM ${prev}::integer`,
    actorId: input.userId,
    action: "expiry_changed",
    details: { from: prev, to: next },
  });
  if (matched === 0) {
    throw new LoyaltyError(
      409,
      "El programa cambió; recarga e intenta de nuevo.",
      "state_changed",
    );
  }
  return {
    balanceExpiryMonths: next,
    balanceExpirySince: since?.toISOString() ?? null,
  };
}
