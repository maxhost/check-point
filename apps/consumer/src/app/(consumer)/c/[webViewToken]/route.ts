import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
} from "@mi-pasaporte/domain/server/consumer/core";
import { issueSession } from "@mi-pasaporte/domain/server/consumer/session";
import { consumerOriginOr } from "@mi-pasaporte/domain/server/hosts";
import { resolveWebViewToken } from "@mi-pasaporte/domain/server/wallet/core";
import { markAccountOpened } from "@mi-pasaporte/domain/server/wallet/reminder-store";

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

  // Spec 0111 D5: opening the account feeds the reminder (never throws, it logs).
  await markAccountOpened(account.id);
  const token = await issueSession(account.id);
  const response = NextResponse.redirect(
    // `CONSUMER_ORIGIN` primero: detras del tunel de dev, `nextUrl.origin` es
    // `https://localhost:3200` y el navegador cae en un puerto sin TLS.
    new URL("/wallet", consumerOriginOr(request.nextUrl.origin)),
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
