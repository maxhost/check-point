import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
// El caso de `signup` encola el link de verificacion: `console` no entrega nada.
process.env.EMAIL_PROVIDER = "console";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "@mi-pasaporte/db";
import { loyaltyPrograms, users } from "@mi-pasaporte/db/schema";
import {
  type OwnerSeed,
  dropOwnerSeed,
  openSessionCookie,
  seedUnverifiedOwner,
  wipePrograms,
  wipeSessions,
} from "./unverified-owner-support";
import { PUT } from "../app/api/loyalty-program/route";
import {
  dropSignups,
  signup,
  signupBody,
} from "./onboarding-signup-integration-support";

/**
 * EL BYPASS DE LA SPEC 0077, con EL MISMO MONTAJE QUE LO ENCONTRÓ (ADR 0076): un solo
 * usuario con `emailVerified: false` y dos escrituras por la ruta ÚNICA (spec 0079:
 * `PUT /api/loyalty-program`; hasta entonces era `POST /api/onboarding/program`).
 *
 * Antes del invariante el segundo devolvía **200 `created:false`** y dejaba la fila
 * reescrita a `{"target":50,…}` desde `target: 8`, mientras la ruta gateada contestaba
 * **403** con la misma cookie. Es la SEGUNDA vez que se abre la misma grieta: la spec 0072
 * ya la tapó para el eje `status` bajando el invariante al writer, y el del email quedó
 * afuera.
 *
 * **POR QUÉ SIGUE VALIENDO DESPUÉS DE LA 0079, que es cuando la puerta pasó a ser una sola:**
 * la 0079 le saca el paso 3 a `PUT /api/loyalty-program` —el gate vive en el writer desde la
 * 0077— y estos casos son EL oráculo de que eso no afloja nada. Es la mutación M1.
 *
 * **Spec 0156: no hay ventana.** El permiso de alta (60 min sin email verificado) se borró;
 * editar exige el email verificado aunque la cuenta tenga un minuto. El último caso lo mide
 * con la cookie que devuelve `POST /api/onboarding/signup`, que es la que lo llevaba.
 *
 * **El oráculo que importa es el de la BASE**: un 403 con la fila ya reescrita sería un
 * falso verde, así que cada caso asevera la `configuration` leída por SQL.
 *
 * Archivo aparte de `onboarding-program.neon.integration.test.ts` por el hook `file-size`:
 * ese archivo está en 279 líneas y no admite un `describe` más.
 */
describe.skipIf(!enabled)("el bypass del gate de email (spec 0077 §5)", () => {
  let seed: OwnerSeed;
  let cookie = "";

  const post = (body: unknown) =>
    PUT(
      new Request("http://localhost:3001/api/loyalty-program", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
    );

  /** El cuerpo CORTO de Sellos de la spec 0079: la ruta única absorbió el de dos campos. */
  const conTarget = (target: number) => ({
    kind: "stamps",
    configuration: { target },
    rewards: [{ type: "custom", label: "Café gratis" }],
  });
  const ocho = conTarget(8);
  const cincuenta = conTarget(50);

  // `unitPlural` lo escribe el wizard desde la spec 0078 (es lo que hace que el TOS diga
  // «Los sellos»): estas aserciones miran la configuración ENTERA, así que lo incluyen.
  const configurationNow = async () => {
    const [row] = await getDb()
      .select({ configuration: loyaltyPrograms.configuration })
      .from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.businessId, seed.businessId))
      .limit(1);
    return row?.configuration ?? null;
  };

  const setVerified = (emailVerified: boolean) =>
    getDb()
      .update(users)
      .set({ emailVerified })
      .where(eq(users.id, seed.ownerId));

  beforeAll(async () => {
    seed = await seedUnverifiedOwner("bypass");
  }, 60_000);

  afterAll(async () => {
    await dropOwnerSeed(seed);
  }, 60_000);

  /** Sesión nueva, sin programa y sin verificar antes de cada caso. */
  const reset = async () => {
    await wipePrograms(seed.businessId);
    await wipeSessions(seed.ownerId);
    await setVerified(false);
    cookie = await openSessionCookie(seed.ownerId);
  };

  it("PUT #1 → 201; PUT #2 → 403 `email_not_verified` y la fila NO se reescribe", async () => {
    await reset();

    const first = await post(ocho);
    expect(first.status).toBe(201);
    expect((await first.json()).created).toBe(true);
    const before = await configurationNow();
    expect(before).toEqual({
      unitName: "sello",
      unitPlural: "sellos",
      target: 8,
    });

    const second = await post(cincuenta);
    expect(second.status).toBe(403);
    expect((await second.json()).code).toBe("email_not_verified");
    // LA ASERCIÓN QUE IMPORTA: la base quedó como estaba, no en `target: 50`.
    expect(await configurationNow()).toEqual(before);
  }, 120_000);

  /** CONTROL POSITIVO — crear SIEMPRE se permite sin verificar (ADR 0070 §11). */
  it("sin email verificado, CREAR el primer programa sigue dando 201", async () => {
    await reset();
    const response = await post(ocho);
    expect(response.status).toBe(201);
    expect((await response.json()).created).toBe(true);
    expect(await configurationNow()).toEqual({
      unitName: "sello",
      unitPlural: "sellos",
      target: 8,
    });
  }, 120_000);

  /** CONTROL NEGATIVO DEL ORÁCULO — con el email verificado la MISMA edición pasa, así que
   * el 403 del primer caso viene del gate de email y no de otra guarda cualquiera. */
  it("con el email VERIFICADO, la misma edición vuelve a dar 200", async () => {
    await reset();
    expect((await post(ocho)).status).toBe(201);
    await setVerified(true);
    const second = await post(cincuenta);
    expect(second.status).toBe(200);
    expect((await second.json()).created).toBe(false);
    expect(await configurationNow()).toEqual({
      unitName: "sello",
      unitPlural: "sellos",
      target: 50,
    });
  }, 120_000);

  /**
   * ORÁCULO DE M1 y M2 (spec 0156) — EL OWNER RECIÉN CREADO POR `signup`, con SU cookie: es
   * la sesión que hasta la 0156 llevaba el permiso de alta. Crear → 201; editar con la cuenta
   * de un minuto → 403 y la fila NO se reescribe.
   */
  it("owner recién creado por `signup`: crear → 201, editar → 403 `email_not_verified`", async () => {
    const email = `bypass-signup-${randomUUID()}@example.test`;
    let businessId: string | null = null;
    try {
      const created = await signup(signupBody(email));
      expect(created.status).toBe(201);
      businessId = (await created.json()).business.id as string;
      const fresh = (created.headers.get("set-cookie") ?? "").split(";")[0];
      const put = (body: unknown) =>
        PUT(
          new Request("http://localhost:3001/api/loyalty-program", {
            method: "PUT",
            headers: { "content-type": "application/json", cookie: fresh },
            body: JSON.stringify(body),
          }),
        );
      const first = await put(ocho);
      expect(first.status).toBe(201);
      expect((await first.json()).created).toBe(true);
      const second = await put(cincuenta);
      expect(second.status).toBe(403);
      expect((await second.json()).code).toBe("email_not_verified");
      const [row] = await getDb()
        .select({ configuration: loyaltyPrograms.configuration })
        .from(loyaltyPrograms)
        .where(eq(loyaltyPrograms.businessId, businessId));
      expect(row.configuration).toMatchObject({ target: 8 });
    } finally {
      // El programa primero: `dropSignups` borra el negocio y el programa no cae en cascada.
      if (businessId) await wipePrograms(businessId);
      await dropSignups([email]);
    }
  }, 120_000);
});
