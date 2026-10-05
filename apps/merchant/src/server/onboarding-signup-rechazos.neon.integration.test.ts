import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

// El token de seleccion se firma con este secreto; better-auth necesita las dos.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
process.env.EMAIL_PROVIDER = "console";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import {
  attemptCount,
  dropSignups,
  linkTokenCount,
  signup,
  signupBody,
  userByEmail,
} from "./onboarding-signup-integration-support";
import { testSelectionToken } from "./places/selection-test-support";

/**
 * Spec 0155 — los RECHAZOS de `POST /api/onboarding/signup` contra la base, separados de
 * `onboarding-signup.neon.integration.test.ts` por el limite de tamaño. Contrato P4: «se
 * valida todo (400/422) antes de mirar si el email existe: un error de validacion nunca
 * manda un mail» — y tampoco gasta cupo ni crea la cuenta. Las tres cosas se cuentan por SQL.
 */
describe.skipIf(!enabled)(
  "signup — rechazos: nada se escribe y no sale ningun mail (spec 0155)",
  () => {
    // UN EMAIL POR CASO: si un caso deja una fila (p. ej. bajo una mutacion que acepta el
    // token), los demas no heredan ese estado y su rojo no se lee como propio.
    const used: string[] = [];
    const rejected = () => {
      const email = `signup-rechazado-${randomUUID()}@example.test`;
      used.push(email);
      return email;
    };

    afterAll(() => dropSignups(used), 60_000);

    const nothingFor = async (email: string) => {
      expect(await userByEmail(email)).toHaveLength(0);
      // Ni siquiera el intento del rate limit: la validacion va ANTES del paso 5.
      expect(await attemptCount(email)).toBe(0);
      expect(await linkTokenCount(email)).toBe(0);
    };
    const [payload, signature] = testSelectionToken().split(".");
    const altered = `${Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, "base64url").toString()),
        latitude: -3.9081,
      }),
    ).toString("base64url")}.${signature}`;

    // ORACULO DE M1 (lado Neon): el token alterado esta VIGENTE.
    it.each([
      ["alterado", altered],
      ["vencido", testSelectionToken({}, new Date(Date.now() - 3 * 3_600_000))],
      [
        "de un pais no soportado (ES)",
        testSelectionToken({ countryCode: "ES", timezone: "Europe/Madrid" }),
      ],
      ["ausente", undefined],
    ])(
      "token %s → 422 invalid_selection",
      async (_case, selectionToken) => {
        const email = rejected();
        const response = await signup(signupBody(email, { selectionToken }));
        expect(response.status).toBe(422);
        expect((await response.json()).code).toBe("invalid_selection");
        await nothingFor(email);
      },
      60_000,
    );

    it.each([
      ["gcid:inventado"],
      ["restaurant"],
      ["gcid:store"],
      [""],
      [42],
      [null],
      [undefined],
    ])(
      "categoria fuera de la lista (%j) → 400 invalid_business",
      async (value) => {
        const email = rejected();
        const response = await signup(
          signupBody(email, { categoryGcid: value }),
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          code: "invalid_business",
          field: "categoryGcid",
        });
        await nothingFor(email);
      },
      60_000,
    );

    it("un cuerpo que no es JSON → 400 invalid_body (ya no rechaza el handler)", async () => {
      const response = await signup("esto no es json");
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_body");
    }, 60_000);

    it("un email con forma invalida → 400 invalid_email", async () => {
      const response = await signup(signupBody("sin-arroba"));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_email");
      expect(await attemptCount("sin-arroba")).toBe(0);
    }, 60_000);
  },
);
