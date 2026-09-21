import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../../../server/api-owner";
import {
  isOnboardingTourId,
  isTourStatus,
  recordTourProgress,
} from "../../../../../server/onboarding/tours";

export const dynamic = "force-dynamic";

/**
 * Spec 0084 §D3 / ADR 0078 §2-3 — `POST /api/onboarding/tours/{tourId}`.
 *
 * **La PRIMERA escritura del onboarding.** Hasta esta spec el checklist era lectura pura. El
 * contrato normativo es `docs/specs/0084-contratos-de-api.md`.
 *
 * ### ESTA RUTA SI LLEVA EL GATE DE EMAIL, y la asimetria con el checklist es LA decision
 *
 * `GET /api/onboarding/checklist` se exime **porque se gatearia a si mismo**: es el endpoint
 * que viene a decir «verifica tu email». Esta ruta no tiene ese problema, y ademas
 * `verify-email` es el UNICO `required: true` del catalogo —y desde la spec 0085 ese campo
 * significa, con las palabras del owner, que mientras no este hecho los items de `position`
 * mayor **no se pueden hacer**—. Poner el paso 3 aca es **HACER CUMPLIR** ese
 * bloqueo en vez de solo reportarlo. El contrato `0083-contratos-de-api.md` §1 declaraba esa
 * decision como no tomada, *«se toma cuando haya un segundo item»*: se toma aca, y es que si.
 *
 * **Consecuencia, y es parte del punto: el inventario cerrado de exenciones al gate sigue en
 * TRES rutas** —esta no es una de ellas—, y la fila nueva va del lado
 * `SURFACES_CON_GATE_DE_EMAIL`. **El nombre de la funcion exenta NO se escribe en este
 * archivo ni siquiera para citarlo:** ese inventario se cuenta con un barrido de `rg` por
 * NOMBRE sobre `apps/merchant/src/app` (spec 0075 §D1), que cuenta ARCHIVOS y no puede
 * distinguir una exencion real de una mencion en prosa. Medido: con la cita puesta, el
 * barrido devolvia **4** sobre un arbol que tiene **3** exenciones.
 *
 * ### El orden de evaluacion, y por que es asi
 *
 * ```
 * 1-4. el guard entero (sesion → owner activo → EMAIL → eje `status`)
 * 5.   ¿el `tourId` existe?  → 404 unknown_tour
 * 6.   ¿el cuerpo se lee y trae un `status` valido? → 400 invalid_body
 * ```
 *
 * - **`unknown_tour` se evalua DESPUES del guard.** Al reves, un desconocido —sin sesion—
 *   podria sondear que ids de tour existen: recibiria `404` para los inventados y `401` para
 *   los reales. Con este orden, sin sesion **siempre** es `401`.
 * - **Un INTEGRANTE recibe `not_owner`, nunca `email_not_verified`**: su email sintetico
 *   (`@staff.invalid`) no se verifica jamas, asi que el codigo del email le pediria hacer algo
 *   que no puede hacer. Lo resuelve `requireApiOwner` por construccion, con el paso 2 antes
 *   del 3 (ADR 0073 §1); ya lo cazo un test de la spec 0067.
 * - **El `businessId` sale del guard, NUNCA del cuerpo ni de la query** (ADR 0070 §15.3). Si
 *   viajara, seria el parametro con el que un owner escribiria el progreso de otro negocio.
 * - **El `request.json()` lleva su propio `try`**, como `api/staff/route.ts`: un cuerpo
 *   ilegible es `400 invalid_body`, no un `503` de base caida.
 * - **El `catch` de ultima linea emite solo `error.name`**, nunca el mensaje: un mensaje de
 *   excepcion puede arrastrar datos de la fila que lo produjo.
 *
 * El guard va ADENTRO del `try` (spec 0068 §3): resolver la sesion **tambien consulta la
 * base**, asi que afuera un fallo de base saldria 500 sin `code` en vez del 503 del contrato.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tourId: string }> },
) {
  try {
    const auth = await requireApiOwner(request, {
      notOwner: "Solo el owner puede registrar el progreso de un tour.",
      emailNotVerified: "Verifica tu email antes de avanzar con el onboarding.",
    });
    if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);

    const { tourId } = await params;
    if (!isOnboardingTourId(tourId)) {
      return NextResponse.json(
        { error: "Ese tour no existe.", code: "unknown_tour" },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo no es válido.", code: "invalid_body" },
        { status: 400 },
      );
    }

    const status = (body as Record<string, unknown> | null)?.status;
    if (!isTourStatus(status)) {
      return NextResponse.json(
        { error: "El cuerpo no es válido.", code: "invalid_body" },
        { status: 400 },
      );
    }

    await recordTourProgress(auth.business.id, tourId, status);
    return NextResponse.json({ tourId, status }, { status: 200 });
  } catch (error) {
    console.error("onboarding_tour_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        error: "No pudimos guardar tu progreso.",
        code: "onboarding_unavailable",
      },
      { status: 503 },
    );
  }
}
