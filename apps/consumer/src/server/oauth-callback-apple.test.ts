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
 * Spec 0119 — EL CALLBACK COMUN por la ruta de APPLE (`form_post`): el nombre del campo `user`,
 * el `aud` = service id y el `client_secret` del canje. Los casos de Google (y el oraculo del
 * `state`) estan en `oauth-callback.test.ts`; el montaje es el mismo: dobles de dominio
 * (cuenta, alta, sesion, Bienvenida), el canje doblado (`fetch`) y el JWKS local.
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

import { POST as appleCallback } from "../app/api/public/auth/apple/callback/route";

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

function sessionCookie(response: Response): string | null {
  return (
    /consumer_session=([^;]*)/.exec(
      response.headers.get("set-cookie") ?? "",
    )?.[1] ?? null
  );
}

function withToken(idToken: string) {
  const endpoint = tokenEndpoint(idToken);
  vi.stubGlobal("fetch", endpoint.fetchImpl);
  return endpoint.calls;
}

describe("callback de Apple (form_post)", () => {
  function apple(form: Record<string, string>, cookie: OAuthState) {
    return appleCallback(
      new NextRequest(`${ORIGIN}/api/public/auth/apple/callback`, {
        method: "POST",
        headers: {
          cookie: `${OAUTH_COOKIE}=${encodeOAuthState(cookie)}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(form).toString(),
      }),
    );
  }
  const appleCookie = cookieFor({ provider: "apple", verifier: undefined });

  it("toma el nombre del campo `user` y verifica `aud` = service id", async () => {
    const token = await provider.sign(
      {
        sub: "apple-sub-1",
        nonce: "nonce-1",
        email: "x@privaterelay.appleid.com",
        email_verified: "true",
      },
      { issuer: "https://appleid.apple.com", audience: APPLE_SERVICE_ID },
    );
    const calls = withToken(token);
    const response = await apple(
      {
        code: "code-1",
        state: "state-1",
        user: JSON.stringify({ name: { firstName: "Bea", lastName: "Ruiz" } }),
      },
      appleCookie,
    );
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/enroll/prog-1/ready`,
    );
    expect(sessionCookie(response)).toBe("session-token");
    expect(identity.findOrCreateAccountByIdentity).toHaveBeenCalledWith({
      provider: "apple",
      subject: "apple-sub-1",
      email: "x@privaterelay.appleid.com",
      firstName: "Bea",
      lastName: "Ruiz",
    });
    expect(calls[0].url).toBe("https://appleid.apple.com/auth/token");
    expect(calls[0].body.get("client_id")).toBe(APPLE_SERVICE_ID);
    expect(calls[0].body.get("client_secret")).toMatch(/^ey/);
  });

  it("un id_token emitido para el cliente de GOOGLE no sirve en Apple (aud)", async () => {
    const token = await provider.sign(
      { sub: "apple-sub-1", nonce: "nonce-1" },
      { issuer: "https://appleid.apple.com", audience: GOOGLE_CLIENT_ID },
    );
    withToken(token);
    const response = await apple(
      { code: "code-1", state: "state-1" },
      appleCookie,
    );
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/enroll/prog-1?error=auth`,
    );
    expect(identity.findOrCreateAccountByIdentity).not.toHaveBeenCalled();
  });
});
