import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  dropBusiness,
  integrationEnabled,
  seedMember,
} from "../../../../server/counter-integration-support";
import { getDb } from "../../../../server/db";
import {
  businesses,
  loyaltyPrograms,
  memberships,
  users,
} from "../../../../server/schema";
import { openMerchantSession } from "../../../../server/merchant-session";

import { GET } from "./route";

/**
 * Spec 0074 §D3 — `GET /api/onboarding/state` CONTRA NEON.
 *
 * **El mundo esta sembrado con el email SIN VERIFICAR a proposito**, porque ese es el estado
 * REAL de quien esta a mitad del wizard: el alta corre ANTES de la verificacion (ADR 0070
 * §11). Un gate de email aca volveria irretomable el unico flujo que ocurre antes de
 * verificar, y es la mutacion M5.
 */
const stateRequest = (cookie?: string) =>
  new Request("https://merchant.test/api/onboarding/state", {
    method: "GET",
    ...(cookie ? { headers: { cookie } } : {}),
  });

const cookieFor = async (userId: string) =>
  (await openMerchantSession(userId)).split(";")[0];

async function seedUser(emailVerified: boolean): Promise<string> {
  const userId = `onb-int-${randomUUID()}`;
  await getDb()
    .insert(users)
    .values({
      id: userId,
      name: "A mitad del wizard",
      email: `${userId}@example.test`,
      emailVerified,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  return userId;
}

describe.skipIf(!integrationEnabled)(
  "GET /api/onboarding/state — retomar el wizard (spec 0074 §D3)",
  () => {
    let userId: string;
    let cookie: string;
    let businessId: string;
    let slug: string;
    let name: string;

    beforeAll(async () => {
      userId = await seedUser(false);
      cookie = await cookieFor(userId);
      businessId = randomUUID();
      name = `Wizard ${businessId.slice(0, 8)}`;
      slug = `int-${businessId.slice(0, 20)}`;
      await getDb().insert(businesses).values({
        id: businessId,
        name,
        slug,
        countryCode: "EC",
        timezone: "America/Guayaquil",
        currencyCode: "USD",
      });
      await getDb()
        .insert(memberships)
        .values({ businessId, userId, role: "owner" });
    }, 120_000);

    afterAll(async () => {
      await dropBusiness(businessId);
    }, 60_000);

    it("SIN SESION: 200 con `{authenticated:false}`", async () => {
      const response = await GET(stateRequest());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ authenticated: false });
    }, 60_000);

    it("con sesion y SIN negocio: los tres hechos en falso", async () => {
      const soloUser = await seedUser(false);
      const response = await GET(stateRequest(await cookieFor(soloUser)));
      expect(response.status).toBe(200);
      // El paso lo deriva la UI de estos hechos: `business === null` → paso 1. NO hay un
      // `"step"` y no lo va a haber (ADR 0070 prohibe la columna `onboarding_step`).
      expect(await response.json()).toEqual({
        authenticated: true,
        business: null,
        program: null,
        stampImage: false,
      });
    }, 60_000);

    it("con negocio y SIN programa: el paso 1 hecho, el 2 no — y el EMAIL SIN VERIFICAR responde 200", async () => {
      // El oraculo de que el gate NO esta: la fila dice `email_verified = false` y la ruta
      // igual contesta 200 con el negocio. Es la mutacion M5.
      const [row] = await getDb()
        .select({ emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, userId));
      expect(row.emailVerified).toBe(false);

      const response = await GET(stateRequest(cookie));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        authenticated: true,
        business: { id: businessId, name, slug },
        program: null,
        stampImage: false,
      });
    }, 60_000);

    it("con negocio Y programa: `kind` y `stampImage`, sin la clave de R2", async () => {
      const programId = randomUUID();
      await getDb()
        .insert(loyaltyPrograms)
        .values({
          id: programId,
          businessId,
          kind: "stamps",
          configuration: { target: 10 },
          status: "active",
          termsMarkdown: "TOS",
          termsHash: "hash",
          createdBy: userId,
          accrualMode: "per_purchase",
          accrualGrant: 1,
          // La clave INTERNA de R2 esta puesta: el `stampImage: true` tiene que derivarse de
          // ella sin que la clave cruce (`CLAUDE.md`, la fuga que un revisor cazo en marca).
          stampImageObjectKey: `programs/${programId}/stamp`,
          stampImageVersion: 1,
        });

      const response = await GET(stateRequest(cookie));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        authenticated: true,
        business: { id: businessId, name, slug },
        program: { id: programId, kind: "stamps" },
        stampImage: true,
      });
      // Sobre el CONJUNTO EXACTO de claves, no por ausencia: un `not.toHaveProperty` pasa
      // en verde si el objeto cambia de forma.
      expect(Object.keys(body.program).sort()).toEqual(["id", "kind"]);
      expect(JSON.stringify(body)).not.toContain("programs/");
    }, 60_000);

    it("membresia NO `active`: `business: null` Y `program: null`, con el programa EXISTIENDO", async () => {
      // EL PROGRAMA DEL CASO ANTERIOR SIGUE EN LA BASE, y se verifica por SQL: sin este
      // chequeo, el `program: null` de abajo seria VACUO —pasaria igual si el negocio no
      // tuviera programa— y el caso no probaria nada. Si la ruta devolviera el negocio,
      // devolveria tambien este programa.
      const [existing] = await getDb()
        .select({ id: loyaltyPrograms.id })
        .from(loyaltyPrograms)
        .where(eq(loyaltyPrograms.businessId, businessId));
      expect(
        existing?.id,
        "el programa del caso anterior tiene que existir",
      ).toBeDefined();

      // Un integrante DADO DE BAJA. La regla es contrato (§D1) y vale para las dos puertas:
      // sin ella leeria `id`, `name` y `slug` del negocio por esta y no por la otra.
      const disabledId = await seedMember({ businessId, status: "disabled" });
      const response = await GET(stateRequest(await cookieFor(disabledId)));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        authenticated: true,
        business: null,
        program: null,
        stampImage: false,
      });
      await getDb()
        .delete(memberships)
        .where(eq(memberships.userId, disabledId));
    }, 120_000);
  },
);
