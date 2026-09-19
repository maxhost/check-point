import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../../server/auth";
import {
  AuthStartError,
  assertStartWithinLimits,
  createOwnerUser,
  findUserIdByEmail,
  hashClientIp,
  normalizeEmail,
  recordStartAttempt,
} from "../../../../../server/auth-start";
import { openMerchantSession } from "../../../../../server/merchant-session";
import { ONBOARDING_GRANT_MINUTES } from "../../../../../server/onboarding-grant";

export const dynamic = "force-dynamic";

/**
 * POST /api/merchant/auth/start — la PANTALLA 1 del wizard (spec 0067 §2, ADR 0070 §4).
 *
 * - email **desconocido** → crea el `user` y **abre sesion en el acto** (200 + cookie).
 * - email **conocido** → **NO abre sesion**: manda un link magico y contesta 200 sin
 *   cookie, con `{ sent: true }`. Es requisito de seguridad confirmado por el owner: sin
 *   contraseña, escribir el email de otro merchant le entregaria el negocio.
 *
 * Contrato: `docs/specs/0067-contratos-de-api.md` §5.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AuthStartError(400, "invalid_body", "El cuerpo no es válido.");
    }
    const email = normalizeEmail(
      (body as { email?: unknown } | null)?.email ?? null,
    );
    const ipHash = hashClientIp(request.headers);
    await assertStartWithinLimits({ email, ipHash });
    await recordStartAttempt({ email, ipHash });

    if (await findUserIdByEmail(email))
      return await sendMagicLink(request, email);

    let userId: string;
    try {
      userId = await createOwnerUser(email);
    } catch (error) {
      // La carrera de dos `start` simultaneos con el mismo email desconocido: decide el
      // indice unico de `merchant_auth.user`, y el perdedor cae en la rama del email
      // conocido, que es lo que ese email PASO A SER. Nunca abre sesion sobre la cuenta
      // que gano el otro request.
      if (isUniqueViolation(error)) return await sendMagicLink(request, email);
      throw error;
    }
    // EL PERMISO DE ALTA (spec 0077 §3, ADR 0076 §2) — se emite **sólo acá**, en la rama
    // del email DESCONOCIDO, que es el único punto donde el servidor sabe por sí mismo que
    // arranca un alta: es el que acaba de crear la cuenta. La rama del email conocido no
    // abre sesión, y `api/merchant/auth/staff` (login por PIN) NUNCA lo pasa.
    const cookie = await openMerchantSession(userId, {
      onboardingGrantUntil: new Date(
        Date.now() + ONBOARDING_GRANT_MINUTES * 60_000,
      ),
    });
    return NextResponse.json(
      { sent: false },
      { status: 200, headers: { "set-cookie": cookie } },
    );
  } catch (error) {
    return startError(error);
  }
}

/**
 * La rama del email conocido. **No devuelve ninguna cookie**: es lo que impide que escribir
 * el email de otro entregue el negocio, y es el invariante que muerde la mutacion #4.
 */
async function sendMagicLink(
  request: Request,
  email: string,
): Promise<NextResponse> {
  await getMerchantAuth().api.signInMagicLink({
    body: { email, callbackURL: "/backoffice" },
    headers: request.headers,
  });
  return NextResponse.json({ sent: true }, { status: 200 });
}

/** `23505` = unique_violation, en el error o en cualquiera de sus `cause`. */
function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Todo lo que no es un `AuthStartError` es 503 CON `code`, nunca un 500 pelado: un 500 sin
 * `code` es un incumplimiento del contrato (lo cazo un revisor en el paso 2). Y se loguea
 * el `name`, para que un `TypeError` nuestro no se presente como «base caída».
 */
function startError(error: unknown): NextResponse {
  if (error instanceof AuthStartError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  console.error("merchant_auth_start_failed", {
    name: error instanceof Error ? error.name : typeof error,
  });
  return NextResponse.json(
    {
      error: "No pudimos continuar. Intentá de nuevo.",
      code: "auth_unavailable",
    },
    { status: 503 },
  );
}
