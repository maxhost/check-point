import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses } from "@mi-pasaporte/db/schema";
import { setLocationStatus } from "../../server/locations/store";
import {
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  seedModuleWorld,
  type ModuleWorld,
} from "../modules-integration-support";
import { createCost, editCost } from "./server/writers";
import { getCost } from "./server/queries";
import { totals } from "./server/totals";
import { secondLocation } from "./test-support";

const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0231 cost revision, archival race and currency snapshots",
  { timeout: 90000 },
  () => {
    let world: ModuleWorld;
    beforeAll(async () => {
      world = await seedModuleWorld("profitability-races");
      await enableModules(world, ["profitability"]);
    });
    afterAll(async () => {
      await dropModuleWorld(world);
    });
    const input = (locationId: string, monthlyTotal: string) => ({
      label: "Fijo",
      locationId,
      monthlyTotal,
      fromMonth: "2027-01",
      untilMonth: "2027-02",
    });

    it("serializes a new cost with the actual archive writer without a business/local deadlock", async () => {
      const locationId = await secondLocation(world);
      const result = await Promise.allSettled([
        createCost(world.businessId, {
          kind: "rent",
          ...input(locationId, "1.00"),
        }),
        setLocationStatus({ id: world.businessId }, locationId, "archived"),
      ]);
      expect(result[1].status).toBe("fulfilled");
      if (result[0].status === "rejected")
        expect(result[0].reason).toMatchObject({ code: "location_archived" });
      expect(
        (await totals(world.businessId, "2027-01", locationId)).totals[0].total,
      ).toBe(result[0].status === "fulfilled" ? "1.00" : "0.00");
    });

    it("accepts just one concurrent replacement with the same revision", async () => {
      const cost = await createCost(world.businessId, {
        kind: "other",
        ...input(world.locationId, "1.00"),
      });
      const results = await Promise.allSettled(
        ["2.00", "3.00"].map((value) =>
          editCost(world.businessId, cost.id, {
            ...input(world.locationId, value),
            expectedRevision: cost.revision,
          }),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.find((r) => r.status === "rejected");
      expect(
        failed && failed.status === "rejected" && failed.reason,
      ).toMatchObject({ code: "revision_conflict" });
      const stored = await getCost(world.businessId, cost.id, "2027-01");
      expect(stored.revision).toBe(2);
      expect(stored.periods).toHaveLength(1);
      expect(["2.00", "3.00"]).toContain(stored.periods[0].monthlyTotal);
    });

    it("retains captured money units and never combines currencies or silently accepts unknown units", async () => {
      const usd = await createCost(world.businessId, {
        kind: "other",
        ...input(world.locationId, "10.00"),
        fromMonth: "2028-01",
        untilMonth: "2028-02",
      });
      await getDb()
        .update(businesses)
        .set({ currencyCode: "COP" })
        .where(eq(businesses.id, world.businessId));
      const cop = await createCost(world.businessId, {
        kind: "other",
        ...input(world.locationId, "100"),
        fromMonth: "2028-01",
        untilMonth: "2028-02",
      });
      expect(cop.periods[0]).toMatchObject({
        currencyCode: "COP",
        minorUnit: 0,
        monthlyTotal: "100",
      });
      expect((await totals(world.businessId, "2028-01")).totals).toEqual([
        { currencyCode: "COP", minorUnit: 0, total: "100" },
        { currencyCode: "USD", minorUnit: 2, total: "10.00" },
      ]);
      expect(
        (await getCost(world.businessId, usd.id, "2028-01")).periods[0]
          .currencyCode,
      ).toBe("USD");
      await getDb()
        .update(businesses)
        .set({ currencyCode: "ZZZ" })
        .where(eq(businesses.id, world.businessId));
      await expect(
        createCost(world.businessId, {
          kind: "other",
          ...input(world.locationId, "1.00"),
        }),
      ).rejects.toMatchObject({ code: "currency_not_supported" });
      await expect(totals(world.businessId, "2029-01")).rejects.toMatchObject({
        code: "currency_not_supported",
      });
      // Historical snapshots do not need the current business currency to remain offered.
      expect(
        (await getCost(world.businessId, usd.id, "2028-01")).periods[0]
          .monthlyTotal,
      ).toBe("10.00");
    });
  },
);
