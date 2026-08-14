import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
} from "../../../../server/consumer/core";
import { issueSession } from "../../../../server/consumer/session";
import { resolveWebViewToken } from "../../../../server/wallet/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Magic-link "Ver mis programas": resolves the bearer `web_view_token`, opens a
 * consumer session (sets the 0028 HttpOnly cookie) and redirects to the wallet
 * surface. Unknown/revoked token → 404. The pass is already at-bearer (ADR 0014),
 * so opening a session on visit does not change the threat model.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webViewToken: string }> },
) {
  const { webViewToken } = await params;
  const account = await resolveWebViewToken(webViewToken);
  if (!account) {
    return NextResponse.json(
      { error: "Enlace no válido.", code: "not_found" },
      { status: 404 },
    );
  }

  const token = await issueSession(account.id);
  const response = NextResponse.redirect(
    new URL("/wallet", request.nextUrl.origin),
    { status: 302 },
  );
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
  return response;
}
