import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { integrationEnabled } from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";

/**
 * Spec 0189 §D1 / DoD — LA MIGRACIÓN 0069, RELEÍDA POR SQL en la rama donde corren las suites
 * (`tools/neon-test.sh` la migra antes): la columna, el default, el check del motivo de pausa y
 * el grant de lectura al rol del cliente. El esquema de drizzle no es el oráculo: lo es el
 * catálogo de Postgres.
 */
async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await getDb().execute(query);
  return (Array.isArray(result) ? result : result.rows) as T[];
}

describe.skipIf(!integrationEnabled)("migración 0069 (spec 0189 §D1)", () => {
  it("`core.subscription.trial_ends_at` existe, `timestamptz` y nullable", async () => {
    expect(
      await rows(sql`
          select data_type, is_nullable from information_schema.columns
          where table_schema = 'core' and table_name = 'subscription'
            and column_name = 'trial_ends_at'`),
    ).toEqual([{ data_type: "timestamp with time zone", is_nullable: "YES" }]);
  });

  it("el default de `plan` es `'trial'`", async () => {
    expect(
      await rows(sql`
          select column_default from information_schema.columns
          where table_schema = 'core' and table_name = 'subscription'
            and column_name = 'plan'`),
    ).toEqual([{ column_default: "'trial'::text" }]);
  });

  it("el check del motivo de pausa admite `billing_blocked`", async () => {
    const [check] = await rows<{ def: string }>(sql`
        select pg_get_constraintdef(oid) as def from pg_constraint
        where conname = 'core_campaign_pause_reason_check'`);
    expect(check.def).toContain("'billing_blocked'");
    expect(check.def).toContain("'owner'");
  });

  it("`checkpass_consumer` lee las cuatro columnas del acceso", async () => {
    expect(
      await rows(sql`
          select c as columna,
            has_column_privilege('checkpass_consumer', 'core.subscription', c, 'SELECT') as puede
          from unnest(array['business_id', 'status', 'stripe_subscription_id', 'trial_ends_at']) c`),
    ).toEqual([
      { columna: "business_id", puede: true },
      { columna: "status", puede: true },
      { columna: "stripe_subscription_id", puede: true },
      { columna: "trial_ends_at", puede: true },
    ]);
  });
});
