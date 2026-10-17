import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { businessModules } from "@mi-pasaporte/db/schema";
import { callModuleRoute } from "../../modules-integration-support";
import { posIntegrationEnabled, posStaff } from "./pos-integration-support";
import { world, setupBusinessWorld } from "./business-core-support";
const old = (
  module: string,
  path: string,
  method: "GET" | "POST" | "PUT" = "GET",
  body?: unknown,
  cookie = world.ownerCookie,
) => callModuleRoute(method, `/api/modules/${module}/${path}`, cookie, body);
const legacy = [
  ["pos", "payment-method-catalog", "GET"],
  ["pos", "payment-methods", "POST"],
  ["pos", `payment-methods/${randomUUID()}/archive`, "POST"],
  ["profitability", "commissions", "GET"],
  ["profitability", `commissions/${randomUUID()}`, "PUT"],
  ["profitability", `sale-commissions/${randomUUID()}`, "GET"],
] as const;
describe.skipIf(!posIntegrationEnabled)(
  "0235 temporary administration bridge",
  () => {
    setupBusinessWorld();
    beforeAll(async () => {
      await getDb().insert(businessModules).values({
        businessId: world.seed.business.id,
        moduleId: "profitability",
        enabled: true,
      });
    }, 120000);
    it("old POS administration delegates to core and preserves IDs", async () => {
      expect((await old("pos", "payment-method-catalog")).status).toBe(200);
      const created = await old("pos", "payment-methods", "POST", {
        name: "Bridge method",
        chargeShape: "percent",
      });
      expect(created.status).toBe(201);
      const { method } = await created.json();
      const listed = await (await old("pos", "payment-methods")).json();
      expect(listed.methods).toContainEqual(
        expect.objectContaining({ id: method.id }),
      );
      expect(
        listed.methods.find((m: { id: string }) => m.id === method.id),
      ).not.toHaveProperty("commission");
      expect(
        (await old("pos", `payment-methods/${method.id}/archive`, "POST", {}))
          .status,
      ).toBe(200);
    }, 120000);
    it("old commission routes delegate configuration and sale reads to core", async () => {
      const listed = await old("profitability", "commissions");
      expect(listed.status).toBe(200);
      const { methods } = await listed.json();
      const method = methods.find(
        (m: { chargeShape: string }) => m.chargeShape === "percent",
      );
      expect(
        (
          await old("profitability", `commissions/${method.methodId}`, "PUT", {
            expectedRevisionId: method.revisionId,
            percent: "2",
          })
        ).status,
      ).toBe(200);
      const missing = await old(
        "profitability",
        `sale-commissions/${randomUUID()}?locationId=${world.seed.locationId}`,
      );
      expect(missing.status).toBe(404);
      expect(await missing.json()).toMatchObject({ code: "sale_not_found" });
    }, 120000);
    it("POS-only and brand-only staff cannot administer via any old route", async () => {
      for (const permissions of [["pos"], ["brand"]]) {
        const staff = await posStaff(world, permissions);
        for (const [module, path, method] of legacy)
          expect(
            (
              await old(
                module,
                path,
                method,
                method === "GET" ? undefined : {},
                staff.cookie,
              )
            ).status,
          ).toBe(403);
      }
    }, 120000);
    it("business staff can use old administration without a module permission", async () => {
      const staff = await posStaff(world, ["business"]);
      expect(
        (
          await old(
            "pos",
            "payment-method-catalog",
            "GET",
            undefined,
            staff.cookie,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await old(
            "profitability",
            "commissions",
            "GET",
            undefined,
            staff.cookie,
          )
        ).status,
      ).toBe(200);
      expect(
        (await old("pos", "payment-methods", "GET", undefined, staff.cookie))
          .status,
      ).toBe(403);
    }, 120000);
    it("cash protection and foreign IDs remain core errors through the bridge", async () => {
      const { methods } = await (await old("pos", "payment-methods")).json();
      const cash = methods.find((m: { isCash: boolean }) => m.isCash);
      expect(
        (await old("pos", `payment-methods/${cash.id}/archive`, "POST", {}))
          .status,
      ).toBe(409);
      const missing = await old(
        "pos",
        `payment-methods/${randomUUID()}/archive`,
        "POST",
        {},
      );
      expect(missing.status).toBe(404);
    }, 120000);
  },
);
