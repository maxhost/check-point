import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type CustomersWorld,
  dropCustomersWorld,
  integrationEnabled,
  oldestAlta,
  projectionRow,
  seedCustomersWorld,
} from "./customers-integration-support";
import { seedReward, setBalance } from "./counter-integration-support";
import {
  type CouponWorld,
  couponBody,
  dropCouponWorld,
  newCouponCard,
  seedCouponWorld,
} from "./counter-coupon-support";
import { getDb, withDbTransaction } from "./db";
import { businessCustomers, programMemberships } from "./schema";
import { rowsOf } from "./counter/core";
import { resolveScan } from "./counter/resolve";
import { grantAccrual } from "./counter/grant";
import { redeemReward } from "./counter/redeem";
import { redeemCoupon } from "./counter/coupon";
import { enroll } from "./consumer/enrollment";
import { listCustomers } from "./customers/list";

/**
 * Spec 0108 — LA PROYECCION SE MANTIENE EN LAS CINCO ESCRITURAS, y el backfill de la `0053` da lo
 * mismo que las escrituras en vivo. El oraculo de «ultima visita» es la fila de ORIGEN leida por
 * SQL (el `created_at` de la orden / del canje), nunca la respuesta de la API (ADR 0054 §4).
 */
const ms = (value: Date | null | undefined) => value?.getTime() ?? null;

async function originAt(
  table: "order" | "reward_redemption" | "coupon_redemption",
  businessId: string,
  consumerId: string,
): Promise<number | null> {
  const [row] = rowsOf(
    await getDb().execute(sql`
      SELECT max(created_at) AS at FROM ${sql.raw(`core."${table}"`)}
      WHERE business_id = ${businessId}::uuid AND consumer_id = ${consumerId}::uuid`),
  ) as Array<{ at: string | null }>;
  return row?.at ? new Date(row.at).getTime() : null;
}

