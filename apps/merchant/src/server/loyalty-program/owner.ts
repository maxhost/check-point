import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { businesses, loyaltyPrograms, memberships } from "../schema";
import { loadProgramRewards, updateWithEvent } from "./persistence";

/**
 * LOS DOS RESOLVEDORES del owner en el dominio del programa.
 *
 * Viven acá y no en `loyalty-program.ts` por el hook `file-size` (300 líneas): el
 * invariante crear ≠ editar de la spec 0077 lo pasaba de largo, y la regla del repo es
 * **dividir, no extender**. Es un movimiento LITERAL —ni una línea de comportamiento
 * cambió— y `loyalty-program.ts` los re-exporta, así que ningún import existente se toca.
 *
 * No importan nada de `loyalty-program.ts`: no hay ciclo.
 */
/**
 * Spec 0086 §10 (enmienda 2026-09-21) — **`businessId` OPCIONAL**, con la misma forma y el
 * mismo motivo que su gemelo de `server/brand.ts`: sin el parametro el comportamiento es
 * **identico al de antes** (owner-only, `desc(createdAt)`, `limit(1)`), y con el se resuelve
 * el negocio que el guard ya resolvio, sin filtrar rol pero exigiendo membresia.
 *
 * Aflojar el `eq(role,'owner')` se descarto: con `limit(1)` sobre un orden por fecha, un
 * usuario con dos membresias escribiria en el negocio equivocado en silencio.
 */
export async function ownerBusiness(userId: string, businessId?: string) {
  const [business] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      countryCode: businesses.countryCode,
      currencyCode: businesses.currencyCode,
      timezone: businesses.timezone,
      brandPrimaryColor: businesses.brandPrimaryColor,
      brandComplementaryColor: businesses.brandComplementaryColor,
      brandAccentColor: businesses.brandAccentColor,
      // Spec 0072, cierre de F1: el eje `status` se lee ACA porque este es el resolvedor que
      // usa `saveProgram`, o sea el que decide SOBRE QUE NEGOCIO se escribe. Gatear con otro
      // resolvedor sería evaluar el estado de una fila y escribir en otra — que es exactamente
      // la divergencia `asc`/`desc` que la §D3 declara abierta.
      status: businesses.status,
      suspensionReason: businesses.suspensionReason,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      businessId === undefined
        ? and(eq(memberships.userId, userId), eq(memberships.role, "owner"))
        : and(
            eq(memberships.userId, userId),
            eq(memberships.businessId, businessId),
          ),
    )
    .orderBy(desc(businesses.createdAt))
    .limit(1);
  return business ?? null;
}

export async function programForOwner(userId: string, businessId?: string) {
  const business = await ownerBusiness(userId, businessId);
  if (!business) return null;
  const db = getDb();
  // Self-heal expiry on read as a safety net for a late cron; atomic with audit.
  await updateWithEvent(db, {
    set: sql`status = 'inactive', updated_at = now()`,
    where: sql`business_id = ${business.id} AND status = 'closing' AND redemption_ends_at <= now()`,
    actorId: null,
    action: "expired",
  });
  const [program] = await db
    .select()
    .from(loyaltyPrograms)
    .where(
      and(
        eq(loyaltyPrograms.businessId, business.id),
        inArray(loyaltyPrograms.status, ["active", "closing"]),
      ),
    )
    .orderBy(desc(loyaltyPrograms.createdAt))
    .limit(1);
  const rewards = program ? await loadProgramRewards(program.id) : [];
  return { business, program: program ?? null, rewards };
}
