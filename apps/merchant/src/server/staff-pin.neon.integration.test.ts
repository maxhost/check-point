import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
} from "./counter-integration-support";
import { getMerchantAuth } from "./auth";
import { getDb } from "./db";
import { memberships, staffPinLockouts } from "./schema";
import { createStaff } from "./staff-create";
import { POST as LOGIN } from "../app/api/merchant/auth/staff/route";

/**
 * Spec 0067 §4 / ADR 0070 §13 — el login del staff contra Neon: el bloqueo escalado
 * PERSISTIDO, el PIN que nunca queda legible, y la cookie de sesión de verdad.
 *
 * Por qué este archivo tiene que existir además del unitario: `nextLockout` es pura y ya
 * está probada sin base, pero **lo que la ruta persiste** es otra afirmación. Acá se lee
 * `locked_until` y `pin_hash` por SQL, que es la única señal que el proceso no generó.
 */
const loginRequest = (identifier: string, pin: string) =>
  new Request("http://localhost:3001/api/merchant/auth/staff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, pin }),
  });

/** Un PIN de 6 dígitos garantizado distinto del real. */
const wrongPin = (real: string) => (real === "000000" ? "111111" : "000000");

describe.skipIf(!integrationEnabled)(
  "login del staff por handle@slug + PIN (spec 0067 §4)",
  () => {
    let a: Seed;

    beforeAll(async () => {
      a = await seedBusiness({
        name: "Pin Bar",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(a.business.id);
    }, 30_000);

    const newStaff = async (name: string) =>
      createStaff({ id: a.business.id, slug: a.slug }, { name });

    const lockoutRow = (userId: string) =>
      getDb()
        .select({
          failedCount: staffPinLockouts.failedCount,
          stage: staffPinLockouts.stage,
          lockedUntil: staffPinLockouts.lockedUntil,
        })
        .from(staffPinLockouts)
        .where(
          and(
            eq(staffPinLockouts.businessId, a.business.id),
            eq(staffPinLockouts.userId, userId),
          ),
        )
        .then((rows) => rows[0] ?? null);

    it("entra con el PIN correcto, devuelve cookie de sesión REAL y pide cambiarlo", async () => {
      const { staff, pin } = await newStaff("Login Ok");
      const response = await LOGIN(loginRequest(staff.identifier, pin));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.staff.mustChangePin).toBe(true);
      expect(JSON.stringify(body)).not.toContain(pin);

      // El oráculo de `merchant-session.ts`: la cookie que arma a mano tiene que ser una
      // que better-auth acepte. Si el esquema de firma cambiara, esto se pone rojo.
      const cookie = response.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("HttpOnly");
      const session = await getMerchantAuth().api.getSession({
        headers: new Headers({ cookie: cookie.split(";")[0] }),
      });
      expect(session?.user.id).toBe(staff.userId);
    }, 60_000);

    it("el PIN nunca queda legible: `pin_hash` no lo contiene", async () => {
      const { staff, pin } = await newStaff("Nunca Legible");
      const [row] = await getDb()
        .select({ pinHash: memberships.pinHash })
        .from(memberships)
        .where(
          and(
            eq(memberships.businessId, a.business.id),
            eq(memberships.userId, staff.userId),
          ),
        );
      expect(row.pinHash).toBeTruthy();
      expect(row.pinHash).not.toContain(pin);
      expect(row.pinHash).not.toBe(pin);
    }, 60_000);

    it("5 fallos → 429 y `locked_until` a 15 minutos, leído por SQL", async () => {
      const { staff, pin } = await newStaff("Cinco Fallos");
      const bad = wrongPin(pin);
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const response = await LOGIN(loginRequest(staff.identifier, bad));
        expect(response.status).toBe(401);
        expect((await lockoutRow(staff.userId))?.failedCount).toBe(attempt);
      }

      const fifth = await LOGIN(loginRequest(staff.identifier, bad));
      expect(fifth.status).toBe(429);
      expect((await fifth.json()).code).toBe("pin_locked");

      const row = await lockoutRow(staff.userId);
      expect(row?.stage).toBe(1);
      expect(row?.failedCount).toBe(0);
      const minutes = (row!.lockedUntil!.getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(14);
      expect(minutes).toBeLessThanOrEqual(15);
    }, 120_000);

    it("estando bloqueado, el PIN CORRECTO también da 429 y no levanta el bloqueo", async () => {
      const { staff, pin } = await newStaff("Bloqueado");
      const bad = wrongPin(pin);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await LOGIN(loginRequest(staff.identifier, bad));
      }
      const before = await lockoutRow(staff.userId);

      const response = await LOGIN(loginRequest(staff.identifier, pin));
      expect(response.status).toBe(429);
      const after = await lockoutRow(staff.userId);
      // El intento no consumió nada ni alargó el candado: el estado es el mismo.
      expect(after?.lockedUntil?.toISOString()).toBe(
        before?.lockedUntil?.toISOString(),
      );
      expect(after?.stage).toBe(1);
      expect(after?.failedCount).toBe(0);
    }, 120_000);

    it("tras vencer el bloqueo, 3 fallos (no 5) → 1 hora; y el login correcto resetea", async () => {
      const { staff, pin } = await newStaff("Escalado");
      const bad = wrongPin(pin);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await LOGIN(loginRequest(staff.identifier, bad));
      }
      // Se mueve el reloj de la fila, no el del proceso: vencer el bloqueo de verdad son
      // 15 minutos de espera, y lo que se prueba es el UMBRAL del tramo siguiente.
      await getDb()
        .update(staffPinLockouts)
        .set({ lockedUntil: sql`now() - interval '1 minute'` })
        .where(
          and(
            eq(staffPinLockouts.businessId, a.business.id),
            eq(staffPinLockouts.userId, staff.userId),
          ),
        );

      expect((await LOGIN(loginRequest(staff.identifier, bad))).status).toBe(
        401,
      );
      expect((await LOGIN(loginRequest(staff.identifier, bad))).status).toBe(
        401,
      );
      const third = await LOGIN(loginRequest(staff.identifier, bad));
      expect(third.status).toBe(429);

      const locked = await lockoutRow(staff.userId);
      expect(locked?.stage).toBe(2);
      const minutes = (locked!.lockedUntil!.getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(59);
      expect(minutes).toBeLessThanOrEqual(60);

      // Se libera el candado y entra bien: contadores en cero.
      await getDb()
        .update(staffPinLockouts)
        .set({ lockedUntil: sql`now() - interval '1 minute'` })
        .where(
          and(
            eq(staffPinLockouts.businessId, a.business.id),
            eq(staffPinLockouts.userId, staff.userId),
          ),
        );
      expect((await LOGIN(loginRequest(staff.identifier, pin))).status).toBe(
        200,
      );
      const reset = await lockoutRow(staff.userId);
      expect(reset).toMatchObject({ failedCount: 0, stage: 0 });
      expect(reset?.lockedUntil).toBeNull();
    }, 180_000);

    it("el `pin_hash` centinela de la 0032 contesta 401, NUNCA 500", async () => {
      const { staff, pin } = await newStaff("Legacy");
      // Es el valor exacto con el que la migración rellenó las 8 membresías heredadas de
      // la rama de integración. `better-auth/crypto` tira `Invalid password hash` contra
      // él: si la ruta no lo atrapara, esto sería un 500.
      await getDb()
        .update(memberships)
        .set({ pinHash: "legacy-sin-pin" })
        .where(
          and(
            eq(memberships.businessId, a.business.id),
            eq(memberships.userId, staff.userId),
          ),
        );
      const response = await LOGIN(loginRequest(staff.identifier, pin));
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("invalid_credentials");
    }, 60_000);

    it("un identificador inexistente da el MISMO 401 que un PIN malo", async () => {
      const ghost = await LOGIN(loginRequest(`fantasma@${a.slug}`, "123456"));
      expect(ghost.status).toBe(401);
      expect(await ghost.json()).toEqual(
        await (await LOGIN(loginRequest(`otro@${a.slug}`, "123456"))).json(),
      );
    }, 60_000);

    it("el staff `disabled` sigue rebotando con `staff_disabled` (ADR 0055)", async () => {
      const { staff, pin } = await newStaff("Desactivado");
      await getDb()
        .update(memberships)
        .set({ status: "disabled" })
        .where(
          and(
            eq(memberships.businessId, a.business.id),
            eq(memberships.userId, staff.userId),
          ),
        );
      const response = await LOGIN(loginRequest(staff.identifier, pin));
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("staff_disabled");
    }, 60_000);
  },
);