describe.skipIf(!integrationEnabled)(
  "listado de clientes — escrituras de la proyeccion (spec 0108)",
  () => {
    let world: CustomersWorld;
    let coupons: CouponWorld;

    beforeAll(async () => {
      world = await seedCustomersWorld(`Proyeccion ${Date.now()}`);
      coupons = await seedCouponWorld("Proyeccion cupon");
    }, 240_000);

    afterAll(async () => {
      if (world) await dropCustomersWorld(world);
      if (coupons) await dropCouponWorld(coupons);
    }, 180_000);

    it("una fila por persona: Z aparece UNA vez en A, con su alta MAS VIEJA", async () => {
      const altas = await oldestAlta(world.a.business.id, world.z.id);
      expect(altas).toHaveLength(2);
      // Sin dos altas distintas el `least` no distingue nada.
      expect(altas[1]).toBeGreaterThan(altas[0]);
      const row = await projectionRow(world.a.business.id, world.z.id);
      expect(ms(row.enrolledAt)).toBe(altas[0]);
      const page = await listCustomers(world.a.business.id, {
        page: 1,
        filter: "all",
      });
      const zs = page.items.filter((i) => i.name === world.z.name);
      expect(zs).toHaveLength(1);
      expect(zs[0].enrolledAt).toBe(new Date(altas[0]).toISOString());
    }, 60_000);

    it("ultima visita: una compra la mueve; la misma compra en B no mueve A", async () => {
      const inB = await resolveScan(world.b.business, world.x.qrToken);
      await grantAccrual(world.b.business, world.b.userId, {
        clientRequestId: randomUUID(),
        membershipId: inB.membership.id,
        mode: "quick",
        total: "1.00",
      });
      expect(
        ms((await projectionRow(world.b.business.id, world.x.id)).lastVisitAt),
      ).toBe(await originAt("order", world.b.business.id, world.x.id));
      expect(
        (await projectionRow(world.a.business.id, world.x.id)).lastVisitAt,
      ).toBeNull();

      const inA = await resolveScan(world.a.business, world.x.qrToken);
      await grantAccrual(world.a.business, world.a.userId, {
        clientRequestId: randomUUID(),
        membershipId: inA.membership.id,
        mode: "quick",
        total: "3.00",
      });
      const at = await originAt("order", world.a.business.id, world.x.id);
      expect(at).not.toBeNull();
      expect(
        ms((await projectionRow(world.a.business.id, world.x.id)).lastVisitAt),
      ).toBe(at);
    }, 60_000);

    it("ultima visita: un canje de premio la mueve", async () => {
      const rewardId = await seedReward({
        programId: world.a.programId,
        businessId: world.a.business.id,
        pointsCost: 5,
      });
      const inA = await resolveScan(world.a.business, world.z.qrToken);
      await setBalance(inA.membership.id, { points: 50 });
      const before = (await projectionRow(world.a.business.id, world.z.id))
        .lastVisitAt;
      await redeemReward(world.a.business, world.a.userId, {
        clientRequestId: randomUUID(),
        membershipId: inA.membership.id,
        rewardId,
        locationId: world.a.locationId,
      });
      const at = await originAt(
        "reward_redemption",
        world.a.business.id,
        world.z.id,
      );
      expect(at).not.toBeNull();
      expect(before).toBeNull();
      expect(
        ms((await projectionRow(world.a.business.id, world.z.id)).lastVisitAt),
      ).toBe(at);
    }, 60_000);

    it("ultima visita: un canje de cupon la mueve", async () => {
      const card = await newCouponCard(coupons);
      const business = coupons.seed.business.id;
      expect(
        (await projectionRow(business, card.consumerId)).lastVisitAt,
      ).toBeNull();
      await redeemCoupon(
        coupons.seed.business,
        coupons.seed.userId,
        couponBody(card, coupons.seed),
      );
      const at = await originAt("coupon_redemption", business, card.consumerId);
      expect(at).not.toBeNull();
      expect(
        ms((await projectionRow(business, card.consumerId)).lastVisitAt),
      ).toBe(at);
    }, 60_000);

    it("orden: los que vinieron primero (mas reciente arriba), los que nunca vinieron al final", async () => {
      const page = await listCustomers(world.a.business.id, {
        page: 1,
        filter: "all",
      });
      // Z canjeo despues de que X compro; W nunca vino.
      expect(page.items.map((i) => i.name)).toEqual([
        world.z.name,
        world.x.name,
        world.w.name,
      ]);
      expect(page.items[2].lastVisitAt).toBeNull();
    }, 60_000);

    it("alta self-service: crea la fila; un 409 `already_member` la deja byte a byte igual", async () => {
      const phone = `+5939${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
      const { account, membership } = await enroll(world.a.programId, {
        firstName: "Ángela",
        lastName: "Ruiz",
        phoneE164: phone,
        countryIso: "EC",
      });
      const created = await projectionRow(world.a.business.id, account.id);
      expect(created).toMatchObject({
        displayName: "Ángela Ruiz",
        searchName: "angela ruiz",
        phoneE164: phone,
        lastVisitAt: null,
      });
      expect(ms(created.enrolledAt)).toBe(ms(membership.enrolledAt));

      await expect(
        enroll(world.a.programId, {
          firstName: "Otro",
          lastName: "Nombre",
          phoneE164: phone,
          countryIso: "EC",
        }),
      ).rejects.toMatchObject({ status: 409, code: "already_member" });
      expect(await projectionRow(world.a.business.id, account.id)).toEqual(
        created,
      );
    }, 60_000);

    it("auto-alta en mostrador: crea la fila con el alta de la membresia", async () => {
      const [before] = await getDb()
        .select()
        .from(businessCustomers)
        .where(
          and(
            eq(businessCustomers.businessId, world.c.business.id),
            eq(businessCustomers.consumerId, world.y.id),
          ),
        );
      expect(before).toBeUndefined();
      const resolved = await resolveScan(world.c.business, world.y.qrToken);
      expect(resolved.membership.justEnrolled).toBe(true);
      const [membership] = await getDb()
        .select({ at: programMemberships.enrolledAt })
        .from(programMemberships)
        .where(eq(programMemberships.id, resolved.membership.id));
      const row = await projectionRow(world.c.business.id, world.y.id);
      expect(row).toMatchObject({
        displayName: world.y.name,
        phoneE164: world.y.phone,
        lastVisitAt: null,
      });
      expect(ms(row.enrolledAt)).toBe(ms(membership.at));
    }, 60_000);

    it("backfill de la 0053: sobre el mundo sembrado da EXACTAMENTE lo que escribieron las escrituras", async () => {
      const migration = readFileSync(
        join(__dirname, "../../drizzle/0053_listado_de_clientes.sql"),
        "utf8",
      );
      const statements = migration.split("--> statement-breakpoint");
      const backfill = statements[statements.length - 1];
      expect(backfill).toContain("INSERT INTO core.business_customer");
      const businessIds = [
        world.a.business.id,
        world.b.business.id,
        world.c.business.id,
        world.d.business.id,
        coupons.seed.business.id,
      ];
      const columns = `business_id, consumer_id, display_name, search_name, phone_e164,
        extract(epoch from enrolled_at) AS enrolled_at,
        extract(epoch from last_visit_at) AS last_visit_at`;
      const ids = sql.join(
        businessIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      const rebuilt = await withDbTransaction(async (tx) => {
        await tx.execute(
          sql`CREATE TEMP TABLE backfill_probe (LIKE core.business_customer) ON COMMIT DROP`,
        );
        await tx.execute(
          sql.raw(
            backfill.replace(
              "INSERT INTO core.business_customer",
              "INSERT INTO backfill_probe",
            ),
          ),
        );
        return rowsOf(
          await tx.execute(sql`SELECT ${sql.raw(columns)} FROM backfill_probe
            WHERE business_id IN (${ids}) ORDER BY business_id, consumer_id`),
        );
      });
      const live = rowsOf(
        await getDb().execute(sql`SELECT ${sql.raw(columns)} FROM core.business_customer
          WHERE business_id IN (${ids}) ORDER BY business_id, consumer_id`),
      );
      // Piso: el mundo tiene las tres clases de visita y altas multiples.
      expect(live.length).toBeGreaterThanOrEqual(9);
      const visited = (live as Array<{ last_visit_at: unknown }>).filter(
        (row) => row.last_visit_at !== null,
      );
      expect(visited.length).toBeGreaterThanOrEqual(4);
      expect(rebuilt).toEqual(live);
    }, 60_000);
  },
);
