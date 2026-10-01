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

/** Pide acceso a una cuenta existente; nunca crea un usuario ni revela si existe. */
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
      await getMerchantAuth().api.signInMagicLink({
        body: { email, callbackURL: "/backoffice" },
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
    console.error("merchant_login_link_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        error: "No pudimos enviar el enlace. Intenta de nuevo.",
        code: "auth_unavailable",
      },
      { status: 503 },
    );
  }
}
