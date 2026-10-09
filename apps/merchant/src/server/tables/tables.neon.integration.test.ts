import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { diningTables, posOrders } from "@mi-pasaporte/db/schema";
import {
  type PosWorld,
  dropPosWorld,
  pos,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
} from "../pos/pos-integration-support";
import { newTable, tables } from "./tables-integration-support";

/**
 * Spec 0182 — LAS MESAS contra Neon, por las rutas y con sesion real: gestion con el permiso
 * `locations` (aislamiento, nombre repetido, archivar con orden abierta) y el POS con mesa
 * (nombre fotografiado, local derivado, una orden abierta por mesa). Lo que pesa se lee por SQL.
 */

let world: PosWorld;
let other: PosWorld;

beforeAll(async () => {
  world = await seedPosWorld("Mesas");
  other = await seedPosWorld("Mesas ajeno");
}, 240_000);

afterAll(async () => {
  await dropPosWorld(world);
  await dropPosWorld(other);
}, 240_000);

describe.skipIf(!posIntegrationEnabled)("Mesas del local (spec 0182)", () => {
  it("crear, listar y editar: forma del DTO, plazas opcionales y orden al final", async () => {
    const a = await tables.create(world.ownerCookie, world.seed.locationId, {
      name: "  Mesa 1 ",
      seats: 4,
    });
    expect(a.status).toBe(201);
    const first = (await a.json()).table;
    expect(first).toEqual({
      id: first.id,
      locationId: world.seed.locationId,
      name: "Mesa 1",
      seats: 4,
      sortOrder: 0,
      status: "active",
    });
    const barra = await newTable(world, "Barra");
    expect(barra).toMatchObject({ seats: null, sortOrder: 1 });

    const patched = await tables.update(
      world.ownerCookie,
      world.seed.locationId,
      first.id,
      { seats: null, sortOrder: 5 },
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).table).toMatchObject({
      seats: null,
      sortOrder: 5,
    });

    const listed = await tables.list(world.ownerCookie, world.seed.locationId);
    const names = (await listed.json()).tables.map(
      (t: { name: string }) => t.name,
    );
    expect(names.indexOf("Barra")).toBeLessThan(names.indexOf("Mesa 1"));
  }, 120_000);

  it("validacion: nombre vacio, plazas fuera de rango y PATCH vacio son 422 `invalid_input`", async () => {
    const t = await newTable(world, "Validar");
    for (const body of [{ name: "  " }, { name: "X", seats: 0 }]) {
      const r = await tables.create(
        world.ownerCookie,
        world.seed.locationId,
        body,
      );
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe("invalid_input");
    }
    const r = await tables.update(
      world.ownerCookie,
      world.seed.locationId,
      t.id,
      {},
    );
    expect(r.status).toBe(422);
  }, 120_000);

  it("nombre repetido entre las activas → 409; archivada no bloquea; reactivar con nombre ocupado → 409", async () => {
    const t = await newTable(world, "Terraza 1");
    const dup = await tables.create(world.ownerCookie, world.seed.locationId, {
      name: "terraza 1",
    });
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("table_name_taken");

    expect(
      (
        await tables.status(
          world.ownerCookie,
          world.seed.locationId,
          t.id,
          "archived",
        )
      ).status,
    ).toBe(200);
    await newTable(world, "Terraza 1");
    const back = await tables.status(
      world.ownerCookie,
      world.seed.locationId,
      t.id,
      "active",
    );
    expect(back.status).toBe(409);
    expect((await back.json()).code).toBe("table_name_taken");
  }, 120_000);

  it("aislamiento: el local y la mesa de OTRO negocio son 404, sin escribir nada", async () => {
    const foreign = await newTable(other, "Ajena");
    const r1 = await tables.list(world.ownerCookie, other.seed.locationId);
    expect(r1.status).toBe(404);
    expect((await r1.json()).code).toBe("unknown_location");
    const r2 = await tables.update(
      world.ownerCookie,
      world.seed.locationId,
      foreign.id,
      { name: "Robada" },
    );
    expect(r2.status).toBe(404);
    expect((await r2.json()).code).toBe("unknown_table");
    const [row] = await getDb()
      .select({ name: diningTables.name })
      .from(diningTables)
      .where(eq(diningTables.id, foreign.id));
    expect(row.name).toBe("Ajena");
  }, 120_000);

  it("staff sin `locations` no administra mesas (403)", async () => {
    const staff = await posStaff(world, ["pos"]);
    const r = await tables.create(staff.cookie, world.seed.locationId, {
      name: "Sin permiso",
    });
    expect(r.status).toBe(403);
  }, 120_000);

  it("POS: orden con mesa fotografia el nombre, deriva el local, ocupa la mesa y la libera al anular", async () => {
    const t = await newTable(world, "Mesa POS", 2);
    const created = await pos.create(world.ownerCookie, {
      tableId: t.id,
      tableLabel: "ignorado",
      items: [],
    });
    expect(created.status).toBe(201);
    const order = await created.json();
    expect(order).toMatchObject({
      tableId: t.id,
      tableLabel: "Mesa POS",
      location: { id: world.seed.locationId },
    });

    const busy = await pos.create(world.ownerCookie, {
      tableId: t.id,
      items: [],
    });
    expect(busy.status).toBe(409);
    expect((await busy.json()).code).toBe("table_occupied");

    const listed = await (
      await tables.pos(world.ownerCookie, world.seed.locationId)
    ).json();
    expect(
      listed.tables.find((x: { id: string }) => x.id === t.id),
    ).toMatchObject({ seats: 2, openOrderId: order.id });

    const archive = await tables.status(
      world.ownerCookie,
      world.seed.locationId,
      t.id,
      "archived",
    );
    expect(archive.status).toBe(409);
    expect((await archive.json()).code).toBe("table_has_open_order");

    expect((await pos.void(world.ownerCookie, order.id)).status).toBe(200);
    const again = await pos.create(world.ownerCookie, {
      tableId: t.id,
      items: [],
    });
    expect(again.status).toBe(201);
    const [row] = await getDb()
      .select({ table: posOrders.diningTableId })
      .from(posOrders)
      .where(eq(posOrders.id, (await again.json()).id));
    expect(row.table).toBe(t.id);
  }, 120_000);

  it("POS: mover una orden a una mesa ocupada → 409; quitar la mesa vuelve a texto libre", async () => {
    const a = await newTable(world, "Mover A");
    const b = await newTable(world, "Mover B");
    const onA = await (
      await pos.create(world.ownerCookie, { tableId: a.id, items: [] })
    ).json();
    const onB = await (
      await pos.create(world.ownerCookie, { tableId: b.id, items: [] })
    ).json();

    const move = await pos.update(world.ownerCookie, onB.id, {
      version: onB.version,
      tableId: a.id,
      items: [],
    });
    expect(move.status).toBe(409);
    expect((await move.json()).code).toBe("table_occupied");

    const free = await pos.update(world.ownerCookie, onA.id, {
      version: onA.version,
      tableId: null,
      tableLabel: "Para llevar",
      items: [],
    });
    expect(free.status).toBe(200);
    expect(await free.json()).toMatchObject({
      tableId: null,
      tableLabel: "Para llevar",
    });
    const moved = await pos.update(world.ownerCookie, onB.id, {
      version: onB.version,
      tableId: a.id,
      items: [],
    });
    expect(moved.status).toBe(200);
    expect(await moved.json()).toMatchObject({
      tableId: a.id,
      tableLabel: "Mover A",
    });
  }, 120_000);

  it("ORACULO DE M1 — POS: la mesa de OTRO negocio es 422 `unknown_table`; local distinto al de la mesa es 422", async () => {
    const foreign = await newTable(other, "Ajena POS");
    const r = await pos.create(world.ownerCookie, {
      tableId: foreign.id,
      items: [],
    });
    expect(r.status).toBe(422);
    expect((await r.json()).code).toBe("unknown_table");

    const mine = await newTable(world, "Mesa local");
    const mismatch = await pos.create(world.ownerCookie, {
      tableId: mine.id,
      locationId: other.seed.locationId,
      items: [],
    });
    expect(mismatch.status).toBe(422);
    expect((await mismatch.json()).code).toBe("table_location_mismatch");
  }, 120_000);

  it("POS sin mesa sigue como antes (texto libre, `tableId: null`)", async () => {
    const r = await pos.create(world.ownerCookie, {
      tableLabel: "Mesa libre",
      locationId: world.seed.locationId,
      items: [],
    });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({
      tableId: null,
      tableLabel: "Mesa libre",
    });
  }, 120_000);
});
