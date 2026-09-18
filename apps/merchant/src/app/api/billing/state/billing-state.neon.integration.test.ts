import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  dropBusiness,
  seedMember,
  type Seed,
} from "../../../../server/counter-integration-support";
import {
  integrationEnabled,
  seedLocationsBusiness,
} from "../../../../server/locations-integration-support";
import { getDb } from "../../../../server/db";
import { businesses, users } from "../../../../server/schema";
import { openMerchantSession } from "../../../../server/merchant-session";

import { GET } from "./route";

/**
 * Spec 0074 §D2 — `GET /api/billing/state` CONTRA NEON: LOS CINCO `code` DE LA 0072 EN SU
 * ORDEN, con sesiones reales, mas el camino feliz.
 *
 * **Por que el ORDEN es lo que se mide y no solo cada `code` por separado:** el orden es
 * contrato (ADR 0073 §1). Un integrante tiene que recibir SIEMPRE `not_owner`, aunque su email
 * no este verificado y aunque el negocio este suspendido — puestos al reves, un tercero podria
 * sondear el estado de un negocio ajeno. Por eso hay dos casos de PRECEDENCIA y no solo cinco
 * casos sueltos.
 */
const stateRequest = (cookie?: string) =>
  new Request("https://merchant.test/api/billing/state", {
    method: "GET",
    ...(cookie ? { headers: { cookie } } : {}),
  });

const cookieFor = async (userId: string) =>
  (await openMerchantSession(userId)).split(";")[0];

describe.skipIf(!integrationEnabled)(
  "GET /api/billing/state — el gate del owner y el plan (spec 0074 §D2)",
  () => {
    let seed: Seed;
    let ownerCookie: string;
    let staffCookie: string;
    let staffId: string;

    beforeAll(async () => {
      seed = await seedLocationsBusiness(
        `Plan ${randomUUID().slice(0, 8)}`,
        "plus",
        { interval: "month" },
      );
      ownerCookie = await cookieFor(seed.userId);
      staffId = await seedMember({ businessId: seed.business.id });
      staffCookie = await cookieFor(staffId);
    }, 120_000);

    afterAll(async () => {
      await dropBusiness(seed.business.id);
    }, 60_000);

    async function setStatus(
      status: string,
      suspensionReason: string | null,
    ): Promise<void> {
      await getDb()
        .update(businesses)
        .set({ status, suspensionReason, statusChangedAt: new Date() })
        .where(eq(businesses.id, seed.business.id));
    }

    async function setVerified(verified: boolean): Promise<void> {
      await getDb()
        .update(users)
        .set({ emailVerified: verified })
        .where(eq(users.id, seed.userId));
    }

    it("camino feliz: el cuerpo literal del anexo, y NADA de Stripe", async () => {
      const response = await GET(stateRequest(ownerCookie));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        subscription: {
          plan: "plus",
          status: "active",
          interval: "month",
          pendingPlan: null,
          pendingPlanAt: null,
        },
        activeLocations: 1,
        canCancel: true,
      });
      // ALLOW-LIST POSITIVA, aseverada sobre el CONJUNTO EXACTO de claves: `not.toHaveProperty`
      // pasa en verde si el objeto cambia de forma.
      expect(Object.keys(body.subscription).sort()).toEqual([
        "interval",
        "pendingPlan",
        "pendingPlanAt",
        "plan",
        "status",
      ]);
    }, 120_000);

    it("paso 1 — sin sesion: 401 `unauthorized`", async () => {
      const response = await GET(stateRequest());
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "No autorizado.",
        code: "unauthorized",
      });
    }, 60_000);

    it("paso 2 — un INTEGRANTE: 403 `not_owner`, sin motivo", async () => {
      const response = await GET(stateRequest(staffCookie));
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({
        error: "Solo el owner puede gestionar la suscripción.",
        code: "not_owner",
      });
      expect(body.suspensionReason).toBeUndefined();
    }, 60_000);

    it("paso 3 — owner con el email SIN verificar: 403 `email_not_verified`", async () => {
      await setVerified(false);
      try {
        const response = await GET(stateRequest(ownerCookie));
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
          error: "Verificá tu email para gestionar la suscripción.",
          code: "email_not_verified",
        });
      } finally {
        await setVerified(true);
      }
    }, 60_000);

    it("paso 4 — negocio `suspended`: 403 `business_suspended` CON motivo", async () => {
      await setStatus("suspended", "Reclamos de consumidores.");
      try {
        const response = await GET(stateRequest(ownerCookie));
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
          error: "Tu cuenta está suspendida.",
          code: "business_suspended",
          suspensionReason: "Reclamos de consumidores.",
        });
      } finally {
        await setStatus("active", null);
      }
    }, 60_000);

    it("paso 4 — negocio `closed`: 403 `business_closed` y SIN motivo", async () => {
      await setStatus("closed", "Motivo viejo de una suspension.");
      try {
        const response = await GET(stateRequest(ownerCookie));
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body).toEqual({
          error: "Esta cuenta está cerrada.",
          code: "business_closed",
        });
        // Un negocio cerrado no tiene motivo que mostrar, y el de una suspension anterior
        // seria informacion vieja.
        expect(body.suspensionReason).toBeUndefined();
      } finally {
        await setStatus("active", null);
      }
    }, 60_000);

    it("PRECEDENCIA: el integrante de un negocio suspendido recibe `not_owner`, no `business_suspended`", async () => {
      await setStatus("suspended", "Motivo interno.");
      try {
        const response = await GET(stateRequest(staffCookie));
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.code).toBe("not_owner");
        expect(body.suspensionReason).toBeUndefined();
      } finally {
        await setStatus("active", null);
      }
    }, 60_000);

    it("PRECEDENCIA: el owner sin verificar de un negocio suspendido recibe `email_not_verified`", async () => {
      await setVerified(false);
      await setStatus("suspended", "Motivo interno.");
      try {
        const response = await GET(stateRequest(ownerCookie));
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe("email_not_verified");
      } finally {
        await setStatus("active", null);
        await setVerified(true);
      }
    }, 60_000);
  },
);
