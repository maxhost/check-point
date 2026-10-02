import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { revokeSession } from "@mi-pasaporte/domain/server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0120 — «Cerrar sesión»: revoca la sesion de la cookie en la base y borra la cookie.
 * Idempotente (sin cookie, igual 204). La cookie de sesion es `SameSite=Lax`: un POST de otro
 * sitio no la lleva, asi que nadie puede cerrar la sesion de un tercero. Si la base falla, la
 * cookie NO se borra: decir «cerrada» con la sesion viva en la base seria mentir.
 */
export async function POST(request: NextRequest) {
  try {
    await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    return NextResponse.json(
      { error: "No pudimos cerrar la sesión.", code: "logout_failed" },
      { status: 503 },
    );
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
