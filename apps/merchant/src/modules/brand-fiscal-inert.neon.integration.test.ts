import { closeWithCash } from "./pos/server/pos-payment-integration-support";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { stockItems, stockItemLocations } from "@mi-pasaporte/db/schema";
import {
  readConfiguration,
  saveConfiguration,
} from "../server/business/configuration";
import { listCatalog } from "@mi-pasaporte/domain/server/catalog";
import { listConsumerPrograms } from "@mi-pasaporte/domain/server/consumer/programs";
import { integrationEnabled as enabled } from "../server/counter-integration-support";
import { scannedCustomer } from "../server/counter/coupon-cycle-support";
import { listItems } from "./stock/items";
import {
  seedPosWorld,
  dropPosWorld,
  openOrder,
} from "./pos/server/pos-integration-support";

describe.skipIf(!enabled)(
  "fiscal settings are inert for current calculations and public consumers",
  () => {
    it("saving flags changes neither catalog price, comparable POS total nor local ingredient cost", async () => {
      const world = await seedPosWorld("Fiscal inert");
      try {
        const businessId = world.seed.business.id;
        const [item] = await getDb()
          .insert(stockItems)
          .values({ businessId, name: "Fiscal Ingredient", unit: "unit" })
          .returning();
        await getDb().insert(stockItemLocations).values({
          businessId,
          itemId: item.id,
          locationId: world.seed.locationId,
          lastUnitCost: "11.500000",
          weightedAverageUnitCost: "10.250000",
          weightedAverageInitializedAt: new Date(),
        });
        const customer = await scannedCustomer(world);
        const catalogBefore = await listCatalog(world.seed.business);
        const stockBefore = await listItems(
          businessId,
          "all",
          world.seed.locationId,
        );
        const costBefore = await getDb()
          .select()
          .from(stockItemLocations)
          .where(eq(stockItemLocations.itemId, item.id));
        const close = async () => {
          const order = await openOrder(world, [
            { productId: world.medialuna, quantity: 2 },
            { productId: world.cafe, quantity: 1 },
          ]);
          const response = await closeWithCash(world.ownerCookie, order.id, {
            clientRequestId: randomUUID(),
            version: order.version,
            membershipId: customer.membershipId,
          });
          expect(response.status).toBe(200);
          return response.json();
        };
        const saleBefore = await close();
        expect(saleBefore.total).toBe("9.00");
        const fiscal = await readConfiguration(businessId, "fiscal");
        const savedFiscal = await saveConfiguration(businessId, "fiscal", {
          ...fiscal,
          chargesVat: true,
          saleVatRate: "100.00",
          recoversPurchaseVat: true,
        });
        expect(savedFiscal).toMatchObject({
          chargesVat: true,
          saleVatRate: "100.00",
          recoversPurchaseVat: true,
        });
        expect(await listCatalog(world.seed.business)).toEqual(catalogBefore);
        expect(
          await listItems(businessId, "all", world.seed.locationId),
        ).toEqual(stockBefore);
        expect(
          await getDb()
            .select()
            .from(stockItemLocations)
            .where(eq(stockItemLocations.itemId, item.id)),
        ).toEqual(costBefore);
        const saleAfter = await close();
        expect(saleAfter.total).toBe(saleBefore.total);
        const consumerDTO = await listConsumerPrograms(customer.consumerId);
        expect(consumerDTO).toHaveLength(1);
        const serialized = JSON.stringify({
          consumerDTO,
          saleBefore,
          saleAfter,
          catalogBefore,
          stockBefore,
        });
        for (const key of ["chargesVat", "saleVatRate", "recoversPurchaseVat"])
          expect(serialized).not.toContain(key);
      } finally {
        await dropPosWorld(world);
      }
    }, 180_000);
  },
);
