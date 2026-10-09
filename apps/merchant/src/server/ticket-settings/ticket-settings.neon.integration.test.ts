import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { ticketSettings } from "@mi-pasaporte/db/schema";
import { conCookie } from "../permissions-integration-support";
import {
  type PosWorld,
  dropPosWorld,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
  setPosModule,
} from "../pos/pos-integration-support";
import {
  GET as OWNER_READ,
  PUT as OWNER_SAVE,
} from "../../app/api/merchant/business/ticket/route";
import { GET as POS_READ } from "../../app/api/pos/ticket/route";

/**
 * Spec 0184 — EL AJUSTE DEL TICKET contra Neon, por las rutas y con sesion real: defaults sin
 * fila, guardar y leer (owner y POS), ninguna opcion obligatoria, aislamiento entre comercios,
 * quien puede y validacion. Lo que pesa se lee por SQL.
 */

const ticket = {
  ownerRead: (cookie: string) =>
    OWNER_READ(conCookie("/api/merchant/business/ticket", "GET", cookie)),
  ownerSave: (cookie: string, body: unknown) =>
    OWNER_SAVE(conCookie("/api/merchant/business/ticket", "PUT", cookie, body)),
  posRead: (cookie: string) =>
    POS_READ(conCookie("/api/pos/ticket", "GET", cookie)),
};

let world: PosWorld;
let other: PosWorld;

beforeAll(async () => {
  world = await seedPosWorld("Ticket");
  other = await seedPosWorld("Ticket ajeno");
}, 240_000);

afterAll(async () => {
  await dropPosWorld(world);
  await dropPosWorld(other);
}, 240_000);

describe.skipIf(!posIntegrationEnabled)("Ajuste del ticket (spec 0184)", () => {
  it("sin fila: owner y POS leen los defaults (los dos bloques prendidos) y no se crea fila", async () => {
    const owner = await ticket.ownerRead(world.ownerCookie);
    expect(owner.status).toBe(200);
    expect(await owner.json()).toEqual({ showBusinessName: true, showTable: true });
    const posRes = await ticket.posRead(world.ownerCookie);
    expect(posRes.status).toBe(200);
    expect(await posRes.json()).toEqual({ showBusinessName: true, showTable: true });
    const rows = await getDb()
      .select()
      .from(ticketSettings)
      .where(eq(ticketSettings.businessId, world.seed.business.id));
    expect(rows).toHaveLength(0);
  }, 120_000);

  it("PUT guarda y se lee por las dos rutas; ninguna opcion es obligatoria (false/false)", async () => {
    const off = await ticket.ownerSave(world.ownerCookie, {
      showBusinessName: false,
      showTable: false,
    });
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({ showBusinessName: false, showTable: false });
    expect(await (await ticket.posRead(world.ownerCookie)).json()).toEqual({
      showBusinessName: false,
      showTable: false,
    });

    const mixed = await ticket.ownerSave(world.ownerCookie, {
      showBusinessName: true,
      showTable: false,
    });
    expect(await mixed.json()).toEqual({ showBusinessName: true, showTable: false });
    const [row] = await getDb()
      .select()
      .from(ticketSettings)
      .where(eq(ticketSettings.businessId, world.seed.business.id));
    expect(row).toMatchObject({ showBusinessName: true, showTable: false });
  }, 120_000);

  it("ORACULO DE M1 — aislamiento: lo que guarda A no cambia lo que lee B", async () => {
    await ticket.ownerSave(world.ownerCookie, {
      showBusinessName: false,
      showTable: false,
    });
    await ticket.ownerSave(other.ownerCookie, {
      showBusinessName: true,
      showTable: true,
    });
    await ticket.ownerSave(world.ownerCookie, {
      showBusinessName: false,
      showTable: false,
    });
    expect(await (await ticket.ownerRead(other.ownerCookie)).json()).toEqual({
      showBusinessName: true,
      showTable: true,
    });
    expect(await (await ticket.posRead(other.ownerCookie)).json()).toEqual({
      showBusinessName: true,
      showTable: true,
    });
    expect(await (await ticket.posRead(world.ownerCookie)).json()).toEqual({
      showBusinessName: false,
      showTable: false,
    });
  }, 120_000);

  it("staff con `pos` lee por el POS pero no edita (403 `not_owner`); sin `pos` → 403 `missing_permission`", async () => {
    const mozo = await posStaff(world, ["pos"]);
    expect((await ticket.posRead(mozo.cookie)).status).toBe(200);
    const save = await ticket.ownerSave(mozo.cookie, {
      showBusinessName: true,
      showTable: true,
    });
    expect(save.status).toBe(403);
    expect((await save.json()).code).toBe("not_owner");

    const otro = await posStaff(world, ["counter"]);
    const read = await ticket.posRead(otro.cookie);
    expect(read.status).toBe(403);
    expect((await read.json()).code).toBe("missing_permission");
  }, 120_000);

  it("POS apagado → 403 `pos_disabled` en la ruta del POS; el owner sigue editando su ajuste", async () => {
    await setPosModule(world.seed.business.id, false);
    try {
      const read = await ticket.posRead(world.ownerCookie);
      expect(read.status).toBe(403);
      expect((await read.json()).code).toBe("pos_disabled");
      expect((await ticket.ownerRead(world.ownerCookie)).status).toBe(200);
    } finally {
      await setPosModule(world.seed.business.id, true);
    }
  }, 120_000);

  it("validacion: campo faltante o no booleano → 422 `invalid_input`, sin escribir", async () => {
    await ticket.ownerSave(world.ownerCookie, {
      showBusinessName: true,
      showTable: true,
    });
    for (const body of [
      { showTable: "si", showBusinessName: true },
      { showBusinessName: false },
    ]) {
      const r = await ticket.ownerSave(world.ownerCookie, body);
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe("invalid_input");
    }
    expect(await (await ticket.ownerRead(world.ownerCookie)).json()).toEqual({
      showBusinessName: true,
      showTable: true,
    });
  }, 120_000);

  it("sin sesion → 401 en las tres", async () => {
    for (const r of [
      await ticket.ownerRead(""),
      await ticket.ownerSave("", { showBusinessName: true, showTable: true }),
      await ticket.posRead(""),
    ])
      expect(r.status).toBe(401);
  }, 120_000);
});
