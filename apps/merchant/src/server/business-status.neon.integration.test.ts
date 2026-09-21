import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedMember,
  type Seed,
} from "./counter-integration-support";
import { getDb } from "./db";
import { businesses, memberships } from "./schema";
import { createStaff } from "./staff-create";
import { openMerchantSession } from "./merchant-session";
import { enroll } from "./consumer/enrollment";
import { requireOperator } from "../app/api/counter/_auth";

import { GET as LOCATIONS } from "../app/api/locations/route";
import { POST as STAFF_LOGIN } from "../app/api/merchant/auth/staff/route";

/**
 * Spec 0072 §D4 — EL EJE `status` CONTRA NEON: la matriz `{active, suspended, closed}` ×
 * {owner, staff, consumidor} sobre una API del owner, el mostrador, el login del staff y el
 * enroll.
 *
 * **Por qué no alcanzan los units** (`api-owner-surfaces.test.ts` dobla `ownerContext`): ahí
 * la fila del negocio la escribe el propio test, así que un guard que leyera la columna
 * equivocada —o que la dejara de seleccionar— pasaría en verde. Acá el `status` se escribe
 * con un `UPDATE` sobre `core.business`, que es exactamente el mecanismo con el que hoy se
 * suspende un negocio (§Alcance: quien ESCRIBE el estado está diferido a las API de admin,
 * que no existen).
 *
 * **Y el caso que sólo se ve acá: LA SESIÓN PREEXISTENTE.** `auth.ts` no pisa
 * `session.expiresIn`, así que rige el default de better-auth 1.6.26 —7 días—. Cerrar el
 * login no expulsa a quien ya entró: el test del mostrador abre la sesión ANTES de suspender
 * y no vuelve a loguear.
 */
async function setStatus(
  businessId: string,
  status: string,
  suspensionReason: string | null = null,
): Promise<void> {
  await getDb()
    .update(businesses)
    .set({ status, suspensionReason, statusChangedAt: new Date() })
    .where(eq(businesses.id, businessId));
}

/** Un owner de verdad: membresía `owner` + email verificado, que es lo que pide el gate. */
async function seedOwnerSession(seed: Seed): Promise<string> {
  const cookie = await openMerchantSession(seed.userId);
  return cookie.split(";")[0];
}

const ownerRequest = (cookie: string) =>
  new Request("https://merchant.test/api/locations", {
    method: "GET",
    headers: { cookie },
  });

