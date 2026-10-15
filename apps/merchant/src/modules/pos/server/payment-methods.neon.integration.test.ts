import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { posPaymentMethodInitializations } from "@mi-pasaporte/db/schema";
import { eq } from "drizzle-orm";
import { callModuleRoute } from "../../modules-integration-support";
import { initializePaymentMethods } from "./payment-catalog";
import {
  dropPosWorld,
  pos,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
  type PosWorld,
} from "./pos-integration-support";
const ROOT = "/api/modules/pos";
let world: PosWorld, fallback: PosWorld;
const route = (
  method: Parameters<typeof callModuleRoute>[0],
  path: string,
  body?: unknown,
  cookie = world.ownerCookie,
) => callModuleRoute(method, `${ROOT}/${path}`, cookie, body);
beforeAll(async () => {
  world = await seedPosWorld("P1 medios EC");
  fallback = await seedPosWorld("P1 medios fallback", "CO", "COP");
}, 240_000);
afterAll(async () => {
  await dropPosWorld(world);
  await dropPosWorld(fallback);
}, 240_000);

describe.skipIf(!posIntegrationEnabled)("P1 medios comerciales reales", () => {
  it("Ecuador inicia seis sugerencias sin tasas; catálogo contiene Datalink opcional, sin Peigo", async () => {
    const listed = await (await route("GET", "payment-methods")).json();
    expect(listed.methods).toHaveLength(6);
    const cash = listed.methods.find((m: { isCash: boolean }) => m.isCash);
    expect(listed.defaultMethodId).toBe(cash.id);
    expect(cash).toMatchObject({
      name: "Efectivo",
      chargeShape: "none",
      status: "active",
    });
    const catalog = await (await route("GET", "payment-method-catalog")).json();
    expect(catalog).toMatchObject({ countryCode: "EC", source: "country" });
    expect(catalog.entries).toHaveLength(7);
    expect(catalog.entries).toContainEqual(
      expect.objectContaining({
        name: "Datalink",
        chargeShape: "fixed",
        initiallySuggested: false,
      }),
    );
    expect(JSON.stringify(catalog)).not.toMatch(
      /Peigo|percentValue|fixedAmount/,
    );
  }, 120_000);

  it("un país sin catálogo usa la base y congela su inicialización una vez", async () => {
    const response = await route(
      "GET",
      "payment-method-catalog",
      undefined,
      fallback.ownerCookie,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      countryCode: "CO",
      source: "base",
    });
    const initial = await route(
      "GET",
      "payment-methods",
      undefined,
      fallback.ownerCookie,
    );
    expect((await initial.json()).methods.length).toBeGreaterThan(0);
    const [marker] = await getDb()
      .select()
      .from(posPaymentMethodInitializations)
      .where(
        eq(
          posPaymentMethodInitializations.businessId,
          fallback.seed.business.id,
        ),
      );
    expect(marker).toMatchObject({ countryCode: "CO", source: "base" });
    await withDbTransaction((tx) =>
      initializePaymentMethods(tx, { businessId: fallback.seed.business.id }),
    );
    expect(
      await getDb()
        .select()
        .from(posPaymentMethodInitializations)
        .where(
          eq(
            posPaymentMethodInitializations.businessId,
            fallback.seed.business.id,
          ),
        ),
    ).toHaveLength(1);
  }, 120_000);

  it("alta de catálogo acepta UUID mayúscula; archivo idempotente y reactivar no lo resucita", async () => {
    const catalog = await (await route("GET", "payment-method-catalog")).json();
    const optional = catalog.entries.find(
      (m: { name: string }) => m.name === "Datalink",
    );
    const created = await route("POST", "payment-methods", {
      catalogId: ` ${optional.id.toUpperCase()} `,
    });
    expect(created.status).toBe(201);
    const { method } = await created.json();
    expect(
      (await route("POST", "payment-methods", { catalogId: optional.id }))
        .status,
    ).toBe(409);
    expect(
      (await route("POST", `payment-methods/${method.id}/archive`, {})).status,
    ).toBe(200);
    expect(
      (await route("POST", `payment-methods/${method.id}/archive`, {})).status,
    ).toBe(200);
    expect((await pos.setModule(world.ownerCookie, false)).status).toBe(200);
    expect((await pos.setModule(world.ownerCookie, true)).status).toBe(200);
    const active = await (await route("GET", "payment-methods")).json();
    expect(active.methods.some((m: { id: string }) => m.id === method.id)).toBe(
      false,
    );
    const all = await (await route("GET", "payment-methods?status=all")).json();
    expect(all.methods).toContainEqual(
      expect.objectContaining({ id: method.id, status: "archived" }),
    );
  }, 120_000);

  it("Efectivo se reutiliza y nunca se archiva; nombres libres únicos entre activos", async () => {
    const catalog = await (await route("GET", "payment-method-catalog")).json();
    const cash = catalog.entries.find((m: { isCash: boolean }) => m.isCash);
    const reused = await route("POST", "payment-methods", {
      catalogId: cash.id,
    });
    expect(reused.status).toBe(201);
    const { method } = await reused.json();
    const archive = await route(
      "POST",
      `payment-methods/${method.id}/archive`,
      {},
    );
    expect(archive.status).toBe(409);
    expect((await archive.json()).code).toBe("cash_required");
    const created = await route("POST", "payment-methods", {
      name: "  Medio libre  ",
      chargeShape: "percent_and_fixed",
    });
    expect(created.status).toBe(201);
    expect((await created.json()).method).toMatchObject({
      name: "Medio libre",
      isCash: false,
    });
    expect(
      (
        await route("POST", "payment-methods", {
          name: "MEDIO LIBRE",
          chargeShape: "none",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await route("POST", "payment-methods", {
          catalogId: cash.id,
          name: "Otro",
        })
      ).status,
    ).toBe(422);
  }, 120_000);

  it("tenant y permiso se aplican a lista/catálogo/archivo, con módulo apagado no hay acceso", async () => {
    const methods = await (await route("GET", "payment-methods")).json();
    const own = methods.methods.find((m: { isCash: boolean }) => !m.isCash);
    expect(
      (
        await route(
          "POST",
          `payment-methods/${own.id}/archive`,
          {},
          fallback.ownerCookie,
        )
      ).status,
    ).toBe(404);
    const staff = await posStaff(world, ["counter"]);
    for (const path of ["payment-methods", "payment-method-catalog"])
      expect((await route("GET", path, undefined, staff.cookie)).status).toBe(
        403,
      );
    await pos.setModule(world.ownerCookie, false);
    expect((await route("GET", "payment-methods")).status).toBe(403);
    await pos.setModule(world.ownerCookie, true);
  }, 120_000);
});
