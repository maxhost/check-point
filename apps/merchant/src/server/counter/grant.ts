import { computeAccrual } from "@mi-pasaporte/domain/server/loyalty-program/accrual";
import {
  CounterError,
  type OperatorBusiness,
  assertLocationInBusiness,
  parseUuid,
  pgErrorCode,
} from "@mi-pasaporte/domain/server/counter/core";
import { accreditableProgram } from "./resolve";
import {
  type GrantItem,
  type GrantedOrder,
  persistGrant,
  readOrderByRequest,
} from "./orders";
import { afterGrant } from "./after-grant";
import {
  buildDetailed,
  loadMembershipInBusiness,
  parseMoney,
  parseNote,
  programAccrual,
} from "./grant-input";
import { grantWithCoupon, parseCouponRef } from "./grant-coupon";

export type GrantResult = {
  order: {
    unitsGranted: number;
    balanceAfter: number;
    kind: string;
    /** Spec 0148: what was charged — the NET of the coupon's discount. */
    total: string;
    /** The sale before the coupon (`total` + `coupon.discountAmount`). */
    grossTotal: string;
    /** Spec 0153: `extraUnits` — the units an `extra_*` coupon added (null for the rest);
     * `balanceAfter` is then the final balance, the sale's plus those. */
    coupon: {
      label: string;
      discountAmount: string;
      extraUnits: number | null;
    } | null;
  };
};

const cents = (value: string) => Math.round(Number(value) * 100);

export function toResult(granted: GrantedOrder): GrantResult {
  const discount = granted.coupon?.discountAmount ?? "0.00";
  return {
    order: {
      unitsGranted: granted.unitsGranted,
      balanceAfter: granted.balanceAfter,
      kind: granted.accrualKind,
      total: granted.total,
      grossTotal: ((cents(granted.total) + cents(discount)) / 100).toFixed(2),
      coupon: granted.coupon,
    },
  };
}

/**
 * WHO and WITH WHAT a sale accredits (spec 0030): the membership within the operator's business
 * (a foreign one → 403 `foreign_membership`), the business's accreditable program — the
 * membership's own, or 404 `no_program` — and its accrual. Shared by the counter's grant and the
 * POS close (spec 0169), so the two cannot diverge.
 */
export async function accrualContext(businessId: string, membershipId: string) {
  const membership = await loadMembershipInBusiness(membershipId, businessId);
  const program = await accreditableProgram(businessId);
  if (membership.programId !== program.id) {
    throw new CounterError(
      404,
      "no_program",
      "El programa de esta membresía ya no acredita.",
    );
  }
  const accrual = programAccrual(program);
  const kind: "points" | "stamps" =
    program.kind === "stamps" ? "stamps" : "points";
  return { membership, program, accrual, kind };
}

/**
 * Validates and executes an accreditation (spec 0030): resolves the membership within
 * the operator's business, computes the grant from the program's accrual and the sale
 * total, and persists it atomically & idempotently (see {@link persistGrant}). A retry
 * with the same `clientRequestId` returns the same order without re-granting.
 *
 * Spec 0148: with `coupon` the sale goes through `grant-coupon.ts` (an interactive
 * transaction that ties the coupon to the order, total and units over the NET). Without it,
 * exactly as before.
 */
export async function grantAccrual(
  business: OperatorBusiness,
  operatorUserId: string,
  raw: Record<string, unknown>,
  now: Date = new Date(),
): Promise<GrantResult> {
  const clientRequestId = parseUuid(raw.clientRequestId, "clientRequestId");
  const membershipId = parseUuid(raw.membershipId, "membershipId");
  const mode = raw.mode;
  if (mode !== "detailed" && mode !== "quick") {
    throw new CounterError(
      422,
      "invalid_input",
      "El modo de venta no es válido.",
    );
  }
  const note = parseNote(raw.note);
  const coupon = parseCouponRef(raw.coupon);
  const locationId =
    raw.locationId === null ||
    raw.locationId === undefined ||
    raw.locationId === ""
      ? null
      : await assertLocationInBusiness(
          business.id,
          parseUuid(raw.locationId, "locationId"),
        );

  const { membership, program, accrual, kind } = await accrualContext(
    business.id,
    membershipId,
  );

  let total: string;
  let items: GrantItem[] = [];
  if (mode === "detailed") {
    ({ total, items } = await buildDetailed(
      business.id,
      locationId,
      raw.items,
    ));
  } else {
    total = parseMoney(raw.total, "El importe");
  }

  const order = {
    businessId: business.id,
    locationId,
    programId: program.id,
    membershipId: membership.id,
    consumerId: membership.consumerId,
    mode,
    currencyCode: business.currencyCode,
    note,
    accrualKind: kind,
    createdByUserId: operatorUserId,
    clientRequestId,
    items,
  } as const;

  if (coupon) {
    const sold = await grantWithCoupon({
      order,
      accrual,
      grossTotal: total,
      coupon,
      now,
    });
    afterGrant(sold);
    return toResult(sold);
  }

  const units = computeAccrual(accrual, Number(total));

  let granted: GrantedOrder | null;
  try {
    granted = await persistGrant({ ...order, total, units });
  } catch (error) {
    // A concurrent grant with the same key won the insert → reread its order.
    if (pgErrorCode(error) === "23505") {
      granted = await readOrderByRequest(business.id, clientRequestId);
    } else {
      throw error;
    }
  }
  if (!granted) {
    granted = await readOrderByRequest(business.id, clientRequestId);
  }
  if (!granted) {
    throw new CounterError(
      503,
      "grant_failed",
      "No pudimos acreditar. Prueba de nuevo.",
    );
  }

  // Best-effort, non-blocking: the transactional push (ADR 0037) and the cross sale (spec
  // 0143) — both only when THIS call created the order (retry/reread has no pushQueueId).
  afterGrant(granted);

  return toResult(granted);
}
