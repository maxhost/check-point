import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { authStartAttempts, users } from "./schema";
import {
  type GrantSeed,
  dropGrantSeed,
  grantRowsOf,
  openSessionCookie,
  programRequest,
  seedUnverifiedOwner,
  wipePrograms,
} from "./onboarding-grant-support";
import { ONBOARDING_GRANT_MINUTES } from "./onboarding-grant";
import { createStaff } from "./staff-create";
import { POST as START } from "../app/api/merchant/auth/start/route";
import { POST as STAFF_LOGIN } from "../app/api/merchant/auth/staff/route";
import { POST as CHECKOUT } from "../app/api/billing/checkout/route";
import { GET as CATALOG } from "../app/api/catalog/route";
import { GET as LOCATIONS } from "../app/api/locations/route";
import { GET as CAMPAIGNS } from "../app/api/marketing/campaigns/route";
import { GET as STAFF } from "../app/api/staff/route";
import { GET as BRAND } from "../app/api/brand/route";
import { POST as LOGO_UPLOAD } from "../app/api/brand/logo-upload/route";
import {
  GET as PROGRAM,
  PUT as PROGRAM_PUT,
} from "../app/api/loyalty-program/route";
import { POST as STAMP_UPLOAD } from "../app/api/loyalty-program/stamp-upload/route";
import { GET as TEMPLATES } from "../app/api/loyalty-terms/templates/route";
import { PATCH as SLUG } from "../app/api/merchant/business/slug/route";

/**
 * Spec 0077 — QUIÉN RECIBE EL PERMISO DE ALTA Y QUIÉN NO, contra Neon.
 *
 * Es el invariante de autorización de la spec, y sólo se puede medir con base: la fila que
 * `auth/start` escribe y la que `auth/staff` escribe son filas distintas de la misma tabla.
 * Los tres cortes van en `onboarding-grant-cortes.neon.integration.test.ts`.
 */
