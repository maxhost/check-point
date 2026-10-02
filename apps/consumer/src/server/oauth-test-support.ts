import {
  type JWTPayload,
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from "jose";

/**
 * Spec 0119 — el «proveedor» de los tests del ingreso: un par RS256 generado, su JWKS local y
 * un firmador de id_tokens. Nada sale a la red: el `fetch` del canje se dobla aparte.
 */

export const GOOGLE_CLIENT_ID = "google-client.apps.test";
export const APPLE_SERVICE_ID = "club.checkpass.test.signin";

export type TestProvider = Awaited<ReturnType<typeof testProvider>>;

export async function testProvider(kid = "test-key") {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256" };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  async function sign(
    claims: JWTPayload,
    options: { issuer?: string; audience?: string; expiresIn?: string } = {},
  ): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(options.issuer ?? "https://accounts.google.com")
      .setAudience(options.audience ?? GOOGLE_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "5m")
      .sign(privateKey);
  }
  return { jwks, sign, privateKey };
}

const TOKEN_URLS = new Set([
  "https://oauth2.googleapis.com/token",
  "https://appleid.apple.com/auth/token",
]);

/**
 * Un `fetch` doblado que contesta el canje con este `id_token` y registra lo que se pidio. Todo
 * lo demas va al `fetch` real: el driver HTTP de Neon tambien usa el `fetch` global.
 */
export function tokenEndpoint(idToken: string) {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const realFetch = globalThis.fetch;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!TOKEN_URLS.has(url)) return realFetch(input, init);
    calls.push({ url, body: init?.body as URLSearchParams });
    return new Response(JSON.stringify({ id_token: idToken }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

/** Una clave `.p8` de prueba (PKCS8 EC P-256), como la que Apple entrega. */
export async function appleTestKey() {
  const { exportPKCS8 } = await import("jose");
  const { privateKey, publicKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  return { pem: await exportPKCS8(privateKey), publicKey };
}
