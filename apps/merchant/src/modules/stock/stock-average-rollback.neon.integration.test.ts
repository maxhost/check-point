import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { stockItemLocations, stockMovements } from "@mi-pasaporte/db/schema";
import {
  dropModuleWorld,
  seedModuleWorld,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../modules-integration-support";
import { createItem, listItems } from "./items";
import { recordEntry } from "./entries";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0228 first local initialization is atomic with entire entry",
  { timeout: 60000 },
  () => {
    let world: ModuleWorld;
    beforeAll(async () => {
      world = await seedModuleWorld("average-first-rollback");
    });
    afterAll(async () => dropModuleWorld(world));
    it("rolls back first marker, pair and purchase when a later line fails", async () => {
      const item = await createItem(world.businessId, {
        name: "First pair",
        unit: "unit",
        locationId: world.locationId,
      });
      await expect(
        recordEntry(world.businessId, world.ownerId, {
          locationId: world.locationId,
          lines: [
            { itemId: item.id, unit: "unit", quantity: "1", totalCost: "1" },
            { itemId: item.id, unit: "g", quantity: "1", totalCost: "1" },
          ],
        }),
      ).rejects.toMatchObject({ code: "unit_mismatch" });
      expect(
        await getDb()
          .select()
          .from(stockItemLocations)
          .where(eq(stockItemLocations.itemId, item.id)),
      ).toEqual([]);
      expect(
        await getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.itemId, item.id)),
      ).toEqual([]);
      expect(
        (await listItems(world.businessId, null, world.locationId))[0],
      ).toMatchObject({
        onHand: "0.000",
        weightedAverageUnitCost: null,
        lastUnitCost: null,
      });
    });
  },
);
