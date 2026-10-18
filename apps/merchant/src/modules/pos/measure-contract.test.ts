import { describe, expect, it } from "vitest";
import {
  captureQuantity,
  trustedUnitSnapshotPrice,
  trustedUnitSnapshotQuantity,
  exactSnapshotLineGross,
  decimalRational,
  exactGrams,
  exactLineGross,
  exactOrderGross,
  fromRatio,
  gramsFactor,
  MeasureError,
  normalizedGross,
  parseMeasure,
  parseNullablePrice,
  parsePrice,
  parseQuantity,
  presentQuantity,
  quantityIn,
  quantityRatio,
  ratioOf,
  terminatingDecimal,
  totalPhysicalQuantities,
  UNIT_MEASURE,
} from "@mi-pasaporte/domain/measures";
import {
  INVALID_DECIMAL_FIXTURES,
  massMeasure,
  MEASURE_FIXTURES,
} from "@mi-pasaporte/domain/measures/fixtures";
import { fromExact, rational } from "@mi-pasaporte/domain/financial/rational";
import {
  canCombinePosLines,
  freezePosCommand,
  selectProductCouponLine,
  type PosLineV2,
  type PosCloseV2,
  type PosCreateV2,
  type ProductCouponLine,
} from "./contracts";

function expectCode(run: () => unknown, code: string) {
  expect(run).toThrow(MeasureError);
  try {
    run();
  } catch (error) {
    expect((error as MeasureError).code).toBe(code);
  }
}
describe("0242 precise capture contract", () => {
  it("keeps zero price distinct from absent and accepts the exact maximum", () => {
    expect(parseNullablePrice(null)).toBeNull();
    expect(parseNullablePrice("0.000000000")).toBe("0");
    expect(parsePrice("999999999.999999999")).toBe("999999999.999999999");
    expect(parseQuantity("999999999.999999999")).toBe("999999999.999999999");
    expect(parseQuantity("0002.5000")).toBe("2.5");
    expectCode(() => parseNullablePrice(undefined), "invalid_price");
    expectCode(() => parseQuantity("0"), "invalid_quantity");
  });
  it.each(INVALID_DECIMAL_FIXTURES)(
    "rejects invalid capture/tariff %s before calculation",
    (value) => {
      expectCode(() => parseQuantity(value), "invalid_quantity");
      expectCode(() => parsePrice(value), "invalid_price");
    },
  );
  it("requires integer units and coherent versioned measure metadata", () => {
    expect(captureQuantity("2.000", "unit")).toEqual({
      quantity: "2",
      quantityUnit: "unit",
    });
    expectCode(() => captureQuantity("0.5", "unit"), "invalid_quantity");
    for (const measure of [
      { ...UNIT_MEASURE, quantityUnit: "g" },
      { ...massMeasure("kg"), priceUnit: "unit" },
      { ...massMeasure("kg"), conversionVersion: "future" },
      { ...massMeasure("kg"), quantityUnit: "oz" },
      null,
    ])
      expectCode(() => parseMeasure(measure), "invalid_measure");
    expectCode(
      () => quantityIn(captureQuantity("1", "unit"), "g"),
      "invalid_measure",
    );
    expectCode(
      () => quantityIn(captureQuantity("1", "g"), "unit"),
      "invalid_measure",
    );
  });
});
describe("0242 exact physical factors and source", () => {
  it("uses the international pound and preserves derived fourteen-place grams", () => {
    expect(gramsFactor("lb")).toEqual({ n: 45359237n, d: 100000n });
    expect(exactGrams(captureQuantity("1", "lb"))).toBe("453.59237");
    const derived = exactGrams(captureQuantity("0.000000001", "lb"));
    expect(derived).toBe("0.00000045359237");
    expectCode(() => parseQuantity(derived), "invalid_quantity");
    expect(decimalRational(derived)).toEqual(
      rational(45359237n, 100000000000000n),
    );
  });
  it("converts equivalent captures without Number or intermediate rounding", () => {
    const pounds = captureQuantity("2", "lb");
    const kilograms = captureQuantity("0.90718474", "kg");
    const grams = captureQuantity("907.18474", "g");
    expect(quantityIn(pounds, "g")).toEqual(quantityIn(kilograms, "g"));
    expect(quantityIn(grams, "lb")).toEqual(rational(2n));
    expect(
      totalPhysicalQuantities([pounds, grams, captureQuantity("2", "unit")]),
    ).toEqual([
      { unit: "unit", quantity: "2" },
      { unit: "g", quantity: "1814.36948" },
    ]);
    expect(totalPhysicalQuantities([])).toEqual([]);
  });
  it("retains a one-gram source when the pound view is nonterminating", () => {
    const source = captureQuantity("1", "g");
    const view = presentQuantity(source, "lb");
    expect(view).toMatchObject({
      source,
      unit: "lb",
      display: "0.002204623",
      approximate: true,
    });
    expect(view.exact).toEqual({
      numerator: "100000",
      denominator: "45359237",
    });
    expect(terminatingDecimal(fromRatio(view.exact))).toBeNull();
    expect(presentQuantity(view.source, "g")).toMatchObject({
      display: "1",
      approximate: false,
    });
    // Editing is explicitly a new capture, never an overwrite caused by a selector change.
    const edited = captureQuantity(view.display, "lb");
    expect(quantityIn(edited, "g")).not.toEqual(quantityIn(source, "g"));
    expect(Object.isFrozen(view.source)).toBe(true);
    expectCode(() => presentQuantity(source, "kg", 15), "invalid_quantity");
  });
  it("signals approximate finite views and preserves tiny positive values", () => {
    const source = captureQuantity("0.000000001", "g");
    expect(presentQuantity(source, "kg")).toMatchObject({
      display: "0",
      approximate: true,
      source,
    });
    expect(presentQuantity(source, "kg", 14)).toMatchObject({
      display: "0.000000000001",
      approximate: false,
    });
  });
  it("keeps rational provenance separate from monetary scale", () => {
    const ratio = quantityRatio(captureQuantity("1", "g"), "lb");
    expect(ratioOf(fromRatio(ratio))).toEqual(ratio);
    expect(ratioOf(rational(2n, 4n))).toEqual({
      numerator: "1",
      denominator: "2",
    });
    for (const invalid of [
      { numerator: "1", denominator: "0" },
      { numerator: "1e3", denominator: "1" },
      { numerator: "1", denominator: "-1" },
    ])
      expectCode(() => fromRatio(invalid), "invalid_measure");
  });
});
describe("0242 monetary originals", () => {
  it.each(MEASURE_FIXTURES)(
    "calculates $quantity at $unitPrice precisely",
    (fixture) => {
      const gross = exactLineGross(
        fixture.quantity,
        fixture.unitPrice,
        fixture.measure,
      );
      expect(gross.scale).toBe(2);
      expect(normalizedGross(fromExact(gross), "USD")).toBe(fixture.gross);
    },
  );
  it("preserves tariff precision and normalizes only the resulting money", () => {
    const gross = exactLineGross("453.59237", "4", massMeasure("g", "lb"));
    expect(gross).toEqual({ numerator: "400", denominator: "1", scale: 2 });
    const tiny = exactLineGross("1", "0.000000001", massMeasure("g"));
    expect(tiny).toEqual({ numerator: "1", denominator: "10000000", scale: 2 });
    expect(normalizedGross(fromExact(tiny), "USD")).toBe("0.00");
    const fractional = exactLineGross("1", "0.5", UNIT_MEASURE);
    expect(normalizedGross(fromExact(fractional), "COP")).toBe("1");
    expect(normalizedGross(fromExact(fractional), "USD")).toBe("0.50");
    expect(exactLineGross("3", "0", UNIT_MEASURE).numerator).toBe("0");
    expectCode(() => exactLineGross("1", null, UNIT_MEASURE), "invalid_price");
  });
  it("aggregates originals before rounding and rejects aggregate overflow", () => {
    const lines = [1, 2].map(() => ({
      quantity: "1",
      unitPrice: "0.004",
      measure: UNIT_MEASURE,
    }));
    expect(
      normalizedGross(fromExact(exactOrderGross(lines, "USD")), "USD"),
    ).toBe("0.01");
    const huge = {
      quantity: "10",
      unitPrice: "999999999",
      measure: UNIT_MEASURE,
    };
    expectCode(
      () => exactOrderGross([huge, huge], "USD"),
      "amount_out_of_range",
    );
  });
  it("rejects overflow both before and after zero-decimal normalization", () => {
    expectCode(
      () => exactLineGross("999999999", "999999999", UNIT_MEASURE),
      "amount_out_of_range",
    );
    expect(normalizedGross(rational(999999999999n), "USD")).toBe(
      "9999999999.99",
    );
    expectCode(
      () => normalizedGross(rational(999999999999n), "COP"),
      "amount_out_of_range",
    );
    expectCode(
      () => normalizedGross(rational(9999999999991n, 10n), "USD"),
      "amount_out_of_range",
    );
  });
});
const couponLines: ProductCouponLine[] = [
  {
    lineId: "mass",
    productId: "p",
    quantity: "250",
    measure: massMeasure("g"),
  },
  {
    lineId: "unit-first",
    productId: "p",
    quantity: "2",
    measure: UNIT_MEASURE,
  },
  {
    lineId: "unit-second",
    productId: "p",
    quantity: "1",
    measure: UNIT_MEASURE,
  },
];
describe("0242 unit-only product coupon target", () => {
  it.each(["free_product", "two_for_one"] as const)(
    "rejects %s on mass without selecting another line",
    (kind) => {
      expect(selectProductCouponLine(kind, couponLines, "p", "mass")).toEqual({
        ok: false,
        status: 409,
        code: "coupon_measure_not_supported",
      });
      expect(
        selectProductCouponLine(kind, couponLines.slice(0, 1), "p"),
      ).toMatchObject({ ok: false, code: "coupon_measure_not_supported" });
    },
  );
  it.each([false, true])(
    "chooses the first quantity-eligible 2x1 snapshot with preceding mass=%s",
    (precedingMass) => {
      const snapshots: ProductCouponLine[] = [
        ...(precedingMass ? [couponLines[0]] : []),
        { ...couponLines[1], lineId: "old-unit", quantity: "1" },
        { ...couponLines[1], lineId: "new-unit", quantity: "2" },
        { ...couponLines[1], lineId: "later-unit", quantity: "3" },
      ];
      expect(selectProductCouponLine("two_for_one", snapshots, "p")).toEqual({
        ok: true,
        targetSourceLineId: "new-unit",
      });
      expect(
        selectProductCouponLine("two_for_one", snapshots, "p", "old-unit"),
      ).toEqual({ ok: false, status: 409, code: "coupon_quantity" });
      expect(selectProductCouponLine("free_product", snapshots, "p")).toEqual({
        ok: true,
        targetSourceLineId: "old-unit",
      });
    },
  );
  it("reports quantity when unit snapshots exist but none can receive 2x1", () => {
    const snapshots = [
      couponLines[0],
      { ...couponLines[1], quantity: "1" },
      { ...couponLines[2], quantity: "1" },
    ];
    expect(selectProductCouponLine("two_for_one", snapshots, "p")).toEqual({
      ok: false,
      status: 409,
      code: "coupon_quantity",
    });
  });
  it("chooses the first unit in a mixed order and validates explicit product/line and quantity", () => {
    expect(selectProductCouponLine("two_for_one", couponLines, "p")).toEqual({
      ok: true,
      targetSourceLineId: "unit-first",
    });
    expect(
      selectProductCouponLine("free_product", couponLines, "p", "unit-second"),
    ).toMatchObject({ ok: true, targetSourceLineId: "unit-second" });
    expect(
      selectProductCouponLine("two_for_one", couponLines, "p", "unit-second"),
    ).toMatchObject({ ok: false, code: "coupon_quantity" });
    expect(
      selectProductCouponLine(
        "free_product",
        couponLines,
        "other",
        "unit-first",
      ),
    ).toMatchObject({ ok: false, code: "coupon_product_missing" });
    expect(
      selectProductCouponLine("free_product", couponLines, null),
    ).toMatchObject({ ok: false, code: "coupon_product_missing" });
  });
});
describe("0242 trusted legacy unit snapshots", () => {
  it("preserves ten-digit legacy tariffs without widening new HTTP inputs", () => {
    const price = "9999999999.99";
    expect(trustedUnitSnapshotPrice(price)).toBe(price);
    expect(trustedUnitSnapshotPrice("9999999999.990000000")).toBe(price);
    expect(exactSnapshotLineGross("1", price, UNIT_MEASURE)).toEqual({
      numerator: "999999999999",
      denominator: "1",
      scale: 2,
    });
    const line: PosLineV2 = {
      lineId: "old",
      productId: "p",
      name: "Legado",
      quantity: "1",
      unitPrice: price,
      measure: UNIT_MEASURE,
      lineTotal: price,
    };
    expect(
      canCombinePosLines(line, {
        ...line,
        lineId: "new",
        unitPrice: "9999999999.990000000",
      }),
    ).toBe(true);
    expect(
      canCombinePosLines(
        { ...line, unitPrice: "1.000000001" },
        { ...line, unitPrice: "1.000000001" },
      ),
    ).toBe(true);
    expectCode(() => parsePrice(price), "invalid_price");
    expectCode(
      () => trustedUnitSnapshotPrice("1000000000.001"),
      "invalid_price",
    );
  });
  it("preserves positive int32 unit quantities for historical coupon eligibility", () => {
    const quantity = "2147483647";
    expect(trustedUnitSnapshotQuantity(quantity)).toBe(quantity);
    expect(trustedUnitSnapshotQuantity(2147483647)).toBe(quantity);
    expect(trustedUnitSnapshotQuantity("2147483647.000000000")).toBe(quantity);
    expect(exactSnapshotLineGross(quantity, "0", UNIT_MEASURE).numerator).toBe(
      "0",
    );
    const line: ProductCouponLine = {
      lineId: "legacy",
      productId: "p",
      quantity,
      measure: UNIT_MEASURE,
    };
    expect(selectProductCouponLine("two_for_one", [line], "p")).toEqual({
      ok: true,
      targetSourceLineId: "legacy",
    });
    expect(
      selectProductCouponLine("two_for_one", [line], "p", "legacy"),
    ).toEqual({ ok: true, targetSourceLineId: "legacy" });
    expectCode(() => parseQuantity(quantity), "invalid_quantity");
    for (const invalid of ["2147483648", "1.5", "0", "-1", "1e3"])
      expectCode(
        () => trustedUnitSnapshotQuantity(invalid),
        "invalid_quantity",
      );
  });
  it("does not extend either legacy allowance to measured snapshots", () => {
    expectCode(
      () => exactSnapshotLineGross("1", "9999999999.99", massMeasure("kg")),
      "invalid_price",
    );
    expectCode(
      () => exactSnapshotLineGross("2147483647", "0", massMeasure("g")),
      "invalid_quantity",
    );
    expectCode(
      () => exactLineGross("2147483647", "0", UNIT_MEASURE),
      "invalid_quantity",
    );
    expectCode(
      () => exactLineGross("1", "9999999999.99", UNIT_MEASURE),
      "invalid_price",
    );
  });
});
describe("0242 frozen intents and snapshots", () => {
  it("copies nested close intent before await including target, version, UUID, payments and scope", () => {
    const draft: PosCloseV2 = {
      clientRequestId: "request-a",
      version: 3,
      coupon: {
        couponId: "coupon-a",
        productId: "p",
        targetSourceLineId: "unit-first",
      },
      payments: [{ paymentId: "payment-a", methodId: "cash", amount: "2.00" }],
    };
    const frozen = freezePosCommand("scope-a", draft);
    draft.clientRequestId = "request-b";
    draft.version = 4;
    draft.coupon!.targetSourceLineId = "mass";
    draft.payments![0].amount = "99.00";
    expect(frozen).toMatchObject({
      scopeKey: "scope-a",
      body: {
        clientRequestId: "request-a",
        version: 3,
        coupon: { targetSourceLineId: "unit-first" },
        payments: [{ amount: "2.00" }],
      },
    });
    expect(Object.isFrozen(frozen.body.payments![0])).toBe(true);
    expect(() => freezePosCommand("", draft)).toThrow(
      "backoffice_context_not_ready",
    );
  });
  it("copies create lines without letting a draft edit change the frozen revision", () => {
    const draft: PosCreateV2 = {
      createRequestId: "create-a",
      saleType: "pickup",
      orderLabel: "Pedido 24",
      locationId: null,
      tableId: null,
      note: null,
      items: [
        {
          productId: "p",
          quantity: "750",
          quantityUnit: "g",
          catalogRevision: "3",
        },
      ],
    };
    const frozen = freezePosCommand("scope-a", draft);
    draft.items[0].catalogRevision = "4";
    draft.items[0].quantity = "1000";
    expect(frozen.body.items[0]).toMatchObject({
      quantity: "750",
      catalogRevision: "3",
    });
  });
  it("never combines a changed commercial snapshot merely by product id", () => {
    const old: PosLineV2 = {
      lineId: "old",
      productId: "p",
      name: "Manzanas",
      quantity: "1",
      unitPrice: "2",
      measure: massMeasure("kg"),
      lineTotal: "2.00",
    };
    expect(
      canCombinePosLines(old, {
        ...old,
        lineId: "new",
        quantity: "2",
        lineTotal: "4.00",
      }),
    ).toBe(true);
    expect(canCombinePosLines(old, { ...old, unitPrice: "3" })).toBe(false);
    expect(canCombinePosLines(old, { ...old, name: "Nuevo nombre" })).toBe(
      false,
    );
    expect(
      canCombinePosLines(old, { ...old, measure: massMeasure("lb") }),
    ).toBe(false);
    expect(
      canCombinePosLines(
        { ...old, productId: null },
        { ...old, productId: null },
      ),
    ).toBe(false);
  });
});
