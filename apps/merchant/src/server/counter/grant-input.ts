import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { products, programMemberships } from "@mi-pasaporte/db/schema";
import type { AccrualInput } from "@mi-pasaporte/domain/server/loyalty-program/core";
import {
  CounterError,
  type ProgramRow,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import type { GrantItem } from "./orders";
import { availableAtCounter } from "./catalog-visibility";

/**
 * The INPUT side of an accreditation (spec 0030): money, note, the program's accrual, the
 * membership and the detailed cart, validated. Apart from `grant.ts` for its size budget
 * (spec 0148 added the sale with a coupon, `grant-coupon.ts`).
 */

const MAX_MONEY = 9_999_999_999.99;

/** numeric(12,2), non-negative. Throws 422 on anything else. */
export function parseMoney(value: unknown, label: string): string {
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

export function parseNote(value: unknown): string | null {
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

export function programAccrual(program: ProgramRow): AccrualInput {
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
export async function loadMembershipInBusiness(
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
export async function buildDetailed(
  businessId: string,
  locationId: string | null,
  rawItems: unknown,
): Promise<{ total: string; items: GrantItem[] }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new CounterError(422, "empty_cart", "Agrega al menos un producto.");
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
    .where(
      and(
        eq(products.businessId, businessId),
        inArray(products.id, ids),
        availableAtCounter(locationId),
      ),
    );
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