describe.skipIf(!integrationEnabled)(
  "el eje `status` del negocio contra Neon (spec 0072 §D4)",
  () => {
    let seed: Seed;
    let ownerCookie: string;
    let staffCookie: string;
    let staffIdentifier: string;
    let staffPin: string;

    beforeAll(async () => {
      seed = await seedBusiness({
        name: `Estado ${randomUUID().slice(0, 8)}`,
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "1.00",
      });
      ownerCookie = await seedOwnerSession(seed);
      const created = await createStaff(
        { id: seed.business.id, slug: seed.slug },
        { name: "Integrante", permissions: ["counter"] },
        "owner",
      );
      staffIdentifier = created.staff.identifier;
      staffPin = created.pin;
      // LA SESIÓN SE ABRE AHORA, con el negocio todavía `active`. Es el punto del test del
      // mostrador: no se vuelve a loguear después de suspender.
      staffCookie = (await openMerchantSession(created.staff.userId)).split(
        ";",
      )[0];
    }, 120_000);

    async function withStatus<T>(
      status: string,
      reason: string | null,
      body: () => Promise<T>,
    ): Promise<T> {
      await setStatus(seed.business.id, status, reason);
      try {
        return await body();
      } finally {
        await setStatus(seed.business.id, "active", null);
      }
    }

    it("`active`: el owner opera, el staff entra y el alta nueva procede", async () => {
      const response = await LOCATIONS(ownerRequest(ownerCookie));
      expect(response.status).toBe(200);

      const login = await STAFF_LOGIN(
        new Request("https://merchant.test/api/merchant/auth/staff", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: staffIdentifier, pin: staffPin }),
        }),
      );
      expect(login.status).toBe(200);

      const result = await enroll(seed.programId, {
        firstName: "Ana",
        lastName: "Pérez",
        phoneE164: `+59399${Math.floor(1000000 + Math.random() * 8999999)}`,
        countryIso: "EC",
      });
      expect(result.membership.programId).toBe(seed.programId);
    }, 120_000);

    it("`suspended`: API del owner 403 CON motivo, mostrador 403, staff sin PIN login, alta nueva 403", async () => {
      await withStatus("suspended", "Reclamos de consumidores.", async () => {
        const api = await LOCATIONS(ownerRequest(ownerCookie));
        expect(api.status).toBe(403);
        const body = await api.json();
        expect(body.code).toBe("business_suspended");
        // El motivo se serializa SOLO al owner: es lo que la pantalla de suspensión muestra.
        expect(body.suspensionReason).toBe("Reclamos de consumidores.");

        // EL HUECO DE LOS 7 DÍAS: la cookie del staff se emitió con el negocio `active` y
        // NO se vuelve a loguear. Si el guard viviera sólo en el login, esto seguiría
        // acreditando durante una semana.
        const counter = await requireOperator(
          new Request("https://merchant.test/api/counter/resolve", {
            method: "POST",
            headers: { cookie: staffCookie },
          }),
        );
        expect(
          "response" in counter,
          "el mostrador dejó pasar una sesión de staff YA VIVA en un negocio SUSPENDIDO",
        ).toBe(true);
        if ("response" in counter) {
          expect(counter.response.status).toBe(403);
          const counterBody = await counter.response.json();
          expect(counterBody.code).toBe("business_suspended");
          // El mostrador lo opera también el staff: el motivo NO viaja acá.
          expect(counterBody.suspensionReason).toBeUndefined();
        }

        const login = await STAFF_LOGIN(
          new Request("https://merchant.test/api/merchant/auth/staff", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              identifier: staffIdentifier,
              pin: staffPin,
            }),
          }),
        );
        expect(login.status).toBe(403);
        expect((await login.json()).code).toBe("business_suspended");

        await expect(
          enroll(seed.programId, {
            firstName: "Bruno",
            lastName: "Díaz",
            phoneE164: `+59399${Math.floor(1000000 + Math.random() * 8999999)}`,
            countryIso: "EC",
          }),
        ).rejects.toMatchObject({ status: 403, code: "business_suspended" });
      });
    }, 120_000);

    it("`closed`: ni sesión nueva por PIN, ni API, ni mostrador, ni alta nueva — y sin motivo", async () => {
      await withStatus(
        "closed",
        "Motivo viejo de una suspensión.",
        async () => {
          const api = await LOCATIONS(ownerRequest(ownerCookie));
          expect(api.status).toBe(403);
          const body = await api.json();
          expect(body.code).toBe("business_closed");
          // Un negocio cerrado no tiene motivo que mostrar, y el de una suspensión anterior
          // sería información vieja.
          expect(body.suspensionReason).toBeUndefined();

          const counter = await requireOperator(
            new Request("https://merchant.test/api/counter/resolve", {
              method: "POST",
              headers: { cookie: staffCookie },
            }),
          );
          expect(
            "response" in counter,
            "el mostrador dejó pasar una sesión de staff YA VIVA en un negocio CERRADO",
          ).toBe(true);
          if ("response" in counter) {
            expect(counter.response.status).toBe(403);
            expect((await counter.response.json()).code).toBe(
              "business_closed",
            );
          }

          const login = await STAFF_LOGIN(
            new Request("https://merchant.test/api/merchant/auth/staff", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                identifier: staffIdentifier,
                pin: staffPin,
              }),
            }),
          );
          expect(login.status).toBe(403);
          expect((await login.json()).code).toBe("business_closed");
          // No se emitió cookie: el login cerrado no abre sesión.
          expect(login.headers.get("set-cookie")).toBeNull();

          await expect(
            enroll(seed.programId, {
              firstName: "Carla",
              lastName: "Ruiz",
              phoneE164: `+59399${Math.floor(1000000 + Math.random() * 8999999)}`,
              countryIso: "EC",
            }),
          ).rejects.toMatchObject({ status: 403, code: "business_closed" });
        },
      );
    }, 120_000);

    it("un INTEGRANTE de un negocio suspendido recibe `not_owner`, no `business_suspended`", async () => {
      // El orden de §D1 sobre la base de verdad: el eje `status` se evalúa DESPUÉS de
      // resolver owner, así que un tercero no puede sondear el estado de un negocio ajeno.
      const memberId = await seedMember({ businessId: seed.business.id });
      const cookie = (await openMerchantSession(memberId)).split(";")[0];
      await withStatus("suspended", "Motivo interno.", async () => {
        const response = await LOCATIONS(ownerRequest(cookie));
        expect(response.status).toBe(403);
        const body = await response.json();
        // CAMBIO DE CONTRATO de la spec 0086: `/api/staff` es delegable, asi que el
        // integrante sin el toggle `staff` recibe `missing_permission` en el paso 3 y no
        // `not_owner`. **Lo que este caso mide no cambia**: el paso 3 va ANTES del 5, asi que
        // el integrante NO se entera de que el negocio esta suspendido ni recibe el motivo.
        expect(body.code).toBe("missing_permission");
        expect(body.suspensionReason).toBeUndefined();
      });
      await getDb().delete(memberships).where(eq(memberships.userId, memberId));
    }, 120_000);

    it("limpieza: el mundo se borra", async () => {
      await dropBusiness(seed.business.id);
      expect(true).toBe(true);
    }, 60_000);
  },
);
