import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  consumerAccounts,
  loyaltyPrograms,
  productCategories,
  products,
  programMemberships,
} from "../schema";
import {
  CounterError,
  type OperatorBusiness,
  type ProgramRow,
  pgErrorCode,
  programDTO,
} from "./core";

const QR_UNRESOLVED = "No pudimos leer este código. Probá de nuevo.";
const NO_PROGRAM =
  "Este negocio no tiene un programa activo para acreditar. Configuralo primero.";

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

/** Lean catalog for the detailed-sale cart: id, name, unit price, image path. */
async function businessCatalog(businessId: string) {
  const rows = await getDb()
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      unitPrice: products.unitPrice,
      imageObjectKey: products.imageObjectKey,
      imageVersion: products.imageVersion,
    })
    .from(products)
    .where(eq(products.businessId, businessId))
    .orderBy(asc(products.name));
  const categories = await getDb()
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.businessId, businessId))
    .orderBy(asc(productCategories.name));
  return {
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      unitPrice: p.unitPrice === null ? null : Number(p.unitPrice),
      imagePath: p.imageObjectKey
        ? `/api/public/catalog/${p.id}/image?v=${p.imageVersion}`
        : null,
    })),
    categories,
  };
}

export type ResolveResult = ReturnType<typeof buildResolveResult>;

function buildResolveResult(opts: {
  displayName: string;
  membership: {
    id: string;
    pointsBalance: number;
    stampsCount: number;
    justEnrolled: boolean;
  };
  program: ProgramRow;
  catalog: Awaited<ReturnType<typeof businessCatalog>>;
}) {
  return {
    // Allow-list: the consumer's display name only — never the qr_token.
    consumer: { displayName: opts.displayName },
    membership: opts.membership,
    program: programDTO(opts.program),
    catalog: opts.catalog,
  };
}

/**
 * Resolves a scanned `qrToken` against the operator's business: finds the consumer,
 * the business's accreditable program, and the membership — AUTO-ENROLLING the
 * consumer (balance 0) when they are not yet a member (ADR 0033). Never leaks the
 * qr_token. Errors: 404 no accreditable program; 422 the qr_token does not resolve.
 */
export async function resolveScan(
  business: OperatorBusiness,
  qrToken: string,
): Promise<ResolveResult> {
  const token = typeof qrToken === "string" ? qrToken.trim() : "";
  if (!token) throw new CounterError(422, "qr_unresolved", QR_UNRESOLVED);

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
  const catalog = await businessCatalog(business.id);

  return buildResolveResult({
    displayName: `${account.firstName} ${account.lastName}`.trim(),
    membership,
    program,
    catalog,
  });
}

/** Reads the (consumer, program) membership or auto-enrolls it with a zero balance.
 * A concurrent auto-enroll (23505 on the unique) is reread, never a 500. */
async function resolveMembership(
  consumerId: string,
  programId: string,
  businessId: string,
) {
  const db = getDb();
  const existing = await readMembership(consumerId, programId);
  if (existing) return { ...existing, justEnrolled: false };
  try {
    const [row] = await db
      .insert(programMemberships)
      .values({ consumerId, programId, businessId })
      .returning({
        id: programMemberships.id,
        pointsBalance: programMemberships.pointsBalance,
        stampsCount: programMemberships.stampsCount,
      });
    return { ...row, justEnrolled: true };
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
