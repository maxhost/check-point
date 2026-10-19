import { describe, expect, it } from "vitest";
import {
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
} from "@mi-pasaporte/domain/financial";
import {
  ticketOrder,
  closedTicket,
} from "../../../../../../../../tests/e2e/support/pos-measured-ticket-fixture";
import {
  buildMeasuredDraftTicket,
  buildMeasuredTicket,
} from "./build-measured";
import { layoutTicket, COLUMNS } from "../escpos/layout";
import { encodeTicket } from "../escpos/encode";
import type { PosOrderV2 } from "../../../contracts";
const settings = { showBusinessName: true, showTable: true };
const now = new Date("2026-10-18T12:00:00Z");
const build = (order: PosOrderV2) =>
  buildMeasuredTicket(order, settings, { now });

describe("measured document preserves exact snapshots and monetary authority", () => {
  it("keeps nine-place quantity and differing tariff unit, without cent rounding", () => {
    const doc = build(ticketOrder);
    expect(doc.lines[0]).toMatchObject({
      quantity: "0.123456789 kg",
      unitPrice: "12.123456789 USD/lb",
      lineTotal: "3.30 USD",
    });
    expect(doc.metadata).toMatchObject({
      kind: "Precuenta",
      saleType: "Para recoger",
      identifier: ticketOrder.orderLabel,
      note: ticketOrder.note,
    });
    expect(doc.total).toBe("3.30 USD");
  });
  it("preserves broad legacy quantity and tariff text", () => {
    for (const [quantity, unitPrice] of [
      ["2147483647", "0.01"],
      ["1", "9999999999.990000000"],
    ]) {
      const order = structuredClone(ticketOrder);
      order.items[0] = {
        ...order.items[0],
        quantity,
        unitPrice,
        measure: {
          kind: "unit",
          quantityUnit: "unit",
          priceUnit: "unit",
          conversionVersion: "mass-si-1",
        },
      };
      expect(build(order).lines[0]).toMatchObject({
        quantity: `${quantity} unit`,
        unitPrice: `${unitPrice} USD/unit`,
      });
    }
  });
  it.each(["kg", "lb", "g"] as const)(
    "prints the captured %s unit",
    (quantityUnit) => {
      const order = structuredClone(ticketOrder);
      order.items[0].measure = {
        kind: "mass",
        quantityUnit,
        priceUnit: "g",
        conversionVersion: "mass-si-1",
      };
      expect(build(order).lines[0].quantity).toBe(
        `0.123456789 ${quantityUnit}`,
      );
      expect(build(order).lines[0].unitPrice).toBe("12.123456789 USD/g");
    },
  );
  it("allocates the open COP 2 × 0.49 canonically to 1 + 0 = 1", () => {
    const order = structuredClone(ticketOrder);
    order.business.currencyCode = "COP";
    order.items = ["a", "b"].map((lineId) => ({
      ...order.items[0],
      lineId,
      quantity: "1",
      unitPrice: "0.49",
      lineTotal: "0.49",
      measure: {
        kind: "unit",
        quantityUnit: "unit",
        priceUnit: "unit",
        conversionVersion: "mass-si-1",
      },
    }));
    const doc = build(order);
    expect(doc.lines.map((line) => line.lineTotal)).toEqual(["1 COP", "0 COP"]);
    expect(doc.total).toBe("1 COP");
  });
  it.each(["USD", "COP", "JPY"])(
    "uses frozen %s settlement including zero, discount and rounding",
    (currencyCode) => {
      const order = closedTicket(true);
      order.items[0] = {
        ...order.items[0],
        quantity: "1",
        unitPrice: "0.49",
        measure: {
          kind: "unit",
          quantityUnit: "unit",
          priceUnit: "unit",
          conversionVersion: "mass-si-1",
        },
      };
      order.settlement = buildFinancialSettlementFromSnapshots({
        currencyCode,
        lines: [{ ...order.items[0], sourceLineId: "mass", position: 0 }],
        discount: {
          amount: "0.49",
          origin: {
            type: "campaign_coupon",
            sourceId: "coupon",
            scope: "order",
          },
        },
        payments: [],
      });
      // Today's business currency and DTO totals cannot replace the closed settlement.
      order.business.currencyCode = "EUR";
      order.total = "999.00";
      const doc = build(order);
      expect(doc.total).toBe(`${order.settlement.collected} ${currencyCode}`);
      expect(doc.summary?.gross).toBe(
        `${order.settlement.gross} ${currencyCode}`,
      );
      expect(doc.summary?.discount).toBe(
        `${order.settlement.discount} ${currencyCode}`,
      );
      expect(doc.lines[0].lineTotal).toBe(
        `${order.settlement.lines[0].money.net} ${currencyCode}`,
      );
    },
  );
  it.each([
    ["1.49", "0.51", "1", "+1 COP"],
    ["0.51", "0.49", "0", "-1 COP"],
  ])(
    "prints frozen rounding from %s minus %s",
    (price, discount, collected, adjustment) => {
      const order = closedTicket();
      order.items[0] = {
        ...order.items[0],
        quantity: "1",
        unitPrice: price,
        measure: {
          kind: "unit",
          quantityUnit: "unit",
          priceUnit: "unit",
          conversionVersion: "mass-si-1",
        },
      };
      order.settlement = buildFinancialSettlementFromSnapshots({
        currencyCode: "COP",
        lines: [{ ...order.items[0], sourceLineId: "mass", position: 0 }],
        discount: {
          amount: discount,
          origin: {
            type: "campaign_coupon",
            sourceId: "coupon",
            scope: "order",
          },
        },
        payments:
          collected === "0"
            ? []
            : [{ paymentId: "payment", methodId: "cash", amount: collected }],
      });
      const doc = build(order);
      expect(doc.total).toBe(`${collected} COP`);
      expect(doc.summary?.roundingAdjustment).toBe(adjustment);
      for (const paper of [58, 80] as const) {
        const rows = layoutTicket(doc, paper)
          .filter((row) => row.kind === "text")
          .map((row) => row.text)
          .join(" ");
        expect(rows).toContain(`Ajuste de redondeo: ${adjustment}`);
      }
    },
  );
  it("does not recalculate a terminal legacy snapshot and never labels voided as a sale", () => {
    const order = { ...ticketOrder, status: "voided" as const, total: "87.00" };
    expect(build(order).metadata?.kind).toBe("Orden anulada");
    expect(build(order).total).toBe("87.00 USD");
    expect(build(order).lines[0].lineTotal).toBe(
      ticketOrder.items[0].lineTotal + " USD",
    );
    const closed = closedTicket();
    closed.settlement = null;
    closed.sale = {
      consumer: "Ana",
      total: "0.00",
      grossTotal: "87.00",
      unitsGranted: 0,
      balanceAfter: 0,
      kind: "stamps",
      coupon: null,
    };
    expect(build(closed).total).toBe("0.00 USD");
  });
  it.each([58, 80] as const)(
    "shares complete metadata and exact decimals in %s mm ESC/POS bytes",
    (paper) => {
      const doc = build(ticketOrder);
      const rows = layoutTicket(doc, paper).filter(
        (row) => row.kind === "text",
      );
      expect(rows.every((row) => row.text.length <= COLUMNS[paper])).toBe(true);
      const content = rows
        .map((row) => row.text)
        .join(" ")
        .replace(/\s+/g, " ");
      expect(content).toContain("0.123456789 kg x 12.123456789");
      expect(content).toContain("USD/lb");
      expect(content).toContain("Precuenta");
      expect(content).toContain("Nota: Conserva la molienda");
      const bytes = new TextDecoder().decode(encodeTicket(doc, paper));
      expect(bytes).toContain("Precuenta");
      expect(bytes).toContain("0.123456789");
      expect(bytes).toContain("12.123456789");
    },
  );
});

