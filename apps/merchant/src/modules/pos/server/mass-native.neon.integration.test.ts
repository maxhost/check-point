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
  loyaltyPrograms,
  campaigns,
  consumerAccounts,
  programMemberships,
  campaignCoupons,
} from "@mi-pasaporte/db/schema";
import {
  neonEndpointId,
  PROD_DB_ENDPOINT_SHA12,
} from "../../../../../../packages/db/src/local";
import { generateOpaqueToken } from "@mi-pasaporte/domain/server/consumer/core";
import { selectCoupon } from "@mi-pasaporte/domain/server/consumer/coupon-selection";
import { upsertEnrollmentSql } from "@mi-pasaporte/domain/server/customers/projection";
import { dropBusiness } from "../../../server/counter-integration-support";
import { dropCampaigns } from "../../../server/marketing-read-support";
import { closeMeasuredPosOrder } from "./measured-close";
import { createProduct } from "@mi-pasaporte/domain/server/catalog";
import {
  seedOwnerDeNegocio,
  cookieDe,
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
  programId?: string;
  campaignId?: string;
  consumerId?: string;
  membershipId?: string;
  couponId?: string;
  qrToken?: string;
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
        await getDb().insert(locations).values({
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
      const base = JSON.parse(await readFile(file, "utf8")) as Manifest;
      const m =
        process.env.POS_MASS_OPERATION === "loyalty"
          ? base
          : (JSON.parse(
              await readFile(`${directory}/loyalty.json`, "utf8"),
            ) as Manifest);
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
      if (process.env.POS_MASS_OPERATION === "loyalty") {
        m.programId = randomUUID();
        m.campaignId = randomUUID();
        m.consumerId = randomUUID();
        m.membershipId = randomUUID();
        m.couponId = randomUUID();
        m.qrToken = generateOpaqueToken();
        // A separate exclusive allocation preserves the original setup manifest and its IDs.
        await writeFile(`${directory}/loyalty.json`, JSON.stringify(m), {
          mode: 0o600,
          flag: "wx",
        });
        const now = new Date();
        await withDbTransaction(async (tx) => {
          await tx.insert(loyaltyPrograms).values({
            id: m.programId!,
            businessId: m.businessId,
            kind: "points",
            configuration: {},
            status: "active",
            termsMarkdown: "Synthetic P3b conditions",
            termsHash: "mass-native0242",
            createdBy: m.ownerId,
            accrualMode: "per_amount",
            accrualGrant: 1,
            accrualBlockAmount: "1.00",
          });
          await tx.insert(campaigns).values({
            id: m.campaignId,
            businessId: m.businessId,
            kind: "proximity",
            templateKey: "welcome",
            channelProximity: false,
            channelPush: false,
            name: "Mass native welcome",
            status: "active",
            activatedAt: now,
            message: "Synthetic mass benefit",
            couponLabel: "Masa diez por ciento",
            couponCost: "0.00",
            couponKind: "discount",
            couponDiscountUnit: "percent",
            couponDiscountValue: "10",
            welcomeValidDays: 15,
            welcomeReminderDays: 3,
            welcomeMonthlyCap: 50,
            welcomeRedeemFrom: "same_visit",
            startsAt: new Date(+now - 3600000),
            createdByUserId: m.ownerId,
          });
          await tx.insert(consumerAccounts).values({
            id: m.consumerId,
            firstName: "Cliente",
            lastName: "Masa nativa",
            qrToken: m.qrToken!,
            webViewToken: generateOpaqueToken(),
            homeLaunchedAt: now,
          });
          await tx.insert(programMemberships).values({
            id: m.membershipId,
            consumerId: m.consumerId!,
            programId: m.programId!,
            businessId: m.businessId,
          });
          await tx.execute(
            upsertEnrollmentSql(
              sql`(select business_id,consumer_id,enrolled_at from consumer.program_membership where id=${m.membershipId}::uuid)`,
            ),
          );
          await tx.insert(campaignCoupons).values({
            id: m.couponId,
            campaignId: m.campaignId!,
            businessId: m.businessId,
            consumerId: m.consumerId!,
            membershipId: m.membershipId!,
            welcomeMembershipId: m.membershipId,
            labelSnapshot: "Masa diez por ciento",
            costSnapshot: "0.00",
            kindSnapshot: "discount",
            discountUnitSnapshot: "percent",
            discountValueSnapshot: "10",
            validFrom: new Date(+now - 3600000),
            validUntil: new Date(+now + 15 * 86400000),
          });
        });
        expect((await selectCoupon(m.consumerId!, m.couponId!)).status).toBe(
          200,
        );
        return;
      }
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
          settlement: { gross: "3.09", collected: "2.78", discount: "0.31" },
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
        ).toEqual([expect.objectContaining({ amount: "2.78" })]);
        expect(
          (
            await getDb().execute(
              sql`select event_version from core.module_event where source_id=${orders[0].id}::uuid and event_type='sale.closed'`,
            )
          ).rows,
        ).toEqual([{ event_version: 4 }]);
        const ledger = (
          await getDb().execute(
            sql`select o.total::text,o.units_granted,m.points_balance,(select count(*)::int from core.coupon_redemption where coupon_id=${m.couponId}::uuid) as redemptions from core."order" o join consumer.program_membership m on m.id=o.membership_id where o.id=${orders[0].orderId}::uuid`,
          )
        ).rows;
        expect(ledger).toEqual([
          {
            total: "2.78",
            units_granted: 2,
            points_balance: 2,
            redemptions: 1,
          },
        ]);
        const browser = JSON.parse(
          await readFile(`${directory}/browser.json`, "utf8"),
        );
        expect(browser.orderId).toBe(orders[0].id);
        const snapshot = async () =>
          (
            await getDb().execute(
              sql`select (select to_jsonb(p) from pos.pos_order p where id=${orders[0].id}::uuid) as pos,(select jsonb_agg(to_jsonb(p) order by id) from pos.order_payment p where pos_order_id=${orders[0].id}::uuid) as payments,(select to_jsonb(m) from consumer.program_membership m where id=${m.membershipId}::uuid) as member,(select jsonb_agg(to_jsonb(c) order by id) from core.coupon_redemption c where coupon_id=${m.couponId}::uuid) as redemptions,(select jsonb_agg(to_jsonb(e) order by id) from core.module_event e where source_id=${orders[0].id}::uuid) as events`,
            )
          ).rows;
        const beforeReplay = await snapshot();
        const replay = await closeMeasuredPosOrder(
          { id: m.businessId, currencyCode: "USD", status: "active" },
          m.ownerId,
          orders[0].id,
          browser.closeBody,
        );
        expect(replay.status).toBe("closed");
        expect(await snapshot()).toEqual(beforeReplay);
        await writeFile(
          `${directory}/inspection.json`,
          JSON.stringify({
            endpoint,
            closedOrders: 1,
            massLines: 1,
            payments: 1,
            eventVersion: 4,
            loyalty: ledger,
            replayUnchanged: true,
          }),
          { mode: 0o600, flag: "wx" },
        );
      } else if (process.env.POS_MASS_OPERATION === "cleanup") {
        const [consumer] = await getDb()
          .select()
          .from(consumerAccounts)
          .where(eq(consumerAccounts.id, m.consumerId!));
        expect(consumer?.qrToken).toBe(m.qrToken);
        await getDb()
          .update(posOrders)
          .set({ orderId: null })
          .where(eq(posOrders.businessId, m.businessId));
        await dropCampaigns(m.businessId);
        await dropBusiness(m.businessId);
        await getDb().delete(users).where(eq(users.id, m.ownerId));
        await getDb()
          .delete(consumerAccounts)
          .where(eq(consumerAccounts.id, m.consumerId!));
        expect(
          await getDb()
            .select()
            .from(businesses)
            .where(eq(businesses.id, m.businessId)),
        ).toEqual([]);
        expect(
          await getDb().select().from(users).where(eq(users.id, m.ownerId)),
        ).toEqual([]);

        await writeFile(
          `${directory}/cleanup.json`,
          JSON.stringify({ endpoint, removedOwnedAggregate: true }),
          { mode: 0o600, flag: "wx" },
        );
      } else throw Error("Unknown owned mass operation");
    }, 180000);
  },
);
