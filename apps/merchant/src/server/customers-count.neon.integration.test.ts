import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type SQL, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type CustomersWorld,
  dropCustomersWorld,
  integrationEnabled,
  seedCustomersWorld,
} from "./customers-integration-support";
import {
  dropBusiness,
  seedReward,
  setBalance,
} from "./counter-integration-support";
import { type DbTransaction, getDb, withDbTransaction } from "./db";
import { consumerAccounts } from "./schema";
import { rowsOf } from "./counter/core";
import { resolveScan } from "./counter/resolve";
import { grantAccrual } from "./counter/grant";
import { redeemReward } from "./counter/redeem";
import { enroll } from "./consumer/enrollment";
import { listCustomers } from "./customers/list";
import type { CustomerQuery } from "./customers/query";

// Spec 0109 — THE TRIPS ORACLE: every statement sent through the transaction's `execute` is
// recorded (rendered to its SQL text). `BEGIN`/`COMMIT` come from `withDbTransaction` itself.
const trips = vi.hoisted(() => ({ statements: [] as string[] }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  return {
    ...actual,
    withDbTransaction: <T>(work: (tx: DbTransaction) => Promise<T>) =>
      actual.withDbTransaction((tx) =>
        work(
          new Proxy(tx, {
            get(target, prop) {
              if (prop !== "execute") return Reflect.get(target, prop, target);
              return (query: SQL) => {
                trips.statements.push(dialect.sqlToQuery(query).sql);
                return target.execute(query);
              };
            },
          }),
        ),
      ),
  };
});

/**
 * Spec 0109 — EL CONTADOR `core.business_customer_count` (ADR 0101 §1). El oraculo es SIEMPRE la
 * proyeccion contada por SQL como el rol de la app, nunca el propio contador ni la API: lo mueve
 * solo un cliente nuevo o uno borrado; una re-alta 409, una compra y un canje, no.
 */
async function counted(businessId: string): Promise<number | null> {
  const [row] = rowsOf(
    await getDb().execute(sql`
      SELECT customers FROM core.business_customer_count
      WHERE business_id = ${businessId}::uuid`),
  ) as Array<{ customers: number }>;
  return row ? Number(row.customers) : null;
}

async function projected(businessId: string): Promise<number> {
  const [row] = rowsOf(
    await getDb().execute(sql`
      SELECT count(*)::int AS n FROM core.business_customer
      WHERE business_id = ${businessId}::uuid`),
  ) as Array<{ n: number }>;
  return Number(row.n);
}

