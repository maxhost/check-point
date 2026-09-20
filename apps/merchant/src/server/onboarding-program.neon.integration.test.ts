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
import { PUT } from "../app/api/loyalty-program/route";

/**
 * Spec 0069 §D4 / spec 0079 — EL CUERPO CORTO CONTRA LA BASE, ahora por la ruta ÚNICA.
 *
 * Este archivo **se reapuntó, no se borró** (spec 0079 §5): sus casos son el oráculo del
 * comportamiento que tenía que sobrevivir al borrado de `POST /api/onboarding/program`.
 * Lo único que cambió es la puerta (`PUT /api/loyalty-program`) y la forma del cuerpo
 * corto; los desenlaces —201, 422, 400, 401, 403 y la fila que queda en la base— son los
 * mismos de antes de la spec.
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
      PUT(
        new Request("http://localhost:3001/api/loyalty-program", {
          method: "PUT",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify(body),
        }),
      );

    /** El cuerpo CORTO de Sellos (spec 0079 §2): `kind`, el objetivo y el premio. Todo lo
     * demás lo completa el servidor. */
    const corto = (target: unknown, conPremio = true) => ({
      kind: "stamps",
      configuration: { target },
      ...(conPremio
        ? { rewards: [{ type: "custom", label: "Café gratis" }] }
        : {}),
    });

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
      // El negocio de este archivo es `EC`; el scope por país lo cubre en detalle
      // `onboarding-program-terms.neon.integration.test.ts` (spec 0078).
      const ids = await wizardClauseTemplateIds("EC", "per_purchase");
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    }, 30_000);

    it("crea el programa con 201: activo, un premio y DOS cláusulas", async () => {
      const response = await post(corto(8));
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
      expect(program.configuration).toEqual({
        unitName: "sello",
        unitPlural: "sellos",
        target: 8,
      });
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
        const response = await post(corto(target));
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
      const response = await post(corto(8, false));
      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe("invalid_program");
    }, 60_000);

    it("un cuerpo que no es JSON responde 400 invalid_body", async () => {
      const response = await PUT(
        new Request("http://localhost:3001/api/loyalty-program", {
          method: "PUT",
          headers: { "content-type": "application/json", cookie },
          body: "esto no es json",
        }),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_body");
    }, 60_000);

    it("sin sesión responde 401 unauthorized", async () => {
      const response = await PUT(
        new Request("http://localhost:3001/api/loyalty-program", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(corto(8)),
        }),
      );
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("unauthorized");
    }, 60_000);

    /**
     * EL CIERRE DE F1 (spec 0072). Esta es LA puerta que el revisor encontró abierta: la ruta
     * del wizard llama a `saveProgram`, **el mismo writer** que `PUT /api/loyalty-program`, y
     * antes de este gate reescribía el programa de un negocio `suspended` con 200 y
     * `created: false` mientras la ruta gateada contestaba 403. Contradecía la regla textual del
     * owner para `suspended`: «no pueden … cambios en programa».
     *
     * **El oráculo NO es sólo el status.** Un 403 podría venir de cualquier otra guarda, así que
     * cada caso asevera además que **el programa NO se movió**: se pinnea el `updatedAt` antes y
     * después. Sin eso, un fix que devolviera 403 *después* de escribir pasaría en verde.
     */
    describe("el eje `status` del negocio corta la ruta única", () => {
      const setStatus = (status: string, reason: string | null = null) =>
        getDb()
          .update(businesses)
          .set({ status, suspensionReason: reason })
          .where(eq(businesses.id, businessId));

      const programUpdatedAt = async () => {
        const [row] = await getDb()
          .select({ updatedAt: loyaltyPrograms.updatedAt })
          .from(loyaltyPrograms)
          .where(eq(loyaltyPrograms.businessId, businessId))
          .limit(1);
        return row?.updatedAt ?? null;
      };

      const body = {
        kind: "stamps",
        configuration: { target: 5 },
        rewards: [{ type: "custom" as const, label: "Postre" }],
      };

      afterAll(async () => {
        await setStatus("active");
      }, 60_000);

      it("`suspended`: 403 business_suspended y el programa NO se reescribe", async () => {
        await setStatus("active");
        await wipePrograms();
        expect((await post(body)).status).toBe(201);
        const before = await programUpdatedAt();
        expect(before).not.toBeNull();

        await setStatus("suspended", "falta de pago");
        const response = await post(body);
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe("business_suspended");
        // La prueba de que frenó ANTES del write, no después.
        expect(await programUpdatedAt()).toEqual(before);
      }, 90_000);

      it("`closed`: 403 business_closed", async () => {
        await setStatus("closed");
        const response = await post(body);
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe("business_closed");
      }, 60_000);

      /**
       * **NO hay caso de `status` desconocido acá, y es un límite MEDIDO, no un olvido.** Se
       * intentó: el `CHECK (status IN ('active','suspended','closed'))` de la migración `0036`
       * lo rechaza **incluso por SQL crudo** —`23514 business_status_check`, «Failing row
       * contains (… frozen …)»—, así que ese estado es INALCANZABLE contra base. La polaridad
       * fail-closed del guard se mide donde sí se puede: sobre la función pura, en
       * `api-owner-surfaces.test.ts`, que recorre los 12 × 7 estados incluido `frozen`.
       */
      it("CONTROL POSITIVO — de vuelta en `active`, la ruta vuelve a escribir", async () => {
        await setStatus("active");
        const before = await programUpdatedAt();
        const response = await post(body);
        expect(response.status).toBe(200);
        expect((await response.json()).created).toBe(false);
        expect(await programUpdatedAt()).not.toEqual(before);
      }, 90_000);
    });
  },
);
