import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { insertMembershipWithProjection } from "../customers/projection";
import {
  businesses,
  locations,
  loyaltyPrograms,
} from "@mi-pasaporte/db/schema";
import { ConsumerError, type MembershipRow, pgErrorCode } from "./core";

const PROGRAM_UNAVAILABLE = "Este programa no está disponible.";

/**
 * El eje `status` del negocio, del lado del CONSUMIDOR (spec 0072 §D4).
 *
 * **La línea que separa lo que se corta de lo que no es «ya emitido» vs «alta nueva»**, y no
 * «comercio» vs «consumidor»: el pase de Wallet, los sellos acumulados y la tarjeta de quien
 * YA está adentro **no se tocan** (decisión del owner: un pase borrado del teléfono no vuelve,
 * y `status` es reversible). Lo que se corta es el alta NUEVA, que es esto.
 *
 * **El 403 NO lleva `suspension_reason`**: el motivo se serializa sólo al owner (§D4). Un
 * consumidor no tiene por qué leer la nota interna de por qué se suspendió una cuenta.
 */
function assertBusinessAdmitsEnrollment(businessStatus: string): void {
  if (businessStatus === "active") return;
  if (businessStatus === "closed") {
    throw new ConsumerError(
      403,
      "business_closed",
      "Este negocio cerró y ya no admite altas nuevas.",
    );
  }
  // Fail-closed sobre un estado desconocido, igual que `businessStatusFailure`.
  throw new ConsumerError(
    403,
    "business_suspended",
    "Este negocio no está aceptando altas nuevas por ahora.",
  );
}

/** Reads a program that admits enrollment (active | closing). A malformed uuid
 * (Postgres 22P02) is treated as an unavailable program (404), never a 500. */
async function loadEnrollableProgram(programId: string) {
  const db = getDb();
  try {
    const [program] = await db
      .select({
        id: loyaltyPrograms.id,
        businessId: loyaltyPrograms.businessId,
        // Spec 0072 §D4: el eje `status` del NEGOCIO. El alta nueva se corta en
        // `suspended` y en `closed` — decisión textual del owner del 2026-09-17: «el alta
        // nueva también queda suspendida si el negocio está suspendido, si está cerrado
        // queda cerrado para altas nuevas». El QR pegado en la pared sigue circulando, así
        // que sin esto un negocio cerrado seguiría dando de alta gente.
        businessStatus: businesses.status,
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
    if (!program)
      throw new ConsumerError(404, "program_unavailable", PROGRAM_UNAVAILABLE);
    assertBusinessAdmitsEnrollment(program.businessStatus);
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

/**
 * Enrolls an EXISTING account (the session's, or the one the provider callback just found or
 * created — spec 0119 / ADR 0111 §6) into a program. Validates the program admits enrollment
 * (active/closing → continue; inactive/missing/suspended → 404/403) and creates the membership
 * with its projection row, or throws 409 `already_member` (backed by the unique on
 * `consumer_id, program_id`, so a race also lands on 409). Writes NOTHING to the account.
 *
 * `originLocationId` (raw, optional; ADR 0042/spec 0041) is the `loc` from the poster QR:
 * validated against the program's business, persisted only on the FIRST alta. A re-alta (409)
 * throws on the membership insert, so the original `origin_location_id` stays.
 */
export async function enrollAccount(
  programId: string,
  accountId: string,
  originLocationId?: string | null,
): Promise<MembershipRow> {
  const program = await loadEnrollableProgram(programId);
  const resolvedOriginLocationId = await resolveOriginLocation(
    program.businessId,
    originLocationId,
  );
  try {
    // Spec 0108: the membership and its row of `core.business_customer` in ONE statement. A
    // 409 aborts the whole statement, so an existing member leaves the projection untouched.
    return await insertMembershipWithProjection({
      consumerId: accountId,
      programId: program.id,
      businessId: program.businessId,
      originLocationId: resolvedOriginLocationId,
    });
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      throw new ConsumerError(
        409,
        "already_member",
        "Ya formás parte de este programa.",
      );
    }
    throw error;
  }
}

// The public landing of the enroll page lives in ./enroll-landing (size budget, spec 0107).
export {
  type EnrollLanding,
  getEnrollLanding,
  isProgramMember,
} from "./enroll-landing";