const phone = () =>
  `+5939${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

describe.skipIf(!integrationEnabled)(
  "listado de clientes — contador por negocio (spec 0109)",
  () => {
    let world: CustomersWorld;

    beforeAll(async () => {
      world = await seedCustomersWorld(`Contador ${Date.now()}`);
    }, 240_000);

    afterAll(async () => {
      if (world) await dropCustomersWorld(world);
    }, 180_000);

    it("el contador de cada negocio es EXACTAMENTE sus filas en la proyeccion, y el backfill de la 0054 da lo mismo", async () => {
      const ids = [world.a, world.b, world.c, world.d].map(
        (s) => s.business.id,
      );
      for (const id of ids)
        expect(await counted(id)).toBe(
          // C no tiene clientes: sin fila (la lista usa `coalesce` 0).
          id === world.c.business.id ? null : await projected(id),
        );
      expect(await projected(world.a.business.id)).toBe(3);

      const migration = readFileSync(
        join(__dirname, "../../drizzle/0054_contador_de_clientes.sql"),
        "utf8",
      );
      const backfill = migration
        .split("--> statement-breakpoint")
        .find((s) => s.includes("FROM core.business_customer GROUP BY 1"));
      expect(backfill).toContain("INSERT INTO core.business_customer_count");
      const list = sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      const rebuilt = await withDbTransaction(async (tx) => {
        await tx.execute(
          sql`CREATE TEMP TABLE count_probe (LIKE core.business_customer_count) ON COMMIT DROP`,
        );
        await tx.execute(
          sql.raw(
            (backfill as string).replace(
              "INSERT INTO core.business_customer_count",
              "INSERT INTO count_probe",
            ),
          ),
        );
        return rowsOf(
          await tx.execute(sql`SELECT business_id, customers FROM count_probe
            WHERE business_id IN (${list}) ORDER BY business_id`),
        );
      });
      const live = rowsOf(
        await getDb().execute(sql`SELECT business_id, customers
          FROM core.business_customer_count
          WHERE business_id IN (${list}) ORDER BY business_id`),
      );
      expect(live).toHaveLength(3);
      expect(rebuilt).toEqual(live);
    }, 60_000);

    it("alta nueva +1; re-alta 409, compra y canje no lo mueven; la lista sin filtro trae ese total; borrar la cuenta −1", async () => {
      const business = world.a.business;
      // Deltas from the starting value, so each operation is observed on its own line.
      const start = (await counted(business.id)) as number;
      expect(start).not.toBeNull();

      const number = phone();
      const { account } = await enroll(world.a.programId, {
        firstName: "Nueva",
        lastName: "Clienta",
        phoneE164: number,
        countryIso: "EC",
      });
      expect(await counted(business.id)).toBe(start + 1);

      await expect(
        enroll(world.a.programId, {
          firstName: "Otra",
          lastName: "Vez",
          phoneE164: number,
          countryIso: "EC",
        }),
      ).rejects.toMatchObject({ status: 409, code: "already_member" });
      expect(await counted(business.id)).toBe(start + 1);

      // Compra: el upsert de la visita termina en DO UPDATE.
      const inA = await resolveScan(business, world.x.qrToken);
      await grantAccrual(business, world.a.userId, {
        clientRequestId: randomUUID(),
        membershipId: inA.membership.id,
        mode: "quick",
        total: "3.00",
      });
      expect(await counted(business.id)).toBe(start + 1);

      // Canje de premio: la otra visita.
      const rewardId = await seedReward({
        programId: world.a.programId,
        businessId: business.id,
        pointsCost: 5,
      });
      await setBalance(inA.membership.id, { points: 50 });
      await redeemReward(business, world.a.userId, {
        clientRequestId: randomUUID(),
        membershipId: inA.membership.id,
        rewardId,
        locationId: world.a.locationId,
      });
      expect(await counted(business.id)).toBe(start + 1);
      expect(await projected(business.id)).toBe(4);
      expect(await counted(business.id)).toBe(4);

      const list = await listCustomers(business.id, { page: 1, filter: "all" });
      expect(list.total).toBe(4);
      expect(list.items).toHaveLength(4);

      // Borrar la cuenta: la proyeccion pierde su fila POR CASCADE y el contador la ve.
      await getDb()
        .delete(consumerAccounts)
        .where(eq(consumerAccounts.id, account.id));
      expect(await projected(business.id)).toBe(3);
      expect(await counted(business.id)).toBe(start);
      expect(start).toBe(3);
      expect(
        (await listCustomers(business.id, { page: 1, filter: "all" })).total,
      ).toBe(3);
    }, 120_000);

    it("viajes: la lectura manda 2 sentencias propias en las tres formas (4 con BEGIN/COMMIT)", async () => {
      const shapes: CustomerQuery[] = [
        { page: 1, filter: "all" },
        { page: 9, filter: "all" },
        { page: 1, filter: "name", q: "lopez" },
        { page: 1, filter: "phone", phone: world.x.phone },
        { page: 2, filter: "phone", phone: world.x.phone },
      ];
      const totals: number[] = [];
      for (const query of shapes) {
        trips.statements.length = 0;
        totals.push((await listCustomers(world.a.business.id, query)).total);
        expect(trips.statements).toHaveLength(2);
        expect(trips.statements[0]).toContain(
          "set_config('role', 'customer_reader', true)",
        );
        expect(trips.statements[0]).toContain("set_config('app.business_id'");
        // The operational program is resolved INSIDE the page's statement, not before.
        expect(trips.statements[1]).toContain("core.loyalty_program");
      }
      // The counting did not change what the list answers.
      expect(totals).toEqual([3, 3, 1, 1, 1]);
    }, 60_000);

    it("borrar el negocio se lleva su contador sin error (los dos cascades, en cualquier orden)", async () => {
      expect(await counted(world.d.business.id)).toBe(2);
      await dropBusiness(world.d.business.id);
      expect(await counted(world.d.business.id)).toBeNull();
      expect(await projected(world.d.business.id)).toBe(0);
    }, 60_000);
  },
);
