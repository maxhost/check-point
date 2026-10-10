import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

/** La cookie que ve `requireBackofficeSession`, que lee `next/headers` y no el `Request`.
 * Esta en un objeto porque la factory de `vi.mock` se hoistea sobre las declaraciones. */
const guard = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(guard.cookie ? { cookie: guard.cookie } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import {
  dropBusiness,
  integrationEnabled,
  seedTrialSubscription,
} from "../../../../server/counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships, users } from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "../../../../server/merchant-session";
import { requireBackofficeSession } from "../../../../server/auth-guards";

import { GET } from "./route";

/**
 * Spec 0074 §D1 — `GET /api/merchant/session` CONTRA NEON, el caso M2 (DOS membresias), en su
 * propio archivo desde la spec 0189 por el limite de 300 lineas de `session.neon…`.
 */
const sessionRequest = (cookie?: string) =>
  new Request("https://merchant.test/api/merchant/session", {
    method: "GET",
    ...(cookie ? { headers: { cookie } } : {}),
  });

const cookieFor = async (userId: string) =>
  (await openMerchantSession(userId)).split(";")[0];

describe.skipIf(!integrationEnabled)(
  "GET /api/merchant/session — el negocio mas viejo (spec 0074 §D1, M2)",
  () => {
    /** El mundo del caso M2: un usuario con DOS membresias. */
    const twin = { userId: "", oldBusiness: "", newBusiness: "" };

    afterAll(async () => {
      if (twin.oldBusiness) await dropBusiness(twin.oldBusiness);
      if (twin.newBusiness) await dropBusiness(twin.newBusiness);
    }, 60_000);

    it("con DOS membresias devuelve el negocio mas VIEJO, el mismo que `requireBackofficeSession`", async () => {
      twin.userId = `session-int-${randomUUID()}`;
      await getDb()
        .insert(users)
        .values({
          id: twin.userId,
          name: "Dos negocios",
          email: `${twin.userId}@example.test`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      // EL ORDEN DE INSERCION ES EL CONTRARIO AL DE `created_at`, y es lo que hace que la
      // mutacion M2 muerda: con el `orderBy` quitado, un `limit(1)` sobre un seq scan
      // devuelve la fila FISICAMENTE primera, que aca es la del negocio MAS NUEVO.
      twin.newBusiness = await seedTwin(twin.userId, "Nuevo", new Date());
      twin.oldBusiness = await seedTwin(
        twin.userId,
        "Viejo",
        new Date(Date.now() - 86_400_000),
      );

      const cookie = await cookieFor(twin.userId);
      const response = await GET(sessionRequest(cookie));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.business.id).toBe(twin.oldBusiness);

      // Y EL ORACULO QUE IMPORTA: el guard del backoffice resuelve EL MISMO negocio. Si las
      // dos superficies divergieran, la UI y el servidor hablarian de negocios distintos.
      guard.cookie = cookie;
      const context = await requireBackofficeSession();
      expect(body.business.id).toBe(context.business.id);
    }, 120_000);
  },
);

/** Un negocio con su membresia `owner`, con el `created_at` que el caso necesita. */
async function seedTwin(
  userId: string,
  label: string,
  createdAt: Date,
): Promise<string> {
  const businessId = randomUUID();
  await getDb()
    .insert(businesses)
    .values({
      id: businessId,
      name: `${label} ${businessId.slice(0, 8)}`,
      slug: `int-${businessId.slice(0, 20)}`,
      countryCode: "EC",
      timezone: "America/Guayaquil",
      currencyCode: "USD",
      createdAt,
    });
  await getDb()
    .insert(memberships)
    .values({ businessId, userId, role: "owner" });
  // Spec 0189: la fila de prueba que todo negocio tiene; sin ella el guard del backoffice
  // (fail-closed) redirige a la suscripcion en vez de resolver el negocio.
  await seedTrialSubscription(businessId);
  return businessId;
}
