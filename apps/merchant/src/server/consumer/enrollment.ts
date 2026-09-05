import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  businesses,
  consumerAccounts,
  locations,
  loyaltyPrograms,
  programMemberships,
} from "../schema";
import {
  type ConsumerAccountRow,
  ConsumerError,
  type EnrollInput,
  type MembershipRow,
  generateOpaqueToken,
  pgErrorCode,
} from "./core";

const PROGRAM_UNAVAILABLE = "Este programa no está disponible.";

export type EnrollResult = {
  account: ConsumerAccountRow;
  membership: MembershipRow;
  /**
   * True when the phone already had an account — including the race path (23505),
   * where another request created it an instant before this one. The 201 exposes it
   * so the confirmation can show the "ya tienes una cuenta" toast (ADR 0051).
   */
  existingAccount: boolean;
};

/** Reads a program that admits enrollment (active | closing). A malformed uuid
 * (Postgres 22P02) is treated as an unavailable program (404), never a 500. */
async function loadEnrollableProgram(programId: string) {
  const db = getDb();
  try {
    const [program] = await db
      .select({
        id: loyaltyPrograms.id,
        businessId: loyaltyPrograms.businessId,
      })
      .from(loyaltyPrograms)
      .where(
        and(
          eq(loyaltyPrograms.id, programId),
          inArray(loyaltyPrograms.status, ["active", "closing"]),
        ),
      )
      .limit(1);
    if (!program)
      throw new ConsumerError(404, "program_unavailable", PROGRAM_UNAVAILABLE);
    return program;
  } catch (error) {
    if (error instanceof ConsumerError) throw error;
    if (pgErrorCode(error) === "22P02")
      throw new ConsumerError(404, "program_unavailable", PROGRAM_UNAVAILABLE);
    throw error;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the origin local for a self-service alta (ADR 0042). Unlike the counter's
 * `assertLocationInBusiness` (which THROWS 422 on a foreign local), the alta must NEVER
 * break on a stale/foreign/malformed `loc` from a printed poster — an unresolvable loc
 * simply attributes `null`. The uuid format is checked before the query so a malformed
 * value never reaches Postgres (avoids a 22P02). Only a local that belongs to the
 * program's business resolves; anything else → null (no cross-business attribution).
 */
async function resolveOriginLocation(
  businessId: string,
  loc: string | null | undefined,
): Promise<string | null> {
  if (typeof loc !== "string") return null;
  const candidate = loc.trim();
  if (!UUID_PATTERN.test(candidate)) return null;
  const [row] = await getDb()
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.id, candidate), eq(locations.businessId, businessId)),
    )
    .limit(1);
  return row?.id ?? null;
}

async function accountByPhone(
  phoneE164: string,
): Promise<ConsumerAccountRow | undefined> {
  const [account] = await getDb()
    .select()
    .from(consumerAccounts)
    .where(eq(consumerAccounts.phoneE164, phoneE164))
    .limit(1);
  return account;
}

/**
 * Enrolls a consumer into a program. Validates the program admits enrollment
 * (active/closing → continue; inactive/missing → 404). Reuses the account by
 * phone — or creates it with a fresh `qrToken` — and then creates the membership, or
 * throws 409 `already_member` (backed by the unique on `consumer_id, program_id`, so a
 * race also lands on 409). Never opens a session here — the caller does that only on
 * success.
 *
 * An existing account is reused AS-IS (ADR 0051, superseding the 0050): the enroll
 * writes NOTHING to `consumer_account` — not the name, not any column. The name just
 * typed is deliberately discarded on a reused account; the 201 carries
 * `existingAccount: true` so the confirmation can say why the stored data won. The
 * only write to the account table is the `insert` of a brand-new phone.
 *
 * `originLocationId` (raw, optional; ADR 0042/spec 0041) is the `loc` from the poster
 * QR: validated against the program's business, persisted only on the FIRST alta. A
 * re-alta (409) throws on the membership insert, so the original `origin_location_id`
 * stays.
 */
