import { NextRequest } from "next/server";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ConsumerError } from "@mi-pasaporte/domain/server/consumer/core";
import {
  OAUTH_COOKIE,
  type OAuthState,
  encodeOAuthState,
} from "@mi-pasaporte/domain/server/consumer/oauth/state-cookie";
import {
  APPLE_SERVICE_ID,
  GOOGLE_CLIENT_ID,
  type TestProvider,
  appleTestKey,
  testProvider,
  tokenEndpoint,
} from "./oauth-test-support";

/**
 * Spec 0119 — EL CALLBACK COMUN, por las dos rutas reales, con dobles de dominio (cuenta, alta,
 * sesion, Bienvenida), el canje doblado (`fetch`) y el JWKS local. ORACULO DE M2: el caso
 * «`state` distinto» manda un id_token VALIDO con el `nonce` de la cookie, asi que el unico
 * control que lo frena es la comparacion del `state` (sin ella habria cuenta y sesion).
 */

const keys = vi.hoisted(() => ({ jwks: null as unknown }));
const identity = vi.hoisted(() => ({
  findOrCreateAccountByIdentity: vi.fn(),
}));
const enrollment = vi.hoisted(() => ({ enrollAccount: vi.fn() }));
const session = vi.hoisted(() => ({ issueSession: vi.fn() }));
const welcome = vi.hoisted(() => ({ issueWelcomeGiftsSafely: vi.fn() }));

vi.mock(
  "@mi-pasaporte/domain/server/consumer/oauth/tokens",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/oauth/tokens")
    >()),
    providerJwks: () => keys.jwks,
  }),
);
vi.mock("@mi-pasaporte/domain/server/consumer/identity", () => identity);
vi.mock(
  "@mi-pasaporte/domain/server/consumer/enrollment",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/enrollment")
    >()),
    ...enrollment,
  }),
);
vi.mock(
  "@mi-pasaporte/domain/server/consumer/session",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/session")
    >()),
    ...session,
  }),
);
vi.mock("@mi-pasaporte/domain/server/marketing/welcome-issue", () => welcome);

import { GET as googleCallback } from "../app/api/public/auth/google/callback/route";

const ORIGIN = "https://my.checkpass.test";
let provider: TestProvider;
let applePem: string;

