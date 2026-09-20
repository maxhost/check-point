import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwnerSinGateDeEmail,
} from "../../../../server/api-owner";
import { toChecklistView } from "../../../../server/onboarding/checklist";
import { checklistFacts } from "../../../../server/onboarding/checklist-facts";

export const dynamic = "force-dynamic";

/**
 * Spec 0083 §D3 / ADR 0077 §6 — `GET /api/onboarding/checklist`.
 *
 * Lectura pura: «que hay que hacer y en que estado esta» **despues** del wizard. El contrato
 * normativo es `docs/specs/0083-contratos-de-api.md`.
 *
 * **ESTA RUTA NO LLEVA EL GATE DEL PASO 3, Y ESE ES EL PUNTO DE LA SPEC.** Un endpoint cuyo
 * unico item dice «verifica tu email» no puede estar bloqueado por no haber verificado el
 * email: se gatearia a si mismo y el owner nunca veria la instruccion que vino a buscar. Es el
 * mismo argumento que sostiene el 200-siempre de `GET /api/merchant/session`.
 *
 * **Por eso NO usa `requireApiOwner`:** su escalera evalua el email en el paso 3 **siempre** y
 * no admite saltarlo (`api-owner.ts`, docblock del modulo). Le contestaria el 403 del
 * paso 3 justo al owner que viene a que le digan que verifique el email — el `code` de ese
 * fallo no se nombra aca a proposito: esta ruta no lo emite en ningun camino y el DoD de la
 * spec lo asevera con un `rg` sobre este directorio.
 *
 * **Y POR ESO USA SU HERMANA `requireApiOwnerSinGateDeEmail`, QUE YA EXISTE, EN VEZ DE ARMAR
 * LA ESCALERA A MANO** —aunque una escalera a mano llamara a las mismas piezas compartidas—:
 * el repo eligio (spec 0075 §D1) marcar las exenciones al gate de email **con un nombre
 * distintivo y no con un flag**, para que `rg 'SinGateDeEmail' apps` pueda contarlas y el
 * conjunto quede aseverado como CERRADO en `api-owner-surfaces.test.ts`. Una escalera escrita
 * a mano seria una exencion **que ni el `rg` ni ese inventario ven**: no es duplicacion fea,
 * es evadir el mecanismo de control sin que nada se ponga rojo. Esta ruta es la **tercera**
 * del conjunto, y su fila esta declarada en `api-owner-surfaces-support.ts` (spec 0083 §D5,
 * decision del owner del 2026-09-20).
 *
 * Lo que esa funcion hace, y es exactamente lo que esta ruta necesita:
 *
 * ```
 * 1. ¿hay sesion?       → 401 unauthorized
 * 2. ¿es owner activo?  → 403 not_owner
 * 3. ¿el email?         → NO CORRE: es la razon de ser de esa funcion  ← la desviacion
 * 4. ¿el negocio OPERA? → 403 business_suspended | business_closed
 * ```
 *
 * **El paso 4 NO se saltea, y la asimetria es deliberada:** saltear el 3 tiene una razon
 * (auto-gateo); saltear el 4 no tendria ninguna, y un negocio cerrado no necesita un checklist
 * de onboarding.
 *
 * **Y el paso 2 hace trabajo real, no es ceremonia:** el staff no tiene email al que
 * escribirle (`@staff.invalid`), asi que un checklist que le llegara le pediria verificar una
 * casilla que no existe y cuya accion contesta 400.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireApiOwnerSinGateDeEmail(request, {
      notOwner: "Solo el owner puede ver el checklist del onboarding.",
    });
    if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);

    // Los hechos del `done` salen de la SESION y viven en `checklist-facts.ts`: el contrato
    // de retorno del guard son `business` y `userId`, no la sesion, y su cuerpo no se toca
    // (invariante de la spec 0075). Ahi esta escrito el costo de esa segunda lectura.
    return NextResponse.json(toChecklistView(await checklistFacts(request)));
  } catch (error) {
    console.error("onboarding_checklist_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        error: "No pudimos cargar tu checklist.",
        code: "onboarding_unavailable",
      },
      { status: 503 },
    );
  }
}
