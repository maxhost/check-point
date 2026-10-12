import { eq, sql } from "drizzle-orm";
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
 * Spec 0184 / 0206 — EL AJUSTE DEL TICKET contra Neon, por las rutas y con sesion real: defaults sin
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
  it("sin fila: owner y POS leen los defaults (impresion APAGADA, bloques prendidos) y no se crea fila", async () => {
    const defaults = {
      printingEnabled: false,
      showBusinessName: true,
      showTable: true,
    };
    const owner = await ticket.ownerRead(world.ownerCookie);
    expect(owner.status).toBe(200);
    expect(await owner.json()).toEqual(defaults);
    const posRes = await ticket.posRead(world.ownerCookie);
    expect(posRes.status).toBe(200);
    expect(await posRes.json()).toEqual(defaults);
    const rows = await getDb()
      .select()
      .from(ticketSettings)
      .where(eq(ticketSettings.businessId, world.seed.business.id));
    expect(rows).toHaveLength(0);
  }, 120_000);

  it("la columna es NOT NULL DEFAULT false (migracion 0072)", async () => {
    const [column] = (
      await getDb().execute<{ is_nullable: string; column_default: string }>(
        sql`SELECT is_nullable, column_default FROM information_schema.columns
            WHERE table_schema = 'core' AND table_name = 'ticket_settings'
              AND column_name = 'printing_enabled'`,
      )
    ).rows;
    expect(column).toEqual({ is_nullable: "NO", column_default: "false" });
  }, 120_000);

  it("PUT guarda y se lee por las dos rutas; ninguna opcion es obligatoria (todo false)", async () => {
    const off = {
      printingEnabled: false,
      showBusinessName: false,
      showTable: false,
    };
    const saved = await ticket.ownerSave(world.ownerCookie, off);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual(off);
    expect(await (await ticket.posRead(world.ownerCookie)).json()).toEqual(off);

    const on = {
      printingEnabled: true,
      showBusinessName: true,
      showTable: false,
    };
    expect(
      await (await ticket.ownerSave(world.ownerCookie, on)).json(),
    ).toEqual(on);
    expect(await (await ticket.posRead(world.ownerCookie)).json()).toEqual(on);
    const [row] = await getDb()
      .select()
      .from(ticketSettings)
      .where(eq(ticketSettings.businessId, world.seed.business.id));
    expect(row).toMatchObject(on);
  }, 120_000);

  it("apagar la impresion conserva los bloques guardados (leido por SQL)", async () => {
    await ticket.ownerSave(world.ownerCookie, {
      printingEnabled: true,
      showBusinessName: false,
      showTable: true,
    });
    await ticket.ownerSave(world.ownerCookie, {
      printingEnabled: false,
      showBusinessName: false,
      showTable: true,
    });
    const [row] = await getDb()
      .select()
      .from(ticketSettings)
      .where(eq(ticketSettings.businessId, world.seed.business.id));
    expect(row).toMatchObject({
      printingEnabled: false,
      showBusinessName: false,
      showTable: true,
    });
  }, 120_000);

  it("ORACULO DE M1 — aislamiento: lo que guarda A no cambia lo que lee B", async () => {
    const a = {
      printingEnabled: false,
      showBusinessName: false,
      showTable: false,
    };
    const b = {
      printingEnabled: true,
      showBusinessName: true,
      showTable: true,
    };
    await ticket.ownerSave(world.ownerCookie, a);
    await ticket.ownerSave(other.ownerCookie, b);
    await ticket.ownerSave(world.ownerCookie, a);
    expect(await (await ticket.ownerRead(other.ownerCookie)).json()).toEqual(b);
    expect(await (await ticket.posRead(other.ownerCookie)).json()).toEqual(b);
    expect(await (await ticket.posRead(world.ownerCookie)).json()).toEqual(a);
  }, 120_000);

  it("staff con `pos` lee por el POS pero no edita (403 `not_owner`); sin `pos` → 403 `missing_permission`", async () => {
    const mozo = await posStaff(world, ["pos"]);
    expect((await ticket.posRead(mozo.cookie)).status).toBe(200);
    const save = await ticket.ownerSave(mozo.cookie, {
      printingEnabled: true,
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
    const kept = {
      printingEnabled: true,
      showBusinessName: true,
      showTable: true,
    };
    await ticket.ownerSave(world.ownerCookie, kept);
    for (const body of [
      // Spec 0206: el cuerpo viejo de la 0184, sin `printingEnabled`, ya no alcanza.
      { showBusinessName: false, showTable: false },
      { printingEnabled: "no", showBusinessName: true, showTable: true },
      { printingEnabled: false, showTable: "si", showBusinessName: true },
      { printingEnabled: false, showBusinessName: false },
    ]) {
      const r = await ticket.ownerSave(world.ownerCookie, body);
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe("invalid_input");
    }
    expect(await (await ticket.ownerRead(world.ownerCookie)).json()).toEqual(
      kept,
    );
  }, 120_000);

  it("sin sesion → 401 en las tres", async () => {
    for (const r of [
      await ticket.ownerRead(""),
      await ticket.ownerSave("", {
        printingEnabled: true,
        showBusinessName: true,
        showTable: true,
      }),
      await ticket.posRead(""),
    ])
      expect(r.status).toBe(401);
  }, 120_000);
});
