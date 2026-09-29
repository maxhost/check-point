import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type CustomersWorld,
  dropCustomersWorld,
  integrationEnabled,
  seedCustomersWorld,
} from "./customers-integration-support";
import { seedMember } from "./counter-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";
import { getDb, withDbTransaction } from "./db";
import { memberships, users } from "./schema";
import { withCustomerReader } from "./customers/reader";
import { GET } from "../app/api/customers/route";

/**
 * Spec 0108 — AISLAMIENTO EN LAS DOS CAPAS (ADR 0100 §3), contra la base y con sesiones reales.
 *
 * Capa 1 es el endpoint: el negocio sale de la sesion. Capa 2 es la BASE, medida SIN pasar por
 * las consultas de la app: SQL crudo y sin filtro dentro de `withCustomerReader`, que tiene que
 * ver solo lo del negocio porque el rol y la RLS lo deciden, no el codigo.
 */
/** Every message along the `cause` chain: drizzle wraps the driver's error. */
function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    parts.push(String((current as { message?: unknown }).message ?? current));
    current = (current as { cause?: unknown }).cause;
  }
  return parts.join(" | ");
}

async function failure(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    return errorText(error);
  }
  return "NO FALLO";
}

type Body = {
  items: Array<Record<string, unknown>>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  code?: string;
};

