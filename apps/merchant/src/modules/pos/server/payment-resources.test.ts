import { describe, expect, it } from "vitest";
import type { DbTransaction } from "@mi-pasaporte/db";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { paymentResourceProviders } from "./payment-resources";
const provider = paymentResourceProviders.find(
  (p) => p.resourceType === "sale_settlement",
)!;
const zero = () =>
  buildFinancialSettlement({
    currencyCode: "USD",
    lines: [
      { sourceLineId: "line", position: 0, unitPrice: "0.00", quantity: 1 },
    ],
    discount: null,
    payments: [],
  });
const read = (settlement: unknown, status = "closed") =>
  provider.read(
    {
      select: () => ({
        from: () => ({
          where: async () => [
            { id: "order", locationId: "location", status, settlement },
          ],
        }),
      }),
    } as unknown as DbTransaction,
    "business",
    ["order"],
  );
describe("POS settlement metadata is evidence, not reconstruction", () => {
  it("exposes only validated minimal zero metadata", async () => {
    expect(await read(zero())).toEqual([
      {
        resourceId: "order",
        metadata: {
          sourceOrderId: "order",
          locationId: "location",
          snapshotPresent: true,
          collectedTotal: "0.00",
          currencyCode: "USD",
          minorUnit: 2,
        },
      },
    ]);
  });
  it.each([null, { collected: "0.00", currencyCode: "USD", minorUnit: 2 }])(
    "missing or malformed durable snapshot is unknown",
    async (snapshot) => {
      expect(await read(snapshot)).toMatchObject([
        {
          metadata: {
            snapshotPresent: false,
            collectedTotal: null,
            currencyCode: null,
            minorUnit: null,
          },
        },
      ]);
    },
  );
  it("an open order is never certain sold evidence", async () => {
    expect(await read(zero(), "open")).toMatchObject([
      { metadata: { snapshotPresent: false, collectedTotal: null } },
    ]);
  });
  it("a balanced counterfeit zero with a positive original net is unknown", async () => {
    const snapshot = buildFinancialSettlement({
      currencyCode: "USD",
      lines: [
        { sourceLineId: "line", position: 0, unitPrice: "1.00", quantity: 1 },
      ],
      discount: null,
      payments: [{ paymentId: "payment", methodId: "method", amount: "1.00" }],
    });
    snapshot.collected = "0.00";
    snapshot.roundingAdjustment = "-1.00";
    snapshot.normalizationAdjustments.net = {
      numerator: "-100",
      denominator: "1",
      scale: 2,
    };
    snapshot.lines[0].money.net = "0.00";
    snapshot.lines[0].money.roundingAdjustment = "-1.00";
    snapshot.lines[0].money.normalizationAdjustments.net = {
      numerator: "-100",
      denominator: "1",
      scale: 2,
    };
    snapshot.payments = [];
    snapshot.paymentOriginals = [];
    expect(await read(snapshot)).toMatchObject([
      { metadata: { snapshotPresent: false, collectedTotal: null } },
    ]);
  });
});
