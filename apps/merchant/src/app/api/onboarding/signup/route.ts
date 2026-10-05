import { NextResponse } from "next/server";
import { ONBOARDING_GRANT_MINUTES } from "@mi-pasaporte/domain/server/onboarding-grant";
import { getMerchantAuth } from "../../../../server/auth";
import {
  AuthStartError,
  assertStartWithinLimits,
  findUserIdByEmail,
  hashClientIp,
  isUndeliverableEmail,
  normalizeEmail,
  recordStartAttempt,
} from "../../../../server/auth-start";
import { isUniqueViolation } from "../../../../server/business-slug";
import { openMerchantSession } from "../../../../server/merchant-session";
import {
  SignupBusinessError,
  createOwnerWithBusiness,
  parseSignupBusiness,
} from "../../../../server/onboarding-signup";
import {
  SelectionError,
  verifySelection,
} from "../../../../server/places/selection-token";

export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/signup — contrato P4 de la spec 0155 (ADR 0121). Reemplaza a
 * `auth/start` + `onboarding/business`: el negocio va primero y el email despues, y la
 * cuenta nace JUNTO con el negocio.
 *
 * El orden es el contrato: se valida TODO (400/422) antes de escribir o mandar un mail; el
 * primer efecto es el intento del rate limit (paso 5).
 *
 * **El invariante de seguridad (spec 0067 §2, ADR 0121 §2):** un email CONOCIDO no abre
 * sesion ni escribe nada mas — sin contraseña, escribir el email de otro le entregaria su
 * negocio. Esa rama manda un link y contesta `200 { sent: true }` SIN cookie.
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AuthStartError(400, "invalid_body", "El cuerpo no es válido.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new AuthStartError(400, "invalid_body", "El cuerpo no es válido.");
    const raw = body as { email?: unknown; business?: unknown };

    const email = normalizeEmail(raw.email ?? null);
    if (isUndeliverableEmail(email))
      throw new AuthStartError(
        400,
        "invalid_email",
        "Ingresa un email válido.",
      );
    const business = parseSignupBusiness(raw.business);
    const selection = verifySelection(business.selectionToken);

    const ipHash = hashClientIp(request.headers);
    await assertStartWithinLimits({ email, ipHash });
    await recordStartAttempt({ email, ipHash });

    if (await findUserIdByEmail(email))
      return await sendAccessLink(request, email);

    let created;
    try {
      created = await createOwnerWithBusiness({ email, business, selection });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Dos altas simultaneas con el mismo email nuevo: decide el unico de
      // `merchant_auth.user` y el perdedor cae en la rama del email conocido, que es lo
      // que ese email PASO A SER. Si el email sigue libre, el choque fue del slug: 503 y el
      // reintento deriva el siguiente libre.
      if (await findUserIdByEmail(email))
        return await sendAccessLink(request, email);
      console.error("onboarding_signup_failed", {
        name: error instanceof Error ? error.name : typeof error,
        slugConflict: true,
      });
      return unavailable();
    }

    // EL PERMISO DE ALTA (spec 0077 §3, ADR 0076 §2): se emite SOLO aca, donde el servidor
    // acaba de crear la cuenta. La rama del email conocido no abre sesion.
    const cookie = await openMerchantSession(created.userId, {
      onboardingGrantUntil: new Date(
        Date.now() + ONBOARDING_GRANT_MINUTES * 60_000,
      ),
    });
    // La cuenta queda aunque el mail de verificacion falle: el cliente ofrece reenviarlo
    // con `/verify-email` desde esta misma sesion.
    let verificationSent = false;
    try {
      await getMerchantAuth().api.signInMagicLink({
        body: { email, callbackURL: "/backoffice" },
        headers: request.headers,
      });
      verificationSent = true;
    } catch (error) {
      console.error("merchant_signup_verification_delivery_failed", {
        name: error instanceof Error ? error.name : typeof error,
      });
    }
    return NextResponse.json(
      {
        created: true,
        verificationSent,
        business: {
          id: created.businessId,
          name: business.name,
          slug: created.slug,
        },
      },
      { status: 201, headers: { "set-cookie": cookie } },
    );
  } catch (error) {
    return signupError(error);
  }
}

/** La rama del email conocido: link de acceso, **sin cookie** y sin escribir nada mas. */
async function sendAccessLink(
  request: Request,
  email: string,
): Promise<NextResponse> {
  await getMerchantAuth().api.signInMagicLink({
    body: { email, callbackURL: "/backoffice" },
    headers: request.headers,
  });
  return NextResponse.json({ sent: true }, { status: 200 });
}

function unavailable(): NextResponse {
  return NextResponse.json(
    {
      error: "No pudimos crear tu cuenta. Intenta de nuevo.",
      code: "signup_unavailable",
    },
    { status: 503 },
  );
}

/** Todo lo que no es un error del contrato es `503 signup_unavailable`, nunca un 500. */
function signupError(error: unknown): NextResponse {
  if (error instanceof AuthStartError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  if (error instanceof SignupBusinessError)
    return NextResponse.json(
      { error: error.message, code: "invalid_business", field: error.field },
      { status: 400 },
    );
  if (error instanceof SelectionError)
    return NextResponse.json(
      { error: error.message, code: "invalid_selection" },
      { status: 422 },
    );
  console.error("onboarding_signup_failed", {
    name: error instanceof Error ? error.name : typeof error,
    slugConflict: false,
  });
  return unavailable();
}
