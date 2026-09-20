import { getMerchantAuth } from "../auth";
import type { ChecklistFacts } from "./checklist";

/**
 * Spec 0083 §D3/§D4 — LOS HECHOS con los que se resuelve el `done` de cada item, leidos de la
 * SESION.
 *
 * **Por que es un modulo y no dos lineas en la ruta:** desde la enmienda del 2026-09-20 la
 * ruta resuelve al owner con `requireApiOwnerSinGateDeEmail`, y el contrato de retorno de esa
 * funcion —el mismo de `requireApiOwner`— son `business` y `userId`, **no la sesion**. Sacar
 * los hechos ahi adentro obligaria a tocar el CUERPO de los dos guards, y la spec 0075 exige
 * que queden byte por byte iguales. Con los hechos aca, el archivo de la ruta no nombra
 * `getSession` ni consulta por su cuenta: su unica escalera es la compartida.
 *
 * **ES UNA SEGUNDA LECTURA DE LA SESION EN EL MISMO REQUEST**, igual que `callerOf` en
 * `app/api/loyalty-program/route.ts` y por el mismo motivo. Sin `cookieCache` configurado es
 * una consulta mas por pedido de checklist. **El §D4 de la spec lo registra corregido**: su
 * version original decia «cero consultas extra», cierta cuando la ruta armaba la escalera a
 * mano y resolvia la sesion UNA vez, y la enmienda del 2026-09-20 la volvio falsa.
 *
 * **Fail-closed:** sin sesion —camino que el guard ya corto con un 401 antes de llegar aca—
 * los hechos salen en su valor mas pendiente, nunca dando un item por hecho. `=== true` y no
 * truthy, la misma regla que el paso 3 de `api-owner.ts`.
 */
export async function checklistFacts(
  request: Request,
): Promise<ChecklistFacts> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  return { emailVerified: session?.user.emailVerified === true };
}
