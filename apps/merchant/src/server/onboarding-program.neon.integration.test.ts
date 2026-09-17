import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  loyaltyProgramEvents,
  loyaltyPrograms,
  loyaltyRewards,
  memberships,
  users,
} from "./schema";
import { openMerchantSession } from "./merchant-session";
import { wizardClauseTemplateIds } from "./onboarding/program-defaults";
import { POST } from "../app/api/onboarding/program/route";

/**
 * Spec 0069 §D4 — `POST /api/onboarding/program` CONTRA LA BASE.
 *
 * Lo que sólo se puede medir con base de verdad:
 *  - las semillas `earning` y `redemption` de `core.terms_template` EXISTEN y se
 *    resuelven a dos ids (si no, la ruta contesta 503 en vez de escribir un programa
 *    sin términos);
 *  - el programa nace `status = 'active'` — **propiedad a verificar, no a construir**:
 *    el default es de la columna;
 *  - el markdown de los términos tiene DOS cláusulas, con las variables renderizadas
 *    contra el nombre real del negocio.
 */
describe.skipIf(!enabled)(
  "el programa del wizard contra Neon (spec 0069)",
  () => {
    const ownerId = `onb-prog-${randomUUID()}`;
    const businessId = randomUUID();
    const businessName = "La Farmacia del Wizard";
    let cookie = "";

    const post = (body: unknown) =>
      POST(
        new Request("http://localhost:3001/api/onboarding/program", {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify(body),
        }),
      );

    const wipePrograms = async () => {
      const db = getDb();
      await db
        .delete(loyaltyProgramEvents)
        .where(eq(loyaltyProgramEvents.businessId, businessId));
      await db
        .delete(loyaltyRewards)
        .where(eq(loyaltyRewards.businessId, businessId));
      await db
        .delete(loyaltyPrograms)
        .where(eq(loyaltyPrograms.businessId, businessId));
    };

    beforeAll(async () => {
      const db = getDb();
      await db.insert(users).values({
        id: ownerId,
        name: "Owner Wizard",
        email: `${ownerId}@example.test`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(businesses).values({
        id: businessId,
        name: businessName,
        slug: `wizard-${businessId.slice(0, 12)}`,
        categoryGcid: "gcid:pharmacy",
        countryCode: "EC",
        timezone: "America/Guayaquil",
      });
      await db
        .insert(memberships)
        .values({ businessId, userId: ownerId, role: "owner" });
      cookie = (await openMerchantSession(ownerId)).split(";")[0];
    }, 60_000);

    afterAll(async () => {
      const db = getDb();
      await wipePrograms();
      await db
        .delete(memberships)
        .where(eq(memberships.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
      await db.delete(users).where(eq(users.id, ownerId));
    }, 60_000);

    it("las dos SEMILLAS de términos existen y resuelven a dos ids distintos", async () => {
      const ids = await wizardClauseTemplateIds();
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    }, 30_000);

    it("crea el programa con 201: activo, un premio y DOS cláusulas", async () => {
      const response = await post({
        target: 8,
        reward: { type: "custom", label: "Café gratis" },
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.created).toBe(true);
      expect(typeof body.programId).toBe("string");

      const [program] = await getDb()
        .select()
        .from(loyaltyPrograms)
        .where(eq(loyaltyPrograms.id, body.programId));
      expect(program.status).toBe("active");
      expect(program.kind).toBe("stamps");
      expect(program.configuration).toEqual({ unitName: "sello", target: 8 });
      // Sin sello: es de donde sale el placeholder de §D5.
      expect(program.stampImageObjectKey).toBeNull();
      expect(program.stampImageVersion).toBe(0);
      expect(program.accrualMode).toBe("per_purchase");
      expect(program.accrualGrant).toBe(1);

      // DOS cláusulas: el markdown es el join de las dos semillas con una línea en blanco.
      const clauses = program.termsMarkdown.split("\n\n");
      expect(clauses).toHaveLength(2);
      expect(clauses[0]).toContain("se acumulan");
      expect(clauses[1]).toContain("sujetos a disponibilidad");
      // Las variables se renderizaron contra el negocio REAL, no quedaron como `{{...}}`.
      expect(program.termsMarkdown).toContain(businessName);
      expect(program.termsMarkdown).not.toContain("{{");

      const rewards = await getDb()
        .select()
        .from(loyaltyRewards)
        .where(eq(loyaltyRewards.programId, body.programId));
      expect(rewards).toHaveLength(1);
      expect(rewards[0].rewardType).toBe("custom");
      expect(rewards[0].label).toBe("Café gratis");
      expect(rewards[0].pointsCost).toBeNull();

      await wipePrograms();
    }, 60_000);

    it.each([[1], [51], [0], [2.5], ["8"]])(
      "un target de %j responde 422 y no escribe ningún programa",
      async (target) => {
        const response = await post({
          target,
          reward: { type: "custom", label: "Café gratis" },
        });
        expect(response.status).toBe(422);
        expect((await response.json()).code).toBe("invalid_program");
        const rows = await getDb()
          .select({ id: loyaltyPrograms.id })
          .from(loyaltyPrograms)
          .where(eq(loyaltyPrograms.businessId, businessId));
        expect(rows).toHaveLength(0);
      },
      60_000,
    );

    it("sin premio responde 422", async () => {
      const response = await post({ target: 8 });
      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe("invalid_program");
    }, 60_000);

    it("un cuerpo que no es JSON responde 400 invalid_body", async () => {
      const response = await POST(
        new Request("http://localhost:3001/api/onboarding/program", {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: "esto no es json",
        }),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_body");
    }, 60_000);

    it("sin sesión responde 401 unauthorized", async () => {
      const response = await POST(
        new Request("http://localhost:3001/api/onboarding/program", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            target: 8,
            reward: { type: "custom", label: "Café" },
          }),
        }),
      );
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("unauthorized");
    }, 60_000);
  },
);
