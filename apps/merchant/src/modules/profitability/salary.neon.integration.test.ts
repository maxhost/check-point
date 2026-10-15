import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { businessModules, staffLocationPeriods } from "@mi-pasaporte/db/schema";
import { lockStaffPerson } from "../../server/staff-location-timeline";
import {
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  seedModuleWorld,
  type ModuleWorld,
} from "../modules-integration-support";
import { SERVER_MODULES } from "../server-registry";
import { createCost, editCost, stopCost } from "./server/writers";
import { getCost } from "./server/queries";
import { totals } from "./server/totals";
import { changeLocations, person, secondLocation } from "./test-support";

const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0231 salary location callback: snapshots, transaction and concurrency",
  { timeout: 90000 },
  () => {
    let world: ModuleWorld, second: string;
    beforeAll(async () => {
      world = await seedModuleWorld("profitability-salary");
      await enableModules(world, ["profitability"]);
      second = await secondLocation(world);
    });
    afterAll(async () => {
      await dropModuleWorld(world);
    });
    const salary = async () => {
      const personId = await person(world);
      let cost = await createCost(world.businessId, {
        kind: "personnel",
        personId,
        label: "Sueldo total",
        monthlyTotal: "100.00",
        fromMonth: "2026-01",
        untilMonth: null,
      });
      cost = await editCost(world.businessId, cost.id, {
        expectedRevision: cost.revision,
        label: "Sueldo con aumento",
        monthlyTotal: "200.00",
        fromMonth: "2026-06",
        untilMonth: null,
      });
      return { personId, cost };
    };

    it("synchronously persists exact splits even OFF, preserving previous months and future raises", async () => {
      const { personId, cost } = await salary();
      await getDb()
        .update(businessModules)
        .set({ enabled: false })
        .where(
          and(
            eq(businessModules.businessId, world.businessId),
            eq(businessModules.moduleId, "profitability"),
          ),
        );
      await changeLocations(world, personId, "2026-03-01", [
        second,
        world.locationId,
      ]);
      const february = await getCost(world.businessId, cost.id, "2026-02");
      expect(february.periods[0].allocations).toEqual([
        { locationId: world.locationId, monthlyAmount: "100.00" },
      ]);
      const march = await getCost(world.businessId, cost.id, "2026-03");
      expect(march.periods[0].monthlyTotal).toBe("100.00");
      expect(march.periods[0].allocations.map((a) => a.monthlyAmount)).toEqual([
        "50.00",
        "50.00",
      ]);
      const june = await getCost(world.businessId, cost.id, "2026-06");
      expect(june.periods[0].monthlyTotal).toBe("200.00");
      expect(june.periods[0].allocations.map((a) => a.monthlyAmount)).toEqual([
        "100.00",
        "100.00",
      ]);
      expect(
        (
          await callModuleRoute(
            "GET",
            "/api/modules/profitability/totals?month=2026-03",
            world.cookie,
          )
        ).status,
      ).toBe(403);
      await withDbTransaction(async (tx) => {
        await lockStaffPerson(tx, world.businessId, personId);
        await SERVER_MODULES.profitability.staffLocationsChanged!(tx, {
          businessId: world.businessId,
          personId,
          fromMonth: "2026-03-01",
          untilMonth: null,
          locationIds: [world.locationId, second],
        });
      });
      expect(
        (await getCost(world.businessId, cost.id, "2026-06")).revision,
      ).toBe(june.revision);
      await enableModules(world, ["profitability"]);
      expect((await totals(world.businessId, "2026-06")).totals[0].total).toBe(
        "200.00",
      );
      const stopped = await stopCost(world.businessId, cost.id, {
        expectedRevision: june.revision,
        endMonth: "2026-07",
      });
      expect(stopped.endMonth).toBe("2026-07");
      expect((await totals(world.businessId, "2026-07")).totals[0].total).toBe(
        "0.00",
      );
    });

    it("rolls back core assignment and every allocation together after a downstream failure", async () => {
      const { personId, cost } = await salary();
      const before = await getCost(world.businessId, cost.id, "2026-06");
      await expect(
        changeLocations(
          world,
          personId,
          "2026-03-01",
          [world.locationId, second],
          true,
        ),
      ).rejects.toThrow("deliberate transaction failure");
      expect(await getCost(world.businessId, cost.id, "2026-06")).toEqual(
        before,
      );
      const timeline = await getDb()
        .select()
        .from(staffLocationPeriods)
        .where(
          and(
            eq(staffLocationPeriods.businessId, world.businessId),
            eq(staffLocationPeriods.personId, personId),
          ),
        );
      expect(timeline).toHaveLength(1);
      expect(timeline[0].untilMonth).toBeNull();
    });

    it("serializes salary edits against location changes without lost raises or partial allocations", async () => {
      const { personId, cost } = await salary();
      const results = await Promise.allSettled([
        editCost(world.businessId, cost.id, {
          expectedRevision: cost.revision,
          label: "Aumento editado",
          monthlyTotal: "300.00",
          fromMonth: "2026-06",
          untilMonth: null,
        }),
        changeLocations(world, personId, "2026-03-01", [
          second,
          world.locationId,
        ]),
      ]);
      expect(results[1].status).toBe("fulfilled");
      if (results[0].status === "rejected")
        expect(results[0].reason).toMatchObject({ code: "revision_conflict" });
      const june = await getCost(world.businessId, cost.id, "2026-06");
      expect(june.periods[0].monthlyTotal).toBe(
        results[0].status === "fulfilled" ? "300.00" : "200.00",
      );
      expect(june.periods[0].allocations.map((a) => a.monthlyAmount)).toEqual(
        results[0].status === "fulfilled"
          ? ["150.00", "150.00"]
          : ["100.00", "100.00"],
      );
      expect(
        (await getCost(world.businessId, cost.id, "2026-02")).periods[0]
          .allocations,
      ).toEqual([{ locationId: world.locationId, monthlyAmount: "100.00" }]);
    });
  },
);
