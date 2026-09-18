import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../server/auth";
import { LoyaltyError, saveProgram } from "../../../../server/loyalty-program";
import { wizardProgramInput } from "../../../../server/onboarding/program-defaults";

export const dynamic = "force-dynamic";

/**
 * Spec 0069 §D4 — la pantalla 3 del wizard, alcanzable con DOS campos.
 *
 * `PUT /api/loyalty-program` ya crea programas, pero exige el `ProgramInput` entero
 * (terminos incluidos). Esta ruta compone ese input desde `{ target, reward }` con
 * `server/onboarding/program-defaults.ts` y reusa `saveProgram`, que es el unico
 * lugar que escribe un programa. No duplica ni una regla de dominio.
 *
 * El negocio sale de la SESION (`saveProgram` resuelve por `programForOwner`): no hay
 * `businessId` en el cuerpo, igual que en el alta de staff.
 */
const codeForStatus = (status: number) => {
  if (status === 403) return "not_owner";
  if (status === 409) return "program_exists";
  if (status === 503) return "program_unavailable";
  return "invalid_program";
};

export async function POST(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthorized" },
      { status: 401 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "El cuerpo de la solicitud no es válido.",
        code: "invalid_body",
      },
      { status: 400 },
    );
  }
  try {
    // Todo lo que toca la base va ADENTRO del `try`, incluida la lectura de las
    // semillas de terminos: un fallo de base tiene que salir como el 503 que el
    // contrato declara, nunca como un 500 sin `code` (leccion de la spec 0068 §3).
    const input = await wizardProgramInput(body);
    const result = await saveProgram(session.user.id, input);
    return NextResponse.json(
      { programId: result.programId, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof LoyaltyError) {
      return NextResponse.json(
        // `error.code ?? …`: el cierre de F1 (spec 0072) hace que `saveProgram` rechace con
        // `business_suspended`/`business_closed`, y el mapeo por STATUS traduciría esos 403 a
        // `not_owner` — un `code` que le miente al cliente sobre por qué lo frenaron.
        {
          error: error.message,
          code: error.code ?? codeForStatus(error.status),
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: "No pudimos guardar el programa.",
        code: "program_unavailable",
      },
      { status: 503 },
    );
  }
}