export async function enroll(
  programId: string,
  input: EnrollInput,
  originLocationId?: string | null,
): Promise<EnrollResult> {
  const db = getDb();
  const program = await loadEnrollableProgram(programId);
  const resolvedOriginLocationId = await resolveOriginLocation(
    program.businessId,
    originLocationId,
  );

  const existing = await accountByPhone(input.phoneE164);
  // The phone already has an account → reuse that identity as-is, byte for byte. The
  // profile is never rewritten here (ADR 0051) — the caller informs instead of mutating.
  let account: ConsumerAccountRow | undefined = existing;
  // True when the account pre-existed this request — including the race below, where
  // another request created it an instant earlier. Exposed on the result (ADR 0051).
  let existingAccount = existing !== undefined;
  if (!existing) {
    try {
      [account] = await db
        .insert(consumerAccounts)
        .values({
          phoneE164: input.phoneE164,
          firstName: input.firstName,
          lastName: input.lastName,
          countryIso: input.countryIso,
          qrToken: generateOpaqueToken(),
          // Distinct opaque token for the "Ver mis programas" magic-link (0029),
          // independently revocable from the qrToken.
          webViewToken: generateOpaqueToken(),
        })
        .returning();
    } catch (error) {
      // Concurrent enroll created the account first → reuse THAT row exactly as it was
      // created (id, name, tokens, country — nothing is overwritten, ADR 0051). For the
      // caller this is an existing account too: it pre-existed this request, even if
      // only by an instant.
      if (pgErrorCode(error) === "23505") {
        account = await accountByPhone(input.phoneE164);
        existingAccount = account !== undefined;
      } else {
        throw error;
      }
    }
  }
  if (!account) {
    throw new ConsumerError(
      503,
      "enroll_failed",
      "No pudimos completar el enrolamiento.",
    );
  }

  let membership: MembershipRow;
  try {
    [membership] = await db
      .insert(programMemberships)
      .values({
        consumerId: account.id,
        programId: program.id,
        businessId: program.businessId,
        originLocationId: resolvedOriginLocationId,
      })
      .returning();
  } catch (error) {
    // The account is never written on a reused phone (ADR 0051), so a rejected
    // enroll — the 409 below or any other failure — leaves it untouched.
    if (pgErrorCode(error) === "23505") {
      throw new ConsumerError(
        409,
        "already_member",
        "Ya formás parte de este programa. Si perdiste el acceso a tu tarjeta, vas a poder recuperarla pronto.",
      );
    }
    throw error;
  }

  return { account, membership, existingAccount };
}

export type EnrollLanding = {
  programId: string;
  /** Public business id — used to build the public logo URL. */
  businessId: string;
  businessName: string;
  /** Business country (ISO-2) — the form's default selection. May be null/empty. */
  countryCode: string | null;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  logoVersion: number;
  /** Whether the business has a published logo. Derived from `logoObjectKey`;
   * the internal R2 key is NEVER serialized to the client. */
  hasLogo: boolean;
};

/** Public landing info for a program that admits enrollment, or null (unavailable). */
export async function getEnrollLanding(
  programId: string,
): Promise<EnrollLanding | null> {
  try {
    const [row] = await getDb()
      .select({
        programId: loyaltyPrograms.id,
        businessId: businesses.id,
        businessName: businesses.name,
        countryCode: businesses.countryCode,
        brandPrimaryColor: businesses.brandPrimaryColor,
        brandComplementaryColor: businesses.brandComplementaryColor,
        brandAccentColor: businesses.brandAccentColor,
        logoVersion: businesses.logoVersion,
        // Selected only to derive `hasLogo`; the internal R2 key is stripped below
        // and never leaves the server (anti-leak rule, CLAUDE.md).
        logoObjectKey: businesses.logoObjectKey,
      })
      .from(loyaltyPrograms)
      .innerJoin(businesses, eq(businesses.id, loyaltyPrograms.businessId))
      .where(
        and(
          eq(loyaltyPrograms.id, programId),
          inArray(loyaltyPrograms.status, ["active", "closing"]),
        ),
      )
      .limit(1);
    if (!row) return null;
    const { logoObjectKey, ...rest } = row;
    return { ...rest, hasLogo: logoObjectKey != null };
  } catch (error) {
    if (pgErrorCode(error) === "22P02") return null;
    throw error;
  }
}
