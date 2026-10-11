import { getPlatformAuth } from "../../../../server/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/sign-out — revoca la sesion del panel y vuelve al login. `Location` relativo:
 * detras del tunel `request.url` es `localhost` (ver `magic-link/route.ts`).
 */
export async function POST(request: Request) {
  const result = await getPlatformAuth().api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  const headers = new Headers({ location: "/login" });
  for (const value of result.headers.getSetCookie()) {
    headers.append("set-cookie", value);
  }
  return new Response(null, { status: 303, headers });
}
