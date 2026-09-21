import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
import { openMerchantSession } from "./merchant-session";
import { createStaff } from "./staff-create";
import { POST as STATUS } from "../app/api/staff/[userId]/status/route";

/**
 * Spec 0068 §2 — **EL CUERPO de `POST /api/staff/[userId]/status` no serializa el email
 * sintético.** Archivo propio porque los dos candidatos a alojarlo
 * (`staff-list.neon.integration.test.ts`, `staff-pin-change.neon.integration.test.ts`)
 * quedaban sobre el límite de 300 líneas del hook `file-size`: dividir, no extender.
 *
 * **Por qué el tipo no alcanza como guard, medido por un revisor independiente:** TypeScript
 * rechaza `toStaffDTO({ …, email })` por exceso de propiedades, pero **no** rechaza
 * `{ ...toStaffDTO(…), email: profile?.email }`. Esa fuga, escrita por fuera del DTO,
 * sobrevivía a la suite entera (1027 passed) y al `typecheck`. El único oráculo que la caza
 * es uno que mire la RESPUESTA.
 *
 * Va contra la base y no contra un doble porque el integrante tiene un
 * `staff-<uuid>@staff.invalid` **real**: así muerde por la subcadena y por la clave.
 */
describe.skipIf(!enabled)(
  "POST /api/staff/[userId]/status contra Neon (spec 0068 §2)",
  () => {
    const ownerId = `status-int-${randomUUID()}`;
    const businessId = randomUUID();
    const slug = `statustest-${businessId.slice(0, 10)}`;
    let staffUserId = "";
    let ownerCookie = "";

    beforeAll(async () => {
      const db = getDb();
      await db.insert(users).values({
        id: ownerId,
        name: "Owner Status",
        email: `${ownerId}@example.test`,
        // Verificado: el gate de email no es lo que este archivo mide.
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(businesses).values({
        id: businessId,
        name: "Status QA",
        slug,
        countryCode: "EC",
        timezone: "America/Guayaquil",
      });
      await db
        .insert(memberships)
        .values({ businessId, userId: ownerId, role: "owner" });
      const { staff } = await createStaff(
        { id: businessId, slug },
        { name: "Estado", permissions: ["counter"] },
        "owner",
      );
      staffUserId = staff.userId;
      ownerCookie = (await openMerchantSession(ownerId)).split(";")[0];
    }, 120_000);

    afterAll(async () => {
      const db = getDb();
      await db
        .delete(memberships)
        .where(eq(memberships.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
      for (const id of [ownerId, staffUserId]) {
        await db.delete(users).where(eq(users.id, id));
      }
    }, 60_000);

    const call = (status: string) =>
      STATUS(
        new Request(`http://localhost:3001/api/staff/${staffUserId}/status`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: ownerCookie },
          body: JSON.stringify({ status }),
        }),
        { params: Promise.resolve({ userId: staffUserId }) },
      );

    it.each(["disabled", "active"])(
      "%s: el cuerpo no lleva `staff.invalid` ni la clave `email`",
      async (status) => {
        const response = await call(status);
        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body).not.toContain("staff.invalid");
        expect(body).not.toContain('"email"');
        const { staff } = JSON.parse(body) as {
          staff: Record<string, unknown>;
        };
        expect(staff).not.toHaveProperty("email");
        expect(staff.status).toBe(status);
        expect(Object.keys(staff).sort()).toEqual([
          "createdAt",
          "identifier",
          "name",
          // Spec 0086 §5: `permissions` entra al DTO; el email sintético sigue sin entrar.
          "permissions",
          "role",
          "status",
          "userId",
        ]);
      },
      120_000,
    );

    it("y el sintético SÍ está en la base: lo que cambió es la serialización", async () => {
      const [row] = await getDb()
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, staffUserId));
      expect(row.email).toMatch(/@staff\.invalid$/);
    }, 60_000);
  },
);
