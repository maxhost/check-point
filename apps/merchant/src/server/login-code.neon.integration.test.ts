import { randomUUID } from "node:crypto";
import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
process.env.EMAIL_PROVIDER = "console";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "@mi-pasaporte/db";
import {
  authStartAttempts,
  businesses,
  memberships,
  sessions,
  users,
} from "@mi-pasaporte/db/schema";
import { consoleEmailOutbox } from "@mi-pasaporte/domain/server/email/console";
import { getMerchantAuth } from "./auth";
import { POST as REQUEST_CODE } from "../app/api/merchant/auth/login/route";
import { POST as VERIFY } from "../app/api/merchant/auth/login/verify/route";

/**
 * Spec 0202 (ADR 0137) — el login del owner con CODIGO, contra la base real: el plugin
 * `emailOTP` guarda y consume en `merchant_auth.verification`, el tope de equivocados vive en
 * la misma tabla y el corte de `closed` revoca la sesion que el plugin ya creo. Nada de eso
 * se puede ver con la base doblada.
 *
 * El codigo se lee del buzon de prueba (`consoleEmailOutbox`, asunto del mail): en la base
 * esta hasheado, que es justamente uno de los casos.
 */
describe.skipIf(!enabled)("login del owner con código (spec 0202)", () => {
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const businessIds: string[] = [];
  const emails: string[] = [];

  async function owner(status: "active" | "closed" = "active") {
    const id = `code-int-${run}-${userIds.length}`;
    const email = `${id}@example.test`;
    const businessId = randomUUID();
    const db = getDb();
    await db.insert(users).values({
      id,
      name: "Owner código",
      email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id: businessId,
      name: "Negocio código",
      slug: `code-${businessId.slice(0, 20)}`,
      countryCode: "EC",
      timezone: "America/Guayaquil",
      currencyCode: "USD",
      status,
    });
    await db
      .insert(memberships)
      .values({ businessId, userId: id, role: "owner" });
    userIds.push(id);
    businessIds.push(businessId);
    emails.push(email);
    return { id, email };
  }

  /** Pide un codigo y lo devuelve leido del asunto del mail. */
  async function requestCode(email: string): Promise<string> {
    const before = consoleEmailOutbox.length;
    const response = await REQUEST_CODE(
      new Request("http://localhost:3001/api/merchant/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `203.0.113.${(userIds.length % 200) + 20}`,
        },
        body: JSON.stringify({ email }),
      }),
    );
    expect(await response.json()).toEqual({ accepted: true });
    const sent = consoleEmailOutbox.slice(before).find((m) => m.to === email);
    const code = sent?.subject.match(/(\d{6})$/)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    return code!;
  }

  const verify = (email: string, code: string) =>
    VERIFY(
      new Request("http://localhost:3001/api/merchant/auth/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      }),
    );

  /** Un codigo de 6 digitos distinto del dado. */
  const wrong = (code: string, n = 1) =>
    String((Number(code) + n) % 1_000_000).padStart(6, "0");

  const liveSessions = async (userId: string) =>
    (
      await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId))
    ).length;

  afterAll(async () => {
    if (!enabled) return;
    const db = getDb();
    if (userIds.length) {
      await db.delete(sessions).where(inArray(sessions.userId, userIds));
      await db.delete(memberships).where(inArray(memberships.userId, userIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }
    if (businessIds.length)
      await db.delete(businesses).where(inArray(businesses.id, businessIds));
    await db
      .delete(authStartAttempts)
      .where(like(authStartAttempts.email, `code-int-${run}-%`));
    await db.execute(
      sql`DELETE FROM merchant_auth.verification WHERE identifier LIKE ${`%code-int-${run}-%`}`,
    );
  }, 60_000);

  it("el código correcto abre la sesión y vale una sola vez; en la base está hasheado", async () => {
    const { id, email } = await owner();
    const code = await requestCode(email);

    const stored = await getDb().execute<{ value: string }>(
      sql`SELECT value FROM merchant_auth.verification
          WHERE identifier = ${`sign-in-otp-${email}`}`,
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]!.value).not.toContain(code);

    const response = await verify(email, code);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ destination: "/backoffice" });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    const session = await getMerchantAuth().api.getSession({
      headers: new Headers({ cookie: cookie.split(";")[0] }),
    });
    expect(session?.user.id).toBe(id);

    const again = await verify(email, code);
    expect(again.status).toBe(400);
    expect((await again.json()).code).toBe("code_incorrect");
  }, 60_000);

  it("equivocado → code_incorrect; tras 5 equivocados el correcto da code_expired", async () => {
    const { email } = await owner();
    const code = await requestCode(email);
    for (let n = 1; n <= 5; n++) {
      const response = await verify(email, wrong(code, n));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("code_incorrect");
    }
    const response = await verify(email, code);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("code_expired");
    expect(response.headers.get("set-cookie")).toBeNull();
  }, 60_000);

  it("vencido → code_expired", async () => {
    const { email } = await owner();
    const code = await requestCode(email);
    await getDb().execute(
      sql`UPDATE merchant_auth.verification SET expires_at = now() - interval '1 minute'
          WHERE identifier = ${`sign-in-otp-${email}`}`,
    );
    const response = await verify(email, code);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("code_expired");
  }, 60_000);

  it("pedir otro código anula el anterior", async () => {
    const { email } = await owner();
    const first = await requestCode(email);
    let second = await requestCode(email);
    // Un empate de 1 en 10⁶ haria pasar el caso por la razon equivocada.
    if (second === first) second = await requestCode(email);

    const old = await verify(email, first);
    expect(old.status).toBe(400);
    expect((await old.json()).code).toBe("code_incorrect");
    expect((await verify(email, second)).status).toBe(200);
  }, 60_000);

  it("negocio cerrado → 403 business_closed y la sesión creada se revoca", async () => {
    const { id, email } = await owner("closed");
    const code = await requestCode(email);
    const response = await verify(email, code);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("business_closed");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await liveSessions(id)).toBe(0);
  }, 60_000);

  it("10 equivocados en 24 h bloquean incluso el código correcto; vencida la ventana, entra", async () => {
    const { email } = await owner();
    for (let round = 0; round < 2; round++) {
      const code = await requestCode(email);
      for (let n = 1; n <= 5; n++)
        expect((await (await verify(email, wrong(code, n))).json()).code).toBe(
          "code_incorrect",
        );
    }
    const code = await requestCode(email);
    const blocked = await verify(email, code);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe("too_many_failures");

    await getDb().execute(
      sql`UPDATE merchant_auth.verification SET expires_at = now() - interval '1 minute'
          WHERE identifier = ${`login-code-failure-${email}`}`,
    );
    expect((await verify(email, code)).status).toBe(200);
  }, 120_000);

  it("formato inválido → invalid_code, sin tocar el plugin", async () => {
    const response = await verify("alguien@example.test", "12ab");
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_code");
  });
});
