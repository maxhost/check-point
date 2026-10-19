import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import type { PosOrderV2, SaleType } from "../../../contracts";
import type { TicketDoc, TicketSettings } from "./types";

const saleTypes: Record<SaleType, string> = {
  table: "Mesa",
  pickup: "Para recoger",
  delivery: "Entrega",
  counter: "Mostrador",
  legacy: "Pedido anterior",
};

/** Exact captured decimals stay textual. Only the domain kernel allocates open money.
 * Terminal orders use their historical settlement/snapshots, never current pricing. */
export function buildMeasuredTicket(
  order: PosOrderV2,
  settings: TicketSettings,
  opts: { now?: Date; qr?: string } = {},
): TicketDoc {
  const amounts =
    order.status === "open"
      ? buildFinancialAmountsFromSnapshots({
          currencyCode: order.business.currencyCode,
          discount: null,
          lines: order.items.map((line, position) => ({
            ...line,
            sourceLineId: line.lineId,
            position,
          })),
        })
      : order.settlement;
  const currency = amounts?.currencyCode ?? order.business.currencyCode;
  // Do not infer today's currency precision for historical settlements. Their
  // decimal strings already carry the frozen minorUnit (including zero).
  const money = (value: string) => `${value} ${currency}`;
  const now = opts.now ?? new Date();
  return {
    metadata: {
      kind:
        order.status === "open"
          ? "Precuenta"
          : order.status === "closed"
            ? "Venta cerrada · Reimpresión"
            : "Orden anulada",
      saleType: saleTypes[order.saleType],
      identifier: order.orderLabel || order.id,
      note: order.note,
    },
    businessName: settings.showBusinessName ? order.business.name : null,
    table:
      settings.showTable && order.saleType === "table"
        ? order.tableLabel.trim() || null
        : null,
    lines: order.items.map((line) => {
      const snapshot =
        amounts?.lines.find((item) => item.sourceLineId === line.lineId) ??
        line.financialSnapshot;
      return {
        name: line.name,
        quantity: `${line.quantity} ${line.measure.quantityUnit}`,
        unitPrice: `${money(line.unitPrice)}/${line.measure.priceUnit}`,
        lineTotal: money(snapshot?.money.net ?? line.lineTotal),
      };
    }),
    ...(amounts
      ? {
          summary: {
            gross: money(amounts.gross),
            discount: money(amounts.discount),
            roundingAdjustment: /^-?0(?:\.0+)?$/.test(
              amounts.roundingAdjustment,
            )
              ? null
              : `${amounts.roundingAdjustment.startsWith("-") ? "" : "+"}${money(amounts.roundingAdjustment)}`,
          },
        }
      : {}),
    total: money(amounts?.collected ?? order.sale?.total ?? order.total),
    date: now.toLocaleDateString("es-EC"),
    time: now.toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
    qr: opts.qr?.trim() || null,
  };
}
