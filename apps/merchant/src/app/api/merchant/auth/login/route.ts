import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../../server/auth";
import {
  AuthStartError,
  assertStartWithinLimits,
  findUserIdByEmail,
  hashClientIp,
  isUndeliverableEmail,
  normalizeEmail,
  recordStartAttempt,
} from "../../../../../server/auth-start";

export const dynamic = "force-dynamic";

/**
 * Pide acceso a una cuenta existente; nunca crea un usuario ni revela si existe. Spec 0202
 * (ADR 0137): manda un CODIGO de 6 digitos, que se canjea en `POST /api/merchant/auth/login/verify`.
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

    if (!isUndeliverableEmail(email) && (await findUserIdByEmail(email))) {
      // Un solo codigo vivo sin hacer nada aca: better-auth 1.7.6 consume la fila MAS NUEVA
      // del email y borra las demas (`internal-adapter.mjs`, `consumeVerificationValue`).
      // Lo fija «pedir otro codigo anula el anterior» en `login-code.neon.integration.test.ts`.
      await getMerchantAuth().api.sendVerificationOTP({
        body: { email, type: "sign-in" },
        headers: request.headers,
      });
    }
    return NextResponse.json({ accepted: true });
  } catch (error) {
    if (error instanceof AuthStartError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    console.error("merchant_login_code_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        error: "No pudimos enviar el código. Intenta de nuevo.",
        code: "auth_unavailable",
      },
      { status: 503 },
    );
  }
}
