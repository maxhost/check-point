import { inArray } from "drizzle-orm";
import { consumerAccounts, users, sessions } from "@mi-pasaporte/db/schema";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businessModules,
  diningTables,
  posOrders,
} from "@mi-pasaporte/db/schema";

/**
 * Spec 0220 / ADR 0141 §4 y §5 — LA CARRERA «abrir una orden CON MESA» vs «apagar Mesas», contra Neon
 * con sesion real. Invariante: nunca queda una orden `open` con mesa con Mesas apagado. Lo que lo
 * sostiene es que la apertura relee Mesas bajo el lock compartido del toggle (`lockTablesEnabled`,
 * `tables.ts`); el lock del POS solo no alcanza: espera al apagado, pero despues no mira Mesas.
 * (Separado de `pos-disable.neon.integration.test.ts` por el limite del hook `file-size`.)
 *
 * Se dobla el MOMENTO, no el resultado: la regla real de Mesas (via `server-registry`, sin importar
 * codigo de Mesas: el POS solo lo nombra, regla 7) y `lockModuleEnabled` real, con un pestillo que
 * los deja esperando DESPUES de hacer su trabajo.
 */

type Latch = {
  armed: boolean;
  reached: () => void;
  wait: Promise<void>;
  release: () => void;
};

const h = vi.hoisted(() => ({
  tablesLock: null as null | Latch,
  tablesRule: null as null | Latch,
}));

function latch(): { latch: Latch; reached: Promise<void> } {
  let reached!: () => void;
  let release!: () => void;
  const reachedP = new Promise<void>((r) => (reached = r));
  const wait = new Promise<void>((r) => (release = r));
  return { latch: { armed: true, reached, wait, release }, reached: reachedP };
}

async function pause(slot: "tablesLock" | "tablesRule"): Promise<void> {
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
      if (args[2] === "tables") await pause("tablesLock");
    },
  };
});

const {
  dropPosWorld,
  posIntegrationEnabled,
  pos,
  capturePosScope,
  scopedPos,
  seedPosWorld,
  setModuleRow,
} = await import("./pos-integration-support");
type PosWorld = Awaited<ReturnType<typeof seedPosWorld>>;

const { SERVER_MODULES } = await import("../../server-registry");
const { moduleLockKey } = await import("../../guard");

let w: PosWorld;
let scope: string;
beforeAll(async () => {
  // Spy on the live registry entry after loading it. Replacing the registry during
  // its activation/routes import cycle can leave the toggle with another object.
  const real = SERVER_MODULES.tables.beforeDisable!;
  vi.spyOn(SERVER_MODULES.tables, "beforeDisable").mockImplementation(
    async (...args) => {
      const result = await real(...args);
      await pause("tablesRule");
      return result;
    },
  );
  w = await seedPosWorld("POS apagar Mesas");
  scope = await capturePosScope(w.ownerCookie, w.seed.business.id);
}, 240_000);
afterAll(async () => {
  await dropPosWorld(w);
  await retireFixtureIdentities([w], []);
  vi.restoreAllMocks();
}, 240_000);

const businessId = () => w.seed.business.id;

async function tablesOn(): Promise<boolean> {
  const [row] = await getDb()
    .select({ enabled: businessModules.enabled })
    .from(businessModules)
    .where(
      and(
        eq(businessModules.businessId, businessId()),
        eq(businessModules.moduleId, "tables"),
      ),
    );
  return row?.enabled === true;
}

async function openWithTable(): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(posOrders)
    .where(
      and(
        eq(posOrders.businessId, businessId()),
        eq(posOrders.status, "open"),
        sql`${posOrders.diningTableId} is not null`,
      ),
    );
  return row.n;
}

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

