import {
  createPaymentMethod,
  archivePaymentMethod,
} from "../../../server/business/payment-methods";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businessModules,
  couponRedemptions,
  moduleEvents,
  orders,
  posOrderItems,
  posOrderPayments,
  posOrders,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import { readModuleResources } from "../../resources";
import { listPaymentMethods } from "./payment-methods";
import {
  dropPosWorld,
  openOrder,
  pos,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
  setPosModule,
  type PosWorld,
} from "./pos-integration-support";
import {
  choose,
  scannedCustomer,
  welcomeCoupon,
} from "../../../server/counter/coupon-cycle-support";
let usd: PosWorld, cop: PosWorld;
let usdCash: string, copCash: string;
const oldEventFlag = process.env.MODULE_EVENTS_ENABLED;
beforeAll(async () => {
  process.env.MODULE_EVENTS_ENABLED = "true";
  usd = await seedPosWorld("P1 snapshot USD");
  cop = await seedPosWorld("P1 snapshot COP", "CO", "COP");
  usdCash = (await listPaymentMethods(usd.seed.business.id)).defaultMethodId!;
  copCash = (await listPaymentMethods(cop.seed.business.id)).defaultMethodId!;
}, 240_000);
afterAll(async () => {
  if (oldEventFlag === undefined) delete process.env.MODULE_EVENTS_ENABLED;
  else process.env.MODULE_EVENTS_ENABLED = oldEventFlag;
  await dropPosWorld(usd);
  await dropPosWorld(cop);
}, 240_000);
const close = (
  world: PosWorld,
  order: { id: string; version: number },
  payments: unknown,
  extra: Record<string, unknown> = {},
) =>
  pos.close(world.ownerCookie, order.id, {
    clientRequestId: randomUUID(),
    version: order.version,
    ...(payments === undefined ? {} : { payments }),
    ...extra,
  });
const payment = (id: string, amount: string) => ({ methodId: id, amount });
const storedPayments = (id: string) =>
  getDb()
    .select()
    .from(posOrderPayments)
    .where(eq(posOrderPayments.posOrderId, id));
const storedEvent = async (id: string) =>
  (
    await getDb()
      .select()
      .from(moduleEvents)
      .where(eq(moduleEvents.sourceId, id))
  )[0]?.payload;

