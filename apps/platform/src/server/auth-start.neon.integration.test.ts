const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const integrationEnabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() lee DATABASE_URL en cada llamada: se apunta a la rama aislada ANTES de usarla.
if (integrationEnabled) process.env.DATABASE_URL = url;

import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { platformVerifications } from "@mi-pasaporte/db/schema";
import { consoleEmailOutbox } from "@mi-pasaporte/domain/server/email/console";
// `getPlatformAuth()` lee el entorno en cada llamada: no hace falta reiniciar modulos, y no se
// reinician para que la ruta y este archivo compartan el MISMO `consoleEmailOutbox`.
import { POST } from "../app/api/auth/start/route";

/** Spec 0190 §D2 — pedir el link: la lista blanca decide quien recibe mail. */
describe.skipIf(!integrationEnabled)("POST /api/auth/start (spec 0190)", () => {
  const saved = { ...process.env };
  const ADMIN = "admin-int@example.test";
  const OUTSIDER = "intruso-int@example.test";

  afterEach(() => {
    for (const key of [
      "PLATFORM_ADMIN_EMAILS",
      "PLATFORM_AUTH_SECRET",
      "PLATFORM_AUTH_URL",
      "EMAIL_PROVIDER",
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    consoleEmailOutbox.length = 0;
  });

  afterAll(async () => {
    await getDb()
      .delete(platformVerifications)
      .where(
        sql`(${platformVerifications.value}::jsonb ->> 'email') in (${ADMIN}, ${OUTSIDER})`,
      );
  });

  async function start(email: string) {
    process.env.PLATFORM_ADMIN_EMAILS = ADMIN;
    process.env.PLATFORM_AUTH_SECRET = "x".repeat(40);
    process.env.PLATFORM_AUTH_URL = "http://localhost:3002";
    process.env.EMAIL_PROVIDER = "console";
    return POST(
      new Request("http://localhost:3002/api/auth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    );
  }

  async function verificationsFor(email: string) {
    const rows = await getDb()
      .select({ id: platformVerifications.id })
      .from(platformVerifications)
      .where(
        sql`(${platformVerifications.value}::jsonb ->> 'email') = ${email}`,
      );
    return rows.length;
  }

  it("correo fuera de la lista → 200 y ninguna verification ni mail", async () => {
    const response = await start(OUTSIDER);
    expect(response.status).toBe(200);
    expect(await verificationsFor(OUTSIDER)).toBe(0);
    expect(consoleEmailOutbox).toHaveLength(0);
  }, 60_000);

  it("correo de la lista → una verification y el mail con el link del panel; repetido en 60 s no manda otro", async () => {
    const response = await start(ADMIN);
    expect(response.status).toBe(200);
    expect(await verificationsFor(ADMIN)).toBe(1);
    expect(consoleEmailOutbox).toHaveLength(1);
    expect(consoleEmailOutbox[0]?.text).toContain(
      "http://localhost:3002/api/auth/magic-link?token=",
    );
    await start(ADMIN);
    expect(await verificationsFor(ADMIN)).toBe(1);
  }, 60_000);

  it("email invalido → 400 invalid_email", async () => {
    const response = await start("no-es-correo");
    expect(response.status).toBe(400);
  });
});
