import { beforeAll, describe, expect, it } from "vitest";
import { getMerchantAuth } from "./auth";

/**
 * Regression guard for the reviewer's blocking finding on spec 0046.
 *
 * The `/api/auth/[...all]` catch-all mounts every better-auth endpoint, including the
 * ones its plugins contribute. Those skip the gate, the persistent rate limit, the
 * disabled-staff check and the audit trail our own routes enforce. They must stay closed
 * over HTTP; the server-side `auth.api.*` calls our routes make are NOT affected by
 * `disabledPaths`.
 *
 * Spec 0067 added the `magicLink` plugin, and the same rule applies to its two endpoints
 * (measured in `dist/plugins/magic-link/index.mjs`): over HTTP they would bypass the
 * per-IP rate limit and the attempt ledger of `POST /api/merchant/auth/start`.
 *
 * The 404 comes from the router's `onRequest`, before any endpoint or database work,
 * so this needs no live database.
 */
const BASE = "http://localhost:3001";

const BLOCKED = [
  "/api/auth/email-otp/send-verification-otp",
  "/api/auth/email-otp/check-verification-otp",
  "/api/auth/email-otp/verify-email",
  "/api/auth/email-otp/request-password-reset",
  "/api/auth/email-otp/reset-password",
  "/api/auth/email-otp/request-email-change",
  "/api/auth/email-otp/change-email",
  "/api/auth/forget-password/email-otp",
  "/api/auth/sign-in/email-otp",
  // Spec 0067 §2 — los dos unicos que publica `magicLink`.
  "/api/auth/sign-in/magic-link",
  "/api/auth/magic-link/verify",
];

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET ??= "disabled-paths-secret-at-least-32-bytes";
  process.env.BETTER_AUTH_URL ??= `${BASE}/api/auth`;
  process.env.DATABASE_URL ??= "postgresql://user:pass@localhost/db";
});

describe("better-auth HTTP surface (spec 0046)", () => {
  it.each(BLOCKED)("answers 404 for %s", async (path) => {
    const response = await getMerchantAuth().handler(
      new Request(`${BASE}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com" }),
      }),
    );
    // Anything but 404 means the bypass is open again.
    expect(response.status).toBe(404);
  });

  // EL CONTROL, sin el cual la lista de arriba no prueba nada: un path mal escrito tambien
  // da 404, asi que hace falta al menos un endpoint VIVO que conteste otra cosa. Era
  // `/sign-in/email`; la spec 0067 apago `emailAndPassword`, asi que ese ya no existe y el
  // control pasa a `/sign-out`, que es una ruta CORE de better-auth.
  it("keeps a live better-auth endpoint reachable (control del 404)", async () => {
    const response = await getMerchantAuth().handler(
      new Request(`${BASE}/api/auth/sign-out`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).not.toBe(404);
  });

  // Spec 0067 §2 / DoD: el merchant YA NO TIENE CONTRASEÑA. Que no quede ninguna llamada a
  // `signIn.email` en el arbol no dice nada si el endpoint sigue autenticando, asi que lo
  // que se pinnea es el comportamiento.
  //
  // MEDIDO, y no es lo que uno supondria: con `emailAndPassword.enabled` apagado
  // better-auth 1.6.26 **sigue montando** `/sign-in/email` y contesta **400** con
  // «Email and password is not enabled», no 404. O sea que el path existe y rechaza; lo
  // que esta prueba fija es que NO PUEDE autenticar a nadie. Si alguien volviera a
  // encender `emailAndPassword`, este 400 se convertiria en un 401/200 y el test muerde.
  it("el login por contraseña ya no autentica a nadie", async () => {
    const response = await getMerchantAuth().handler(
      new Request(`${BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", password: "x" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(JSON.stringify(await response.json())).toContain("not enabled");
  });
});
