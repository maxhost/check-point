import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  businesses,
  consumerAccounts,
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
 * phone WITHOUT overwriting the profile, or creates it with a fresh `qrToken`.
 * Creates a new membership, or throws 409 `already_member` (backed by the unique
 * on `consumer_id, program_id`, so a race also lands on 409). Never opens a session
 * here — the caller does that only on success.
 */
export async function enroll(
  programId: string,
  input: EnrollInput,
): Promise<EnrollResult> {
  const db = getDb();
  const program = await loadEnrollableProgram(programId);

  let account = await accountByPhone(input.phoneE164);
  if (!account) {
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
      // Concurrent enroll created the account first → reuse it (do not overwrite).
      if (pgErrorCode(error) === "23505") {
        account = await accountByPhone(input.phoneE164);
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

  try {
    const [membership] = await db
      .insert(programMemberships)
      .values({
        consumerId: account.id,
        programId: program.id,
        businessId: program.businessId,
      })
      .returning();
    return { account, membership };
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      throw new ConsumerError(
        409,
        "already_member",
        "Ya formás parte de este programa. Si perdiste el acceso a tu tarjeta, vas a poder recuperarla pronto.",
      );
    }
    throw error;
  }
}

export type EnrollLanding = {
  programId: string;
  businessName: string;
  /** Business country (ISO-2) — the form's default selection. May be null/empty. */
  countryCode: string | null;
};

/** Public landing info for a program that admits enrollment, or null (unavailable). */
export async function getEnrollLanding(
  programId: string,
): Promise<EnrollLanding | null> {
  try {
    const [row] = await getDb()
      .select({
        programId: loyaltyPrograms.id,
        businessName: businesses.name,
        countryCode: businesses.countryCode,
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
    return row ?? null;
  } catch (error) {
    if (pgErrorCode(error) === "22P02") return null;
    throw error;
  }
}
