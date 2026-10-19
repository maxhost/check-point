import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  consumerAccounts,
  loyaltyPrograms,
  programMemberships,
} from "@mi-pasaporte/db/schema";
import {
  CounterError,
  type OperatorBusiness,
  type ProgramRow,
  assertLocationInBusiness,
  pgErrorCode,
} from "@mi-pasaporte/domain/server/counter/core";
import { insertMembershipWithProjection } from "@mi-pasaporte/domain/server/customers/projection";

const QR_UNRESOLVED = "No pudimos leer este código. Prueba de nuevo.";
const NO_PROGRAM =
  "Este negocio no tiene un programa activo para acreditar. Configúralo primero.";

/** The single operational (active|closing) accreditable program of a business:
 * a Puntos/Sellos program with its accrual mechanics defined (spec 0036). At most
 * one exists (unique `core_loyalty_program_one_operational`). */
export async function accreditableProgram(
  businessId: string,
): Promise<ProgramRow> {
  const [program] = await getDb()
    .select({
      id: loyaltyPrograms.id,
      kind: loyaltyPrograms.kind,
      configuration: loyaltyPrograms.configuration,
      redeemAllowInsufficient: loyaltyPrograms.redeemAllowInsufficient,
      accrualMode: loyaltyPrograms.accrualMode,
      accrualGrant: loyaltyPrograms.accrualGrant,
      accrualBlockAmount: loyaltyPrograms.accrualBlockAmount,
      cardBackgroundColor: loyaltyPrograms.cardBackgroundColor,
      cardBackgroundColor2: loyaltyPrograms.cardBackgroundColor2,
      cardBackgroundGradientAngle: loyaltyPrograms.cardBackgroundGradientAngle,
      cardBorderColor: loyaltyPrograms.cardBorderColor,
      stampImageObjectKey: loyaltyPrograms.stampImageObjectKey,
      stampImageVersion: loyaltyPrograms.stampImageVersion,
      businessId: loyaltyPrograms.businessId,
    })
    .from(loyaltyPrograms)
    .where(
      and(
        eq(loyaltyPrograms.businessId, businessId),
        inArray(loyaltyPrograms.status, ["active", "closing"]),
        inArray(loyaltyPrograms.kind, ["points", "stamps"]),
        isNotNull(loyaltyPrograms.accrualMode),
      ),
    )
    .limit(1);
  if (!program) throw new CounterError(404, "no_program", NO_PROGRAM);
  return program;
}

/** Identity/enrolment context shared by scan consumers. No catalogue or purchase effects.
 * The raw program stays server-side; each caller projects its own public allow-list. */
export async function resolveScanContext(
  business: OperatorBusiness,
  qrToken: string,
  selectedLocationId?: string | null,
) {
  const token = typeof qrToken === "string" ? qrToken.trim() : "";
  if (!token) throw new CounterError(422, "qr_unresolved", QR_UNRESOLVED);
  const locationId = selectedLocationId
    ? await assertLocationInBusiness(business.id, selectedLocationId)
    : null;

  const program = await accreditableProgram(business.id);

  const [account] = await getDb()
    .select({
      id: consumerAccounts.id,
      firstName: consumerAccounts.firstName,
      lastName: consumerAccounts.lastName,
    })
    .from(consumerAccounts)
    .where(eq(consumerAccounts.qrToken, token))
    .limit(1);
  if (!account) throw new CounterError(422, "qr_unresolved", QR_UNRESOLVED);

  const membership = await resolveMembership(
    account.id,
    program.id,
    business.id,
  );
  // Spec 0148 / ADR 0119 §2: «the business where they scanned it» — the PWA's «aca» without
  // GPS. After `resolveMembership`, which guarantees the row (the auto-enrolment writes it).
  await getDb().execute(sql`
    update core.business_customer set last_scan_at = now()
    where business_id = ${business.id} and consumer_id = ${account.id}
  `);
  return {
    consumerId: account.id,
    displayName: `${account.firstName} ${account.lastName}`.trim(),
    membership,
    program,
    locationId,
  };
}

/** Reads the (consumer, program) membership or auto-enrolls it with a zero balance.
 * A concurrent auto-enroll (23505 on the unique) is reread, never a 500. The auto-enroll
 * writes its row of `core.business_customer` in the SAME statement (spec 0108); the `23505`
 * aborts that statement whole, so the reread path never half-writes the projection. */
async function resolveMembership(
  consumerId: string,
  programId: string,
  businessId: string,
) {
  const existing = await readMembership(consumerId, programId);
  if (existing) return { ...existing, justEnrolled: false };
  try {
    const row = await insertMembershipWithProjection({
      consumerId,
      programId,
      businessId,
    });
    return {
      id: row.id,
      pointsBalance: row.pointsBalance,
      stampsCount: row.stampsCount,
      justEnrolled: true,
    };
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      const reread = await readMembership(consumerId, programId);
      if (reread) return { ...reread, justEnrolled: false };
    }
    throw error;
  }
}

async function readMembership(consumerId: string, programId: string) {
  const [row] = await getDb()
    .select({
      id: programMemberships.id,
      pointsBalance: programMemberships.pointsBalance,
      stampsCount: programMemberships.stampsCount,
    })
    .from(programMemberships)
    .where(
      and(
        eq(programMemberships.consumerId, consumerId),
        eq(programMemberships.programId, programId),
      ),
    )
    .limit(1);
  return row;
}
