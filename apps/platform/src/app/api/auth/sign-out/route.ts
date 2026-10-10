import { NextResponse } from "next/server";
import { getPlatformAuth } from "../../../../server/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/sign-out — revoca la sesion del panel y vuelve al login. */
export async function POST(request: Request) {
  const result = await getPlatformAuth().api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  for (const value of result.headers.getSetCookie()) {
    response.headers.append("set-cookie", value);
  }
  return response;
}
