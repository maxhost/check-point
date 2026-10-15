import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses } from "@mi-pasaporte/db/schema";
import {
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  moduleStaff,
  modulesIntegrationEnabled,
  seedModuleWorld,
  type ModuleWorld,
} from "../modules-integration-support";
import { person, secondLocation } from "./test-support";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0231 actual money permission and private staff DTO",
  { timeout: 90000 },
  () => {
    let world: ModuleWorld, second: string, personId: string;
    const input = (locationId: string, monthlyTotal: string) => ({
      kind: "rent",
      label: "Alquiler",
      locationId,
      monthlyTotal,
      fromMonth: "2026-01",
      untilMonth: null,
    });
    beforeAll(async () => {
      world = await seedModuleWorld("profitability-access");
      await enableModules(world, ["profitability"]);
      second = await secondLocation(world);
      personId = await person(world);
    });
    afterAll(async () => {
      await dropModuleWorld(world);
    });
    it("requires only Rentabilidad for money, refuses staff-only, and exposes no auth metadata", async () => {
      const money = await moduleStaff(world, ["profitability"]);
      const staff = await moduleStaff(world, ["staff", "locations"]);
      for (const path of [
        "locations",
        "people?month=2026-02",
        "totals?month=2026-02",
      ]) {
        expect(
          (
            await callModuleRoute(
              "GET",
              `/api/modules/profitability/${path}`,
              money,
            )
          ).status,
        ).toBe(200);
        const denied = await callModuleRoute(
          "GET",
          `/api/modules/profitability/${path}`,
          staff,
        );
        expect(denied.status).toBe(403);
        expect((await denied.json()).code).toBe("missing_permission");
      }
      expect(
        (
          await callModuleRoute(
            "POST",
            "/api/modules/profitability/costs",
            staff,
            input(second, "1.00"),
          )
        ).status,
      ).toBe(403);
      const created = await callModuleRoute(
        "POST",
        "/api/modules/profitability/costs",
        money,
        input(second, "10.00"),
      );
      expect(created.status).toBe(201);
      const cost = (await created.json()).cost;
      const updated = await callModuleRoute(
        "PUT",
        `/api/modules/profitability/costs/${cost.id}/period`,
        money,
        {
          expectedRevision: cost.revision,
          label: "Alquiler corregido",
          locationId: second,
          monthlyTotal: "12.00",
          fromMonth: "2026-02",
          untilMonth: "2026-03",
        },
      );
      expect(updated.status).toBe(200);
      const revision = (await updated.json()).cost.revision;
      expect(
        (
          await callModuleRoute(
            "GET",
            `/api/modules/profitability/costs/${cost.id}?month=2026-02`,
            money,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await callModuleRoute(
            "POST",
            `/api/modules/profitability/costs/${cost.id}/stop`,
            money,
            { expectedRevision: revision, endMonth: "2026-03" },
          )
        ).status,
      ).toBe(200);
      const people = await (
        await callModuleRoute(
          "GET",
          "/api/modules/profitability/people?month=2026-02",
          money,
        )
      ).json();
      expect(
        people.people.find((p: { id: string }) => p.id === personId),
      ).toEqual({
        id: personId,
        name: "Personal sin acceso",
        accessState: "none",
        locationsConfigured: true,
        locationIds: [world.locationId],
      });
      expect(JSON.stringify(people)).not.toMatch(
        /permissions|handle|identifier|pin|monthly/,
      );
      expect(
        (
          await callModuleRoute(
            "GET",
            "/api/modules/profitability/totals?month=2026-02",
            "",
          )
        ).status,
      ).toBe(401);
      await getDb()
        .update(businesses)
        .set({ currencyCode: "COP" })
        .where(eq(businesses.id, world.businessId));
      const invalid = await callModuleRoute(
        "POST",
        "/api/modules/profitability/costs",
        money,
        input(second, "0.25"),
      );
      expect(invalid.status).toBe(422);
      expect((await invalid.json()).code).toBe("invalid_amount");
      await getDb()
        .update(businesses)
        .set({ currencyCode: "USD" })
        .where(eq(businesses.id, world.businessId));
    });
  },
);