describe.skipIf(!posIntegrationEnabled)(
  "P1 cierre y snapshot financiero reales",
  () => {
    it("cobro positivo exige pagos; errores de suma/duplicado/negativo y tenant revierten todo", async () => {
      const order = await openOrder(usd, [
        { productId: usd.cafe, quantity: 1 },
      ]);
      for (const [payments, code] of [
        [undefined, "payment_required"],
        [[payment(usdCash, "1.99")], "payment_sum_mismatch"],
        [
          [payment(usdCash, "1.00"), payment(usdCash.toUpperCase(), "1.00")],
          "duplicate_payment_method",
        ],
        [[payment(usdCash, "-2.00")], "invalid_payment_amount"],
      ] as const) {
        const response = await close(usd, order, payments);
        expect(response.status).toBe(422);
        expect((await response.json()).code).toBe(code);
      }
      const foreign = await close(usd, order, [payment(copCash, "2.00")]);
      expect(foreign.status).toBe(404);
      expect((await foreign.json()).code).toBe("payment_method_not_found");
      expect(await storedPayments(order.id)).toHaveLength(0);
      expect(await storedEvent(order.id)).toBeUndefined();
      expect(
        (
          await getDb()
            .select()
            .from(posOrders)
            .where(eq(posOrders.id, order.id))
        )[0].status,
      ).toBe("open");
    }, 120_000);

    it("UUID mayúscula y espacios cierra; archivar después conserva pago y retry idéntico sin pagos nuevos", async () => {
      const method = await createPaymentMethod(usd.seed.business.id, {
        name: "Transferencia prueba",
        chargeShape: "none",
      });
      const order = await openOrder(usd, [
        { productId: usd.cafe, quantity: 1 },
      ]);
      const key = randomUUID();
      const response = await close(
        usd,
        order,
        [payment(` ${method.id.toUpperCase()} `, "2.00")],
        { clientRequestId: key },
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.settlement).toMatchObject({
        gross: "2.00",
        discount: "0.00",
        collected: "2.00",
        minorUnit: 2,
        payments: [
          {
            methodId: method.id,
            amount: "2.00",
            methodName: "Transferencia prueba",
          },
        ],
      });
      const persisted = await storedPayments(order.id);
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toMatchObject({
        methodId: method.id,
        methodName: "Transferencia prueba",
        amount: "2.00",
      });
      await archivePaymentMethod(usd.seed.business.id, method.id);
      const retry = await close(usd, order, undefined, {
        clientRequestId: key,
      });
      expect(retry.status).toBe(200);
      expect((await retry.json()).settlement).toEqual(body.settlement);
      expect(await storedPayments(order.id)).toHaveLength(1);
      const newOrder = await openOrder(usd, [
        { productId: usd.cafe, quantity: 1 },
      ]);
      const archived = await close(usd, newOrder, [payment(method.id, "2.00")]);
      expect(archived.status).toBe(409);
      expect((await archived.json()).code).toBe("payment_method_archived");
    }, 120_000);

    it("COP10.40−0.60 cobra10, acredita100puntos y congela10−1+1=10 con originales exactos", async () => {
      const product = await seedProduct(cop, "Servicio COP", "10.40");
      const customer = await scannedCustomer(cop);
      const couponId = await welcomeCoupon(cop, customer, {
        kind: "discount",
        label: "0.60 COP",
        discountUnit: "amount",
        discountValue: "0.60",
      });
      await choose(customer, couponId);
      const order = await openOrder(cop, [{ productId: product, quantity: 1 }]);
      const response = await close(cop, order, [payment(copCash, "10")], {
        membershipId: customer.membershipId,
        coupon: { couponId },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.settlement).toMatchObject({
        gross: "10",
        discount: "1",
        roundingAdjustment: "1",
        collected: "10",
        minorUnit: 0,
        currencyCode: "COP",
        originals: {
          gross: { numerator: "1040", denominator: "1", scale: 2 },
          discount: { numerator: "60", denominator: "1", scale: 2 },
          net: { numerator: "980", denominator: "1", scale: 2 },
        },
      });
      expect(body.sale).toMatchObject({
        total: "10",
        grossTotal: "10",
        coupon: { discountAmount: "1" },
      });
      const [closed] = await getDb()
        .select({ orderId: posOrders.orderId })
        .from(posOrders)
        .where(eq(posOrders.id, order.id));
      const [grant] = await getDb()
        .select()
        .from(orders)
        .where(eq(orders.id, closed.orderId!));
      expect(grant).toMatchObject({ total: "10.00", unitsGranted: 100 });
      const [line] = await getDb()
        .select()
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, order.id));
      expect(line.financialSnapshot).toEqual(body.settlement.lines[0]);
      expect(line.financialSnapshot?.discountOrigin).toMatchObject({
        type: "campaign_coupon",
        sourceId: couponId,
        scope: "order",
      });
      const event = await storedEvent(order.id);
      expect(event).toMatchObject({
        eventVersion: 2,
        money: {
          gross: "10",
          discount: "1",
          roundingAdjustment: "1",
          collected: "10",
        },
        payments: [{ methodId: copCash, amount: "10" }],
      });
    }, 120_000);

    it("un rechazo por suma revierte grant/redención/selección y permite confirmar después", async () => {
      const customer = await scannedCustomer(usd);
      const couponId = await welcomeCoupon(usd, customer, {
        kind: "discount",
        label: "Mitad",
        discountUnit: "percent",
        discountValue: "50",
      });
      await choose(customer, couponId);
      const order = await openOrder(usd, [
        { productId: usd.cafe, quantity: 1 },
      ]);
      const key = randomUUID();
      const extra = {
        clientRequestId: key,
        membershipId: customer.membershipId,
        coupon: { couponId },
      };
      const rejected = await close(
        usd,
        order,
        [payment(usdCash, "2.00")],
        extra,
      );
      expect(rejected.status).toBe(422);
      expect((await rejected.json()).settlement).toMatchObject({
        collected: "1.00",
      });
      expect(
        await getDb()
          .select()
          .from(orders)
          .where(eq(orders.clientRequestId, key)),
      ).toHaveLength(0);
      expect(
        await getDb()
          .select()
          .from(couponRedemptions)
          .where(eq(couponRedemptions.couponId, couponId)),
      ).toHaveLength(0);
      const accepted = await close(
        usd,
        order,
        [payment(usdCash, "1.00")],
        extra,
      );
      expect(accepted.status).toBe(200);
      expect(
        await getDb()
          .select()
          .from(couponRedemptions)
          .where(eq(couponRedemptions.couponId, couponId)),
      ).toHaveLength(1);
    }, 120_000);

    it("gratis elige primera línea repetida y una unidad; la cantidad física no cambia", async () => {
      const product = await seedProduct(usd, "Servicio repetido", null);
      const customer = await scannedCustomer(usd);
      const couponId = await welcomeCoupon(usd, customer, {
        kind: "free_product",
        label: "Una unidad",
      });
      await choose(customer, couponId);
      const order = await openOrder(usd, [
        { productId: product, quantity: 2, unitPrice: "1.25" },
        { productId: product, quantity: 1, unitPrice: "3.50" },
      ]);
      const response = await close(usd, order, [payment(usdCash, "4.75")], {
        membershipId: customer.membershipId,
        coupon: { couponId, productId: product },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      const [first, second] = body.settlement.lines;
      expect(first).toMatchObject({
        sourceLineId: order.items[0].lineId,
        money: { gross: "2.50", discount: "1.25", net: "1.25" },
        discountOrigin: {
          scope: "line",
          targetSourceLineId: order.items[0].lineId,
        },
      });
      expect(second).toMatchObject({
        sourceLineId: order.items[1].lineId,
        money: { gross: "3.50", discount: "0.00", net: "3.50" },
        discountOrigin: null,
      });
      expect(await storedEvent(order.id)).toMatchObject({
        lines: [
          { sourceLineId: first.sourceLineId, quantity: 2 },
          { sourceLineId: second.sourceLineId, quantity: 1 },
        ],
      });
    }, 120_000);

    it("pagos COP normalizados0 conservan orden/auditoría, sin transacción efectiva", async () => {
      const product = await seedProduct(cop, "Servicio fracción", "10.40");
      const other = await createPaymentMethod(cop.seed.business.id, {
        name: "Pago fijo",
        chargeShape: "fixed",
      });
      const order = await openOrder(cop, [{ productId: product, quantity: 1 }]);
      const response = await close(cop, order, [
        payment(other.id, "0.40"),
        payment(copCash, "10.00"),
      ]);
      expect(response.status).toBe(200);
      const { settlement } = await response.json();
      expect(settlement.paymentOriginals).toMatchObject([
        { position: 0, methodId: other.id, amount: "0", effective: false },
        { position: 1, methodId: copCash, amount: "10", effective: true },
      ]);
      expect(settlement.payments).toHaveLength(1);
      expect(await storedPayments(order.id)).toMatchObject([
        { methodId: copCash, position: 1, amount: "10.00" },
      ]);
    }, 120_000);

    it("neto0 usa[]; provider real lee cero persistido con POS apagado y aísla tenant", async () => {
      const product = await seedProduct(cop, "Servicio cubierto", "0.60");
      const customer = await scannedCustomer(cop);
      const couponId = await welcomeCoupon(cop, customer, {
        kind: "discount",
        label: "Todo",
        discountUnit: "percent",
        discountValue: "100",
      });
      await choose(customer, couponId);
      const order = await openOrder(cop, [{ productId: product, quantity: 1 }]);
      const extra = {
        membershipId: customer.membershipId,
        coupon: { couponId },
      };
      const invalid = await close(
        cop,
        order,
        [payment(copCash, "0.60")],
        extra,
      );
      expect(invalid.status).toBe(422);
      expect((await invalid.json()).code).toBe("payments_not_expected");
      process.env.MODULE_EVENTS_ENABLED = "false";
      const accepted = await close(cop, order, [], extra);
      process.env.MODULE_EVENTS_ENABLED = "true";
      expect(accepted.status).toBe(200);
      expect(await storedEvent(order.id)).toBeUndefined();
      expect((await accepted.json()).settlement).toMatchObject({
        gross: "1",
        discount: "1",
        collected: "0",
        payments: [],
        paymentOriginals: [],
      });
      await setPosModule(cop.seed.business.id, false);
      const resources = await withDbTransaction((tx) =>
        readModuleResources(tx, cop.seed.business.id, "sale_settlement", [
          order.id,
        ]),
      );
      expect(resources).toEqual([
        {
          providerId: "pos",
          resourceId: order.id,
          metadata: {
            sourceOrderId: order.id,
            locationId: cop.seed.locationId,
            snapshotPresent: true,
            collectedTotal: "0",
            currencyCode: "COP",
            minorUnit: 0,
          },
        },
      ]);
      expect(
        await withDbTransaction((tx) =>
          readModuleResources(tx, usd.seed.business.id, "sale_settlement", [
            order.id,
          ]),
        ),
      ).toEqual([]);
      const methods = await withDbTransaction((tx) =>
        readModuleResources(tx, cop.seed.business.id, "payment_method", [
          copCash,
        ]),
      );
      expect(methods).toEqual([]); // Payment methods no longer belong to the module directory.
      expect(
        await getDb()
          .select()
          .from(businessModules)
          .where(
            and(
              eq(businessModules.businessId, cop.seed.business.id),
              eq(businessModules.moduleId, "pos"),
            ),
          ),
      ).toMatchObject([{ enabled: false }]);
      await setPosModule(cop.seed.business.id, true);
    }, 120_000);
  },
);
