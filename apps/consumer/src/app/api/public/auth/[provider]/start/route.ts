import { NextResponse, type NextRequest } from "next/server";
import {
  appleAuthorizeUrl,
  appleConfigFromEnv,
} from "@mi-pasaporte/domain/server/consumer/oauth/apple";
import {
  googleAuthorizeUrl,
  googleConfigFromEnv,
} from "@mi-pasaporte/domain/server/consumer/oauth/google";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_OPTIONS,
  encodeOAuthState,
  isOAuthProvider,
  newOAuthState,
} from "@mi-pasaporte/domain/server/consumer/oauth/state-cookie";
import { consumerOriginOr } from "@mi-pasaporte/domain/server/hosts";
import {
  callbackUri,
  destinationOf,
} from "../../../../../../server/oauth-callback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** `programId`/`loc` viajan en la cookie y vuelven en un path: solo forma de id, acotada. */
function idParam(value: string | null): string | null {
  return value && /^[A-Za-z0-9-]{1,64}$/.test(value) ? value : null;
}

/**
 * Spec 0119 / ADR 0111: arranca el ingreso con Google o Apple. Setea la cookie transitoria
 * `__Host-cp_oauth` (`state`, `nonce`, PKCE, a donde volver) y responde 302 al proveedor.
 * Proveedor desconocido → 404. Proveedor sin configurar → 303 de vuelta con `?error=auth`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) {
    return NextResponse.json(
      { error: "No encontrado.", code: "not_found" },
      { status: 404 },
    );
  }
  const programId = idParam(request.nextUrl.searchParams.get("programId"));
  const loc = idParam(request.nextUrl.searchParams.get("loc"));
  const origin = request.nextUrl.origin;
  const redirectUri = callbackUri(origin, provider);
  const attempt = newOAuthState({ provider, programId, loc });

  let authorizeUrl: string | null = null;
  if (provider === "google") {
    const config = googleConfigFromEnv();
    if (config && attempt.verifier)
      authorizeUrl = googleAuthorizeUrl({
        clientId: config.clientId,
        redirectUri,
        state: attempt.state,
        nonce: attempt.nonce,
        verifier: attempt.verifier,
      });
  } else {
    const config = appleConfigFromEnv();
    if (config)
      authorizeUrl = appleAuthorizeUrl({
        serviceId: config.serviceId,
        redirectUri,
        state: attempt.state,
        nonce: attempt.nonce,
      });
  }
  if (!authorizeUrl) {
    console.warn(`[oauth] ${provider}: not_configured`);
    return NextResponse.redirect(
      new URL(
        `${destinationOf(programId)}?error=auth`,
        consumerOriginOr(origin),
      ),
      303,
    );
  }
  const response = NextResponse.redirect(authorizeUrl, 302);
  response.cookies.set(
    OAUTH_COOKIE,
    encodeOAuthState(attempt),
    OAUTH_COOKIE_OPTIONS,
  );
  return response;
}
