import { and, eq } from "drizzle-orm";
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
import { getDb } from "./db";
import { memberships, sessions, staffPinLockouts } from "./schema";
import { createStaff } from "./staff-create";
import { openMerchantSession } from "./merchant-session";
import { POST as LOGIN } from "../app/api/merchant/auth/staff/route";
import { POST as CHANGE } from "../app/api/staff/[userId]/pin/route";
import { POST as REGENERATE } from "../app/api/staff/[userId]/pin/regenerate/route";

/**
 * Spec 0067 §4 — el cambio obligatorio del primer uso y la regeneración del owner.
 *
 * **El invariante más peligroso del paso está acá:** si el cambio dejara fijar un PIN
 * nuevo sin verificar el actual, `pin_must_change = true` sobre las membresías heredadas
 * (backfill de la 0032, `pin_hash = 'legacy-sin-pin'`) sería una toma de cuenta de todo el
 * staff viejo. Se prueba leyendo el `pin_hash` por SQL antes y después del intento fallido.
 */
const jsonRequest = (path: string, body: unknown, cookie?: string): Request =>
  new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const params = (userId: string) => ({ params: Promise.resolve({ userId }) });

describe.skipIf(!integrationEnabled)(
  "PIN del staff: cambio obligatorio y regeneración (spec 0067 §4)",
  () => {
    let a: Seed;
    let b: Seed;

    beforeAll(async () => {
      a = await seedBusiness({
        name: "Pin Change A",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      b = await seedBusiness({
        name: "Pin Change B",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(a.business.id);
      await dropBusiness(b.business.id);
    }, 30_000);

    const newStaff = (seed: Seed, name: string) =>
      createStaff({ id: seed.business.id, slug: seed.slug }, { name });

    const pinRow = (userId: string) =>
      getDb()
        .select({
          pinHash: memberships.pinHash,
          pinMustChange: memberships.pinMustChange,
        })
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .then((rows) => rows[0]);

    it("NO deja fijar un PIN nuevo sin el PIN actual correcto", async () => {
      const { staff, pin } = await newStaff(a, "Sin Verificar");
      const cookie = (await openMerchantSession(staff.userId)).split(";")[0];
      const before = await pinRow(staff.userId);

      const response = await CHANGE(
        jsonRequest(
          `/api/staff/${staff.userId}/pin`,
          {
            currentPin: pin === "999999" ? "888888" : "999999",
            newPin: "424242",
          },
          cookie,
        ),
        params(staff.userId),
      );
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("invalid_credentials");

      // El hash NO se movió y el integrante sigue obligado a cambiarlo.
      const after = await pinRow(staff.userId);
      expect(after.pinHash).toBe(before.pinHash);
      expect(after.pinMustChange).toBe(true);
      // Y el PIN viejo sigue siendo el que entra: el intento no fijó nada.
      const login = await LOGIN(
        jsonRequest("/api/merchant/auth/staff", {
          identifier: staff.identifier,
          pin,
        }),
      );
      expect(login.status).toBe(200);
    }, 120_000);

    it("con el PIN actual correcto cambia, apaga `pin_must_change` y rota el hash", async () => {
      const { staff, pin } = await newStaff(a, "Cambio Feliz");
      const cookie = (await openMerchantSession(staff.userId)).split(";")[0];
      const before = await pinRow(staff.userId);

      const response = await CHANGE(
        jsonRequest(
          `/api/staff/${staff.userId}/pin`,
          { currentPin: pin, newPin: "424242" },
          cookie,
        ),
        params(staff.userId),
      );
      expect(response.status).toBe(200);

      const after = await pinRow(staff.userId);
      expect(after.pinMustChange).toBe(false);
      expect(after.pinHash).not.toBe(before.pinHash);
      expect(after.pinHash).not.toContain("424242");

      const withNew = await LOGIN(
        jsonRequest("/api/merchant/auth/staff", {
          identifier: staff.identifier,
          pin: "424242",
        }),
      );
      expect(withNew.status).toBe(200);
      expect((await withNew.json()).staff.mustChangePin).toBe(false);
    }, 120_000);

    it("el centinela `legacy-sin-pin` da 401 en el cambio, NUNCA 500", async () => {
      const { staff } = await newStaff(a, "Legacy Cambio");
      await getDb()
        .update(memberships)
        .set({ pinHash: "legacy-sin-pin" })
        .where(eq(memberships.userId, staff.userId));
      const cookie = (await openMerchantSession(staff.userId)).split(";")[0];

      const response = await CHANGE(
        jsonRequest(
          `/api/staff/${staff.userId}/pin`,
          { currentPin: "123456", newPin: "424242" },
          cookie,
        ),
        params(staff.userId),
      );
      expect(response.status).toBe(401);
      expect((await pinRow(staff.userId)).pinHash).toBe("legacy-sin-pin");
    }, 60_000);

    it("un integrante no puede cambiar el PIN de otro (404) ni entrar sin sesión (401)", async () => {
      const uno = await newStaff(a, "Uno Cambio");
      const otro = await newStaff(a, "Otro Cambio");
      const cookie = (await openMerchantSession(uno.staff.userId)).split(
        ";",
      )[0];

      const ajeno = await CHANGE(
        jsonRequest(
          `/api/staff/${otro.staff.userId}/pin`,
          { currentPin: otro.pin, newPin: "424242" },
          cookie,
        ),
        params(otro.staff.userId),
      );
      expect(ajeno.status).toBe(404);

      const anon = await CHANGE(
        jsonRequest(`/api/staff/${uno.staff.userId}/pin`, {
          currentPin: uno.pin,
          newPin: "424242",
        }),
        params(uno.staff.userId),
      );
      expect(anon.status).toBe(401);
    }, 120_000);

    it("regenerar rota el PIN, vuelve a exigir el cambio, resetea el bloqueo y borra las sesiones", async () => {
      const { staff, pin } = await newStaff(a, "Regenerado");
      const ownerCookie = (await openMerchantSession(a.userId)).split(";")[0];
      // Estado previo: una sesión viva del integrante y un bloqueo en curso.
      await openMerchantSession(staff.userId);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await LOGIN(
          jsonRequest("/api/merchant/auth/staff", {
            identifier: staff.identifier,
            pin: pin === "000000" ? "111111" : "000000",
          }),
        );
      }
      expect(await lockoutCount(a.business.id, staff.userId)).toBe(1);

      const response = await REGENERATE(
        jsonRequest(
          `/api/staff/${staff.userId}/pin/regenerate`,
          {},
          ownerCookie,
        ),
        params(staff.userId),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.pin).toMatch(/^[0-9]{6}$/);
      expect(body.pin).not.toBe(pin);
      expect(JSON.stringify(body.staff)).not.toContain(body.pin);
      // Spec 0068 §2 — el email sintético NO se serializa, y se mira EL CUERPO, no el tipo:
      // `{...toStaffDTO(…), email}` compila igual, así que el `StaffDTO` no es el guard.
      // Este integrante tiene un `staff-<uuid>@staff.invalid` real en la base.
      expect(JSON.stringify(body.staff)).not.toContain("staff.invalid");
      expect(body.staff).not.toHaveProperty("email");

      const after = await pinRow(staff.userId);
      expect(after.pinMustChange).toBe(true);
      expect(after.pinHash).not.toContain(body.pin);
      expect(await lockoutCount(a.business.id, staff.userId)).toBe(0);
      const live = await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, staff.userId));
      expect(live).toHaveLength(0);

      // El PIN nuevo entra (el bloqueo se levantó de verdad) y el viejo no.
      const conNuevo = await LOGIN(
        jsonRequest("/api/merchant/auth/staff", {
          identifier: staff.identifier,
          pin: body.pin,
        }),
      );
      expect(conNuevo.status).toBe(200);
    }, 180_000);

    it("un owner del negocio A no puede regenerar el PIN de un staff de B: 404, no 403", async () => {
      const ajeno = await newStaff(b, "De Otro Negocio");
      const ownerCookie = (await openMerchantSession(a.userId)).split(";")[0];
      const response = await REGENERATE(
        jsonRequest(
          `/api/staff/${ajeno.staff.userId}/pin/regenerate`,
          {},
          ownerCookie,
        ),
        params(ajeno.staff.userId),
      );
      expect(response.status).toBe(404);
      expect((await response.json()).code).toBe("staff_not_found");
      // Y el PIN del ajeno sigue sirviendo: no se tocó nada.
      const login = await LOGIN(
        jsonRequest("/api/merchant/auth/staff", {
          identifier: ajeno.staff.identifier,
          pin: ajeno.pin,
        }),
      );
      expect(login.status).toBe(200);
    }, 120_000);

    it("un integrante (no owner) no puede regenerar PINes: 403", async () => {
      const { staff } = await newStaff(a, "No Owner");
      const cookie = (await openMerchantSession(staff.userId)).split(";")[0];
      const response = await REGENERATE(
        jsonRequest(`/api/staff/${staff.userId}/pin/regenerate`, {}, cookie),
        params(staff.userId),
      );
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("not_owner");
    }, 60_000);
  },
);

function lockoutCount(businessId: string, userId: string): Promise<number> {
  return getDb()
    .select({ userId: staffPinLockouts.userId })
    .from(staffPinLockouts)
    .where(
      and(
        eq(staffPinLockouts.businessId, businessId),
        eq(staffPinLockouts.userId, userId),
      ),
    )
    .then((rows) => rows.length);
}
