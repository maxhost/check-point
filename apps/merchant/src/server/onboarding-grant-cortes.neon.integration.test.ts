import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { sessions, users } from "./schema";
import { openMerchantSession } from "./merchant-session";
import {
  ONBOARDING_GRANT_MINUTES,
  onboardingGrantActive,
} from "./onboarding-grant";
import {
  type GrantSeed,
  dropGrantSeed,
  grantRowsOf,
  openSessionCookie,
  seedUnverifiedOwner,
  wipePrograms,
  wipeSessions,
  wizardRequest,
} from "./onboarding-grant-support";
import { POST as WIZARD } from "../app/api/onboarding/program/route";

/**
 * Spec 0077 §4 — LOS TRES CORTES y la MONOTONÍA, sobre la columna real.
 *
 * Por qué acá y no en la unitaria pura: el acortado es `least(...)` en SQL, y «todas las
 * sesiones del usuario» es una propiedad del `WHERE`. Ninguna de las dos existe en JS.
 */
describe.skipIf(!enabled)(
  "los cortes del permiso de alta (spec 0077 §4)",
  () => {
    let seed: GrantSeed;
    const post = (cookie: string) => WIZARD(wizardRequest(cookie));

    /** Cada caso arranca del mismo estado: sin programa y sin sesiones previas. */
    const reset = async () => {
      await wipePrograms(seed.businessId);
      await wipeSessions(seed.ownerId);
    };

    beforeAll(async () => {
      seed = await seedUnverifiedOwner("cortes");
    }, 60_000);

    afterAll(async () => {
      await dropGrantSeed(seed);
    }, 60_000);

    /** CORTE 3 del ADR 0076 §4 — los 60 minutos desde que se creó la cuenta. */
    it("CORTE por vencimiento: con el instante en el pasado, la EDICIÓN da 403", async () => {
      await reset();
      const cookie = await openSessionCookie(seed.ownerId, 5);
      expect((await post(cookie)).status).toBe(201);

      // La SESIÓN sigue viva (7 días medidos, ADR 0076 §2); lo que venció es el permiso.
      await getDb()
        .update(sessions)
        .set({ onboardingGrantUntil: new Date(Date.now() - 60_000) })
        .where(eq(sessions.userId, seed.ownerId));
      const response = await post(cookie);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
    }, 120_000);

    /**
     * CORTE 1 — el email verificado. **Se evalúa EN LA LECTURA, sin escribir nada**: es la
     * propiedad que hace que este corte no necesite ni un job ni un writer.
     *
     * Verificar el email NO cierra la escritura —la regla del §5 es
     * `emailVerified || onboardingGrantActive`, y el email es la primera mitad: ABRE—, así
     * que el oráculo del corte es doble: que la DECISIÓN pasa a `false`, y que la COLUMNA
     * queda intacta. (La spec 0077 llegó a pedir un 403 acá; se corrigió el 2026-09-18.)
     */
    it("CORTE por email verificado: apaga el permiso SIN tocar la columna", async () => {
      await reset();
      const cookie = await openSessionCookie(seed.ownerId, 30);
      const [before] = await grantRowsOf(seed.ownerId);
      expect(
        onboardingGrantActive({
          onboardingGrantUntil: before.until,
          emailVerified: false,
        }),
      ).toBe(true);

      const db = getDb();
      await db
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, seed.ownerId));
      try {
        expect(
          onboardingGrantActive({
            onboardingGrantUntil: before.until,
            emailVerified: true,
          }),
        ).toBe(false);
        // 201 = CREACIÓN (el `reset()` borró los programas), y crear se permite siempre.
        // Lo que se mide acá es la COLUMNA: el corte por email no la toca.
        expect((await post(cookie)).status).toBe(201);
        const [after] = await grantRowsOf(seed.ownerId);
        expect(after.until).toEqual(before.until);
      } finally {
        await db
          .update(users)
          .set({ emailVerified: false })
          .where(eq(users.id, seed.ownerId));
      }
    }, 120_000);

    /**
     * CORTE 2 — 5 minutos tras el alta completa, y sobre **TODAS** las sesiones del usuario:
     * el permiso es del alta, no del navegador, y dejar viva la de otra pestaña reabriría la
     * ventana entera.
     */
    it("CORTE por alta completa: las DOS sesiones quedan `<= now() + 5 min`", async () => {
      await reset();
      const uno = await openSessionCookie(
        seed.ownerId,
        ONBOARDING_GRANT_MINUTES,
      );
      await openSessionCookie(seed.ownerId, ONBOARDING_GRANT_MINUTES); // otra pestaña
      expect(await grantRowsOf(seed.ownerId)).toHaveLength(2);

      expect((await post(uno)).status).toBe(201);

      const rows = await grantRowsOf(seed.ownerId);
      expect(rows).toHaveLength(2);
      const limit = Date.now() + 5 * 60_000 + 5_000;
      for (const row of rows) {
        expect(row.until).toBeInstanceOf(Date);
        expect((row.until as Date).getTime()).toBeLessThanOrEqual(limit);
        expect((row.until as Date).getTime()).toBeGreaterThan(Date.now());
      }
    }, 120_000);

    /** MONOTONÍA — `least(...)` y no una asignación: el alta NO extiende la ventana. */
    it("MONOTONÍA: con 2 minutos restantes, completar el alta NO los estira a 5", async () => {
      await reset();
      const cookie = await openSessionCookie(seed.ownerId, 2);
      const [before] = await grantRowsOf(seed.ownerId);
      expect((await post(cookie)).status).toBe(201);
      const [after] = await grantRowsOf(seed.ownerId);
      expect(after.until).toEqual(before.until);
      expect((after.until as Date).getTime()).toBeLessThan(
        Date.now() + 3 * 60_000,
      );
    }, 120_000);

    /**
     * Lo que este caso pinnea REALMENTE —y su docblock decía otra cosa, cazado por el
     * revisor— es el `caller.onboardingGrantActive ? [shorten…] : []` de
     * `loyalty-program.ts`: sin permiso el `UPDATE` **ni se emite**, así que el `isNotNull`
     * del `WHERE` nunca llega a evaluarse. El `isNotNull` tiene su propio caso, el de abajo.
     */
    it("sin permiso, el alta no escribe la columna: sigue NULL", async () => {
      await reset();
      const cookie = await openSessionCookie(seed.ownerId, null);
      expect((await post(cookie)).status).toBe(201);
      const [row] = await grantRowsOf(seed.ownerId);
      expect(row.until).toBeNull();
    }, 120_000);

    /**
     * EL `isNotNull` DEL `WHERE`, y es el único caso que lo pinnea.
     *
     * **`least` IGNORA LOS NULOS** — medido contra esta misma rama:
     * `select least(null::timestamptz, now() + interval '5 minutes')` devuelve **la fecha**,
     * no `NULL`. O sea que sin el `isNotNull`, completar el alta le REGALARÍA 5 minutos de
     * permiso a una sesión del mismo usuario que **nunca lo tuvo** — y esa coexistencia es
     * alcanzable: `magicLinkVerify` abre sesión sin override (columna `NULL`) mientras la
     * sesión del alta sí lo tiene.
     *
     * El `WHERE` acota por `user_id` **y** por `IS NOT NULL`; los dos ejes, un caso cada uno.
     */
    it("el acortado NO le regala permiso a una sesión del MISMO usuario que lo tenía NULL", async () => {
      await reset();
      const conPermiso = await openSessionCookie(
        seed.ownerId,
        ONBOARDING_GRANT_MINUTES,
      );
      await openSessionCookie(seed.ownerId, null); // la que nunca tuvo permiso
      const antes = await grantRowsOf(seed.ownerId);
      expect(antes).toHaveLength(2);
      expect(antes.filter((r) => r.until === null)).toHaveLength(1);

      expect((await post(conPermiso)).status).toBe(201);

      const despues = await grantRowsOf(seed.ownerId);
      expect(despues).toHaveLength(2);
      // LA ASERCIÓN: la fila NULL sigue NULL. `least` la habría llenado con now()+5min.
      expect(despues.filter((r) => r.until === null)).toHaveLength(1);
      // Y control positivo: la que SÍ tenía permiso se acortó, o sea el UPDATE corrió.
      const acortada = despues.find((r) => r.until !== null);
      expect(acortada?.until).toBeInstanceOf(Date);
      expect((acortada!.until as Date).getTime()).toBeLessThanOrEqual(
        Date.now() + 5 * 60_000 + 5_000,
      );
    }, 120_000);

    /** Y no derrama a OTROS usuarios: el `WHERE` filtra por `user_id`. */
    it("el acortado no toca el permiso de otro usuario", async () => {
      await reset();
      const otherId = `grant-otro-${randomUUID()}`;
      const db = getDb();
      await db.insert(users).values({
        id: otherId,
        name: "Otro",
        email: `${otherId}@example.test`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await openMerchantSession(otherId, {
        onboardingGrantUntil: new Date(Date.now() + 59 * 60_000),
      });
      try {
        const cookie = await openSessionCookie(
          seed.ownerId,
          ONBOARDING_GRANT_MINUTES,
        );
        expect((await post(cookie)).status).toBe(201);
        const [row] = await grantRowsOf(otherId);
        expect((row.until as Date).getTime()).toBeGreaterThan(
          Date.now() + 30 * 60_000,
        );
      } finally {
        await db.delete(users).where(eq(users.id, otherId));
      }
    }, 120_000);

    /** CONTROL de la migración: la columna que todo lo de arriba lee. */
    it("la columna existe, es nullable y es `timestamptz`", async () => {
      const result = await getDb().execute<{
        data_type: string;
        is_nullable: string;
      }>(sql`select data_type, is_nullable
             from information_schema.columns
            where table_schema = 'merchant_auth'
              and table_name = 'session'
              and column_name = 'onboarding_grant_until'`);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].data_type).toBe("timestamp with time zone");
      expect(result.rows[0].is_nullable).toBe("YES");
    }, 60_000);
  },
);
