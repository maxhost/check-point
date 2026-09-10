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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid straight from the request body. Anything else is a 422 `invalid_input`.
 * Lives here (not in `grant.ts`) because `redeem.ts` validates the same shapes and a
 * second copy of a validator is how two places that decide the same thing diverge. */
export function parseUuid(value: unknown, field: string): string {
  if (typeof value === "string" && uuidPattern.test(value.trim())) {
    return value.trim();
  }
  throw new CounterError(
    422,
    "invalid_input",
    `El campo ${field} no es válido.`,
  );
}

/** The counter operator's business (id + snapshot currency). Any membership role
 * (owner or staff) may operate the counter; returns null when the user owns none.
 *
 * The `status = 'active'` filter is load-bearing (ADR 0044, spec 0055): a `disabled`
 * member keeps their identity and their audit trail but loses access — and the counter
 * hands over merchandise and destroys balance, so a dismissed employee must not be able
 * to accredit or redeem. It gates all three endpoints (`resolve`/`grant`/`redeem`). */
export type OperatorBusiness = { id: string; currencyCode: string };

export async function operatorBusiness(
  userId: string,
): Promise<OperatorBusiness | null> {
  const [business] = await getDb()
    .select({ id: businesses.id, currencyCode: businesses.currencyCode })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      and(eq(memberships.userId, userId), eq(memberships.status, "active")),
    )
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return business ?? null;
}

/** Confirms a location belongs to the operator's business AND is still `active`;
 * returns the id, or throws 422 on a foreign/unknown/archived location.
 *
 * The `status = 'active'` filter is load-bearing (spec 0061). Dropping the location from
 * the counter's selector is an INTERFACE gate: `backoffice/counter/page.tsx` also accepts
 * `?location=<uuid>` — the parameter exists precisely so the staff can bookmark their
 * branch's counter — so an old tab or a saved link would keep accrediting and redeeming
 * against an archived location. That is «a locked door next to an open wall», the same
 * shape as the better-auth plugin of spec 0046. The list filter and this one both ship;
 * this is the one that decides.
 *
 * Pinned by the first case of `locations-counter-guard.neon.integration.test.ts`, and the
 * pairing was EXECUTED, not assumed: with this `eq` removed that test goes red because the
 * archived location accredited 90 points and the balance moved. Its second case (two
 * locations, attribution) stays green under the same removal — it does not cover this. */
export async function assertLocationInBusiness(
  businessId: string,
  locationId: string,
): Promise<string> {
  const [row] = await getDb()
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.id, locationId),
        eq(locations.businessId, businessId),
        eq(locations.status, "active"),
      ),
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
  /** Raw `configuration` jsonb — `target` lives here (Sellos), never in a column.
   * The jsonb itself is NEVER serialized: `programDTO` is an allow-list, and the only
   * key of it that reaches the client is `target` (via {@link rawTarget}). Adding a
   * second one is a decision, not a detail — `counter-redeem-surfaces` asserts the DTO
   * carries no `configuration` and no `*ObjectKey`, and goes red if that changes. */
  configuration: unknown;
  redeemAllowInsufficient: boolean;
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

/** `configuration.target` straight out of the program jsonb, untouched. Validating it is
 * the job of whoever consumes it (`planRedemption` on the server, `rewardState` on the
 * client): `Number(null) === 0` would be a free redemption. ONE definition, used by
 * `redeem.ts` and by `programDTO` — two copies of a validator is how two places that
 * decide the same thing diverge. */
export function rawTarget(program: ProgramRow): unknown {
  const configuration = program.configuration;
  if (!configuration || typeof configuration !== "object") return undefined;
  return (configuration as Record<string, unknown>).target;
}

/** Program DTO for the counter: kind + accrual + card design. Never serializes the
 * internal `stampImageObjectKey` nor the raw `configuration` jsonb (allow-list) — only
 * the public stamp path and the ONE key of `configuration` the console needs. */
export function programDTO(program: ProgramRow) {
  return {
    id: program.id,
    kind: program.kind,
    redeemAllowInsufficient: program.redeemAllowInsufficient,
    // The Sellos card size, RAW and never normalized (spec 0055 «UI — consola de
    // mostrador»): the console draws `stamps_count` / `target` and decides with the same
    // semantics the server enforces, so it can never show "Canjeable" on a program the
    // redemption answers `422 invalid_program` to. This is a single key of
    // `configuration`, NOT the jsonb: nothing else of it is serialized.
    target: rawTarget(program),
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
