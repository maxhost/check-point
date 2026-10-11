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
  if (!token) return bounce(FAILED);
  let verified: Response;
  try {
    verified = await getPlatformAuth().api.magicLinkVerify({
      query: { token },
      headers: request.headers,
      asResponse: true,
    });
  } catch (error) {
    console.error("platform_magic_link_failed", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : undefined,
    });
    return bounce(FAILED);
  }
  const cookies = verified.headers.getSetCookie();
  if (verified.status !== 200 || cookies.length === 0) {
    console.error("platform_magic_link_rejected", {
      status: verified.status,
      location: verified.headers.get("location"),
    });
    return bounce(FAILED);
  }
  return bounce("/", cookies);
}

/**
 * `Location` RELATIVO, como el merchant: detras del tunel `request.url` es `localhost:3002`, y un
 * redirect absoluto armado con el mandaba al navegador a `https://localhost:3002`.
 */
function bounce(destination: string, cookies: string[] = []): Response {
  const headers = new Headers({ location: destination });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}
