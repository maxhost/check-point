import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildFinancialSettlementFromSnapshots,
  buildFinancialAmountsFromSnapshots,
} from "@mi-pasaporte/domain/financial";
import { UNIT_MEASURE, type LineMeasure } from "@mi-pasaporte/domain/measures";
import {
  measuredGrantItems,
  type MeasuredGrantItem,
} from "./measured-order-input";
import { persistGrant, persistMeasuredGrant } from "./orders";

const mass: LineMeasure = {
  kind: "mass",
  quantityUnit: "g",
  priceUnit: "lb",
  conversionVersion: "mass-si-1",
};
const item = (
  overrides: Partial<MeasuredGrantItem> = {},
): MeasuredGrantItem => ({
  sourceLineId: "opaque producer reference",
  productId: null,
  nameSnapshot: "Frozen name",
  unitPrice: "4",
  quantity: "2",
  measure: UNIT_MEASURE,
  lineTotal: "8.00",
  ...overrides,
});
function input(items = [item()], currencyCode = "USD", discount = "0.00") {
  const financial = {
    currencyCode,
    lines: items.map((line, position) => ({ ...line, position })),
    discount:
      discount === "0.00"
        ? null
        : {
            amount: discount,
            origin: {
              type: "campaign_coupon" as const,
              sourceId: "trusted coupon",
              scope: "order" as const,
            },
          },
  };
  const amounts = buildFinancialAmountsFromSnapshots(financial);
  const settlement = buildFinancialSettlementFromSnapshots({
    ...financial,
    payments:
      BigInt(amounts.collected.replace(".", "")) === 0n
        ? []
        : [
            {
              paymentId: "decided payment",
              methodId: "trusted method",
              amount: amounts.collected,
            },
          ],
  });
  return { items, settlement, total: settlement.collected, currencyCode };
}

const context = {
  businessId: "00000000-0000-4000-8000-000000000001",
  locationId: null,
  programId: "00000000-0000-4000-8000-000000000002",
  membershipId: "00000000-0000-4000-8000-000000000003",
  consumerId: "00000000-0000-4000-8000-000000000004",
  mode: "detailed" as const,
  note: null,
  accrualKind: "points" as const,
  units: 17,
  createdByUserId: "trusted actor",
  clientRequestId: "00000000-0000-4000-8000-000000000005",
};

