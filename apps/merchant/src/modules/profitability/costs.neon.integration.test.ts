import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  locations,
  profitabilityFixedCostAllocations,
} from "@mi-pasaporte/db/schema";
import {
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  seedModuleWorld,
  type ModuleWorld,
} from "../modules-integration-support";
import { createCost, editCost, stopCost } from "./server/writers";
import { getCost, listCosts } from "./server/queries";
import { totals } from "./server/totals";
import { person, secondLocation } from "./test-support";

const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0231 fixed costs, money permission and tenant boundaries",
  { timeout: 90000 },
  () => {
    let world: ModuleWorld,
      other: ModuleWorld,
      second: string,
      personId: string;
    let salary: Awaited<ReturnType<typeof createCost>>,
      rent: Awaited<ReturnType<typeof createCost>>;
    const input = (
      locationId: string,
      total: string,
      fromMonth = "2026-01",
      untilMonth: string | null = null,
    ) => ({
      kind: "rent",
      label: "Alquiler",
      locationId,
      monthlyTotal: total,
      fromMonth,
      untilMonth,
    });
    const editInput = (...args: Parameters<typeof input>) =>
      Object.fromEntries(
        Object.entries(input(...args)).filter(([key]) => key !== "kind"),
      );
    beforeAll(async () => {
      world = await seedModuleWorld("profitability-costs");
      other = await seedModuleWorld("profitability-foreign");
      await enableModules(world, ["profitability"]);
      await enableModules(other, ["profitability"]);
      second = await secondLocation(world);
      personId = await person(world);
    });
    afterAll(async () => {
      await dropModuleWorld(world);
      await dropModuleWorld(other);
    });

    it("creates, corrects exactly one past month and stops from the inclusive month", async () => {
      expect((await totals(world.businessId, "2026-01")).totals[0].total).toBe(
        "0.00",
      );
      rent = await createCost(
        world.businessId,
        input(world.locationId, "1000.00"),
      );
      rent = await editCost(world.businessId, rent.id, {
        ...editInput(world.locationId, "1200.00", "2026-03"),
        expectedRevision: rent.revision,
      });
      await createCost(world.businessId, {
        ...input(world.locationId, "100.00"),
        kind: "electricity",
        label: "Luz",
      });
      await createCost(world.businessId, input(second, "600.00"));
      salary = await createCost(world.businessId, {
        kind: "personnel",
        personId,
        label: "Sueldo total",
        monthlyTotal: "900.00",
        fromMonth: "2026-01",
        untilMonth: null,
      });
      expect((await totals(world.businessId, "2026-02")).totals[0].total).toBe(
        "2600.00",
      );
      expect((await totals(world.businessId, "2026-03")).totals[0].total).toBe(
        "2800.00",
      );
      rent = await editCost(world.businessId, rent.id, {
        ...editInput(world.locationId, "1030.00", "2026-02", "2026-03"),
        expectedRevision: rent.revision,
      });
      expect((await totals(world.businessId, "2026-02")).totals[0].total).toBe(
        "2630.00",
      );
      expect((await totals(world.businessId, "2026-03")).totals[0].total).toBe(
        "2800.00",
      );
      salary = await stopCost(world.businessId, salary.id, {
        expectedRevision: salary.revision,
        endMonth: "2026-04",
      });
      expect((await totals(world.businessId, "2026-04")).totals[0].total).toBe(
        "1900.00",
      );
      expect((await totals(world.businessId, "2026-03")).totals[0].total).toBe(
        "2800.00",
      );
      expect(
        (
          await stopCost(world.businessId, salary.id, {
            expectedRevision: salary.revision,
            endMonth: "2026-04",
          })
        ).revision,
      ).toBe(salary.revision);
    });

    it("isolates locations and businesses through routes and composite foreign keys", async () => {
      expect(
        (await listCosts(world.businessId, second, "2026-02")).costs.map(
          (c) => c.monthlyAmount,
        ),
      ).toEqual(["600.00"]);
      expect((await totals(other.businessId, "2026-02")).totals[0].total).toBe(
        "0.00",
      );
      for (const id of [other.locationId, randomUUID()]) {
        await expect(
          createCost(world.businessId, input(id, "1.00")),
        ).rejects.toMatchObject({ code: "location_not_found" });
        const response = await callModuleRoute(
          "GET",
          `/api/modules/profitability/costs?month=2026-02&locationId=${id}`,
          world.cookie,
        );
        expect(response.status).toBe(404);
      }
      await expect(
        getCost(other.businessId, rent.id, "2026-02"),
      ).rejects.toMatchObject({ code: "cost_not_found" });
      const detail = await getCost(world.businessId, rent.id, "2026-02");
      expect(detail.periods).toHaveLength(1);
      const [allocation] = await getDb()
        .select()
        .from(profitabilityFixedCostAllocations)
        .where(
          eq(profitabilityFixedCostAllocations.businessId, world.businessId),
        );
      await expect(
        getDb()
          .insert(profitabilityFixedCostAllocations)
          .values({
            ...allocation,
            businessId: other.businessId,
            locationId: other.locationId,
          }),
      ).rejects.toBeDefined();
    });

    it("preserves archived obligations, permits corrections/stops and rejects new assignments", async () => {
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, second));
      expect(
        (await totals(world.businessId, "2026-04", second)).totals[0].total,
      ).toBe("600.00");
      await expect(
        createCost(world.businessId, input(second, "1.00")),
      ).rejects.toMatchObject({ code: "location_archived" });
      const list = await listCosts(world.businessId, second, "2026-04");
      const existing = list.costs[0];
      const corrected = await editCost(world.businessId, existing.id, {
        ...editInput(second, "650.00", "2026-04", "2026-05"),
        expectedRevision: existing.revision,
      });
      expect(
        (await totals(world.businessId, "2026-04", second)).totals[0].total,
      ).toBe("650.00");
      await stopCost(world.businessId, existing.id, {
        expectedRevision: corrected.revision,
        endMonth: "2026-05",
      });
      expect(
        (await totals(world.businessId, "2026-05", second)).totals[0].total,
      ).toBe("0.00");
    });

    it("rejects unassigned/foreign personnel, duplicate salary, manual allocations and stale revisions", async () => {
      const unassigned = await person(world, []);
      const foreign = await person(other);
      const body = {
        kind: "personnel",
        label: "Sueldo",
        monthlyTotal: "10.00",
        fromMonth: "2026-01",
        untilMonth: null,
      };
      await expect(
        createCost(world.businessId, { ...body, personId: unassigned }),
      ).rejects.toMatchObject({ code: "staff_locations_required" });
      await expect(
        createCost(world.businessId, { ...body, personId: foreign }),
      ).rejects.toMatchObject({ code: "person_not_found" });
      await expect(
        createCost(world.businessId, { ...body, personId }),
      ).rejects.toMatchObject({ code: "salary_already_exists" });
      await expect(
        createCost(world.businessId, {
          ...editInput(world.locationId, "1.00"),
          allocations: [],
        }),
      ).rejects.toMatchObject({ code: "manual_allocation_not_supported" });
      await expect(
        editCost(world.businessId, rent.id, {
          ...editInput(world.locationId, "1.00"),
          expectedRevision: 1,
        }),
      ).rejects.toMatchObject({ code: "revision_conflict" });
    });
  },
);
