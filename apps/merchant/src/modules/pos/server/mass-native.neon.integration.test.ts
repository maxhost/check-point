/** Owned fixture; all DB operations run exclusively through tools/neon-test.sh. */
import { readFile, writeFile, stat } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  businessModules,
  businessOnboardingTours,
  locations,
  posOrders,
  posOrderItems,
  posOrderPayments,
  users,
} from "@mi-pasaporte/db/schema";
import {
  neonEndpointId,
  PROD_DB_ENDPOINT_SHA12,
} from "../../../../../../packages/db/src/local";
import { createProduct } from "@mi-pasaporte/domain/server/catalog";
import {
  seedOwnerDeNegocio,
  cookieDe,
  limpiarNegocios,
} from "../../../server/permissions-integration-support";
import { initializePaymentMethods } from "../../../server/business/payment-catalog";
import { ONBOARDING_TOURS } from "../../../server/onboarding/tours";
const directory = "/private/tmp/checkpass-pos-0242/mass-native";
const file = `${directory}/manifest.json`;
type Manifest = {
  kind: "mass-native-0242";
  endpoint: string;
  businessId: string;
  ownerId: string;
  locationId: string;
  slug: string;
  phase: string;
  productId?: string;
  cookie?: string;
};
describe.skipIf(process.env.POS_MASS_NATIVE !== "true")(
  "0242 owned mass Next fixture",
  () => {
    it("performs the requested operation under exclusive CI ownership", async () => {
      expect(process.env.NEON_INTEGRATION_ISOLATED).toBe("true");
      const id = neonEndpointId(process.env.NEON_INTEGRATION_DATABASE_URL!);
      expect(id).toMatch(/^ep-[a-z0-9-]+$/);
      const endpoint = createHash("sha256")
        .update(id)
        .digest("hex")
        .slice(0, 12);
      expect(endpoint).not.toBe(PROD_DB_ENDPOINT_SHA12);
      expect(endpoint).toBe(process.env.POS_MEASUREMENT_ENDPOINT_SHA12);
      expect(process.env.BETTER_AUTH_URL).toBe("http://localhost:43252");
      expect((await stat(directory)).mode & 0o077).toBe(0);
      const save = (m: Manifest) =>
        writeFile(file, JSON.stringify(m), { mode: 0o600 });
      if (process.env.POS_MASS_OPERATION === "setup") {
        const businessId = randomUUID();
        const m: Manifest = {
          kind: "mass-native-0242",
          endpoint,
          businessId,
          ownerId: `mass-native-${randomUUID()}`,
          locationId: randomUUID(),
          slug: `mass-native-${businessId}`,
          phase: "allocated",
        };
        // The aggregate IDs and owner exist in an exclusive private manifest before any DB write.
        await writeFile(file, JSON.stringify(m), { mode: 0o600, flag: "wx" });
        await seedOwnerDeNegocio(m.ownerId, m.businessId, m.slug);
        await getDb()
          .update(businesses)
          .set({ categoryGcid: "gcid:restaurant", status: "active" })
          .where(eq(businesses.id, m.businessId));
        await getDb()
          .insert(locations)
          .values({
            id: m.locationId,
            businessId: m.businessId,
            name: "Mass native local",
            countryCode: "EC",
            addressLabel: "Synthetic fixture",
            addressSnapshot: {},
          });
        await getDb()
          .insert(businessModules)
          .values({ businessId: m.businessId, moduleId: "pos", enabled: true });
        await getDb()
          .insert(businessOnboardingTours)
          .values(
            ONBOARDING_TOURS.map((tourId) => ({
              businessId: m.businessId,
              tourId,
              status: "completed" as const,
            })),
          );
        await withDbTransaction((tx) =>
          initializePaymentMethods(tx, { businessId: m.businessId }),
        );
        const product = await createProduct(
          { id: m.businessId, currencyCode: "USD" },
          {
            name: "Masa nativa",
            soldByWeight: true,
            pricingUnit: "kg",
            unitPrice: "4.123456789",
            unitCost: null,
            availableAllLocations: true,
            categoryId: null,
            locationIds: [],
          },
          { contract: 2 },
        );
        m.productId = product.id;
        m.cookie = await cookieDe(m.ownerId);
        m.phase = "ready";
        await save(m);
        return;
      }
      expect((await stat(file)).mode & 0o077).toBe(0);
      const m = JSON.parse(await readFile(file, "utf8")) as Manifest;
      expect(m.kind).toBe("mass-native-0242");
      expect(m.endpoint).toBe(endpoint);
      expect(m.slug).toBe(`mass-native-${m.businessId}`);
      const [owned] = await getDb()
        .select()
        .from(businesses)
        .where(eq(businesses.id, m.businessId));
      expect(owned?.slug).toBe(m.slug);
      const [owner] = await getDb()
        .select()
        .from(users)
        .where(eq(users.id, m.ownerId));
      expect(owner?.email).toBe(`${m.ownerId}@example.test`);
      if (process.env.POS_MASS_OPERATION === "inspect") {
        const orders = await getDb()
          .select()
          .from(posOrders)
          .where(eq(posOrders.businessId, m.businessId));
        expect(orders).toHaveLength(1);
        expect(orders[0]).toMatchObject({
          status: "closed",
          saleType: "counter",
          totalSnapshot: "3.09",
          settlement: { gross: "3.09", collected: "3.09" },
        });
        const lines = await getDb()
          .select()
          .from(posOrderItems)
          .where(eq(posOrderItems.posOrderId, orders[0].id));
        expect(lines).toEqual([
          expect.objectContaining({
            productId: m.productId,
            quantity: "0.750000000",
            unitPriceSnapshot: "4.123456789",
            measureKind: "mass",
            quantityUnit: "kg",
            priceUnit: "kg",
            conversionVersion: "mass-si-1",
          }),
        ]);
        expect(
          await getDb()
            .select()
            .from(posOrderPayments)
            .where(eq(posOrderPayments.posOrderId, orders[0].id)),
        ).toEqual([expect.objectContaining({ amount: "3.09" })]);
        expect(
          (
            await getDb().execute(
              sql`select event_version from core.module_event where source_id=${orders[0].id}::uuid and event_type='sale.closed'`,
            )
          ).rows,
        ).toEqual([{ event_version: 4 }]);
        await writeFile(
          `${directory}/inspection.json`,
          JSON.stringify({
            endpoint,
            closedOrders: 1,
            massLines: 1,
            payments: 1,
            eventVersion: 4,
          }),
          { mode: 0o600, flag: "wx" },
        );
      } else if (process.env.POS_MASS_OPERATION === "cleanup") {
        await limpiarNegocios([m.businessId], [m.ownerId]);
        expect(
          await getDb()
            .select()
            .from(businesses)
            .where(eq(businesses.id, m.businessId)),
        ).toEqual([]);
        expect(
          await getDb().select().from(users).where(eq(users.id, m.ownerId)),
        ).toEqual([]);
        m.phase = "cleaned";
        delete m.cookie;
        await save(m);
        await writeFile(
          `${directory}/cleanup.json`,
          JSON.stringify({ endpoint, removedOwnedAggregate: true }),
          { mode: 0o600, flag: "wx" },
        );
      } else throw Error("Unknown owned mass operation");
    }, 180000);
  },
);
