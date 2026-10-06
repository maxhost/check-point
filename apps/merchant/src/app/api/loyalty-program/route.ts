import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwnerSinGateDeEmail,
} from "../../../server/api-owner";
import { requireApiPermissionSinGateDeEmail } from "../../../server/api-permission";
import { programInput } from "../../../server/onboarding/program-defaults";
import {
  LoyaltyError,
  cancelClose,
  closeProgram,
  programForOwner,
  saveProgram,
} from "@mi-pasaporte/domain/server/loyalty-program";
import { toClientProgram } from "@mi-pasaporte/domain/server/loyalty-program/client-view";

/**
 * Spec 0072 §D3 — las CUATRO superficies de esta ruta resuelven owner con
 * `requireApiOwner`. Antes cada verbo hacia `getSession` pelado y delegaba la resolucion de
 * negocio en el dominio, que **no filtra `memberships.status='active'`** y no tiene gate de
 * email: un integrante de baja editaba el programa de fidelizacion.
 *
 * Las funciones de dominio siguen recibiendo el `userId` y resolviendo su propio negocio:
 * esta spec unifica el GUARD, no el dominio.
 *
 * **Spec 0079 — `PUT` es LA UNICA ruta de escritura del programa.** `POST
 * /api/onboarding/program` se BORRO: dos puertas sobre un mismo writer es exactamente lo
 * que produjo el bypass de la 0077 y, antes, el del eje `status` en la 0072. El `PUT`
 * absorbio el cuerpo corto, los `code` estables y el guard sin paso 3 de la puerta vieja;
 * `GET`, `DELETE` y `PATCH` **no cambian** (siguen con `requireApiOwner` y sin `code`).
 *
 * **Spec 0086 §3 — LOS CUATRO VERBOS YA NO COMPARTEN GUARD, y eso es la decision:**
 *
 * - `GET` y `PUT` son **delegables** con el alcance `loyalty` (un integrante lee y escribe
 *   el programa). Desde el ADR 0122 (spec 0156 C) los dos usan
 *   `requireApiPermissionSinGateDeEmail`: el programa NO exige email verificado.
 * - `DELETE` (cierra el programa) y `PATCH` (`cancel-close`) son **IRREVERSIBLES** y por eso
 *   **ningun toggle los abre** (ADR 0079 §2, contrato 0086 §2.1): solo el owner, con su
 *   `403 not_owner`. Desde el ADR 0125 (spec 0165) van por `requireApiOwnerSinGateDeEmail`:
 *   siguen siendo SOLO del owner, sin exigirle el email verificado.
 */
const MESSAGES = {
  missingPermission: "No tienes permiso para gestionar el programa.",
};

/** La copia OWNER-ONLY de `DELETE` y `PATCH`. Separada de {@link MESSAGES} porque los `code`
 * son distintos y el tipo de las dos funciones lo hace explicito. */
const OWNER_MESSAGES = {
  notOwner: "Solo la persona propietaria puede cerrar o reabrir el programa.",
};

/**
 * Spec 0079 §4 — la MISMA tabla de `code` que emitia la ruta borrada
 * (`onboarding/program/route.ts:19-24`). Se usa **solo** cuando el `LoyaltyError` no trae
 * `code` propio: el `error.code ??` de la 0072 es lo que hace que `business_suspended`,
 * `business_closed` y `email_not_verified` no se traduzcan a `not_owner` por su status.
 */
const codeForStatus = (status: number) => {
  if (status === 403) return "not_owner";
  if (status === 409) return "program_exists";
  if (status === 503) return "program_unavailable";
  return "invalid_program";
};

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new LoyaltyError(400, "El cuerpo de la solicitud no es válido.");
  }
}

export async function GET(request: Request) {
  const auth = await requireApiPermissionSinGateDeEmail(request, "loyalty", {
    missingPermission: MESSAGES.missingPermission,
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  // Spec 0086 §10: el negocio sale del guard, no de un segundo resolvedor owner-only.
  const result = await programForOwner(auth.userId, auth.business.id);
  if (!result)
    return NextResponse.json(
      { error: "Sin negocio.", code: "not_member" },
      { status: 403 },
    );
  return NextResponse.json({
    business: result.business,
    program: toClientProgram(
      result.program,
      result.business.id,
      result.rewards,
    ),
  });
}

/**
 * **LA UNICA ESCRITURA DEL PROGRAMA** (spec 0079). Acepta cuerpo corto o completo, las dos
 * modalidades que el dominio habilita (`points` y `stamps`, ADR 0076 §6) y emite los 8
 * `code` de §4.
 *
 * **SU GUARD ES `requireApiPermissionSinGateDeEmail` —la escalera sin el paso 4 (email)—**
 * por decision del owner (ADR 0122): crear y editar el programa NO exigen email verificado.
 * El writer tampoco tiene regla de email (spec 0156 C). `DELETE` y `PATCH` si la conservan.
 */
export async function PUT(request: Request) {
  const auth = await requireApiPermissionSinGateDeEmail(request, "loyalty", {
    missingPermission: MESSAGES.missingPermission,
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Fuera del `try` de abajo a proposito: el 400 tiene `code` propio (`invalid_body`) y
    // caeria en el `invalid_program` de `codeForStatus` si viajara como `LoyaltyError`.
    return NextResponse.json(
      {
        error: "El cuerpo de la solicitud no es válido.",
        code: "invalid_body",
      },
      { status: 400 },
    );
  }
  try {
    // Todo lo que toca la base va ADENTRO del `try`, incluida la lectura de las semillas de
    // terminos que hace `programInput`: un fallo de base sale como el 503 que el contrato
    // declara, nunca como un 500 sin `code` (leccion de la spec 0068 §3).
    const input = await programInput(body, auth.userId, auth.business.id);
    const result = await saveProgram(auth.userId, input, auth.business.id);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        {
          error: error.message,
          code: error.code ?? codeForStatus(error.status),
        },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos guardar el programa.", code: "program_unavailable" },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiOwnerSinGateDeEmail(request, OWNER_MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    await closeProgram(
      auth.userId,
      (await readJson(request)) as {
        earningEndsAt?: string;
        redemptionEndsAt?: string;
      },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos retirar el programa." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiOwnerSinGateDeEmail(request, OWNER_MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const body = (await request.json().catch(() => null)) as {
    action?: string;
  } | null;
  if (body?.action !== "cancel-close") {
    return NextResponse.json({ error: "Acción no válida." }, { status: 422 });
  }
  try {
    await cancelClose(auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos cancelar el cierre." },
      { status: 503 },
    );
  }
}
