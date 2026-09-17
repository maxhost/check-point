import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
process.env.EMAIL_PROVIDER = "console";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { authStartAttempts, sessions, users } from "./schema";
import { getMerchantAuth } from "./auth";
import { UNDELIVERABLE_EMAIL_DOMAIN } from "./auth-start";
import { POST as START } from "../app/api/merchant/auth/start/route";
import { GET as CONSUME } from "../app/api/merchant/auth/magic-link/route";
import { POST as VERIFY_EMAIL } from "../app/api/merchant/auth/verify-email/route";
import { openMerchantSession } from "./merchant-session";

/**
 * Spec 0067 §2 — EL VIAJE COMPLETO del link mágico, contra Neon: `start` con un email
 * conocido emite el token, y la ruta propia lo consume, abre sesión **y verifica el email**.
 *
 * Por qué importa que sea de punta a punta: las tres piezas viven en archivos distintos
 * —el plugin arma el token, `sendMagicLink` arma la URL, y nuestra ruta la consume— y cada
 * una por separado puede estar bien mientras el conjunto no entra. Acá se toma el token de
 * la tabla `verification` (que es lo que el mail lleva) y se pide la ruta de verdad.
 *
 * Y sostiene el otro invariante, el que cierra el gate de la §3: **consumir el link deja
 * `email_verified = true`**, leído por SQL. Si better-auth dejara de hacerlo, el owner no
 * tendría ninguna forma de salir del rebote `email_not_verified` y el producto quedaría
 * cerrado con llave.
 */