describe("trusted measured core order snapshots", () => {
  it("preserves original precise strings and four measure fields without reconstructing tariff", () => {
    const data = input([
      item({
        quantity: "453.592370000",
        unitPrice: "4.000000001",
        measure: mass,
        lineTotal: "4.00",
      }),
    ]);
    expect(measuredGrantItems(data)).toEqual(data.items);
    expect(data.settlement.lines[0].money.originals.gross).toEqual({
      numerator: "4000000001",
      denominator: "10000000",
      scale: 2,
    });
  });

  it.each([
    ["2", "lb", "8.00"],
    ["907.18474", "g", "8.00"],
    ["0.90718474", "kg", "8.00"],
  ] as const)(
    "validates equivalent %s %s against exact originals",
    (quantity, quantityUnit, lineTotal) => {
      const data = input([
        item({ quantity, measure: { ...mass, quantityUnit }, lineTotal }),
      ]);
      expect(measuredGrantItems(data)[0].quantity).toBe(quantity);
    },
  );

  it("preserves trusted legacy unit limits without widening new capture parsers", () => {
    for (const line of [
      item({
        quantity: "2147483647.000000000",
        unitPrice: "0.00",
        lineTotal: "0.00",
      }),
      item({
        quantity: "1",
        unitPrice: "9999999999.990000000",
        lineTotal: "9999999999.99",
      }),
    ])
      expect(measuredGrantItems(input([line]))[0]).toEqual(line);
  });

  it("keeps allocated gross lines and net total when an authorized discount exists", () => {
    const data = input([item()], "USD", "3.00");
    expect(data.total).toBe("5.00");
    expect(measuredGrantItems(data)[0].lineTotal).toBe("8.00");
  });

  it("uses the authoritative allocation in zero-minor currencies", () => {
    const data = input(
      [
        item({ quantity: "1", unitPrice: "0.5", lineTotal: "1" }),
        item({
          sourceLineId: "second",
          quantity: "1",
          unitPrice: "0.5",
          lineTotal: "0",
        }),
      ],
      "JPY",
    );
    expect(measuredGrantItems(data).map((line) => line.lineTotal)).toEqual([
      "1",
      "0",
    ]);
  });

  it.each([
    (data: ReturnType<typeof input>) => {
      data.total = "7.99";
    },
    (data: ReturnType<typeof input>) => {
      data.currencyCode = "JPY";
    },
    (data: ReturnType<typeof input>) => {
      data.items[0].sourceLineId = "other source";
    },
    (data: ReturnType<typeof input>) => {
      data.items[0].quantity = "3";
    },
    (data: ReturnType<typeof input>) => {
      data.items[0].unitPrice = "4.000000001";
    },
    (data: ReturnType<typeof input>) => {
      data.items[0].lineTotal = "7.99";
    },
    (data: ReturnType<typeof input>) => {
      data.settlement.lines[0].money.originals.gross.numerator = "799";
    },
    (data: ReturnType<typeof input>) => {
      data.items[0].measure = {
        ...mass,
        quantityUnit: "unit",
      } as unknown as LineMeasure;
    },
    (data: ReturnType<typeof input>) => {
      data.items.push(data.items[0]);
    },
  ])(
    "rejects an incoherent settlement or snapshot before executing SQL",
    async (change) => {
      const data = input();
      change(data);
      const execute = vi.fn();
      await expect(
        persistMeasuredGrant({ ...context, ...data }, { execute }),
      ).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each(["1e2", "NaN", "0", "1.0000000001", "1000000000"])(
    "rejects invalid measured quantity %s",
    (quantity) => {
      const data = input();
      data.items[0] = item({ quantity, measure: mass });
      expect(() => measuredGrantItems(data)).toThrow();
    },
  );

  it("rejects duplicate source references even with the same line count", () => {
    const data = input([item(), item({ sourceLineId: "second" })]);
    data.items[1].sourceLineId = data.items[0].sourceLineId;
    expect(() => measuredGrantItems(data)).toThrow();
  });

  it("serializes precise mass algebra in the same single SQL statement, without claiming canonical mass writes", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const data = input([
      item({
        quantity: "453.592370000",
        unitPrice: "4.000000001",
        measure: mass,
        lineTotal: "4.00",
      }),
    ]);
    expect(
      await persistMeasuredGrant({ ...context, ...data }, { execute }),
    ).toBeNull();
    expect(execute).toHaveBeenCalledTimes(1);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.params).toEqual(
      expect.arrayContaining([
        "453.592370000",
        "4.000000001",
        "mass",
        "g",
        "lb",
        "mass-si-1",
        context.units,
      ]),
    );
    expect(query.sql).toContain("INSERT INTO core.order_item");
    expect(query.sql).toContain("UPDATE consumer.program_membership");
    expect(query.sql).toContain("INSERT INTO consumer.wallet_push_queue");
    expect(query.sql).not.toContain("ON CONFLICT DO NOTHING");
    expect(query.params).not.toContain(data.items[0].sourceLineId);
  });

  it("legacy and measured calls use the identical statement and preserve legacy quantities", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const data = input();
    await persistGrant(
      { ...context, ...data, items: [{ ...data.items[0], quantity: 2 }] },
      { execute },
    );
    await persistMeasuredGrant({ ...context, ...data }, { execute });
    const queries = execute.mock.calls.map(([query]) =>
      new PgDialect().sqlToQuery(query),
    );
    expect(queries[0]).toEqual(queries[1]);
    await persistGrant(
      {
        ...context,
        ...data,
        items: [
          {
            ...data.items[0],
            quantity: 2147483647,
            unitPrice: "0.00",
            lineTotal: "0.00",
          },
        ],
      },
      { execute },
    );
    expect(
      new PgDialect().sqlToQuery(execute.mock.calls[2][0]).params,
    ).toContain("2147483647");
  });
});
