import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businessModules,
  diningTables,
  posOrders,
} from "@mi-pasaporte/db/schema";

/**
 * Spec 0220 / ADR 0141 §4 y §5 — APAGAR EL POS Y MESAS contra Neon, con sesion real y las reglas
 * reales (`beforeDisable`), y LA CARRERA crear-orden vs apagar en sus dos ordenes posibles. El
 * invariante: nunca queda una orden `open` con el POS apagado, ni una `open` con mesa con Mesas
 * apagado.
 *
 * Para fijar el orden de la carrera se dobla el MOMENTO, no el resultado: `lockModuleEnabled` y la
 * regla del POS son las reales, envueltas en un pestillo que las deja esperando DESPUES de hacer su
 * trabajo (con el lock tomado). El otro lado arranca, y el pestillo se suelta cuando la base muestra
 * un advisory lock en espera (o el otro lado ya termino, que es el sintoma del lock que falta).
 * Las mesas se siembran por SQL: el POS no importa codigo de Mesas (regla 7), solo lo nombra.
 */

type Latch = {
  armed: boolean;
  reached: () => void;
  wait: Promise<void>;
  release: () => void;
};

const h = vi.hoisted(() => ({
  lock: null as null | Latch,
  rule: null as null | Latch,
}));

function latch(): { latch: Latch; reached: Promise<void> } {
  let reached!: () => void;
  let release!: () => void;
  const reachedP = new Promise<void>((r) => (reached = r));
  const wait = new Promise<void>((r) => (release = r));
  return { latch: { armed: true, reached, wait, release }, reached: reachedP };
}

async function pause(slot: "lock" | "rule"): Promise<void> {
  const l = h[slot];
  if (!l?.armed) return;
  l.armed = false;
  l.reached();
  await l.wait;
}

vi.mock("../../guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../guard")>();
  return {
    ...actual,
    lockModuleEnabled: async (
      ...args: Parameters<typeof actual.lockModuleEnabled>
    ) => {
      await actual.lockModuleEnabled(...args);
      if (args[2] === "pos") await pause("lock");
    },
  };
});
vi.mock("./module", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./module")>();
  return {
    posBeforeDisable: async (
      ...args: Parameters<typeof actual.posBeforeDisable>
    ) => {
      const result = await actual.posBeforeDisable(...args);
      await pause("rule");
      return result;
    },
  };
});

const { dropPosWorld, posIntegrationEnabled, pos, seedPosWorld, setModuleRow } =
  await import("./pos-integration-support");
type PosWorld = Awaited<ReturnType<typeof seedPosWorld>>;

let w: PosWorld;
beforeAll(async () => {
  w = await seedPosWorld("POS apagar");
}, 240_000);
afterAll(async () => {
  await dropPosWorld(w);
}, 240_000);

const businessId = () => w.seed.business.id;

async function moduleOn(moduleId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ enabled: businessModules.enabled })
    .from(businessModules)
    .where(
      and(
        eq(businessModules.businessId, businessId()),
        eq(businessModules.moduleId, moduleId),
      ),
    );
  return row?.enabled === true;
}

async function openCount(withTable = false): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(posOrders)
    .where(
      and(
        eq(posOrders.businessId, businessId()),
        eq(posOrders.status, "open"),
        withTable ? sql`${posOrders.diningTableId} is not null` : undefined,
      ),
    );
  return row.n;
}

/** Anula todas las abiertas por SQL (montaje entre casos). */
async function voidAll(): Promise<void> {
  await getDb()
    .update(posOrders)
    .set({
      status: "voided",
      closedAt: new Date(),
      closedByUserId: w.seed.userId,
    })
    .where(
      and(eq(posOrders.businessId, businessId()), eq(posOrders.status, "open")),
    );
}

async function newDiningTable(name: string): Promise<string> {
  const [row] = await getDb()
    .insert(diningTables)
    .values({ businessId: businessId(), locationId: w.seed.locationId, name })
    .returning({ id: diningTables.id });
  return row.id;
}

const create = (body: Record<string, unknown> = {}) =>
  pos.create(w.ownerCookie, { tableLabel: "Carrera", items: [], ...body });
const toggle = (moduleId: string, enabled: boolean) =>
  pos.setModule(w.ownerCookie, enabled, moduleId);