describe.skipIf(!integrationEnabled)(
  "listado de clientes — aislamiento en dos capas (spec 0108)",
  () => {
    let world: CustomersWorld;
    const cookies: Record<string, string> = {};
    const extraUsers: string[] = [];

    const list = async (who: string, qs = "") => {
      const response = await GET(
        conCookie(`/api/customers${qs}`, "GET", cookies[who]),
      );
      return { status: response.status, body: (await response.json()) as Body };
    };
    const names = (body: Body) => body.items.map((i) => i.name).sort();

    beforeAll(async () => {
      world = await seedCustomersWorld(`Clientes ${Date.now()}`);
      cookies.a = await cookieDe(world.a.userId);
      cookies.b = await cookieDe(world.b.userId);
      cookies.c = await cookieDe(world.c.userId);
      cookies.d = await cookieDe(world.d.userId);
      const cajero = await seedMember({
        businessId: world.a.business.id,
        permissions: ["counter"],
      });
      const sinCounter = await seedMember({
        businessId: world.a.business.id,
        permissions: ["catalog"],
      });
      extraUsers.push(cajero, sinCounter);
      cookies.cajero = await cookieDe(cajero);
      cookies.sinCounter = await cookieDe(sinCounter);
    }, 240_000);

    afterAll(async () => {
      if (world) await dropCustomersWorld(world);
      for (const userId of [
        ...extraUsers,
        world?.a.userId,
        world?.b.userId,
        world?.c.userId,
        world?.d.userId,
      ].filter(Boolean) as string[]) {
        await getDb().delete(memberships).where(eq(memberships.userId, userId));
        await getDb().delete(users).where(eq(users.id, userId));
      }
    }, 180_000);

    it("capa 1: A lista X, Z y W, nunca Y; B lista X e Y; C vacio", async () => {
      const a = await list("a");
      expect(a.status).toBe(200);
      expect(names(a.body)).toEqual(
        [world.w.name, world.x.name, world.z.name].sort(),
      );
      expect(a.body.total).toBe(3);
      const b = await list("b");
      expect(names(b.body)).toEqual([world.x.name, world.y.name].sort());
      const c = await list("c");
      expect(c.body).toEqual({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      });
    }, 60_000);

    it("capa 1: el nombre y el telefono de Y desde A → vacio, con la MISMA forma que uno inexistente", async () => {
      const byName = await list("a", "?q=Yolanda");
      expect(byName.body.items).toEqual([]);
      expect(byName.body.total).toBe(0);
      const foreign = await list(
        "a",
        `?phone=${encodeURIComponent(world.y.phone)}`,
      );
      const missing = await list(
        "a",
        `?phone=${encodeURIComponent("+59300000000")}`,
      );
      expect(foreign.status).toBe(200);
      expect(foreign.body).toEqual(missing.body);
      expect(foreign.body).toEqual({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
      });
      // Control: B SI lo encuentra por telefono.
      const own = await list(
        "b",
        `?phone=${encodeURIComponent(world.y.phone)}`,
      );
      expect(names(own.body)).toEqual([world.y.name]);
    }, 60_000);

    // Las TRES formas de la respuesta: la busqueda por nombre SI lee `consumer_id` de la funcion
    // (para el join del saldo), asi que la lista sin filtro sola no ve una fuga por ahi.
    it("DTO: cada fila tiene EXACTAMENTE name, enrolledAt, lastVisitAt y balance, en las tres formas", async () => {
      const shapes = [
        await list("a"),
        await list("a", `?q=${encodeURIComponent(world.x.name.split(" ")[0])}`),
        await list("a", `?phone=${encodeURIComponent(world.x.phone)}`),
      ];
      for (const a of shapes) {
        expect(a.body.items.length).toBeGreaterThan(0);
        for (const item of a.body.items)
          expect(Object.keys(item).sort()).toEqual([
            "balance",
            "enrolledAt",
            "lastVisitAt",
            "name",
          ]);
        const serialized = JSON.stringify(a.body);
        for (const person of [world.x, world.z, world.w]) {
          expect(serialized).not.toContain(person.id);
          expect(serialized).not.toContain(person.phone);
          expect(serialized).not.toContain(person.qrToken);
        }
      }
    }, 60_000);

    it("capa 2: sin filtro, el rol solo ve lo de A en la proyeccion y en las membresias", async () => {
      const seen = await withCustomerReader(world.a.business.id, (reader) =>
        Promise.all([
          reader.execute(sql`
            SELECT count(*)::int AS n, count(DISTINCT business_id)::int AS bizs,
                   bool_and(business_id = ${world.a.business.id}::uuid) AS only_a
            FROM core.business_customer`),
          reader.execute(sql`
            SELECT count(*)::int AS n,
                   bool_and(business_id = ${world.a.business.id}::uuid) AS only_a
            FROM consumer.program_membership`),
        ]),
      );
      const [[bc], [pm]] = seen;
      expect(bc).toEqual({ n: 3, bizs: 1, only_a: true });
      // X, Z (x2: old + operational) and W: four memberships of A.
      expect(pm).toEqual({ n: 4, only_a: true });
    }, 60_000);

    it.each([
      [
        "consumer.consumer_account",
        sql`SELECT 1 FROM consumer.consumer_account LIMIT 1`,
      ],
      ['core."order"', sql`SELECT 1 FROM core."order" LIMIT 1`],
    ])(
      "capa 2: %s → permission denied",
      async (_name, query) => {
        expect(
          await failure(() =>
            withCustomerReader(world.a.business.id, (reader) =>
              reader.execute(query),
            ),
          ),
        ).toContain("permission denied");
      },
      60_000,
    );

    it("capa 2: la funcion de busqueda devuelve solo coincidencias de A", async () => {
      // «a» coincide con los cuatro nombres del mundo; desde A tienen que salir solo los tres.
      const rows = await withCustomerReader(world.a.business.id, (reader) =>
        reader.execute(
          sql`SELECT consumer_id, total FROM core.search_business_customers('a', 25, 0)`,
        ),
      );
      expect(rows.map((r) => r.consumer_id).sort()).toEqual(
        [world.x.id, world.z.id, world.w.id].sort(),
      );
      expect(rows[0].total).toBe(3);
    }, 60_000);

    it("capa 2: la funcion sin `app.business_id` fijado FALLA (no devuelve filas)", async () => {
      expect(
        await failure(() =>
          withDbTransaction(async (tx) => {
            await tx.execute(sql`SET LOCAL ROLE customer_reader`);
            return tx.execute(
              sql`SELECT * FROM core.search_business_customers('mar', 25, 0)`,
            );
          }),
        ),
      ).toMatch(/app\.business_id|invalid input syntax for type uuid/);
    }, 60_000);

    it("autorizacion: staff sin `counter` → 403; con `counter` → 200; owner → 200; sin sesion → 401", async () => {
      const sin = await list("sinCounter");
      expect(sin.status).toBe(403);
      expect(sin.body.code).toBe("missing_permission");
      const cajero = await list("cajero");
      expect(cajero.status).toBe(200);
      expect(cajero.body.total).toBe(3);
      expect((await list("a")).status).toBe(200);
      const anon = await GET(
        new Request("http://localhost:3001/api/customers"),
      );
      expect(anon.status).toBe(401);
      expect((await anon.json()).code).toBe("unauthorized");
    }, 60_000);

    it("saldo: Z trae el del programa operativo; W null; un negocio sin programa operativo, null en todas", async () => {
      const a = await list("a");
      const byName = Object.fromEntries(a.body.items.map((i) => [i.name, i]));
      expect(byName[world.z.name].balance).toEqual({
        kind: "points",
        value: 7,
      });
      expect(byName[world.x.name].balance).toEqual({
        kind: "points",
        value: 0,
      });
      expect(byName[world.w.name].balance).toBeNull();
      const b = await list("b");
      expect(b.body.items.map((i) => i.balance)).toEqual([
        { kind: "stamps", value: 0 },
        { kind: "stamps", value: 0 },
      ]);
      const d = await list("d");
      expect(d.body.total).toBe(2);
      expect(d.body.items.map((i) => i.balance)).toEqual([null, null]);
    }, 60_000);
  },
);
