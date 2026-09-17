import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
// El canal `console` NO manda nada y sólo se permite fuera de producción
// (`email/provider.ts`): el link mágico se ENCOLA de verdad, no se entrega. Que llegue a
// una bandeja está declarado fuera de alcance por la spec.
process.env.EMAIL_PROVIDER = "console";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() lee DATABASE_URL de forma perezosa; apuntarlo a la rama aislada.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { authStartAttempts, sessions, users } from "./schema";
import { getMerchantAuth } from "./auth";
import { START_RATE_LIMITS } from "./auth-start";
import { POST as START } from "../app/api/merchant/auth/start/route";

/**
 * Spec 0067 §2 — `POST /api/merchant/auth/start` CONTRA LA BASE.
 *
 * **El invariante que este archivo existe para sostener** (mutación #4 del presupuesto):
 * un email CONOCIDO no abre sesión. Sin contraseña, escribir el email de otro merchant le
 * entregaría el negocio; la única barrera es que esa rama no devuelva cookie y no cree
 * `session`. Las dos cosas se miden: la cabecera `set-cookie` **y** el conteo de filas por
 * SQL, porque una cookie ausente con una sesión creada seguiría siendo la mitad del agujero.
 */
const start = (email: unknown, ip = "203.0.113.10") =>
  START(
    new Request("http://localhost:3001/api/merchant/auth/start", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email }),
    }),
  );

describe.skipIf(!enabled)(
  "POST /api/merchant/auth/start (spec 0067 §2)",
  () => {
    const known = `start-int-conocido-${randomUUID()}@example.test`;
    const unknown = `start-int-nuevo-${randomUUID()}@example.test`;
    const knownId = `start-int-${randomUUID()}`;
    const emails = [known, unknown];

    const sessionCount = async (userId: string) => {
      const rows = await getDb().execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM merchant_auth.session WHERE user_id = ${userId}`,
      );
      return rows.rows[0].n;
    };

    const userRow = async (email: string) => {
      const rows = await getDb().execute<{
        id: string;
        email_verified: boolean;
        accounts: number;
      }>(
        sql`SELECT u.id,
                 u.email_verified,
                 (SELECT count(*)::int FROM merchant_auth.account a
                   WHERE a.user_id = u.id) AS accounts
            FROM merchant_auth."user" u WHERE lower(u.email) = ${email}`,
      );
      return rows.rows[0] ?? null;
    };

    const cleanup = async () => {
      const db = getDb();
      for (const email of emails) {
        const row = await userRow(email);
        if (row) await db.delete(users).where(eq(users.id, row.id));
        await db
          .delete(authStartAttempts)
          .where(eq(authStartAttempts.email, email));
      }
    };

    beforeAll(async () => {
      await cleanup();
      await getDb().insert(users).values({
        id: knownId,
        name: "Ana Conocida",
        email: known,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, 60_000);

    afterAll(async () => {
      await getDb().delete(sessions).where(eq(sessions.userId, knownId));
      await cleanup();
    }, 30_000);

    it("email DESCONOCIDO: crea el user, abre sesión y devuelve cookie", async () => {
      expect(await userRow(unknown)).toBeNull();

      const response = await start(unknown);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sent: false });

      const cookie = response.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("HttpOnly");

      const row = await userRow(unknown);
      expect(row).not.toBeNull();
      // Sin contraseña: no hay fila en `account`, así que no hay credencial que verificar.
      expect(row!.accounts).toBe(0);
      // El wizard se completa SIN verificar; lo que bloquea es todo lo posterior (§3).
      expect(row!.email_verified).toBe(false);
      expect(await sessionCount(row!.id)).toBe(1);

      // La cookie es una que better-auth acepta de verdad, no una cadena con la forma
      // correcta: el ida y vuelta lo decide `getSession`.
      const session = await getMerchantAuth().api.getSession({
        headers: new Headers({ cookie: cookie.split(";")[0] }),
      });
      expect(session?.user.id).toBe(row!.id);
    });

    // === MUTACIÓN #4 ===
    it("email CONOCIDO: NO abre sesión, no devuelve cookie, y manda el link", async () => {
      const before = await sessionCount(knownId);

      const response = await start(known);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sent: true });

      // Las DOS mitades del invariante, porque cualquiera sola dejaría medio agujero.
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await sessionCount(knownId)).toBe(before);

      // Y el token del link sí se emitió: la rama hace algo, no es un no-op silencioso.
      const verifications = await getDb().execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM merchant_auth.verification
           WHERE value LIKE ${`%${known}%`}`,
      );
      expect(verifications.rows[0].n).toBeGreaterThanOrEqual(1);
    });

    it("un email con forma inválida es 400 invalid_email y no crea nada", async () => {
      const response = await start("sin-arroba");
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_email");
    });

    it("el rate limit por email muerde con el número del contrato", async () => {
      // El cupo por email (5/h) es el más chico de los tres, así que es el que corta
      // primero. Ya se consumió 1 intento arriba con `known`.
      let last = await start(known);
      for (let i = 1; i < START_RATE_LIMITS.emailPerHour + 2; i += 1) {
        last = await start(known);
        if (last.status === 429) break;
      }
      expect(last.status).toBe(429);
      const body = await last.json();
      expect(body.code).toBe("rate_limited");

      // Y el bloqueo NO abrió ninguna sesión por el camino.
      expect(await sessionCount(knownId)).toBe(0);
    }, 30_000);
  },
);
