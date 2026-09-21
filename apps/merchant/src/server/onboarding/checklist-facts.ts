import { eq } from "drizzle-orm";
import { getMerchantAuth } from "../auth";
import { getDb } from "../db";
import { businessOnboardingTours } from "../schema";
import type { ChecklistFacts } from "./checklist";

/**
 * Spec 0085 (antes 0083 §D3/§D4) — LOS HECHOS con los que se resuelve el `done` de cada item:
 * la SESION para `verify-email` y `core.business_onboarding_tour` para los cuatro tours.
 *
 * **Por que es un modulo y no dos lineas en la ruta:** desde la enmienda del 2026-09-20 la
 * ruta resuelve al owner con `requireApiOwnerSinGateDeEmail`, y el contrato de retorno de esa
 * funcion —el mismo de `requireApiOwner`— son `business` y `userId`, **no la sesion**. Sacar
 * los hechos ahi adentro obligaria a tocar el CUERPO de los dos guards, y la spec 0075 exige
 * que queden byte por byte iguales. Con los hechos aca, el archivo de la ruta no nombra
 * `getSession` ni consulta por su cuenta: su unica escalera es la compartida.
 *
 * ### EL COSTO, DECLARADO: son DOS lecturas por pedido de checklist
 *
 * 1. **Una segunda resolucion de la SESION en el mismo request**, igual que `callerOf` en
 *    `app/api/loyalty-program/route.ts` y por el mismo motivo. Sin `cookieCache` configurado
 *    es una consulta mas.
 * 2. **UNA consulta a `core.business_onboarding_tour`** — la agrego la spec 0085.
 *
 * **Es UNA sola consulta y no cuatro**: se leen TODAS las filas del negocio (son 4 como mucho,
 * el catalogo de tours es cerrado) y despues cada item pregunta por su id contra el `Set`. El
 * prefijo de la PK `(business_id, tour_id)` ya sirve a ese filtro, asi que no hay indice extra.
 *
 * **El `businessId` lo pone el LLAMADOR desde el guard** (`auth.business.id`), nunca el cuerpo
 * ni la query (ADR 0070 §15.3): si viajara, seria el parametro con el que un owner leeria el
 * progreso de otro negocio.
 *
 * **Fail-closed en los dos ejes:** sin sesion —camino que el guard ya corto con un 401 antes de
 * llegar aca— el email sale `false` (`=== true` y no truthy, la misma regla que el paso 3 de
 * `api-owner.ts`), y un negocio sin filas tiene los cuatro tours en `false`. Un error de
 * lectura **no puede dar un item por hecho**: revienta y la ruta contesta 503, nunca un
 * `done: true` inventado.
 */
export async function checklistFacts(
  request: Request,
  businessId: string,
): Promise<ChecklistFacts> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  const filas = await getDb()
    .select({ tourId: businessOnboardingTours.tourId })
    .from(businessOnboardingTours)
    .where(eq(businessOnboardingTours.businessId, businessId));
  return {
    emailVerified: session?.user.emailVerified === true,
    toursHechos: new Set(filas.map((fila) => fila.tourId)),
  };
}
