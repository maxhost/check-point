import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
process.env.EMAIL_PROVIDER = "console";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  authStartAttempts,
  businesses,
  memberships,
  sessions,
  users,
} from "./schema";
import { POST as START } from "../app/api/merchant/auth/start/route";
import { GET as CONSUME } from "../app/api/merchant/auth/magic-link/route";

/**
 * Spec 0072 §D4 — EL CORTE DE `closed` EN EL CONSUMO DEL LINK MÁGICO.
 *
 * **Por qué acá y no en `auth/start`**: `start` sólo toca `merchant_auth.user` y no resuelve
 * negocio, así que gatear ahí sería una consulta nueva — y además el owner de un negocio
 * `suspended` SÍ tiene que entrar, para ver el motivo. **El corte va donde se CREA la
 * sesión**, que es este consumo.
 *
 * Y lo que este test mide y ningún unit puede: `magicLinkVerify` **ya escribió la sesión en
 * la base** antes de que nuestra ruta decida, así que no alcanza con no reenviar la cookie.
 * Acá se cuentan las filas de `merchant_auth.session` después del rebote.
 */
describe.skipIf(!enabled)(
  "el link mágico contra un negocio CERRADO (spec 0072 §D4)",
  () => {
    const suffix = randomUUID();
    const email = `closed-int-${suffix}@example.test`;
    const userId = `closed-int-${suffix}`;
    const businessId = randomUUID();

    const tokenFor = async (address: string) => {
      const rows = await getDb().execute<{ identifier: string }>(
        sql`SELECT identifier FROM merchant_auth.verification
           WHERE value LIKE ${`%${address}%`}
           ORDER BY created_at DESC LIMIT 1`,
      );
      return rows.rows[0]?.identifier ?? null;
    };

    const liveSessions = async () => {
      const rows = await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId));
      return rows.length;
    };

    const consume = (token: string) =>
      CONSUME(
        new Request(
          `http://localhost:3001/api/merchant/auth/magic-link?token=${encodeURIComponent(token)}`,
        ),
      );

    afterAll(async () => {
      if (!enabled) return;
      const db = getDb();
      await db.delete(sessions).where(eq(sessions.userId, userId));
      await db.delete(memberships).where(eq(memberships.userId, userId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
      await db.delete(users).where(eq(users.id, userId));
      await db
        .delete(authStartAttempts)
        .where(eq(authStartAttempts.email, email));
      await db.execute(
        sql`DELETE FROM merchant_auth.verification WHERE value LIKE ${`%${email}%`}`,
      );
    }, 60_000);

    it("el owner de un negocio CERRADO no obtiene sesión: rebota y la sesión creada se revoca", async () => {
      const db = getDb();
      await db.insert(users).values({
        id: userId,
        name: "Owner cerrado",
        email,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(businesses).values({
        id: businessId,
        name: "Negocio cerrado",
        slug: `closed-${businessId.slice(0, 20)}`,
        countryCode: "EC",
        timezone: "America/Guayaquil",
        currencyCode: "USD",
        status: "closed",
      });
      await db
        .insert(memberships)
        .values({ businessId, userId, role: "owner" });

      const started = await START(
        new Request("http://localhost:3001/api/merchant/auth/start", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.91",
          },
          body: JSON.stringify({ email }),
        }),
      );
      expect(await started.json()).toEqual({ sent: true });

      const token = await tokenFor(email);
      expect(token).toBeTruthy();

      const response = await consume(token!);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("/?e=business_closed");
      // Ni la cookie…
      expect(response.headers.get("set-cookie")).toBeNull();
      // …ni la fila: `magicLinkVerify` ya la había creado, y el corte la revoca.
      expect(await liveSessions()).toBe(0);
    }, 60_000);

    it("con el negocio de vuelta en `active`, el MISMO owner entra normal", async () => {
      // Control positivo: sin él, un rebote por cualquier otra causa (token mal leído, ruta
      // rota) se vería idéntico al corte que este archivo mide.
      await getDb()
        .update(businesses)
        .set({ status: "active" })
        .where(eq(businesses.id, businessId));

      await START(
        new Request("http://localhost:3001/api/merchant/auth/start", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.92",
          },
          body: JSON.stringify({ email }),
        }),
      );
      const token = await tokenFor(email);
      const response = await consume(token!);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("/backoffice");
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
      expect(await liveSessions()).toBe(1);
    }, 60_000);
  },
);
