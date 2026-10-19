import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
} from "@mi-pasaporte/domain/financial";
import { UNIT_MEASURE, type LineMeasure } from "@mi-pasaporte/domain/measures";
import { decodeMeasuredSaleClosedEvent, decodeSaleClosedEvent } from "./decode";
import {
  buildMeasuredSaleClosedPayload,
  type MeasuredSaleClosedInput,
} from "./publish-measured";

function input(
  quantity = "1",
  unitPrice = "1",
  measure: LineMeasure = UNIT_MEASURE,
  currencyCode = "USD",
): MeasuredSaleClosedInput {
  const lines = [
    {
      sourceLineId: randomUUID(),
      position: 0,
      productId: randomUUID(),
      productLabel: "Producto",
      quantity,
      unitPrice,
      measure,
    },
  ];
  const financial = { lines, currencyCode, discount: null };
  const amounts = buildFinancialAmountsFromSnapshots(financial);
  const settlement = buildFinancialSettlementFromSnapshots({
    ...financial,
    payments:
      BigInt(amounts.collected.replace(".", "")) === 0n
        ? []
        : [
            {
              paymentId: randomUUID(),
              methodId: randomUUID(),
              amount: amounts.collected,
            },
          ],
  });
  return {
    businessId: randomUUID(),
    sourceOrderId: randomUUID(),
    locationId: randomUUID(),
    userId: "owner",
    lines,
    settlement,
    commissionByLine: { [lines[0].sourceLineId]: null },
    capture: { captured_at: "2026-10-18T12:00:00Z", enabled: [], versions: [] },
    paymentsMetadata: settlement.payments.map((payment) => ({
      paymentId: payment.paymentId,
      methodId: payment.methodId,
      methodProviderId: "payment-provider",
      methodName: "Efectivo",
      chargeShape: "none",
    })),
  };
}
const mass: LineMeasure = {
  kind: "mass",
  quantityUnit: "g",
  priceUnit: "lb",
  conversionVersion: "mass-si-1",
};

describe("opt-in measured sale payload", () => {
  it.each([
    ["2147483647.000000000", "0.000000001", UNIT_MEASURE],
    ["1.000000000", "9999999999.990000000", UNIT_MEASURE],
    ["250.000000001", "4.000000001", mass],
    ["1", "0", UNIT_MEASURE],
  ])(
    "preserves trusted source strings and all settled money (%s, %s)",
    (quantity, price, measure) => {
      const args = input(quantity, price, measure as LineMeasure);
      const payload = buildMeasuredSaleClosedPayload(args);
      expect(decodeMeasuredSaleClosedEvent(payload, 4)).toEqual(payload);
      expect(() => decodeSaleClosedEvent(payload)).toThrow();
      expect(payload.lines[0].quantity).toBe(quantity);
      expect(payload.lines[0].money).toEqual(args.settlement.lines[0].money);
      expect(payload.lines[0]).not.toHaveProperty("unitPrice");
      expect(payload.paymentOriginals).toEqual(
        args.settlement.paymentOriginals,
      );
      expect(payload.closedAt).toBe("2026-10-18T12:00:00.000Z");
      expect(payload.money.normalizationAdjustments).toEqual(
        args.settlement.normalizationAdjustments,
      );
    },
  );
  it.each(["USD", "COP"])(
    "rejects originals that merely normalize to the same %s money",
    (currency) => {
      const args = input("1", "1.000000001", UNIT_MEASURE, currency);
      args.lines[0].unitPrice = "1.000000002";
      expect(() => buildMeasuredSaleClosedPayload(args)).toThrow(
        "original mismatch",
      );
    },
  );
  it.each([
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].quantity = "250.000000002";
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].measure = { ...mass, quantityUnit: "kg" };
    },
  ])(
    "rejects changed physical originals despite frozen settled money %#",
    (mutate) => {
      const args = input("250.000000001", "0.000000001", mass);
      mutate(args);
      expect(() => buildMeasuredSaleClosedPayload(args)).toThrow(
        "original mismatch",
      );
    },
  );
  it("requires unique positions even when line IDs and financial money remain valid", () => {
    const args = input();
    args.lines = [
      ...args.lines,
      { ...args.lines[0], sourceLineId: randomUUID() },
    ];
    args.commissionByLine = Object.fromEntries(
      args.lines.map((line) => [line.sourceLineId, null]),
    );
    args.settlement = buildFinancialSettlementFromSnapshots({
      currencyCode: "USD",
      lines: args.lines,
      discount: null,
      payments: [{ ...args.settlement.payments[0], amount: "2" }],
    });
    expect(() => buildMeasuredSaleClosedPayload(args)).toThrow("sources");
  });
  it("does not compare only aggregate originals across lines", () => {
    const args = input();
    const second = {
      ...args.lines[0],
      sourceLineId: randomUUID(),
      position: 1,
      unitPrice: "2",
    };
    args.lines = [...args.lines, second];
    args.commissionByLine = Object.fromEntries(
      args.lines.map((line) => [line.sourceLineId, null]),
    );
    args.settlement = buildFinancialSettlementFromSnapshots({
      currencyCode: "USD",
      lines: args.lines,
      discount: null,
      payments: [{ ...args.settlement.payments[0], amount: "3" }],
    });
    args.lines[0].unitPrice = "2";
    second.unitPrice = "1";
    expect(() => buildMeasuredSaleClosedPayload(args)).toThrow(
      "original mismatch",
    );
  });
  it.each([
    (v: MeasuredSaleClosedInput) => {
      v.lines = [...v.lines, { ...v.lines[0] }];
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines = [];
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].sourceLineId = randomUUID();
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].position = 1;
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].productLabel = "";
    },
    (v: MeasuredSaleClosedInput) => {
      v.commissionByLine = {};
    },
    (v: MeasuredSaleClosedInput) => {
      v.paymentsMetadata = [];
    },
    (v: MeasuredSaleClosedInput) => {
      v.paymentsMetadata = [
        ...v.paymentsMetadata,
        { ...v.paymentsMetadata[0] },
      ];
    },
    (v: MeasuredSaleClosedInput) => {
      v.paymentsMetadata[0].methodId = randomUUID();
    },
    (v: MeasuredSaleClosedInput) => {
      v.paymentsMetadata[0].methodName = "";
    },
    (v: MeasuredSaleClosedInput) => {
      Object.assign(v.capture, { enabled: undefined });
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].unitPrice = "1e2";
    },
    (v: MeasuredSaleClosedInput) => {
      Object.assign(v.lines[0], { quantity: 1 });
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].quantity = "2147483648";
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].measure = {
        ...mass,
        conversionVersion: "wrong",
      } as unknown as LineMeasure;
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].measure = mass;
      v.lines[0].quantity = "1000000000";
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].measure = mass;
      v.lines[0].quantity = "0.0000000001";
    },
    (v: MeasuredSaleClosedInput) => {
      v.lines[0].unitPrice = "10000000000";
    },
  ])(
    "rejects incomplete provenance, metadata or invalid source %#",
    (mutate) => {
      const args = input();
      mutate(args);
      expect(() => buildMeasuredSaleClosedPayload(args)).toThrow();
    },
  );
});