describe.skipIf(!enabled)(
  "el link mágico de punta a punta (spec 0067 §2)",
  () => {
    const email = `magic-int-${randomUUID()}@example.test`;
    const userId = `magic-int-${randomUUID()}`;
    /** Un segundo owner que se queda SIN verificar: es el caso `sent: true` de §7. */
    const pendingEmail = `magic-int-pend-${randomUUID()}@example.test`;
    const pendingId = `magic-int-pend-${randomUUID()}`;
    /** Un INTEGRANTE, con el email sintetico de verdad que acuña `staff-create.ts`. */
    const staffId = `magic-int-staff-${randomUUID()}`;
    const staffEmail = `staff-${staffId}@${UNDELIVERABLE_EMAIL_DOMAIN}`;

    const tokenFor = async (address: string) => {
      const rows = await getDb().execute<{ identifier: string }>(
        sql`SELECT identifier FROM merchant_auth.verification
           WHERE value LIKE ${`%${address}%`}
           ORDER BY created_at DESC LIMIT 1`,
      );
      return rows.rows[0]?.identifier ?? null;
    };

    const verifiedFlag = async () => {
      const rows = await getDb().execute<{ email_verified: boolean }>(
        sql`SELECT email_verified FROM merchant_auth."user" WHERE id = ${userId}`,
      );
      return rows.rows[0]?.email_verified ?? null;
    };

    /** Cupo consumido por ese email, contado en la tabla que alimenta el rate limit. */
    const attemptsFor = async (address: string) => {
      const rows = await getDb().execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM merchant_auth.auth_start_attempt
             WHERE email = ${address}`,
      );
      return rows.rows[0].n;
    };

    /** Tokens de link magico emitidos hacia ese email. */
    const tokensFor = async (address: string) => {
      const rows = await getDb().execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM merchant_auth.verification
             WHERE value LIKE ${`%${address}%`}`,
      );
      return rows.rows[0].n;
    };

    const consume = (token: string) =>
      CONSUME(
        new Request(
          `http://localhost:3001/api/merchant/auth/magic-link?token=${token}`,
        ),
      );

    beforeAll(async () => {
      await getDb().insert(users).values({
        id: userId,
        name: "Magic Owner",
        email,
        // Sin verificar: es el estado en el que queda un owner recién dado de alta.
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await getDb().insert(users).values({
        id: staffId,
        name: "Integrante",
        email: staffEmail,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await getDb().insert(users).values({
        id: pendingId,
        name: "Pending Owner",
        email: pendingEmail,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, 60_000);

    afterAll(async () => {
      const db = getDb();
      for (const id of [userId, pendingId, staffId]) {
        await db.delete(sessions).where(eq(sessions.userId, id));
        await db.delete(users).where(eq(users.id, id));
      }
      for (const address of [email, pendingEmail, staffEmail]) {
        await db
          .delete(authStartAttempts)
          .where(eq(authStartAttempts.email, address));
        await db.execute(
          sql`DELETE FROM merchant_auth.verification WHERE value LIKE ${`%${address}%`}`,
        );
      }
    }, 30_000);

    it("start → token → consumo: 303 a /backoffice, con cookie y con el email verificado", async () => {
      expect(await verifiedFlag()).toBe(false);

      const started = await START(
        new Request("http://localhost:3001/api/merchant/auth/start", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.77",
          },
          body: JSON.stringify({ email }),
        }),
      );
      expect(await started.json()).toEqual({ sent: true });
      // `start` con email conocido NO abre sesión: la sesión sólo puede nacer del consumo.
      expect(started.headers.get("set-cookie")).toBeNull();

      const token = await tokenFor(email);
      expect(token).toBeTruthy();

      const response = await consume(token!);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("/backoffice");

      const cookie = response.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("HttpOnly");
      const session = await getMerchantAuth().api.getSession({
        headers: new Headers({ cookie: cookie.split(";")[0] }),
      });
      expect(session?.user.id).toBe(userId);

      // Lo que abre el gate de la §3, leído en la columna y no en el objeto de sesión.
      expect(await verifiedFlag()).toBe(true);
    }, 30_000);

    it("el token vale UNA sola vez: el segundo consumo rebota sin cookie", async () => {
      const token = await tokenFor(email);
      // Ya fue consumido arriba; si quedara en la tabla, este `expect` lo diría.
      expect(token).toBeNull();

      const response = await consume("un-token-que-no-existe");
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("/?e=magic_link_invalid");
      expect(response.headers.get("set-cookie")).toBeNull();
    }, 30_000);

    // `POST /api/merchant/auth/verify-email` (contrato §7) es el otro emisor del MISMO
    // enlace: el primer paso del onboarding del ADR 0070 §11. No recibe email —la dirección
    // sale de la sesión— y eso es lo que impide disparar mails hacia una dirección ajena.
    it("verify-email sin sesión → 401 unauthorized", async () => {
      const response = await VERIFY_EMAIL(
        new Request("http://localhost:3001/api/merchant/auth/verify-email", {
          method: "POST",
        }),
      );
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("unauthorized");
    });

    it("verify-email con el email SIN verificar encola el enlace", async () => {
      const cookie = (await openMerchantSession(pendingId)).split(";")[0];
      const response = await VERIFY_EMAIL(
        new Request("http://localhost:3001/api/merchant/auth/verify-email", {
          method: "POST",
          headers: { cookie, "x-forwarded-for": "203.0.113.79" },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sent: true, verified: false });
      // No abre ninguna sesión nueva: la que ya tenía sigue siendo la suya.
      expect(response.headers.get("set-cookie")).toBeNull();
      // Y el token existe de verdad: el enlace se emitió, no es un `sent: true` de adorno.
      expect(await tokenFor(pendingEmail)).toBeTruthy();
    }, 30_000);

    it("verify-email con el email YA verificado no manda nada", async () => {
      // Este caso corre después del consumo de arriba, que dejó `email_verified = true`.
      expect(await verifiedFlag()).toBe(true);
      const cookie = (await openMerchantSession(userId)).split(";")[0];
      const response = await VERIFY_EMAIL(
        new Request("http://localhost:3001/api/merchant/auth/verify-email", {
          method: "POST",
          headers: { cookie, "x-forwarded-for": "203.0.113.78" },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sent: false, verified: true });
      // Y no dejó ningún token nuevo colgando.
      expect(await tokenFor(email)).toBeNull();
    }, 30_000);

    // Cazado por un revisor independiente: el email sintetico del staff PASA la forma de
    // `normalizeEmail` (`staff` `.` `invalid` es forma valida), asi que la ruta contestaba 200,
    // emitia un token real y consumia cupo del balde por IP que comparte con `start`, para
    // pedirle al proveedor una entrega a un TLD que RFC 2606 reserva para no resolver.
    //
    // Las DOS aserciones de «cero» son lo que hace que este test pruebe algo: sin ellas, un
    // 400 emitido DESPUES de gastar el cupo se veria exactamente igual de verde.
    it("verify-email con sesión de INTEGRANTE: 400, sin token y sin gastar cupo", async () => {
      const tokensAntes = await tokensFor(staffEmail);
      const cupoAntes = await attemptsFor(staffEmail);

      const cookie = (await openMerchantSession(staffId)).split(";")[0];
      const response = await VERIFY_EMAIL(
        new Request("http://localhost:3001/api/merchant/auth/verify-email", {
          method: "POST",
          headers: { cookie, "x-forwarded-for": "203.0.113.80" },
        }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_email");
      // No se emitio ningun enlace hacia un buzon que no existe…
      expect(await tokensFor(staffEmail)).toBe(tokensAntes);
      // …y no se gasto un intento del balde que los owners necesitan desde esa misma IP.
      expect(await attemptsFor(staffEmail)).toBe(cupoAntes);
      // Pisos: los dos contadores arrancan en cero, asi que las dos comparaciones de arriba
      // comparan contra algo conocido y no contra un numero que ya venia inflado.
      expect(tokensAntes).toBe(0);
      expect(cupoAntes).toBe(0);
    }, 30_000);

    it("sin token, rebota con el mismo código y no abre nada", async () => {
      const response = await CONSUME(
        new Request("http://localhost:3001/api/merchant/auth/magic-link"),
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("/?e=magic_link_invalid");
      expect(response.headers.get("set-cookie")).toBeNull();
    });
  },
);