const req = (path: string, method: string, cookie: string) =>
  new NextRequest(`https://merchant.test${path}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    ...(method === "GET" ? {} : { body: JSON.stringify({}) }),
  });

/**
 * Las ONCE entradas del ADR 0073 §1 que conservan el gate ENTERO — las 13 de
 * `api-owner-surfaces.test.ts` menos las DOS sin paso 3: el QR (spec 0075, que el ADR 0076
 * §3 deja fuera del permiso porque es una LECTURA) y el `PUT` de la ruta única (spec 0079,
 * cuyo gate bajó al writer). El lado positivo del `PUT` se mide al final del archivo.
 */
const SURFACES: Array<[string, (cookie: string) => Promise<Response>]> = [
  [
    "billing/checkout",
    (c) => CHECKOUT(req("/api/billing/checkout", "POST", c)),
  ],
  ["catalog", (c) => CATALOG(req("/api/catalog", "GET", c))],
  ["locations", (c) => LOCATIONS(req("/api/locations", "GET", c))],
  [
    "marketing/campaigns",
    (c) => CAMPAIGNS(req("/api/marketing/campaigns", "GET", c)),
  ],
  ["staff", (c) => STAFF(req("/api/staff", "GET", c))],
  ["brand", (c) => BRAND(req("/api/brand", "GET", c))],
  [
    "brand/logo-upload",
    (c) => LOGO_UPLOAD(req("/api/brand/logo-upload", "POST", c)),
  ],
  ["loyalty-program", (c) => PROGRAM(req("/api/loyalty-program", "GET", c))],
  [
    "loyalty-program/stamp-upload",
    (c) => STAMP_UPLOAD(req("/api/loyalty-program/stamp-upload", "POST", c)),
  ],
  [
    "loyalty-terms/templates",
    (c) => TEMPLATES(req("/api/loyalty-terms/templates", "GET", c)),
  ],
  [
    "merchant/business/slug",
    (c) => SLUG(req("/api/merchant/business/slug", "PATCH", c)),
  ],
];

describe.skipIf(!enabled)(
  "quién recibe el permiso de alta (spec 0077 §3)",
  () => {
    let seed: GrantSeed;

    beforeAll(async () => {
      seed = await seedUnverifiedOwner("quien");
    }, 60_000);

    afterAll(async () => {
      await dropGrantSeed(seed);
    }, 60_000);

    /** La rama del email DESCONOCIDO: el único punto donde el servidor sabe por sí mismo
     * que arranca un alta, porque es el que acaba de crear la cuenta (ADR 0076 §2). */
    it("`auth/start` con un email desconocido abre la sesión CON el permiso a 60 min", async () => {
      const email = `alta-${randomUUID()}@example.test`;
      const response = await START(
        new Request("http://localhost:3001/api/merchant/auth/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        }),
      );
      expect(response.status).toBe(200);
      // EL PERMISO NO VIAJA: ni en el cuerpo, ni en la cookie (ADR 0076 §2).
      const cookie = response.headers.get("set-cookie") ?? "";
      const text = await response.text();
      expect(JSON.parse(text).sent).toBe(false);
      expect(text).not.toContain("onboardingGrant");
      expect(cookie.toLowerCase()).not.toContain("grant");

      const db = getDb();
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      expect(user).toBeTruthy();
      const rows = await grantRowsOf(user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].until).toBeInstanceOf(Date);
      const minutes = ((rows[0].until as Date).getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(55);
      expect(minutes).toBeLessThanOrEqual(ONBOARDING_GRANT_MINUTES + 0.5);

      await db.delete(users).where(eq(users.id, user.id));
      await db
        .delete(authStartAttempts)
        .where(eq(authStartAttempts.email, email));
    }, 90_000);

    /** Y QUIÉN NO: un PIN jamás abre una sesión con permiso de alta. */
    it("`auth/staff` (login por PIN) NUNCA lo recibe: la columna queda NULL", async () => {
      const { staff, pin } = await createStaff(
        { id: seed.businessId, slug: seed.slug },
        { name: "Cajera Sin Permiso", permissions: ["counter"] },
        "owner",
      );
      const response = await STAFF_LOGIN(
        new Request("http://localhost:3001/api/merchant/auth/staff", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: staff.identifier, pin }),
        }),
      );
      expect(response.status).toBe(200);
      const rows = await grantRowsOf(staff.userId);
      expect(rows).toHaveLength(1);
      expect(rows[0].until).toBeNull();
    }, 90_000);

    /**
     * EL PERMISO NO DERRAMA (ADR 0076 §3): staff, locales, marca, campañas, catálogo y
     * billing conservan el gate ENTERO. El barrido corre sobre una SESIÓN REAL con el
     * permiso vigente —no sobre un doble—, así que mide el CABLEADO: `requireApiOwner` no
     * lee la columna, y esa es la propiedad.
     */
    describe("no habilita ninguna de las otras 11 entradas (ADR 0073 §1)", () => {
      it("la tabla de superficies no quedó vacía ni de más", () => {
        expect(SURFACES.length).toBe(11);
        expect(SURFACES.map(([n]) => n)).not.toContain("loyalty-program/qr");
      });

      it.each(SURFACES)(
        "%s: con el permiso VIGENTE sigue dando 403 `email_not_verified`",
        async (_name, call) => {
          const cookie = await openSessionCookie(
            seed.ownerId,
            ONBOARDING_GRANT_MINUTES,
          );
          const response = await call(cookie);
          expect(response.status).toBe(403);
          expect((await response.json()).code).toBe("email_not_verified");
        },
        120_000,
      );
    });

    /**
     * **El caso que la spec 0079 dio vuelta a propósito**: hasta la 0079 exigía 403 acá,
     * porque `PUT /api/loyalty-program` era la puerta gateada y cortaba en el paso 3. La
     * 0079 la convierte en la ÚNICA escritura y le saca ese paso, porque desde la 0077 el
     * invariante vive en `saveProgram` —que distingue crear de editar—. Con el email SIN
     * verificar y sin programa previo, el cuerpo corto de Sellos **crea**: 201.
     *
     * **⚠️ OJO — ESTE 201 NO PRUEBA EL PERMISO** (spec 0080 §2, corrigiendo el título viejo
     * «es lo ÚNICO que el permiso habilita»): `programEditDenied`
     * (`server/onboarding-grant.ts:76`) abre con `if (!input.isEdit) return null`, así que
     * **crear sale igual SIN permiso** —y eso lo mide `onboarding-program-bypass.neon`
     * («sin email verificado y SIN permiso, CREAR el primer programa sigue dando 201»)—.
     * Lo que este caso pinnea es que la puerta ya no corta por el paso 3, que es el lado
     * positivo del barrido de las 11 de arriba. **El control positivo del permiso en sí
     * —editar CON permiso vigente → 200— vive en `onboarding-program-bypass.neon`.**
     */
    it("CREAR sigue dando 201 con una sesión sin verificar: la 0079 le sacó el paso 3 a esta puerta", async () => {
      await wipePrograms(seed.businessId);
      const cookie = await openSessionCookie(
        seed.ownerId,
        ONBOARDING_GRANT_MINUTES,
      );
      const response = await PROGRAM_PUT(programRequest(cookie));
      expect(response.status).toBe(201);
      expect((await response.json()).created).toBe(true);
      await wipePrograms(seed.businessId);
    }, 90_000);
  },
);
