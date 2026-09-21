import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropBusiness,
  integrationEnabled as enabled,
  seedBusiness,
  seedConsumer,
  seedMember,
  type Seed,
} from "./counter-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";
import { getDb } from "./db";
import { memberships, users } from "./schema";
import { POST as RESOLVE } from "../app/api/counter/resolve/route";
import { POST as GRANT } from "../app/api/counter/grant/route";
import { POST as REDEEM } from "../app/api/counter/redeem/route";
import { POST as COUPON } from "../app/api/counter/coupon-redeem/route";

/**
 * Spec 0086 §6 — **EL MOSTRADOR EXIGE EL PERMISO `counter`, contra la base y con sesiones
 * REALES.**
 *
 * **Es un CAMBIO DE COMPORTAMIENTO, no un gate nuevo sobre lo mismo**: hasta esta spec
 * CUALQUIER integrante activo del negocio acreditaba, por el solo hecho de ser miembro
 * (`requireOperator` aceptaba cualquier membresía). Es el motivo por el que la migración 0041
 * **borra** las membresías de staff existentes en vez de backfillearlas: el owner las recrea
 * con `counter` si las quiere.
 *
 * Archivo propio y no dentro de `permisos-delegados.neon.integration.test.ts` por el hook
 * `file-size` (300 líneas): dividir, no extender. Comparte el mismo montaje.
 */
/** Las CUATRO rutas del mostrador, con el cuerpo mínimo de cada una. El cuerpo no importa
 * para lo que se mide —el guard corre ANTES de leerlo—, salvo en `resolve`, que es el único
 * con desenlace positivo alcanzable sin montar una acreditación entera. */
const MOSTRADOR: Array<
  [string, (cookie: string, qrToken: string) => Promise<Response>]
> = [
  [
    "resolve",
    (c, qrToken) =>
      RESOLVE(conCookie("/api/counter/resolve", "POST", c, { qrToken })),
  ],
  ["grant", (c) => GRANT(conCookie("/api/counter/grant", "POST", c, {}))],
  ["redeem", (c) => REDEEM(conCookie("/api/counter/redeem", "POST", c, {}))],
  [
    "coupon-redeem",
    (c) => COUPON(conCookie("/api/counter/coupon-redeem", "POST", c, {})),
  ],
];

describe.skipIf(!enabled)(
  "el mostrador y el permiso `counter` (spec 0086 §6)",
  () => {
    let a: Seed;
    const extras: string[] = [];
    /** Integrante con un permiso VÁLIDO que no es `counter`: es exactamente el caller que
     * antes acreditaba y ahora no. */
    let cookieSinCounter = "";
    let cookieCajero = "";
    let qrToken = "";

    beforeAll(async () => {
      a = await seedBusiness({
        name: "Mostrador Perm",
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "1.00",
      });
      const sinCounter = await seedMember({
        businessId: a.business.id,
        permissions: ["catalog"],
      });
      const cajero = await seedMember({
        businessId: a.business.id,
        permissions: ["counter"],
      });
      extras.push(sinCounter, cajero);
      cookieSinCounter = await cookieDe(sinCounter);
      cookieCajero = await cookieDe(cajero);
      qrToken = (await seedConsumer()).qrToken;
    }, 240_000);

    afterAll(async () => {
      if (a) await dropBusiness(a.business.id);
      for (const userId of [...extras, a?.userId].filter(Boolean)) {
        await getDb()
          .delete(memberships)
          .where(eq(memberships.userId, userId as string));
        await getDb()
          .delete(users)
          .where(eq(users.id, userId as string));
      }
    }, 180_000);

    /** **EL CAMBIO DE COMPORTAMIENTO DEL §6**: hasta esta spec CUALQUIER integrante activo
     * operaba el mostrador. El `cataloguero` tiene un permiso válido y no es `counter`, así
     * que es exactamente el caller que antes acreditaba y ahora no. */
    it.each(MOSTRADOR)(
      "mostrador/%s: un STAFF sin `counter` → 403 `missing_permission`",
      async (_name, call) => {
        const response = await call(cookieSinCounter, qrToken);
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe("missing_permission");
      },
      120_000,
    );

    /** CONTROL POSITIVO de las CUATRO: con el toggle puesto, el guard deja pasar. `resolve`
     * llega a 200 de verdad; las otras tres fallan en el DOMINIO por su cuerpo vacío —y eso es
     * lo que se asevera: que el `code` YA NO es `missing_permission` y el status ya no es 403—.
     * Medir un 200 en las tres exigiría montar una acreditación entera, que es lo que miden
     * `counter-*.neon.integration` con el owner. */
    it.each(MOSTRADOR)(
      "mostrador/%s: un STAFF CON `counter` pasa el guard",
      async (name, call) => {
        const response = await call(cookieCajero, qrToken);
        const body = await response.json();
        expect(body.code).not.toBe("missing_permission");
        if (name === "resolve") {
          expect(response.status).toBe(200);
          expect(body.consumer).toBeDefined();
        } else {
          expect(response.status).not.toBe(403);
        }
      },
      120_000,
    );
  },
);