/** Hasta que la base muestre un advisory lock esperando, o `other` termine (≤ 8 s). */
async function untilBlockedOrDone(other: Promise<unknown>): Promise<boolean> {
  let done = false;
  void other.then(
    () => (done = true),
    () => (done = true),
  );
  const key = moduleLockKey(businessId());
  for (let i = 0; i < 40 && !done; i += 1) {
    const { rows } = await getDb().execute<{ n: number }>(
      sql`select count(*)::int as n from pg_locks where locktype = 'advisory' and not granted
        and classid::bigint = ((hashtextextended(${key},0) >> 32) & 4294967295)
        and objid::bigint = (hashtextextended(${key},0) & 4294967295)`,
    );
    if (rows[0].n > 0) return !done;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([
    p.then(() => "llego" as const),
    new Promise<"no llego">((r) => setTimeout(() => r("no llego"), ms)),
  ]);

describe.skipIf(!posIntegrationEnabled)(
  "carrera: orden con mesa vs apagar Mesas (spec 0220)",
  () => {
    it("apagar Mesas primero: la apertura con mesa espera y despues ve Mesas apagado (422 `tables_disabled`)", async () => {
      await setModuleRow(businessId(), "tables", true);
      const table = await newDiningTable("Mesa carrera A");
      const { latch: l, reached } = latch();
      h.tablesRule = l;
      const off = pos.setModule(w.ownerCookie, false, "tables");
      let created: Promise<Response> | undefined;
      try {
        expect(await withTimeout(reached, 8_000)).toBe("llego");
        // The real rule has counted zero orders under the exclusive lock.
        created = scopedPos(w.ownerCookie, scope).create({
          createRequestId: randomUUID(),
          saleType: "table",
          orderLabel: "Mesa",
          locationId: null,
          tableId: table,
          note: null,
          items: [],
        });
        expect(await untilBlockedOrDone(created)).toBe(true);
        l.release();
        const [offRes, createdRes] = await Promise.all([off, created]);
        expect(offRes.status).toBe(200);
        expect(createdRes.status).toBe(422);
        expect(await createdRes.json()).toMatchObject({
          code: "tables_disabled",
        });
        expect(await tablesOn()).toBe(false);
        expect(await openWithTable()).toBe(0);
      } finally {
        l.release();
        await Promise.allSettled([off, ...(created ? [created] : [])]);
      }
      await voidAll();
    }, 120_000);

    it("abrir con mesa primero: relee Mesas con el lock tomado; el apagado espera, cuenta la orden y da 409", async () => {
      await setModuleRow(businessId(), "tables", true);
      const table = await newDiningTable("Mesa carrera B");
      const { latch: l, reached } = latch();
      h.tablesLock = l;
      const created = scopedPos(w.ownerCookie, scope).create({
        createRequestId: randomUUID(),
        saleType: "table",
        orderLabel: "Mesa",
        locationId: null,
        tableId: table,
        note: null,
        items: [],
      });
      let off: Promise<Response> | undefined;
      try {
        // Cableado: la apertura con mesa TIENE que releer Mesas bajo el lock (`lockTablesEnabled`).
        expect(await withTimeout(reached, 8_000)).toBe("llego");
        off = pos.setModule(w.ownerCookie, false, "tables");
        expect(await untilBlockedOrDone(off)).toBe(true);
        l.release();
        const [createdRes, offRes] = await Promise.all([created, off]);
        expect(createdRes.status).toBe(201);
        expect(offRes.status).toBe(409);
        expect(await offRes.json()).toMatchObject({
          code: "tables_has_open_orders",
        });
        expect(await tablesOn()).toBe(true);
        expect(await openWithTable()).toBe(1);
      } finally {
        l.release();
        await Promise.allSettled([created, ...(off ? [off] : [])]);
      }
      await voidAll();
    }, 120_000);
  },
);

/** Retire only identities created by these fixtures, after their business roots are gone. */
async function retireFixtureIdentities(
  targets: { seed: { userId: string }; extraUsers: string[] }[],
  consumers: string[] = [],
) {
  if (consumers.length) {
    await getDb()
      .delete(consumerAccounts)
      .where(inArray(consumerAccounts.id, consumers));
    expect(
      await getDb()
        .select({ id: consumerAccounts.id })
        .from(consumerAccounts)
        .where(inArray(consumerAccounts.id, consumers)),
    ).toEqual([]);
  }
  const owners = targets.flatMap((target) => [
    target.seed.userId,
    ...target.extraUsers,
  ]);
  if (owners.length) {
    await getDb().delete(users).where(inArray(users.id, owners));
    expect(
      await getDb()
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, owners)),
    ).toEqual([]);
    expect(
      await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(inArray(sessions.userId, owners)),
    ).toEqual([]);
  }
}
