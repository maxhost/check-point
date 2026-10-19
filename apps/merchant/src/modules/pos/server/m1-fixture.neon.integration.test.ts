import { dropBusiness } from "../../../server/counter-integration-support";
/** Explicit operations, exclusively tools/neon-test.sh. New persistent owned M1 fixtures; never touches M0. */
import { randomUUID, randomInt } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { eq, sql, inArray } from "drizzle-orm";
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
  sessions,
  paymentMethods,
  paymentMethodInitializations,
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
              lineIds: Array.from(
                { length: i === 0 ? 0 : i === 1 ? 24 : 200 },
                () =>
                  Array.from({ length: i === 2 ? 30 : 8 }, () => randomUUID()),
              ),
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
                    id: f.lineIds[f.orders.indexOf(posOrderId)][i],
                    posOrderId,
                    productId: f.products[i],
                    nameSnapshot: `Producto ${String(i).padStart(4, "0")}`,
                    unitPriceSnapshot: "2.00",
                    quantity: "1",
                    measureKind: "unit",
                    quantityUnit: "unit",
                    priceUnit: "unit",
                    conversionVersion: "mass-si-1",
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
          const businessIds = m.fixtures.map((f) => f.businessId),
            userIds = m.fixtures.flatMap((f) => [f.ownerId, f.staffId]);
          const orderIds = m.fixtures.flatMap((f) => f.orders),
            lineIds = m.fixtures.flatMap((f) => f.lineIds.flat());
          const checks = [
            [
              "businesses",
              sql`select count(*)::int as count from ${businesses} where ${inArray(businesses.id, businessIds)}`,
            ],
            [
              "users",
              sql`select count(*)::int as count from ${users} where ${inArray(users.id, userIds)}`,
            ],
            [
              "sessions",
              sql`select count(*)::int as count from ${sessions} where ${inArray(sessions.userId, userIds)}`,
            ],
            [
              "memberships",
              sql`select count(*)::int as count from ${memberships} where ${inArray(memberships.businessId, businessIds)} or ${inArray(memberships.userId, userIds)}`,
            ],
            [
              "subscriptions",
              sql`select count(*)::int as count from ${subscriptions} where ${inArray(subscriptions.businessId, businessIds)}`,
            ],
            [
              "modules",
              sql`select count(*)::int as count from ${businessModules} where ${inArray(businessModules.businessId, businessIds)}`,
            ],
            [
              "tours",
              sql`select count(*)::int as count from ${businessOnboardingTours} where ${inArray(businessOnboardingTours.businessId, businessIds)}`,
            ],
            [
              "locations",
              sql`select count(*)::int as count from ${locations} where ${inArray(locations.businessId, businessIds)} or ${inArray(
                locations.id,
                m.fixtures.flatMap((f) => f.locations),
              )}`,
            ],
            [
              "categories",
              sql`select count(*)::int as count from ${productCategories} where ${inArray(productCategories.businessId, businessIds)} or ${inArray(
                productCategories.id,
                m.fixtures.flatMap((f) => f.categories),
              )}`,
            ],
            [
              "products",
              sql`select count(*)::int as count from ${products} where ${inArray(products.businessId, businessIds)} or ${inArray(
                products.id,
                m.fixtures.flatMap((f) => f.products),
              )}`,
            ],
            [
              "orders",
              sql`select count(*)::int as count from ${posOrders} where ${inArray(posOrders.businessId, businessIds)} or ${inArray(posOrders.id, orderIds)}`,
            ],
            [
              "lines",
              sql`select count(*)::int as count from ${posOrderItems} where ${inArray(posOrderItems.posOrderId, orderIds)} or ${inArray(posOrderItems.id, lineIds)}`,
            ],
            [
              "paymentMethods",
              sql`select count(*)::int as count from ${paymentMethods} where ${inArray(paymentMethods.businessId, businessIds)}`,
            ],
            [
              "paymentMethodInitializations",
              sql`select count(*)::int as count from ${paymentMethodInitializations} where ${inArray(paymentMethodInitializations.businessId, businessIds)}`,
            ],
          ] as const;
          const remaining: Record<string, number> = {};
          for (const [label, query] of checks) {
            remaining[label] = Number(
              (await getDb().execute(query)).rows[0]?.count,
            );
            expect(remaining[label], `cleanup own ${label}`).toBe(0);
          }
          await writeFile(
            `${directory}/cleanup.json`,
            JSON.stringify(
              {
                kind: "pos-m1-list-cleanup-v1",
                endpoint,
                verified: true,
                at: new Date().toISOString(),
                remaining,
              },
              null,
              2,
            ) + "\n",
            { flag: "wx", mode: 0o600 },
          );
          m.phase = "cleaned";
          await save(file, m);
        }
      }
    }, 180000);
  },
);
