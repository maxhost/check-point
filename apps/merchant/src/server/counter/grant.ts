import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { products, programMemberships } from "../schema";
import { computeAccrual } from "../loyalty-program/accrual";
import type { AccrualInput } from "../loyalty-program/core";
import {
  CounterError,
  type OperatorBusiness,
  type ProgramRow,
  assertLocationInBusiness,
  pgErrorCode,
} from "./core";
import { accreditableProgram } from "./resolve";
import {
  type GrantItem,
  type GrantedOrder,
  persistGrant,
  readOrderByRequest,
} from "./orders";
import { dispatchGranted } from "../wallet/push";

const MAX_MONEY = 9_999_999_999.99;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuid(value: unknown, field: string): string {
  if (typeof value === "string" && uuidPattern.test(value.trim())) {
    return value.trim();
  }
  throw new CounterError(
    422,
    "invalid_input",
    `El campo ${field} no es válido.`,
  );
}

/** numeric(12,2), non-negative. Throws 422 on anything else. */
function parseMoney(value: unknown, label: string): string {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new CounterError(422, "invalid_amount", `${label} no es válido.`);
  }
  if (amount > MAX_MONEY) {
    throw new CounterError(
      422,
      "invalid_amount",
      `${label} es demasiado grande.`,
    );
  }
  return amount.toFixed(2);
}

function parseNote(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new CounterError(422, "invalid_input", "La nota no es válida.");
  }
  const note = value.trim();
  if (!note) return null;
  if (note.length > 280) {
    throw new CounterError(422, "invalid_input", "La nota es demasiado larga.");
  }
  return note;
}

function programAccrual(program: ProgramRow): AccrualInput {
  if (
    (program.accrualMode !== "per_amount" &&
      program.accrualMode !== "per_purchase") ||
    program.accrualGrant === null
  ) {
    throw new CounterError(
      404,
      "no_program",
      "El programa no tiene una mecánica de acumulación válida.",
    );
  }
  return {
    mode: program.accrualMode,
    grant: program.accrualGrant,
    blockAmount: program.accrualBlockAmount,
  };
}

/** Membership scoped to the operator's business (never another business's). A
 * missing/foreign membership → 403; a malformed uuid → 422. */
async function loadMembershipInBusiness(
  membershipId: string,
  businessId: string,
) {
  const [row] = await getDb()
    .select({
      id: programMemberships.id,
      consumerId: programMemberships.consumerId,
      programId: programMemberships.programId,
    })
    .from(programMemberships)
    .where(
      and(
        eq(programMemberships.id, membershipId),
        eq(programMemberships.businessId, businessId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new CounterError(
      403,
      "foreign_membership",
      "Esta membresía no pertenece a tu negocio.",
    );
  }
  return row;
}

/** Validates a detailed cart against the business catalog and returns snapshot lines
 * + the summed total. Each line snapshots the DB product name and unit price; a
 * product without a stored price requires the operator's typed `unitPrice`. */
async function buildDetailed(
  businessId: string,
  rawItems: unknown,
): Promise<{ total: string; items: GrantItem[] }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new CounterError(422, "empty_cart", "Agregá al menos un producto.");
  }
  const parsed = rawItems.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const productId = parseUuid(item.productId, "productId");
    const quantity = item.quantity;
    if (!Number.isInteger(quantity) || (quantity as number) <= 0) {
      throw new CounterError(422, "invalid_input", "La cantidad no es válida.");
    }
    return {
      productId,
      quantity: quantity as number,
      rawUnitPrice: item.unitPrice,
    };
  });

  const ids = [...new Set(parsed.map((p) => p.productId))];
  const rows = await getDb()
    .select({
      id: products.id,
      name: products.name,
      unitPrice: products.unitPrice,
    })
    .from(products)
    .where(and(eq(products.businessId, businessId), inArray(products.id, ids)));
  const byId = new Map(rows.map((r) => [r.id, r]));

  let totalCents = 0;
  const items: GrantItem[] = parsed.map((p) => {
    const product = byId.get(p.productId);
    if (!product) {
      throw new CounterError(
        422,
        "unknown_product",
        "Un producto no es válido.",
      );
    }
    // Snapshot the DB price; when the catalog has no price the operator typed it.
    const unitPrice =
      product.unitPrice !== null
        ? Number(product.unitPrice).toFixed(2)
        : parseMoney(p.rawUnitPrice, "El importe de la línea");
    const lineTotal = (Number(unitPrice) * p.quantity).toFixed(2);
    totalCents += Math.round(Number(lineTotal) * 100);
    return {
      productId: p.productId,
      nameSnapshot: product.name,
      unitPrice,
      quantity: p.quantity,
      lineTotal,
    };
  });

  const total = (totalCents / 100).toFixed(2);
  if (Number(total) > MAX_MONEY) {
    throw new CounterError(
      422,
      "invalid_amount",
      "El total es demasiado grande.",
    );
  }
  return { total, items };
}

export type GrantResult = {
  order: { unitsGranted: number; balanceAfter: number; kind: string };
};

/**
 * Validates and executes an accreditation (spec 0030): resolves the membership within
 * the operator's business, computes the grant from the program's accrual and the sale
 * total, and persists it atomically & idempotently (see {@link persistGrant}). A retry
 * with the same `clientRequestId` returns the same order without re-granting.
 */
export async function grantAccrual(
  business: OperatorBusiness,
  operatorUserId: string,
  raw: Record<string, unknown>,
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
  const locationId =
    raw.locationId === null ||
    raw.locationId === undefined ||
    raw.locationId === ""
      ? null
      : await assertLocationInBusiness(
          business.id,
          parseUuid(raw.locationId, "locationId"),
        );

  const membership = await loadMembershipInBusiness(membershipId, business.id);
  const program = await accreditableProgram(business.id);
  if (membership.programId !== program.id) {
    throw new CounterError(
      404,
      "no_program",
      "El programa de esta membresía ya no acredita.",
    );
  }
  const accrual = programAccrual(program);
  const kind = program.kind === "stamps" ? "stamps" : "points";

  let total: string;
  let items: GrantItem[] = [];
  if (mode === "detailed") {
    ({ total, items } = await buildDetailed(business.id, raw.items));
  } else {
    total = parseMoney(raw.total, "El importe");
  }

  const units = computeAccrual(accrual, Number(total));

  let granted: GrantedOrder | null;
  try {
    granted = await persistGrant({
      businessId: business.id,
      locationId,
      programId: program.id,
      membershipId: membership.id,
      consumerId: membership.consumerId,
      mode,
      total,
      currencyCode: business.currencyCode,
      note,
      accrualKind: kind,
      units,
      createdByUserId: operatorUserId,
      clientRequestId,
      items,
    });
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
      "No pudimos acreditar. Probá de nuevo.",
    );
  }

  // Best-effort inline dispatch of the transactional push (ADR 0037); only fires when
  // THIS call created the order (retry/reread has no pushQueueId). Non-blocking.
  dispatchGranted(granted.pushQueueId);

  return {
    order: {
      unitsGranted: granted.unitsGranted,
      balanceAfter: granted.balanceAfter,
      kind: granted.accrualKind,
    },
  };
}
