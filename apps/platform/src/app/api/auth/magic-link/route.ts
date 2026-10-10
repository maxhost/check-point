import { NextResponse } from "next/server";
import { getPlatformAuth } from "../../../../server/auth";

export const dynamic = "force-dynamic";

const FAILED = "/login?e=link_invalid";

/**
 * GET /api/auth/magic-link?token=… — consume el link del panel (spec 0190 §D2) y deja la cookie.
 * La lista blanca NO se mira aca: la mira el guard en cada request, asi que una sesion de un
 * correo sacado de la lista no abre nada.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return bounce(request, FAILED);
  let verified: Response;
  try {
    verified = await getPlatformAuth().api.magicLinkVerify({
      query: { token },
      headers: request.headers,
      asResponse: true,
    });
  } catch {
    return bounce(request, FAILED);
  }
  const cookie = verified.headers.get("set-cookie");
  if (verified.status !== 200 || !cookie) return bounce(request, FAILED);
  const response = bounce(request, "/");
  for (const value of verified.headers.getSetCookie()) {
    response.headers.append("set-cookie", value);
  }
  return response;
}

function bounce(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}
