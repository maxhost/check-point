import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isAdminEmail } from "./admin-emails";
import { getPlatformAuth } from "./auth";

/**
 * Spec 0190 §D3 — el UNICO lugar que decide si alguien es admin: sesion de `platform_auth`
 * Y correo en `PLATFORM_ADMIN_EMAILS` (leida en cada llamada, `admin-emails.ts`).
 */
async function sessionEmail(requestHeaders: Headers): Promise<string | null> {
  const session = await getPlatformAuth().api.getSession({
    headers: requestHeaders,
  });
  return session?.user.email ?? null;
}

/** Paginas: sin sesion → `/login`; correo fuera de la lista → `/login?e=not_admin`. */
export async function requireAdmin(): Promise<{ email: string }> {
  const email = await sessionEmail(await headers());
  if (email === null) redirect("/login");
  if (!isAdminEmail(email)) redirect("/login?e=not_admin");
  return { email };
}

export type ApiAdmin =
  { ok: true; email: string } | { ok: false; response: Response };

/** Rutas: sin sesion → 401 `unauthorized`; correo fuera de la lista → 403 `not_admin`. */
export async function requireApiAdmin(request: Request): Promise<ApiAdmin> {
  const email = await sessionEmail(request.headers);
  if (email === null) {
    return {
      ok: false,
      response: NextResponse.json(
        { code: "unauthorized", message: "Inicia sesión." },
        { status: 401 },
      ),
    };
  }
  if (!isAdminEmail(email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { code: "not_admin", message: "Este correo no tiene acceso al panel." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, email };
}
