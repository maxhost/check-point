import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type CustomersWorld,
  dropCustomersWorld,
  integrationEnabled,
  seedCustomersWorld,
  seedPerson,
  seedPointsBusiness,
} from "./customers-integration-support";
import { type Seed, dropBusiness } from "./counter-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { memberships, users } from "@mi-pasaporte/db/schema";
import { rowsOf } from "@mi-pasaporte/domain/server/counter/core";
import { insertMembershipWithProjection } from "@mi-pasaporte/domain/server/customers/projection";
import { listCustomers } from "./customers/list";
import { GET } from "../app/api/customers/route";

/**
 * Spec 0108 — PAGINAS, BUSQUEDA y los objetos de la migracion `0053` leidos por SQL.
 */
describe.skipIf(!integrationEnabled)(
  "listado de clientes — paginas, busqueda y migracion (spec 0108)",
  () => {
    let world: CustomersWorld;
    let many: Seed;
    let cookie = "";

    beforeAll(async () => {
      world = await seedCustomersWorld(`Listado ${Date.now()}`);
      cookie = await cookieDe(world.a.userId);
      many = await seedPointsBusiness(`Treinta ${Date.now()}`);
      for (let i = 0; i < 30; i += 1) {
        const person = await seedPerson(`Cliente${i}`, "Treinta");
        await insertMembershipWithProjection({
          consumerId: person.id,
          programId: many.programId,
          businessId: many.business.id,
        });
      }
      // Ten of them came, at distinct times: the order mixes visits and never-came.
      await getDb().execute(sql`
        UPDATE core.business_customer bc SET last_visit_at = now() - (k.n || ' minutes')::interval
        FROM (SELECT consumer_id, row_number() OVER (ORDER BY consumer_id) AS n
              FROM core.business_customer WHERE business_id = ${many.business.id}::uuid) k
        WHERE bc.business_id = ${many.business.id}::uuid AND bc.consumer_id = k.consumer_id
          AND k.n <= 10`);
    }, 240_000);

    afterAll(async () => {
      if (world) await dropCustomersWorld(world);
      if (many) await dropBusiness(many.business.id);
      for (const userId of [
        world?.a.userId,
        world?.b.userId,
        world?.c.userId,
        world?.d.userId,
        many?.userId,
      ].filter(Boolean) as string[]) {
        await getDb().delete(memberships).where(eq(memberships.userId, userId));
        await getDb().delete(users).where(eq(users.id, userId));
      }
    }, 180_000);

    it("paginas: 30 clientes → 25 + 5 + [] con total 30 y 2 paginas, sin repetir ni perder", async () => {
      const page = (n: number) =>
        listCustomers(many.business.id, { page: n, filter: "all" });
      const [p1, p2, p3] = [await page(1), await page(2), await page(3)];
      expect(p1.items).toHaveLength(25);
      expect(p2.items).toHaveLength(5);
      expect(p3.items).toEqual([]);
      for (const p of [p1, p2, p3]) {
        expect(p.total).toBe(30);
        expect(p.totalPages).toBe(2);
        expect(p.pageSize).toBe(25);
      }
      expect(p3.page).toBe(3);
      const all = [...p1.items, ...p2.items].map((i) => i.name);
      expect(new Set(all).size).toBe(30);
      // Los diez que vinieron primero, del mas reciente al mas viejo; despues los que no.
      const visits = [...p1.items, ...p2.items].map((i) => i.lastVisitAt);
      expect(visits.slice(0, 10).every((v) => v !== null)).toBe(true);
      expect(visits.slice(10).every((v) => v === null)).toBe(true);
      const times = visits.slice(0, 10).map((v) => Date.parse(v as string));
      expect(times).toEqual([...times].sort((x, y) => y - x));
    }, 60_000);

    // «mar» también está en «Zoe Martínez»: sin tildes ni mayusculas, los dos coinciden.
    it.each([
      ["maria", ["x"]],
      ["MAR", ["x", "z"]],
      ["már", ["x", "z"]],
      ["lóp", ["x"]],
    ] as const)(
      "busqueda: %s encuentra %j",
      async (q, who) => {
        const found = await listCustomers(world.a.business.id, {
          page: 1,
          filter: "name",
          q,
        });
        const expected = who.map((key) => world[key].name).sort();
        expect(found.items.map((i) => i.name).sort()).toEqual(expected);
        expect(found.total).toBe(expected.length);
      },
      60_000,
    );

    it("busqueda: `___` NO devuelve a todos (los comodines se escapan)", async () => {
      const found = await listCustomers(world.a.business.id, {
        page: 1,
        filter: "name",
        q: "___",
      });
      expect(found).toMatchObject({ items: [], total: 0, totalPages: 0 });
      // `%` tampoco es comodin.
      const pct = await listCustomers(world.a.business.id, {
        page: 1,
        filter: "name",
        q: "%%%",
      });
      expect(pct.total).toBe(0);
    }, 60_000);

    it("busqueda: una pagina mas alla de la ultima trae [] con el total real", async () => {
      // Spec 0109: 30 coincidencias → 25 + 5, con el total 30 en LAS DOS paginas.
      const first = await listCustomers(many.business.id, {
        page: 1,
        filter: "name",
        q: "treinta",
      });
      expect(first).toMatchObject({ total: 30, totalPages: 2 });
      expect(first.items).toHaveLength(25);
      const found = await listCustomers(many.business.id, {
        page: 2,
        filter: "name",
        q: "treinta",
      });
      expect(found.items).toHaveLength(5);
      expect(found.total).toBe(30);
      expect(
        new Set([...first.items, ...found.items].map((i) => i.name)).size,
      ).toBe(30);
      const beyond = await listCustomers(many.business.id, {
        page: 9,
        filter: "name",
        q: "treinta",
      });
      expect(beyond).toMatchObject({ items: [], total: 30, totalPages: 2 });
    }, 60_000);

    it("la ruta: `q` de 2 caracteres → 400 `validation` con fields.q", async () => {
      const response = await GET(
        conCookie("/api/customers?q=ma", "GET", cookie),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("validation");
      expect(Object.keys(body.fields)).toEqual(["q"]);
    }, 60_000);

    it("migracion 0053: extensiones, rol, grants, RLS, politicas y funcion presentes", async () => {
      const one = async (query: ReturnType<typeof sql>) =>
        rowsOf(await getDb().execute(query));
      expect(
        (
          await one(sql`SELECT extname FROM pg_extension
            WHERE extname IN ('pg_trgm', 'unaccent', 'btree_gin') ORDER BY 1`)
        ).map((r) => (r as { extname: string }).extname),
      ).toEqual(["btree_gin", "pg_trgm", "unaccent"]);
      expect(
        await one(sql`SELECT rolcanlogin, rolbypassrls FROM pg_roles
          WHERE rolname = 'customer_reader'`),
      ).toEqual([{ rolcanlogin: false, rolbypassrls: false }]);
      expect(
        await one(sql`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
          WHERE oid IN ('core.business_customer'::regclass, 'consumer.program_membership'::regclass)
          ORDER BY relname`),
      ).toEqual([
        {
          relname: "business_customer",
          relrowsecurity: true,
          relforcerowsecurity: false,
        },
        {
          relname: "program_membership",
          relrowsecurity: true,
          relforcerowsecurity: false,
        },
      ]);
      expect(
        await one(sql`SELECT tablename, cmd, roles::text AS roles FROM pg_policies
          WHERE policyname IN ('business_customer_by_business', 'program_membership_by_business')
          ORDER BY tablename`),
      ).toEqual([
        {
          tablename: "business_customer",
          cmd: "SELECT",
          roles: "{customer_reader}",
        },
        {
          tablename: "program_membership",
          cmd: "SELECT",
          roles: "{customer_reader}",
        },
      ]);
      expect(
        (
          await one(sql`SELECT column_name FROM information_schema.column_privileges
            WHERE grantee = 'customer_reader' AND table_schema = 'consumer'
              AND table_name = 'program_membership' AND privilege_type = 'SELECT'
            ORDER BY 1`)
        ).map((r) => (r as { column_name: string }).column_name),
      ).toEqual([
        "business_id",
        "consumer_id",
        "points_balance",
        "program_id",
        "stamps_count",
      ]);
      expect(
        await one(sql`SELECT prosecdef,
            has_function_privilege('customer_reader', p.oid, 'EXECUTE') AS reader,
            has_function_privilege('public', p.oid, 'EXECUTE') AS anyone
          FROM pg_proc p WHERE p.proname = 'search_business_customers'`),
      ).toEqual([{ prosecdef: true, reader: true, anyone: false }]);
      expect(
        (
          await one(sql`SELECT indexname FROM pg_indexes
            WHERE schemaname = 'core' AND tablename = 'business_customer' ORDER BY 1`)
        ).map((r) => (r as { indexname: string }).indexname),
      ).toEqual([
        "business_customer_business_id_consumer_id_pk",
        "core_business_customer_order_idx",
        "core_business_customer_phone_unique",
        "core_business_customer_search_idx",
      ]);
    }, 60_000);
  },
);
