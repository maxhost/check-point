import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { productLocations, products } from "@mi-pasaporte/db/schema";
import {
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "../counter-integration-support";
import { seedExtraLocation } from "../locations-integration-support";
import { resolveScan } from "./resolve";
import { grantAccrual } from "./grant";

describe.skipIf(!integrationEnabled)(
  "catálogo local y atajos del mostrador",
  () => {
    it("muestra y acredita solo productos del local; los hábitos no cruzan clientes ni locales", async () => {
      const seed = await seedBusiness({
      name: "Mostrador 0121",
        kind: "points",
        mode: "per_amount",
        grant: 1,
        blockAmount: "1.00",
      });
      try {
        const secondLocation = await seedExtraLocation(
          seed.business.id,
          "Sucursal B",
        );
        const coffee = randomUUID();
        const juice = randomUUID();
        await getDb()
          .insert(products)
          .values([
            {
              id: coffee,
              businessId: seed.business.id,
              name: "Café",
              unitPrice: "2.00",
              availableAllLocations: false,
            },
            {
              id: juice,
              businessId: seed.business.id,
              name: "Jugo",
              unitPrice: "3.00",
            },
          ]);
        await getDb()
          .insert(productLocations)
          .values({ productId: coffee, locationId: seed.locationId });
        const buyer = await seedConsumer();
        const other = await seedConsumer();
        const atA = await resolveScan(
          seed.business,
          buyer.qrToken,
          seed.locationId,
        );
        const atB = await resolveScan(
          seed.business,
          buyer.qrToken,
          secondLocation,
        );
        expect(atA.catalog.products.map((product) => product.id)).toContain(
          coffee,
        );
        expect(atB.catalog.products.map((product) => product.id)).not.toContain(
          coffee,
        );
        await expect(
          grantAccrual(seed.business, seed.userId, {
            clientRequestId: randomUUID(),
            membershipId: atA.membership.id,
            locationId: secondLocation,
            mode: "detailed",
            items: [{ productId: coffee, quantity: 1 }],
          }),
        ).rejects.toMatchObject({ status: 422, code: "unknown_product" });
        for (const quantity of [1, 2]) {
          await grantAccrual(seed.business, seed.userId, {
            clientRequestId: randomUUID(),
            membershipId: atA.membership.id,
            locationId: seed.locationId,
            mode: "detailed",
            items: [{ productId: coffee, quantity }],
          });
        }
        const updated = await resolveScan(
          seed.business,
          buyer.qrToken,
          seed.locationId,
        );
        expect(updated.catalog.habitualProductIds).toEqual([coffee]);
        expect(updated.catalog.lastPurchase?.items).toEqual([
          { productId: coffee, quantity: 2 },
        ]);
        expect(
          (await resolveScan(seed.business, buyer.qrToken, secondLocation))
            .catalog.habitualProductIds,
        ).toEqual([]);
        expect(
          (await resolveScan(seed.business, other.qrToken, seed.locationId))
            .catalog.habitualProductIds,
        ).toEqual([]);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 30_000);
  },
);
