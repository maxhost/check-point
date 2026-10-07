/**
 * Oraculo de los roles calcados contra la base LOCAL (spec 0167, ADR 0126 §Medido): los
 * atributos de `neondb_owner` copiados de PROD (`BYPASSRLS`, miembro de `neon_superuser`) no le
 * regalan permisos a los roles de la app. Va por el driver real y el proxy, como la app.
 *
 * Se saltea salvo `LOCAL_DB_INTEGRATION=true` (necesita `tools/local-db/up.sh` previo). Lo corre
 * `tools/local-db/check-roles.sh`. Nunca apunta a Neon: las URLs son locales y fijas.
 */
import { neon, Pool } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureNeonForLocal, quietPool } from "./local";

const enabled = process.env.LOCAL_DB_INTEGRATION === "true";
const OWNER =
  "postgresql://neondb_owner:local-solo-dev@db.localtest.me:5432/neondb";
const CONSUMER =
  "postgresql://checkpass_consumer:local-solo-dev@db.localtest.me:5432/neondb";
// Ids fijos de `seed-local.ts`: el comercio 1 tiene 2 clientes, el 2 tiene 1.
const BUSINESS_1 = "00000000-0000-4000-8000-000000000110";
const NO_BUSINESS = "00000000-0000-4000-8000-000000009999";

// `neonConfig` NO se fija aca: el primer bloque prueba que `client.ts` lo fija solo.
const pool = enabled ? quietPool(new Pool({ connectionString: OWNER })) : null;

/** `count(*)` de clientes como `customer_reader`, dentro de una transaccion del owner. */
async function countAsReader(businessId: string | null): Promise<number> {
  const client = await pool!.connect();
  try {
    await client.query("begin");
    if (businessId)
      await client.query("select set_config('app.business_id', $1, true)", [
        businessId,
      ]);
    await client.query("set local role customer_reader");
    const { rows } = await client.query<{ n: number }>(
      "select count(*)::int as n from core.business_customer",
    );
    return rows[0].n;
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
}

// Primero, y sin `configureNeonForLocal` previo: si `getDb`/`withDbTransaction` no lo llamaran,
// el driver iria a `https://db.localtest.me/sql` y este bloque fallaria.
describe.skipIf(!enabled)("client.ts contra la base local", () => {
  it("getDb (HTTP) y withDbTransaction (WebSocket) de client.ts andan contra la base local", async () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = OWNER;
    try {
      const { getDb, withDbTransaction } = await import("./client");
      const { sql } = await import("drizzle-orm");
      const http = await getDb().execute(sql`select current_user as u`);
      expect(http.rows[0]).toEqual({ u: "neondb_owner" });
      const inTx = await withDbTransaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(167)`);
        const r = await tx.execute(
          sql`select count(*)::int as n from core.business`,
        );
        return r.rows[0];
      });
      expect(inTx).toEqual({ n: 2 });
    } finally {
      process.env.DATABASE_URL = prev;
    }
  });
});

describe.skipIf(!enabled)("roles calcados de PROD en la base local", () => {
  beforeAll(() => configureNeonForLocal(OWNER));
  afterAll(async () => {
    await pool?.end();
  });

  it("checkpass_consumer por su login recibe permission denied for schema merchant_auth", async () => {
    const sql = neon(CONSUMER);
    await expect(
      sql`select count(*) from merchant_auth."user"`,
    ).rejects.toThrow("permission denied for schema merchant_auth");
    // Control: el login anda y ve lo que sus GRANTs le dan.
    const rows = await sql`select current_user as u`;
    expect(rows[0].u).toBe("checkpass_consumer");
  });

  it("el owner ve los 3 clientes sembrados (sin esto, los «0» de abajo no prueban nada)", async () => {
    const { rows } = await pool!.query<{ n: number }>(
      "select count(*)::int as n from core.business_customer",
    );
    expect(rows[0].n).toBe(3);
  });

  it("customer_reader sin app.business_id no ve ninguna fila: la politica tira", async () => {
    // Medido 2026-10-07: la politica usa `current_setting('app.business_id')` SIN `missing_ok`,
    // asi que sin la variable la consulta falla en vez de devolver 0 filas.
    await expect(countAsReader(null)).rejects.toThrow(
      'unrecognized configuration parameter "app.business_id"',
    );
  });

  it("customer_reader ve solo los clientes del app.business_id de la transaccion", async () => {
    expect(await countAsReader(NO_BUSINESS)).toBe(0);
    expect(await countAsReader(BUSINESS_1)).toBe(2);
  });
});