/** Hasta que la base muestre un advisory lock esperando, o `other` termine (≤ 8 s). */
async function untilBlockedOrDone(other: Promise<unknown>): Promise<void> {
  let done = false;
  void other.finally(() => (done = true));
  for (let i = 0; i < 40 && !done; i += 1) {
    const { rows } = await getDb().execute<{ n: number }>(
      sql`select count(*)::int as n from pg_locks where locktype = 'advisory' and not granted`,
    );
    if (rows[0].n > 0) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe.skipIf(!posIntegrationEnabled)(
  "apagar el POS y Mesas (spec 0220)",
  () => {
    it("POS con una orden abierta → 409 `pos_has_open_orders`; con Mesas encendido → 409 `module_required_by` ANTES", async () => {
      await setModuleRow(businessId(), "tables", false);
      expect((await create()).status).toBe(201);
      const blocked = await toggle("pos", false);
      expect(blocked.status).toBe(409);
      expect(await blocked.json()).toMatchObject({
        code: "pos_has_open_orders",
        openCount: 1,
      });

      await setModuleRow(businessId(), "tables", true);
      const required = await toggle("pos", false);
      expect(required.status).toBe(409);
      expect(await required.json()).toMatchObject({
        code: "module_required_by",
        dependents: ["tables"],
      });
      expect(await moduleOn("pos")).toBe(true);
      await voidAll();
    }, 120_000);

    it("Mesas con una orden abierta EN una mesa → 409 `tables_has_open_orders`; sin mesa, se apaga", async () => {
      await setModuleRow(businessId(), "tables", true);
      const table = await newDiningTable("Mesa apagar");
      expect((await create({ tableId: table })).status).toBe(201);
      expect((await create()).status).toBe(201);
      const blocked = await toggle("tables", false);
      expect(blocked.status).toBe(409);
      expect(await blocked.json()).toMatchObject({
        code: "tables_has_open_orders",
        openCount: 1,
      });
      expect(await moduleOn("tables")).toBe(true);

      await getDb()
        .update(posOrders)
        .set({
          status: "voided",
          closedAt: new Date(),
          closedByUserId: w.seed.userId,
        })
        .where(eq(posOrders.diningTableId, table));
      const off = await toggle("tables", false);
      expect(off.status).toBe(200);
      expect(await moduleOn("tables")).toBe(false);
      expect(await openCount()).toBe(1);
      await voidAll();
    }, 120_000);

    it("Mesas apagado: GET …/pos/tables `[]`, orden con mesa 422 `tables_disabled`, sin mesa 201; al reencender vuelven", async () => {
      await setModuleRow(businessId(), "tables", true);
      const table = await newDiningTable("Mesa guardada");
      await setModuleRow(businessId(), "tables", false);

      const listed = await pos.tables(w.ownerCookie, w.seed.locationId);
      expect(listed.status).toBe(200);
      expect(await listed.json()).toEqual({ tables: [] });
      const withTable = await create({ tableId: table });
      expect(withTable.status).toBe(422);
      expect(await withTable.json()).toMatchObject({ code: "tables_disabled" });
      expect((await create()).status).toBe(201);
      expect(await openCount(true)).toBe(0);

      await setModuleRow(businessId(), "tables", true);
      const back = await (
        await pos.tables(w.ownerCookie, w.seed.locationId)
      ).json();
      expect(back.tables.map((t: { id: string }) => t.id)).toContain(table);
      await voidAll();
    }, 120_000);

    it("CARRERA, apagar primero: el apagado tiene el lock; crear espera y despues ve el POS apagado (403)", async () => {
      await setModuleRow(businessId(), "tables", false);
      await setModuleRow(businessId(), "pos", true);
      const { latch: l, reached } = latch();
      h.rule = l;
      const off = toggle("pos", false);
      await reached; // la regla ya conto 0 abiertas y el toggle tiene el lock EXCLUSIVO
      const created = create();
      await untilBlockedOrDone(created);
      l.release();
      const [offRes, createdRes] = await Promise.all([off, created]);
      expect(offRes.status).toBe(200);
      expect(createdRes.status).toBe(403);
      expect(await createdRes.json()).toMatchObject({
        code: "module_disabled",
      });
      expect(await moduleOn("pos")).toBe(false);
      expect(await openCount()).toBe(0);
      await setModuleRow(businessId(), "pos", true);
    }, 120_000);

    it("CARRERA, crear primero: la apertura tiene el lock; el apagado espera, cuenta la orden y da 409", async () => {
      await setModuleRow(businessId(), "tables", false);
      await setModuleRow(businessId(), "pos", true);
      const { latch: l, reached } = latch();
      h.lock = l;
      const created = create();
      await reached; // la apertura ya releyo el POS con el lock COMPARTIDO tomado
      const off = toggle("pos", false);
      await untilBlockedOrDone(off);
      l.release();
      const [createdRes, offRes] = await Promise.all([created, off]);
      expect(createdRes.status).toBe(201);
      expect(offRes.status).toBe(409);
      expect(await offRes.json()).toMatchObject({
        code: "pos_has_open_orders",
      });
      expect(await moduleOn("pos")).toBe(true);
      expect(await openCount()).toBe(1);
      await voidAll();
    }, 120_000);

    it("el lock es COMPARTIDO: con una apertura en curso, otra apertura no espera", async () => {
      await setModuleRow(businessId(), "pos", true);
      const { latch: l, reached } = latch();
      h.lock = l;
      const first = create({ tableLabel: "Primera" });
      await reached;
      const second = await Promise.race([
        create({ tableLabel: "Segunda" }),
        new Promise<"esperando">((r) =>
          setTimeout(() => r("esperando"), 8_000),
        ),
      ]);
      l.release();
      expect(second === "esperando" ? second : second.status).toBe(201);
      expect((await first).status).toBe(201);
      await voidAll();
    }, 120_000);
  },
);