describe("editor precuenta", () => {
  it("prints an unsaved draft without inventing an order identifier", () => {
    const draft = {
      saleType: ticketOrder.saleType,
      orderLabel: "",
      tableLabel: "",
      note: "Sin hielo",
      business: ticketOrder.business,
      items: ticketOrder.items,
    };
    const doc = buildMeasuredDraftTicket(draft, settings);
    expect(doc.metadata).toMatchObject({
      kind: "Precuenta · Borrador sin confirmar",
      identifier: "Nueva orden",
      note: "Sin hielo",
    });
    expect(doc.lines[0].quantity).toBe("0.123456789 kg");
    expect(
      buildMeasuredDraftTicket(draft, settings, { confirmed: true }).metadata
        ?.kind,
    ).toBe("Precuenta");
  });
  it("uses the same preview discount and net total as the editor", () => {
    const amounts = buildFinancialAmountsFromSnapshots({
      currencyCode: "USD",
      lines: ticketOrder.items.map((line, position) => ({
        ...line,
        sourceLineId: line.lineId,
        position,
      })),
      discount: {
        amount: "1.00",
        origin: { type: "campaign_coupon", sourceId: "coupon", scope: "order" },
      },
    });
    const doc = buildMeasuredDraftTicket(ticketOrder, settings, { amounts });
    expect(doc.total).toBe(`${amounts.collected} USD`);
    expect(doc.summary?.discount).toBe("1.00 USD");
    expect(doc.lines[0].lineTotal).toBe(`${amounts.lines[0].money.net} USD`);
  });
});
