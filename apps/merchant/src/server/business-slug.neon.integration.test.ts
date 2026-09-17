import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() lee DATABASE_URL de forma perezosa; apuntarlo a la rama aislada.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { businesses, memberships, users } from "./schema";
import { saveBrand } from "./brand";
import { openMerchantSession } from "./merchant-session";
import { PATCH } from "../app/api/merchant/business/slug/route";

/**
 * Spec 0067 §1 / ADR 0070 §12 — el slug del negocio CONTRA LA BASE.
 *
 * Las dos propiedades que ningún test sin Neon puede dar:
 *
 * 1. **Renombrar el negocio NO mueve el slug.** Se lee por SQL antes y después del
 *    `saveBrand`. Es el oráculo de la mutación #5 del presupuesto: el slug es el login del
 *    staff (`handle@slug`) y la URL pública, así que arrastrarlo con el nombre rompería
 *    los dos de una vez, en silencio.
 * 2. **El 409 sale del choque del índice único**, no de un chequeo previo. Un `select`
 *    antes del `update` respondería sobre un estado que ya puede haber cambiado.
 */
const patch = (cookie: string, body: unknown) =>
  PATCH(
    new Request("http://localhost:3001/api/merchant/business/slug", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    }),
  );

const brandInput = (name: string, revision: number) => ({
  name,
  timezone: "America/Guayaquil",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2D8B68",
  brandAccentColor: "#E78132",
  revision,
  logoAction: "keep" as const,
});

describe.skipIf(!enabled)(
  "el slug del negocio contra Neon (spec 0067 §1)",
  () => {
    const ownerId = `slug-int-${randomUUID()}`;
    const staffId = `slug-int-staff-${randomUUID()}`;
    const otherOwnerId = `slug-int-other-${randomUUID()}`;
    const businessId = randomUUID();
    const otherBusinessId = randomUUID();
    const mine = `slugtest-${businessId.slice(0, 12)}`;
    const theirs = `slugtaken-${otherBusinessId.slice(0, 12)}`;
    let ownerCookie = "";

    const slugOf = async (id: string) => {
      const rows = await getDb()
        .select({ slug: businesses.slug })
        .from(businesses)
        .where(eq(businesses.id, id));
      return rows[0]?.slug ?? null;
    };

    const seedOwner = async (
      userId: string,
      bizId: string,
      slug: string,
      emailVerified: boolean,
    ) => {
      const db = getDb();
      await db.insert(users).values({
        id: userId,
        name: "Owner Slug",
        email: `${userId}@example.test`,
        emailVerified,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(businesses).values({
        id: bizId,
        name: "Slug QA",
        slug,
        countryCode: "EC",
        timezone: "America/Guayaquil",
      });
      await db
        .insert(memberships)
        .values({ businessId: bizId, userId, role: "owner" });
    };

    beforeAll(async () => {
      await seedOwner(ownerId, businessId, mine, true);
      // El dueño del negocio «ocupado» va SIN verificar a propósito: es el caso del
      // gate de API (spec §3), que este archivo necesita ejercitar sobre un owner de
      // verdad.
      await seedOwner(otherOwnerId, otherBusinessId, theirs, false);
      // Un integrante del MISMO negocio, para el caso «no es owner».
      await getDb()
        .insert(users)
        .values({
          id: staffId,
          name: "Staff Slug",
          email: `${staffId}@staff.invalid`,
          // SIN verificar, que es como nacen los integrantes (email sintético). El gate de
          // email NO puede alcanzarlo: la spec §3 lo aplica sólo a `role='owner'`. Si el
          // guard invirtiera el orden, este integrante recibiría `email_not_verified`.
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      await getDb().insert(memberships).values({
        businessId,
        userId: staffId,
        role: "staff",
        status: "active",
        handle: "staff-slug",
        pinHash: "no-sirve-para-nada",
      });
      ownerCookie = (await openMerchantSession(ownerId)).split(";")[0];
    }, 60_000);

    afterAll(async () => {
      const db = getDb();
      for (const id of [businessId, otherBusinessId]) {
        await db.delete(memberships).where(eq(memberships.businessId, id));
        await db.delete(businesses).where(eq(businesses.id, id));
      }
      for (const id of [ownerId, staffId, otherOwnerId]) {
        await db.delete(users).where(eq(users.id, id));
      }
    }, 30_000);

    it("cambia el slug y lo persiste (leído por SQL)", async () => {
      const next = `slugtest-nuevo-${businessId.slice(0, 8)}`;
      const response = await patch(ownerCookie, { slug: next });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ slug: next });
      expect(await slugOf(businessId)).toBe(next);

      // Se deja como estaba para que el resto de los casos partan del mismo estado.
      await getDb()
        .update(businesses)
        .set({ slug: mine })
        .where(eq(businesses.id, businessId));
    });

    it.each([
      ["-mal", "invalid_slug"],
      ["ab", "invalid_slug"],
      ["Con Mayúsculas", "invalid_slug"],
      ["admin", "reserved_slug"],
      ["backoffice", "reserved_slug"],
    ])("rechaza %s con 400 %s y no toca la fila", async (value, code) => {
      const response = await patch(ownerCookie, { slug: value });
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe(code);
      expect(await slugOf(businessId)).toBe(mine);
    });

    it("un slug tomado devuelve 409 con sugerencia, y no cambia nada", async () => {
      const response = await patch(ownerCookie, { slug: theirs });
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("slug_taken");
      expect(body.suggestion).toBe(`${theirs}-2`);
      expect(await slugOf(businessId)).toBe(mine);
      expect(await slugOf(otherBusinessId)).toBe(theirs);
    });

    // === MUTACIÓN #5 ===
    it("renombrar el negocio NO cambia el slug", async () => {
      const before = await slugOf(businessId);
      expect(before).toBe(mine);

      const [{ revision }] = await getDb()
        .select({ revision: businesses.brandRevision })
        .from(businesses)
        .where(eq(businesses.id, businessId));
      const saved = await saveBrand(
        ownerId,
        brandInput("Un Nombre Completamente Distinto", revision),
      );
      expect(saved.name).toBe("Un Nombre Completamente Distinto");

      // Leído por SQL crudo, no por el DTO que devuelve `saveBrand`: la pregunta es qué
      // quedó en la columna, no qué dice el objeto que volvió.
      const rows = await getDb().execute<{ slug: string; name: string }>(
        sql`SELECT slug, name FROM core.business WHERE id = ${businessId}`,
      );
      expect(rows.rows[0].name).toBe("Un Nombre Completamente Distinto");
      expect(rows.rows[0].slug).toBe(before);
    });

    it("sin sesión → 401 unauthorized", async () => {
      const response = await patch("", { slug: "lo-que-sea-1" });
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("unauthorized");
    });

    it("un integrante (no owner) → 403 not_owner", async () => {
      const cookie = (await openMerchantSession(staffId)).split(";")[0];
      const response = await patch(cookie, { slug: "lo-que-sea-2" });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("not_owner");
      expect(await slugOf(businessId)).toBe(mine);
    });

    // El GEMELO DE API del gate de la §3: en una ruta owner-only el owner sin verificar
    // recibe 403 con `code`, NO un redirect — un `redirect()` sobre un PATCH sería un 307.
    it("un owner con el email SIN verificar → 403 email_not_verified", async () => {
      const cookie = (await openMerchantSession(otherOwnerId)).split(";")[0];
      const response = await patch(cookie, { slug: "lo-que-sea-3" });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
      expect(await slugOf(otherBusinessId)).toBe(theirs);
    });
  },
);
