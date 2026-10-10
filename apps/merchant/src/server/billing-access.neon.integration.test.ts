import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropBusiness,
  integrationEnabled,
  seedBusiness,
} from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { subscriptions } from "@mi-pasaporte/db/schema";
import {
  accessSql,
  billingAccess,
} from "@mi-pasaporte/domain/server/billing-access";
import { ACCESS_CASES, NOW } from "./billing-access-cases";

/**
 * Spec 0189 §Plan de pruebas, T2 — `accessSql` = `billingAccess`. Siembra UNA fila por caso de
 * la tabla compartida (`billing-access-cases.ts`, el mismo oráculo de T1) y asevera que el
 * fragmento SQL dice «tiene acceso» exactamente cuando la función TS no dice `blocked`. Las dos
 * definiciones del eje no pueden divergir sin que esto se ponga rojo.
 *
 * El caso «sin fila» borra la fila de prueba que `seedBusiness` crea: es el `left join` vacío,
 * que tiene que ser FALSO (fail-closed), no NULL.
 */

type Seeded = { name: string; businessId: string; expected: boolean };

async function hasAccessSql(businessId: string): Promise<unknown> {
  const result = await getDb().execute<{ has: unknown }>(sql`
    select ${accessSql("s", NOW)} as has
    from core.business b
    left join core.subscription s on s.business_id = b.id
    where b.id = ${businessId}`);
  const rows = Array.isArray(result) ? result : result.rows;
  return rows[0]?.has;
}

describe.skipIf(!integrationEnabled)(
  "accessSql — la versión SQL del eje de acceso (spec 0189, T2)",
  () => {
    const seeded: Seeded[] = [];
    const run = randomUUID().slice(0, 8);

    beforeAll(async () => {
      for (const [index, item] of ACCESS_CASES.entries()) {
        const seed = await seedBusiness({
          name: `Acceso ${index} ${run}`,
          kind: "points",
          mode: "per_amount",
          grant: 10,
          blockAmount: "1.00",
        });
        const where = eq(subscriptions.businessId, seed.business.id);
        if (item.row === null) {
          await getDb().delete(subscriptions).where(where);
        } else {
          await getDb()
            .update(subscriptions)
            .set({
              status: item.row.status,
              // Los ids de Stripe son UNIQUE GLOBALES: sufijo por corrida.
              stripeSubscriptionId:
                item.row.stripeSubscriptionId === null
                  ? null
                  : `${item.row.stripeSubscriptionId}_${run}`,
              trialEndsAt: item.row.trialEndsAt,
            })
            .where(where);
        }
        seeded.push({
          name: item.name,
          businessId: seed.business.id,
          expected: billingAccess(item.row, NOW) !== "blocked",
        });
      }
    }, 120_000);

    afterAll(async () => {
      for (const item of seeded) await dropBusiness(item.businessId);
    }, 60_000);

    it("cubre la tabla entera, con los dos desenlaces", () => {
      expect(seeded).toHaveLength(ACCESS_CASES.length);
      expect(new Set(seeded.map((item) => item.expected))).toEqual(
        new Set([true, false]),
      );
    });

    it.each(ACCESS_CASES.map((item) => [item.name]))(
      "%s: el SQL coincide con `billingAccess`",
      async (name) => {
        const item = seeded.find((candidate) => candidate.name === name);
        // Un booleano de VERDAD: `false` y no `null` en el `left join` vacío.
        expect(await hasAccessSql(item!.businessId)).toBe(item!.expected);
      },
      60_000,
    );
  },
);
