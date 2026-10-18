import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
  type FinancialInputV2,
} from "@mi-pasaporte/domain/financial";
import {
  UNIT_MEASURE,
  exactGrams,
  type LineMeasure,
} from "@mi-pasaporte/domain/measures";
import {
  decodeMeasuredSaleClosedEvent,
  decodeSaleClosedEvent,
  toMeasuredSaleClosedEventView,
} from "./decode";
import type { SaleClosedEvent, SaleClosedEventV4 } from "./types";

const mass = (
  quantityUnit: "lb" | "kg" | "g",
  priceUnit: "lb" | "kg" | "g" = quantityUnit,
): LineMeasure => ({
  kind: "mass",
  quantityUnit,
  priceUnit,
  conversionVersion: "mass-si-1",
});
function event(
  captures = [
    { quantity: "1", unitPrice: "1", measure: UNIT_MEASURE as LineMeasure },
  ],
  currencyCode = "USD",
): SaleClosedEventV4 {
  const lines = captures.map((capture, position) => ({
    ...capture,
    sourceLineId: randomUUID(),
    position,
  }));
  const input: FinancialInputV2 = { currencyCode, lines, discount: null };
  const amounts = buildFinancialAmountsFromSnapshots(input);
  const s = buildFinancialSettlementFromSnapshots({
    ...input,
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
    eventVersion: 4,
    sourceOrderId: randomUUID(),
    locationId: randomUUID(),
    closedAt: "2026-10-18T12:00:00.000Z",
    userId: "user",
    lines: s.lines.map((financial, i) => ({
      ...financial,
      quantity: lines[i].quantity,
      measure: lines[i].measure,
      productId: randomUUID(),
      resourceVersions: [
        {
          providerId: "provider-a",
          slot: "composition",
          versionId: randomUUID(),
        },
      ],
      productLabel: "Producto",
      commissionMinor: "10",
    })),
    money: {
      gross: s.gross,
      discount: s.discount,
      roundingAdjustment: s.roundingAdjustment,
      collected: s.collected,
      currencyCode: s.currencyCode,
      minorUnit: s.minorUnit,
      originalGross: s.originals.gross,
      originalDiscount: s.originals.discount,
      originalNet: s.originals.net,
      normalizationAdjustments: s.normalizationAdjustments,
    },
    payments: s.payments.map((p) => ({
      ...p,
      methodProviderId: "payments",
      methodName: "Cash",
      chargeShape: "none",
      resourceVersions: [],
    })),
    paymentOriginals: s.paymentOriginals,
  };
}
function legacy(
  version: 1 | 2 | 3,
  quantity = 1,
  unitPrice = "0",
): SaleClosedEvent {
  const v4 = event([{ quantity: "1", unitPrice, measure: UNIT_MEASURE }]);
  const lines = v4.lines.map((line) => ({
    sourceLineId: line.sourceLineId,
    productId: line.productId,
    resourceVersions: line.resourceVersions,
    quantity,
    position: line.position,
    money: line.money,
    discountOrigin: line.discountOrigin,
    productLabel: line.productLabel,
    commissionMinor: line.commissionMinor,
  }));
  if (version === 1)
    return {
      eventVersion: 1,
      sourceOrderId: v4.sourceOrderId,
      locationId: v4.locationId,
      closedAt: v4.closedAt,
      userId: v4.userId,
      lines: lines.map(
        ({ sourceLineId, productId, quantity, resourceVersions }) => ({
          sourceLineId,
          productId,
          quantity,
          resourceVersions,
        }),
      ),
    };
  if (version === 2)
    return {
      ...v4,
      eventVersion: 2,
      lines: lines.map((line) => ({
        sourceLineId: line.sourceLineId,
        productId: line.productId,
        resourceVersions: line.resourceVersions,
        quantity,
        position: line.position,
        money: line.money,
        discountOrigin: line.discountOrigin,
      })),
    };
  return { ...v4, eventVersion: 3, lines };
}

describe("0242 dormant measured sale decoder", () => {
  it.each([1, 2, 3] as const)(
    "keeps v%s payload and money intact while making an explicit unit view",
    (version) => {
      const payload = legacy(version);
      const before = structuredClone(payload);
      expect(decodeSaleClosedEvent(payload)).toBe(payload);
      const decoded = decodeMeasuredSaleClosedEvent(payload, version);
      expect(decoded).toBe(payload);
      const view = toMeasuredSaleClosedEventView(decoded);
      expect(view.payload).toBe(payload);
      const measured = view;
      expect(measured).toEqual({
        payload,
        lines: payload.lines.map((line) => ({
          ...line,
          quantity: String(line.quantity),
          measure: UNIT_MEASURE,
        })),
      });
      expect(measured).not.toBe(payload);
      expect(measured.lines[0]).not.toBe(payload.lines[0]);
      expect(payload).toEqual(before);
      expect(decodeSaleClosedEvent(payload)).toEqual(before);
      if (version === 1) expect(measured.payload).not.toHaveProperty("money");
      else if ("money" in measured.payload && "money" in payload)
        expect(measured.payload.money).toBe(payload.money);
    },
  );
  it.each([2, 3] as const)(
    "retains paid historical v%s financial and audit blocks by identity",
    (version) => {
      const payload = legacy(version, 1, "10.40");
      if (payload.eventVersion === 1)
        throw new Error("Expected financial payload");
      const before = structuredClone(payload);
      const decoded = decodeMeasuredSaleClosedEvent(payload);
      expect(decoded).toBe(payload);
      const view = toMeasuredSaleClosedEventView(decoded);
      expect(view.payload).toBe(payload);
      expect(view.lines[0].quantity).toBe("1");
      expect(payload.money.originalGross).toEqual({
        numerator: "1040",
        denominator: "1",
        scale: 2,
      });
      expect(payload.payments).toHaveLength(1);
      expect(payload).toEqual(before);
    },
  );
  it.each([1, 2, 3] as const)(
    "preserves safe-integer legacy v%s beyond INT32",
    (version) => {
      const payload = legacy(version, Number.MAX_SAFE_INTEGER);
      expect(decodeSaleClosedEvent(payload)).toBe(payload);
      expect(
        toMeasuredSaleClosedEventView(decodeMeasuredSaleClosedEvent(payload))
          .lines[0].quantity,
      ).toBe("9007199254740991");
      payload.lines[0].quantity = Number.MAX_SAFE_INTEGER + 1;
      expect(() => decodeMeasuredSaleClosedEvent(payload)).toThrow();
    },
  );
  it.each(["USD", "COP"])(
    "accepts mixed quantities with exact originals, payments and provenance in %s",
    (currency) => {
      const payload = event(
        [
          { quantity: "2", unitPrice: "3", measure: UNIT_MEASURE },
          { quantity: "1", unitPrice: "1", measure: mass("lb", "g") },
          { quantity: "453.59237", unitPrice: "1", measure: mass("g", "lb") },
        ],
        currency,
      );
      const before = structuredClone(payload);
      expect(decodeMeasuredSaleClosedEvent(payload, 4)).toBe(payload);
      expect(payload.lines[1].money.originals.gross).toEqual({
        numerator: "45359237",
        denominator: "1000",
        scale: 2,
      });
      expect(
        exactGrams({ quantity: payload.lines[1].quantity, quantityUnit: "lb" }),
      ).toBe("453.59237");
      const view = toMeasuredSaleClosedEventView(payload);
      expect(view.payload).toBe(payload);
      expect(view.lines).toEqual(payload.lines);
      expect(view.lines[0]).not.toBe(payload.lines[0]);
      expect(payload).toEqual(before);
      expect(payload.lines[0]).not.toHaveProperty("unitPrice");
      expect(() => decodeSaleClosedEvent(payload)).toThrow();
    },
  );
  it("preserves nonterminating rational money rather than reconstructing from rounded zero", () => {
    const payload = event([
      { quantity: "1", unitPrice: "1", measure: mass("g", "lb") },
    ]);
    expect(payload.money.collected).toBe("0.00");
    expect(payload.payments).toEqual([]);
    const decoded = decodeMeasuredSaleClosedEvent(payload);
    if (decoded.eventVersion !== 4) throw new Error("Expected V4");
    expect(decoded.lines[0].money.originals.gross).toEqual({
      numerator: "10000000",
      denominator: "45359237",
      scale: 2,
    });
  });
  it("preserves rounded-zero payment originals and validates their IDs too", () => {
    const payload = event(undefined, "COP");
    const s = buildFinancialSettlementFromSnapshots({
      currencyCode: "COP",
      lines: [
        {
          sourceLineId: payload.lines[0].sourceLineId,
          position: 0,
          quantity: "1",
          unitPrice: "1",
          measure: UNIT_MEASURE,
        },
      ],
      discount: null,
      payments: [
        { paymentId: randomUUID(), methodId: randomUUID(), amount: "0.1" },
        { paymentId: randomUUID(), methodId: randomUUID(), amount: "0.9" },
      ],
    });
    payload.payments = s.payments.map((p) => ({
      ...payload.payments[0],
      ...p,
    }));
    payload.paymentOriginals = s.paymentOriginals;
    expect(payload.paymentOriginals[0].effective).toBe(false);
    const before = structuredClone(payload);
    expect(decodeMeasuredSaleClosedEvent(payload)).toBe(payload);
    expect(payload).toEqual(before);
    payload.paymentOriginals[0].methodId = "invalid";
    expect(() => decodeMeasuredSaleClosedEvent(payload)).toThrow(
      "Invalid financial payment original",
    );
  });
  it.each(["USD", "COP"])(
    "accepts zero and historical INT32 unit quantities in %s",
    (currency) => {
      const payload = event(
        [{ quantity: "2147483647", unitPrice: "0", measure: UNIT_MEASURE }],
        currency,
      );
      expect(decodeMeasuredSaleClosedEvent(payload)).toBe(payload);
      expect(payload.payments).toEqual([]);
    },
  );
  it("accepts the exact nine-decimal mass capture limit", () => {
    const payload = event([
      { quantity: "999999999.999999999", unitPrice: "0", measure: mass("lb") },
    ]);
    expect(decodeMeasuredSaleClosedEvent(payload)).toBe(payload);
    expect(
      exactGrams({ quantity: payload.lines[0].quantity, quantityUnit: "lb" }),
    ).toBe("453592369999.99999954640763");
  });
  it.each([
    undefined,
    null,
    {},
    { ...UNIT_MEASURE, quantityUnit: "g" },
    { ...mass("lb"), priceUnit: "unit" },
    { ...mass("kg"), conversionVersion: "next" },
  ])(
    "rejects missing or incoherent measure %# with no legacy fallback",
    (measure) => {
      const payload = event();
      Object.assign(payload.lines[0], { measure });
      expect(() => decodeMeasuredSaleClosedEvent(payload)).toThrow();
    },
  );
  it.each([
    1,
    "0",
    "-1",
    "1e2",
    "NaN",
    "Infinity",
    "1,2",
    "1.5",
    "2147483648",
    "1.0000000001",
  ])("rejects invalid unit quantity %s", (quantity) => {
    const payload = event();
    Object.assign(payload.lines[0], { quantity });
    expect(() => decodeMeasuredSaleClosedEvent(payload)).toThrow();
  });
  it.each([1, "0", "1e2", "1000000000", "0.0000000001"])(
    "rejects invalid mass capture %s",
    (quantity) => {
      const payload = event([
        { quantity: "1", unitPrice: "1", measure: mass("g") },
      ]);
      Object.assign(payload.lines[0], { quantity });
      expect(() => decodeMeasuredSaleClosedEvent(payload)).toThrow();
    },
  );
  it.each([1, 2, 3] as const)(
    "rejects strings under legacy version %s",
    (version) => {
      const payload = legacy(version);
      Object.assign(payload.lines[0], { quantity: "1", measure: UNIT_MEASURE });
      expect(() => decodeMeasuredSaleClosedEvent(payload)).toThrow();
      expect(() => decodeSaleClosedEvent(payload)).toThrow();
    },
  );
  it.each([0, 5, "4", undefined, null])(
    "rejects unknown/missing payload version %s",
    (eventVersion) => {
      expect(() =>
        decodeMeasuredSaleClosedEvent({ ...event(), eventVersion }),
      ).toThrow();
    },
  );
  it.each([1, 2, 3, 4] as const)(
    "rejects envelope mismatch for v%s",
    (version) => {
      expect(() =>
        decodeMeasuredSaleClosedEvent(
          version === 4 ? event() : legacy(version),
          version + 1,
        ),
      ).toThrow("Event version mismatch");
    },
  );
  it.each([
    (v: SaleClosedEventV4) => {
      v.sourceOrderId = "bad";
    },
    (v: SaleClosedEventV4) => {
      v.locationId = "bad";
    },
    (v: SaleClosedEventV4) => {
      v.closedAt = "yesterday";
    },
    (v: SaleClosedEventV4) => {
      v.lines[0].sourceLineId = "bad";
    },
    (v: SaleClosedEventV4) => {
      v.lines[0].productId = "bad";
    },
    (v: SaleClosedEventV4) => {
      v.lines[0].resourceVersions[0].versionId = "bad";
    },
    (v: SaleClosedEventV4) => {
      v.lines.push({ ...v.lines[0] });
    },
    (v: SaleClosedEventV4) => {
      v.lines = [];
    },
    (v: SaleClosedEventV4) => {
      v.lines[0].productLabel = "";
    },
    (v: SaleClosedEventV4) => {
      Object.assign(v.lines[0], { commissionMinor: undefined });
    },
    (v: SaleClosedEventV4) => {
      v.lines[0].commissionMinor = "0.1";
    },
    (v: SaleClosedEventV4) => {
      v.lines[0].position = -1;
    },
    (v: SaleClosedEventV4) => {
      v.money.collected = "2.00";
    },
    (v: SaleClosedEventV4) => {
      v.money.gross = "10000000000.00";
    },
    (v: SaleClosedEventV4) => {
      v.money.originalGross.denominator = "0";
    },
    (v: SaleClosedEventV4) => {
      v.payments = [];
    },
    (v: SaleClosedEventV4) => {
      v.payments[0].methodId = "bad";
    },
    (v: SaleClosedEventV4) => {
      v.payments[0].methodName = "";
    },
    (v: SaleClosedEventV4) => {
      v.payments.push({ ...v.payments[0] });
    },
    (v: SaleClosedEventV4) => {
      v.paymentOriginals[0].originalAmount.numerator = "101";
    },
  ])("rejects corrupt envelope, provenance, metadata or money %#", (mutate) => {
    const payload = event();
    mutate(payload);
    expect(() => decodeMeasuredSaleClosedEvent(payload)).toThrow();
  });
});