beforeAll(async () => {
  provider = await testProvider();
  keys.jwks = provider.jwks;
  applePem = (await appleTestKey()).pem;
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONSUMER_ORIGIN", "");
  vi.stubEnv("CONSUMER_GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
  vi.stubEnv("CONSUMER_GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("APPLE_SIGNIN_SERVICE_ID", APPLE_SERVICE_ID);
  vi.stubEnv("APPLE_SIGNIN_KEY_ID", "KEY123");
  vi.stubEnv("APPLE_TEAM_ID", "TEAM456");
  vi.stubEnv("APPLE_SIGNIN_PRIVATE_KEY", applePem);
  identity.findOrCreateAccountByIdentity.mockResolvedValue({ id: "acc-1" });
  enrollment.enrollAccount.mockResolvedValue({ id: "mem-1" });
  session.issueSession.mockResolvedValue("session-token");
  welcome.issueWelcomeGiftsSafely.mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function cookieFor(overrides: Partial<OAuthState> = {}): OAuthState {
  return {
    provider: "google",
    state: "state-1",
    nonce: "nonce-1",
    verifier: "verifier-1",
    programId: "prog-1",
    loc: "loc-9",
    exp: Date.now() + 600_000,
    ...overrides,
  };
}

async function googleToken(claims: Record<string, unknown> = {}) {
  return provider.sign({
    sub: "google-sub-1",
    nonce: "nonce-1",
    email: "ana@example.test",
    email_verified: true,
    given_name: "Ana",
    family_name: "Pérez",
    ...claims,
  });
}

/** Stubs the token endpoint with `idToken` and returns the call log. */
function withToken(idToken: string) {
  const endpoint = tokenEndpoint(idToken);
  vi.stubGlobal("fetch", endpoint.fetchImpl);
  return endpoint.calls;
}

function google(query: string, cookie: OAuthState | null = cookieFor()) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `${OAUTH_COOKIE}=${encodeOAuthState(cookie)}`;
  return googleCallback(
    new NextRequest(`${ORIGIN}/api/public/auth/google/callback?${query}`, {
      headers,
    }),
  );
}

function sessionCookie(response: Response): string | null {
  return (
    /consumer_session=([^;]*)/.exec(
      response.headers.get("set-cookie") ?? "",
    )?.[1] ?? null
  );
}

describe("callback de Google", () => {
  it("alta nueva: cuenta por (google, sub), alta con su loc, sesion y 303 a la confirmacion", async () => {
    const calls = withToken(await googleToken());
    const response = await google("code=code-1&state=state-1");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/enroll/prog-1/ready`,
    );
    expect(sessionCookie(response)).toBe("session-token");
    expect(identity.findOrCreateAccountByIdentity).toHaveBeenCalledWith({
      provider: "google",
      subject: "google-sub-1",
      email: "ana@example.test",
      firstName: "Ana",
      lastName: "Pérez",
    });
    expect(enrollment.enrollAccount).toHaveBeenCalledWith(
      "prog-1",
      "acc-1",
      "loc-9",
    );
    expect(welcome.issueWelcomeGiftsSafely).toHaveBeenCalledWith("acc-1");
    // El canje lleva el verificador PKCE de la cookie y el redirect_uri del start.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0].body.get("code_verifier")).toBe("verifier-1");
    expect(calls[0].body.get("redirect_uri")).toBe(
      `${ORIGIN}/api/public/auth/google/callback`,
    );
    // La cookie transitoria se borra.
    expect(response.headers.get("set-cookie")).toContain(`${OAUTH_COOKIE}=;`);
  });

  it("`state` distinto (con un id_token valido y el nonce de la cookie) → ?error=auth, sin sesion y sin cuenta", async () => {
    const calls = withToken(await googleToken());
    const response = await google("code=code-1&state=state-de-otro");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/enroll/prog-1?error=auth`,
    );
    expect(sessionCookie(response)).toBeNull();
    expect(identity.findOrCreateAccountByIdentity).not.toHaveBeenCalled();
    expect(session.issueSession).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("sin cookie, o cookie de OTRO proveedor → ?error=auth sin cuenta", async () => {
    withToken(await googleToken());
    const missing = await google("code=code-1&state=state-1", null);
    expect(missing.headers.get("location")).toBe(`${ORIGIN}/wallet?error=auth`);
    const apple = await google(
      "code=code-1&state=state-1",
      cookieFor({ provider: "apple" }),
    );
    expect(apple.headers.get("location")).toBe(
      `${ORIGIN}/enroll/prog-1?error=auth`,
    );
    expect(identity.findOrCreateAccountByIdentity).not.toHaveBeenCalled();
  });

  it("el usuario cancelo (`access_denied`) → 303 a la landing SIN error y sin sesion", async () => {
    const response = await google("error=access_denied&state=state-1");
    expect(response.headers.get("location")).toBe(`${ORIGIN}/enroll/prog-1`);
    expect(sessionCookie(response)).toBeNull();
  });

  it("id_token con OTRO nonce → ?error=auth sin cuenta", async () => {
    withToken(await googleToken({ nonce: "nonce-de-otro" }));
    const response = await google("code=code-1&state=state-1");
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/enroll/prog-1?error=auth`,
    );
    expect(identity.findOrCreateAccountByIdentity).not.toHaveBeenCalled();
  });

  it("`already_member` no es error: sesion y 303 a /wallet", async () => {
    withToken(await googleToken());
    enrollment.enrollAccount.mockRejectedValue(
      new ConsumerError(409, "already_member", "Ya formás parte."),
    );
    const response = await google("code=code-1&state=state-1");
    expect(response.headers.get("location")).toBe(`${ORIGIN}/wallet`);
    expect(sessionCookie(response)).toBe("session-token");
  });

  it("login sin programa → /wallet, sin alta", async () => {
    withToken(await googleToken());
    const response = await google(
      "code=code-1&state=state-1",
      cookieFor({ programId: undefined, loc: undefined }),
    );
    expect(response.headers.get("location")).toBe(`${ORIGIN}/wallet`);
    expect(enrollment.enrollAccount).not.toHaveBeenCalled();
    expect(sessionCookie(response)).toBe("session-token");
  });

  it("Google con `email_verified=false` → el email no se guarda", async () => {
    withToken(await googleToken({ email_verified: false }));
    await google("code=code-1&state=state-1");
    expect(identity.findOrCreateAccountByIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ email: null }),
    );
  });
});
