import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { businesses, locations, memberships } from "../schema";
import type { AccrualInput } from "../loyalty-program/core";

/** Typed domain error: HTTP status + stable machine `code` + user message. */
export class CounterError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Walks the `.cause` chain (drizzle wraps the pg error) and returns its SQLSTATE. */
export function pgErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const code = (current as { code?: string }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** neon-http returns `{ rows }`; the pg builder returns an array. Normalize both. */
export function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

/** The counter operator's business (id + snapshot currency). Any membership role
 * (owner or staff) may operate the counter; returns null when the user owns none. */
export type OperatorBusiness = { id: string; currencyCode: string };

export async function operatorBusiness(
  userId: string,
): Promise<OperatorBusiness | null> {
  const [business] = await getDb()
    .select({ id: businesses.id, currencyCode: businesses.currencyCode })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return business ?? null;
}

/** Confirms a location belongs to the operator's business (defends the FK against a
 * spoofed `?location`); returns the id, or throws 422 on a foreign/unknown location. */
export async function assertLocationInBusiness(
  businessId: string,
  locationId: string,
): Promise<string> {
  const [row] = await getDb()
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.id, locationId), eq(locations.businessId, businessId)),
    )
    .limit(1);
  if (!row) {
    throw new CounterError(422, "unknown_location", "El local no es válido.");
  }
  return row.id;
}

/** Public accrual shape (mirrors the loyalty client-view DTO). */
export type AccrualDTO = {
  mode: AccrualInput["mode"];
  grant: number;
  blockAmount: number | null;
};

/** Card design colors for the counter preview (Sellos); all optional. */
export type CardDesignDTO = {
  backgroundColor: string | null;
  backgroundColor2: string | null;
  gradientAngle: number | null;
  borderColor: string | null;
};

export type ProgramRow = {
  id: string;
  kind: string;
  accrualMode: string | null;
  accrualGrant: number | null;
  accrualBlockAmount: string | null;
  cardBackgroundColor: string | null;
  cardBackgroundColor2: string | null;
  cardBackgroundGradientAngle: number | null;
  cardBorderColor: string | null;
  stampImageObjectKey: string | null;
  stampImageVersion: number;
};

/** Program DTO for the counter: kind + accrual + card design. Never serializes the
 * internal `stampImageObjectKey` (allow-list) — only the public stamp path. */
export function programDTO(program: ProgramRow) {
  return {
    id: program.id,
    kind: program.kind,
    accrual: {
      mode: program.accrualMode,
      grant: program.accrualGrant,
      blockAmount:
        program.accrualBlockAmount === null
          ? null
          : Number(program.accrualBlockAmount),
    },
    cardDesign: {
      backgroundColor: program.cardBackgroundColor,
      backgroundColor2: program.cardBackgroundColor2,
      gradientAngle: program.cardBackgroundGradientAngle,
      borderColor: program.cardBorderColor,
    },
  };
}
