import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { loyaltyPrograms, users } from "./schema";
import {
  type GrantSeed,
  dropGrantSeed,
  openSessionCookie,
  seedUnverifiedOwner,
  wipePrograms,
  wipeSessions,
} from "./onboarding-grant-support";
import { ONBOARDING_GRANT_MINUTES } from "./onboarding-grant";
import { PUT } from "../app/api/loyalty-program/route";

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
 * **La sesión de los casos de bypass NO tiene permiso de alta.** Es el estado de quien
 * vuelve al día siguiente, o de quien ya consumió los 5 minutos posteriores a completar el
 * alta: el permiso es una ventana, no una puerta abierta. Con el permiso VIGENTE la edición
 * sí se permite —y también se mide acá, porque el alta no se puede romper.
 *
 * **El oráculo que importa es el de la BASE**: un 403 con la fila ya reescrita sería un
 * falso verde, así que cada caso asevera la `configuration` leída por SQL.
 *
 * Archivo aparte de `onboarding-program.neon.integration.test.ts` por el hook `file-size`:
 * ese archivo está en 279 líneas y no admite un `describe` más.
 */
describe.skipIf(!enabled)("el bypass del gate de email (spec 0077 §5)", () => {
  let seed: GrantSeed;
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
    await dropGrantSeed(seed);
  }, 60_000);

  /** Una sesión SIN permiso antes de cada caso: el montaje es el estado por defecto. */
  const reset = async (minutes: number | null) => {
    await wipePrograms(seed.businessId);
    await wipeSessions(seed.ownerId);
    await setVerified(false);
    cookie = await openSessionCookie(seed.ownerId, minutes);
  };

  it("PUT #1 → 201; PUT #2 → 403 `email_not_verified` y la fila NO se reescribe", async () => {
    await reset(null);

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

  /** CONTROL POSITIVO — crear SIEMPRE se permite sin verificar (ADR 0070 §11), y no
   * depende del permiso: esta sesión no lo tiene. */
  it("sin email verificado y SIN permiso, CREAR el primer programa sigue dando 201", async () => {
    await reset(null);
    const response = await post(ocho);
    expect(response.status).toBe(201);
    expect((await response.json()).created).toBe(true);
    expect(await configurationNow()).toEqual({
      unitName: "sello",
      unitPlural: "sellos",
      target: 8,
    });
  }, 120_000);

  /** EL ALTA NO SE ROMPE — con el permiso vigente el wizard puede volver atrás y corregir,
   * que es exactamente para lo que el permiso existe. */
  it("con el permiso VIGENTE, la edición del wizard sigue pasando (200)", async () => {
    await reset(ONBOARDING_GRANT_MINUTES);
    expect((await post(ocho)).status).toBe(201);
    const second = await post(cincuenta);
    expect(second.status).toBe(200);
    expect((await second.json()).created).toBe(false);
    expect(await configurationNow()).toEqual({
      unitName: "sello",
      unitPlural: "sellos",
      target: 50,
    });
  }, 120_000);

  /** CONTROL NEGATIVO DEL ORÁCULO — con el email verificado la MISMA edición pasa, así que
   * el 403 del primer caso viene del gate de email y no de otra guarda cualquiera. */
  it("con el email VERIFICADO, la misma edición vuelve a dar 200", async () => {
    await reset(null);
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
});
