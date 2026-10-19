import { dropBusiness } from "../../../server/counter-integration-support";
/** Explicit operations, exclusively tools/neon-test.sh. New persistent owned M1 fixtures; never touches M0. */
import { randomUUID, randomInt } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  users,
  businesses,
  memberships,
  subscriptions,
  businessModules,
  businessOnboardingTours,
  locations,
  productCategories,
  products,
  posOrders,
  posOrderItems,
} from "@mi-pasaporte/db/schema";
import { hashPin } from "../../../server/staff-pin";
import { ONBOARDING_TOURS } from "../../../server/onboarding/tours";
import { initializePaymentMethods } from "../../../server/business/payment-catalog";
import {
  guard,
  load,
  save,
  owned,
  inspect,
  login,
  type Manifest,
} from "./m1-fixture.test-support";

describe.skipIf(process.env.POS_M1_FIXTURE !== "true")(
  "0242 protected M1 list fixture",
  () => {
    it("executes requested operation without unrelated cleanup", async () => {
      const { directory, endpoint, file } = await guard();
      const op = process.env.POS_M1_OPERATION;
      expect(["setup", "inspect", "login", "cleanup"]).toContain(op);
      if (op === "setup") {
        const runId = randomUUID(),
          now = new Date();
        const m: Manifest = {
          kind: "pos-m1-list-fixture-v1",
          runId,
          endpoint,
          day: new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Guayaquil",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(now),
          phase: "allocating",
          fixtures: (["empty", "normal", "volume"] as const).map((c, i) => {
            const slug = `posm10242-${runId}-${c}`;
            return {
              case: c,
              businessId: randomUUID(),
              slug,
              ownerId: randomUUID(),
              staffId: randomUUID(),
              email: `${slug}@example.test`,
              pin: String(randomInt(100000, 1000000)),
              locations: [randomUUID(), randomUUID()],
              categories: Array.from({ length: 8 }, () => randomUUID()),
              products: Array.from({ length: i === 2 ? 2000 : 120 }, () =>
                randomUUID(),
              ),
              orders: Array.from(
                { length: i === 0 ? 0 : i === 1 ? 24 : 200 },
                () => randomUUID(),
              ),
              linesPerOrder: i === 2 ? 30 : 8,
            };
          }),
        };
        await writeFile(file, JSON.stringify(m, null, 2), {
          flag: "wx",
          mode: 0o600,
        });
        for (const f of m.fixtures) {
          const pinHash = await hashPin(f.pin);
          await withDbTransaction(async (tx) => {
            await tx.insert(users).values([
              {
                id: f.ownerId,
                name: `Owner ${f.case}`,
                email: f.email,
                emailVerified: true,
                createdAt: now,
                updatedAt: now,
              },
              {
                id: f.staffId,
                name: `Operator ${f.case}`,
                email: `staff-${f.email}`,
                emailVerified: true,
                createdAt: now,
                updatedAt: now,
              },
            ]);
            await tx.insert(businesses).values({
              id: f.businessId,
              name: `POS sintético ${f.case}`,
              slug: f.slug,
              countryCode: "EC",
              timezone: "America/Guayaquil",
              currencyCode: "USD",
              status: "active",
              categoryGcid: "gcid:store",
            });
            await tx.insert(memberships).values([
              {
                businessId: f.businessId,
                userId: f.ownerId,
                role: "owner",
                status: "active",
                pinMustChange: false,
              },
              {
                businessId: f.businessId,
                userId: f.staffId,
                role: "staff",
                status: "active",
                handle: "operator",
                pinHash,
                pinMustChange: false,
                permissions: ["pos"],
              },
            ]);
            await tx.insert(subscriptions).values({
              businessId: f.businessId,
              plan: "trial",
              status: "active",
              trialEndsAt: new Date(+now + 30 * 86400000),
            });
            await tx.insert(businessModules).values({
              businessId: f.businessId,
              moduleId: "pos",
              enabled: true,
            });
            await tx.insert(businessOnboardingTours).values(
              ONBOARDING_TOURS.map((tourId) => ({
                businessId: f.businessId,
                tourId,
                status: "completed",
              })),
            );
            await tx.insert(locations).values(
              f.locations.map((id, i) => ({
                id,
                businessId: f.businessId,
                name: i ? "Norte" : "Centro",
                countryCode: "EC",
                addressLabel: "Fixture sintética",
                addressSnapshot: {},
              })),
            );
            await tx.insert(productCategories).values(
              f.categories.map((id, i) => ({
                id,
                businessId: f.businessId,
                name: `Categoría ${i}`,
              })),
            );
            for (let offset = 0; offset < f.products.length; offset += 100)
              await tx.insert(products).values(
                f.products.slice(offset, offset + 100).map((id, i) => ({
                  id,
                  businessId: f.businessId,
                  categoryId: f.categories[(offset + i) % 8],
                  name: `Producto ${String(offset + i).padStart(4, "0")}`,
                  unitPrice: "2.00",
                  availableAllLocations: true,
                })),
              );
            if (f.orders.length)
              await tx.insert(posOrders).values(
                f.orders.map((id, i) => ({
                  id,
                  businessId: f.businessId,
                  locationId: f.locations[i % 2],
                  tableLabel: `M1 ${String(i).padStart(3, "0")}`,
                  createdByUserId: f.ownerId,
                  createdAt: new Date(+now - (f.orders.length - i) * 60000),
                })),
              );
            for (let offset = 0; offset < f.orders.length; offset += 10)
              await tx.insert(posOrderItems).values(
                f.orders.slice(offset, offset + 10).flatMap((posOrderId) =>
                  Array.from({ length: f.linesPerOrder }, (_, i) => ({
                    posOrderId,
                    productId: f.products[i],
                    nameSnapshot: `Producto ${String(i).padStart(4, "0")}`,
                    unitPriceSnapshot: "2.00",
                    quantity: "1",
                    position: i,
                  })),
                ),
              );
            await initializePaymentMethods(tx, { businessId: f.businessId });
          });
        }
        m.phase = "ready";
        await save(file, m);
        await inspect(m);
      } else {
        const m = await load(file, endpoint);
        if (op === "inspect") {
          await inspect(m);
          const ledger = await getDb().execute(
            sql`select id,hash,created_at from drizzle.__drizzle_migrations order by id`,
          );
          const columns = await getDb().execute(
            sql`select table_schema,table_name,column_name,data_type,numeric_precision,numeric_scale from information_schema.columns where table_schema in ('pos','core','merchant_auth') order by table_schema,table_name,ordinal_position`,
          );
          await writeFile(
            `${directory}/schema-preflight.json`,
            JSON.stringify(
              {
                at: new Date().toISOString(),
                ledger: ledger.rows,
                columns: columns.rows,
              },
              null,
              2,
            ),
            { mode: 0o600 },
          );
        } else if (op === "login") {
          await inspect(m);
          await login(m, directory);
        } else {
          for (const f of m.fixtures) {
            await owned(f);
            await getDb()
              .update(posOrders)
              .set({ orderId: null })
              .where(eq(posOrders.businessId, f.businessId));
            await dropBusiness(f.businessId);
            await getDb()
              .delete(businesses)
              .where(eq(businesses.id, f.businessId));
            await getDb().delete(users).where(eq(users.id, f.ownerId));
            await getDb().delete(users).where(eq(users.id, f.staffId));
          }
          m.phase = "cleaned";
          await save(file, m);
        }
      }
    }, 180000);
  },
);
