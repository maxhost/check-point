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
import { businesses, memberships, users } from "./schema";
import { openMerchantSession } from "./merchant-session";
import { GET } from "../app/api/loyalty-terms/templates/route";

/**
 * Spec 0081 §4 — `GET /api/loyalty-terms/templates` FILTRADO POR EL SCOPE DEL NEGOCIO.
 *
 * El defecto que cierra, reportado al owner por el revisor de la 0078: la ruta devolvía
 * **todas** las publicadas —seis filas con títulos repetidos («Cómo se acumula» ×3) y **sin
 * `jurisdictionScope`**—, así que un panel construido sobre ese contrato no tenía forma de
 * distinguirlas y podía escribirle a un comercio EC el texto deprecado de `global-draft`
 * («Los sello se acumulan…»). Ahora el DTO trae el scope y la lista es la del país.
 *
 * Su guard y sus `code` no cambian (declarado afuera, como la 0079 con `GET`/`DELETE`/`PATCH`).
 */
type Template = {
  id: string;
  title: string;
  category: string;
  jurisdictionScope: string;
  templateMarkdown: string;
  version: string;
};

describe.skipIf(!enabled)(
  "las plantillas que ofrece la ruta (spec 0081)",
  () => {
    const ecOwnerId = `tpl-ec-${randomUUID()}`;
    const ecBusinessId = randomUUID();
    const mxOwnerId = `tpl-mx-${randomUUID()}`;
    const mxBusinessId = randomUUID();
    let ecCookie = "";
    let mxCookie = "";

    const seedOwner = async (
      userId: string,
      id: string,
      countryCode: string,
    ) => {
      const db = getDb();
      await db.insert(users).values({
        id: userId,
        name: `Owner ${countryCode}`,
        email: `${userId}@example.test`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(businesses).values({
        id,
        name: `Comercio ${countryCode}`,
        slug: `tpl-${id.slice(0, 12)}`,
        categoryGcid: "gcid:store",
        countryCode,
        timezone: "America/Guayaquil",
      });
      await db
        .insert(memberships)
        .values({ businessId: id, userId, role: "owner" });
    };

    const templatesFor = async (cookie: string): Promise<Template[]> => {
      const response = await GET(
        new Request("http://localhost:3001/api/loyalty-terms/templates", {
          headers: { cookie },
        }),
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { templates: Template[] }).templates;
    };

    beforeAll(async () => {
      await seedOwner(ecOwnerId, ecBusinessId, "EC");
      await seedOwner(mxOwnerId, mxBusinessId, "MX");
      ecCookie = (await openMerchantSession(ecOwnerId)).split(";")[0];
      mxCookie = (await openMerchantSession(mxOwnerId)).split(";")[0];
    }, 120_000);

    afterAll(async () => {
      const db = getDb();
      for (const [id, userId] of [
        [ecBusinessId, ecOwnerId],
        [mxBusinessId, mxOwnerId],
      ]) {
        await db.delete(memberships).where(eq(memberships.businessId, id));
        await db.delete(businesses).where(eq(businesses.id, id));
        await db.delete(users).where(eq(users.id, userId));
      }
    }, 120_000);

    it("el DTO trae `jurisdictionScope`, y `global-draft` ya no se ofrece", async () => {
      const templates = await templatesFor(ecCookie);
      expect(templates.length).toBeGreaterThan(0);
      for (const template of templates) {
        expect(typeof template.jurisdictionScope).toBe("string");
      }
      expect(
        templates.filter(
          (template) => template.jurisdictionScope === "global-draft",
        ),
      ).toEqual([]);
      // Y el texto deprecado que el revisor de la 0078 reportó tampoco llega por acá.
      for (const template of templates) {
        expect(template.templateMarkdown).not.toContain("Los {{program_name}}");
      }
    }, 90_000);

    /**
     * El control es de DOS negocios: con uno solo, una ruta que devolviera «todo menos
     * `global-draft`» pasaría igual. El de MX es el que prueba que el filtro es por el país de
     * la sesión — no ve ni una fila de `EC`, y las de `default` las ve igual.
     */
    it("un negocio EC ve `EC` + `default`; uno MX ve SOLO `default`", async () => {
      const ec = await templatesFor(ecCookie);
      expect([...new Set(ec.map((t) => t.jurisdictionScope))].sort()).toEqual([
        "EC",
        "default",
      ]);
      const mx = await templatesFor(mxCookie);
      expect([...new Set(mx.map((t) => t.jurisdictionScope))]).toEqual([
        "default",
      ]);
      expect(mx.filter((t) => t.jurisdictionScope === "EC")).toEqual([]);
      // Las 4 claves del país están: `earning`, `earning_per_amount`, `redemption`, `transition`.
      expect(mx).toHaveLength(4);
    }, 90_000);
  },
);
