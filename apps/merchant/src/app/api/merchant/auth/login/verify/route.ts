import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../../../server/auth";
import {
  AuthStartError,
  normalizeEmail,
} from "../../../../../../server/auth-start";
import {
  loginCodeFailuresExhausted,
  recordLoginCodeFailure,
  settleOwnerLogin,
} from "../../../../../../server/merchant-login";

export const dynamic = "force-dynamic";

/**
 * POST /api/merchant/auth/login/verify — canjea email + codigo por la sesion del owner (spec
 * 0202 §D4, ADR 0137). El codigo lo emitio `POST /api/merchant/auth/login`.
 *
 * Por ruta propia y no por `/sign-in/email-otp`: ese path esta en `disabledPaths`
 * (`server/auth.ts`) porque por HTTP saltearia el tope de equivocados y el corte de `closed`.
 * `auth.api.*` no pasa por `disabledPaths`.
 */
export async function POST(request: Request) {
  let email: string;
  let code: string;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AuthStartError(400, "invalid_body", "El cuerpo no es válido.");
    }
    const fields = (body ?? {}) as { email?: unknown; code?: unknown };
    email = normalizeEmail(fields.email ?? null);
    code = typeof fields.code === "string" ? fields.code.trim() : "";
    if (!/^\d{6}$/.test(code))
      throw new AuthStartError(
        400,
        "invalid_code",
        "El código tiene 6 números.",
      );
  } catch (error) {
    if (error instanceof AuthStartError) return failure(error);
    throw error;
  }

  try {
    // El tope va ANTES del plugin: bloqueado, ni el codigo correcto entra (si no, no frena).
    if (await loginCodeFailuresExhausted(email))
      return failure(
        new AuthStartError(
          429,
          "too_many_failures",
          "Demasiados intentos. Probá de nuevo mañana.",
        ),
      );

    const verified = await getMerchantAuth().api.signInEmailOTP({
      body: { email, otp: code },
      headers: request.headers,
      asResponse: true,
    });
    const cookie = verified.headers.get("set-cookie");
    if (verified.status !== 200 || !cookie) {
      const pluginCode = await errorCode(verified);
      // TOO_MANY_ATTEMPTS: el codigo quedo consumido; para el owner es lo mismo que vencido.
      if (pluginCode === "OTP_EXPIRED" || pluginCode === "TOO_MANY_ATTEMPTS")
        return failure(
          new AuthStartError(
            400,
            "code_expired",
            "El código venció. Pedí uno nuevo.",
          ),
        );
      if (pluginCode === "INVALID_OTP") {
        await recordLoginCodeFailure(email);
        return failure(
          new AuthStartError(
            400,
            "code_incorrect",
            "El código no es correcto.",
          ),
        );
      }
      throw new Error(`sign-in-email-otp: ${verified.status} ${pluginCode}`);
    }

    const outcome = await settleOwnerLogin(verified);
    if (outcome.kind === "closed")
      return failure(
        new AuthStartError(
          403,
          "business_closed",
          "Este negocio está cerrado.",
        ),
      );
    const response = NextResponse.json({ destination: outcome.destination });
    response.headers.set("set-cookie", cookie);
    return response;
  } catch (error) {
    console.error("merchant_login_verify_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        error: "No pudimos verificar el código. Intenta de nuevo.",
        code: "auth_unavailable",
      },
      { status: 503 },
    );
  }
}

function failure(error: AuthStartError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

/** El `code` del cuerpo de error de better-auth (`{ code, message }`), o null. */
async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { code?: unknown } | null;
    return typeof body?.code === "string" ? body.code : null;
  } catch {
    return null;
  }
}
