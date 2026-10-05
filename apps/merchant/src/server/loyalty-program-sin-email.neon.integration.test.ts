import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
// `signup` encola el link de verificacion: `console` no entrega nada.
process.env.EMAIL_PROVIDER = "console";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "@mi-pasaporte/db";
import { loyaltyPrograms } from "@mi-pasaporte/db/schema";
import { wipePrograms } from "./unverified-owner-support";
import {
  DELETE as PROGRAM_DELETE,
  GET as PROGRAM_GET,
  PUT as PROGRAM_PUT,
} from "../app/api/loyalty-program/route";
import { GET as QR } from "../app/api/loyalty-program/qr/route";
import { GET as TEMPLATES } from "../app/api/loyalty-terms/templates/route";
import {
  dropSignups,
  signup,
  signupBody,
} from "./onboarding-signup-integration-support";

/**
 * Spec 0156 C / ADR 0122 — **EL PROGRAMA NO EXIGE EMAIL VERIFICADO**, contra la base y con la
 * cookie REAL que devuelve `POST /api/onboarding/signup` (la cuenta tiene segundos y
 * `email_verified = false` por construcción).
 *
 * Ver, crear y editar el programa, leer las plantillas de condiciones y el QR pasan; retirar
 * el programa (`DELETE`) sigue exigiendo owner verificado (ADR 0122 §4). El staff con y sin
 * `loyalty` vive en `permisos-brand-loyalty.neon.integration.test.ts`.
 *
 * **El oráculo de la edición es la BASE**: un 200 con la fila sin reescribir sería un falso
 * verde, así que se lee la `configuration` por SQL. Era `onboarding-program-bypass.neon…`,
 * que aseveraba lo contrario (editar sin verificar → 403) hasta el ADR 0122.
 */
describe.skipIf(!enabled)(
  "el programa sin email verificado (spec 0156 C, ADR 0122)",
  () => {
    const email = `sin-email-${randomUUID()}@example.test`;
    let businessId = "";
    let cookie = "";

    const call = (
      handler: (request: Request) => Promise<Response>,
      path: string,
      method: string,
      body?: unknown,
    ) =>
      handler(
        new Request(`http://localhost:3001${path}`, {
          method,
          headers: { "content-type": "application/json", cookie },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );

    /** El cuerpo CORTO de Sellos de la spec 0079. */
    const conTarget = (target: number) => ({
      kind: "stamps",
      configuration: { target },
      rewards: [{ type: "custom", label: "Café gratis" }],
    });

    const configurationNow = async () => {
      const [row] = await getDb()
        .select({ configuration: loyaltyPrograms.configuration })
        .from(loyaltyPrograms)
        .where(eq(loyaltyPrograms.businessId, businessId))
        .limit(1);
      return row?.configuration ?? null;
    };

    beforeAll(async () => {
      const created = await signup(signupBody(email));
      expect(created.status).toBe(201);
      businessId = (await created.json()).business.id as string;
      cookie = (created.headers.get("set-cookie") ?? "").split(";")[0];
    }, 60_000);

    afterAll(async () => {
      // El programa primero: `dropSignups` borra el negocio y el programa no cae en cascada.
      if (businessId) await wipePrograms(businessId);
      await dropSignups([email]);
    }, 60_000);

    it("antes de crear: GET del programa → 200 sin programa; QR → 404 `no_program`", async () => {
      const read = await call(PROGRAM_GET, "/api/loyalty-program", "GET");
      expect(read.status).toBe(200);
      const body = await read.json();
      expect(body.business.id).toBe(businessId);
      expect(body.program).toBeNull();
      const qr = await call(QR, "/api/loyalty-program/qr", "GET");
      expect(qr.status).toBe(404);
      expect((await qr.json()).code).toBe("no_program");
    }, 60_000);

    it("ORÁCULO DE M2 — crear → 201 y EDITAR → 200 con la fila reescrita, sin verificar", async () => {
      const first = await call(
        PROGRAM_PUT,
        "/api/loyalty-program",
        "PUT",
        conTarget(8),
      );
      expect(first.status).toBe(201);
      expect((await first.json()).created).toBe(true);
      expect(await configurationNow()).toMatchObject({ target: 8 });

      const second = await call(
        PROGRAM_PUT,
        "/api/loyalty-program",
        "PUT",
        conTarget(50),
      );
      expect(second.status).toBe(200);
      expect((await second.json()).created).toBe(false);
      expect(await configurationNow()).toEqual({
        unitName: "sello",
        unitPlural: "sellos",
        target: 50,
      });
    }, 120_000);

    it("ORÁCULO DE M1 — con programa: GET → 200 con el programa; QR → 200 SVG", async () => {
      const read = await call(PROGRAM_GET, "/api/loyalty-program", "GET");
      expect(read.status).toBe(200);
      const body = await read.json();
      expect(body.business.id).toBe(businessId);
      expect(body.program.configuration).toMatchObject({ target: 50 });
      const qr = await call(QR, "/api/loyalty-program/qr", "GET");
      expect(qr.status).toBe(200);
      expect(qr.headers.get("content-type")).toBe("image/svg+xml");
    }, 60_000);

    it("las plantillas de condiciones → 200", async () => {
      const response = await call(
        TEMPLATES,
        "/api/loyalty-terms/templates",
        "GET",
      );
      expect(response.status).toBe(200);
      expect(Array.isArray((await response.json()).templates)).toBe(true);
    }, 60_000);

    it("RETIRAR (`DELETE`) sigue exigiendo email verificado: 403 y el programa sigue activo", async () => {
      const response = await call(
        PROGRAM_DELETE,
        "/api/loyalty-program",
        "DELETE",
        {},
      );
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
      const [row] = await getDb()
        .select({ status: loyaltyPrograms.status })
        .from(loyaltyPrograms)
        .where(eq(loyaltyPrograms.businessId, businessId));
      expect(row.status).toBe("active");
    }, 60_000);
  },
);
