import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../../server/auth";
import {
  AuthStartError,
  assertStartWithinLimits,
  hashClientIp,
  isUndeliverableEmail,
  normalizeEmail,
  recordStartAttempt,
} from "../../../../../server/auth-start";

export const dynamic = "force-dynamic";

/**
 * POST /api/merchant/auth/verify-email — el PRIMER paso del onboarding (ADR 0070 §11):
 * mandarle al owner el mail con el que prueba que el buzon es suyo.
 *
 * **No recibe email.** La direccion sale de la SESION, igual que el `slug` sale de la
 * sesion en el alta de staff: si viajara en el cuerpo, seria un parametro con el que
 * cualquiera podria disparar mails hacia una direccion ajena.
 *
 * El canal es el mismo link magico de la §2 —y eso no es un atajo: consumirlo prueba
 * control del buzon y better-auth marca `emailVerified: true` al hacerlo—, asi que no se
 * introduce un segundo tipo de token que pueda divergir. Consume el mismo cupo que `start`.
 *
 * Contrato: `docs/specs/0067-contratos-de-api.md` §7.
 */
export async function POST(request: Request) {
  try {
    const session = await getMerchantAuth().api.getSession({
      headers: request.headers,
    });
    if (!session)
      throw new AuthStartError(401, "unauthorized", "No autorizado.");
    if (session.user.emailVerified)
      return NextResponse.json(
        { sent: false, verified: true },
        { status: 200 },
      );

    const email = normalizeEmail(session.user.email);
    // ANTES del cupo, y el orden es la regla: rechazar despues de `recordStartAttempt` ya le
    // habria comido un intento al balde por IP que comparte con `start`. Un integrante llega
    // hasta acá porque su email SINTETICO pasa la forma de `normalizeEmail` (tiene `@` y
    // tiene punto); lo que no puede es recibir nada. Ver `isUndeliverableEmail`.
    if (isUndeliverableEmail(email))
      throw new AuthStartError(
        400,
        "invalid_email",
        "Esta cuenta no tiene un email al que podamos escribirte.",
      );
    const ipHash = hashClientIp(request.headers);
    await assertStartWithinLimits({ email, ipHash });
    await recordStartAttempt({ email, ipHash });
    await getMerchantAuth().api.signInMagicLink({
      body: { email, callbackURL: "/backoffice" },
      headers: request.headers,
    });
    return NextResponse.json({ sent: true, verified: false }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthStartError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    console.error("merchant_verify_email_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        error: "No pudimos enviarte el enlace. Intentá de nuevo.",
        code: "auth_unavailable",
      },
      { status: 503 },
    );
  }
}
