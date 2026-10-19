import { buildFinancialSettlementFromSnapshots } from "../../../packages/domain/src/financial";
import type { PosOrderV2 } from "../../../apps/merchant/src/modules/pos/contracts";
export const ticketOrder: PosOrderV2 = {
  contractVersion: 2,
  id: "ticket-a",
  status: "open",
  version: 1,
  saleType: "pickup",
  orderLabel: "Pedido de montaña para recoger",
  tableLabel: "",
  tableId: null,
  location: null,
  note: "Conserva la molienda y prepara el pedido sin mezclar variedades.",
  business: { name: "Café de montaña", currencyCode: "USD" },
  items: [
    {
      lineId: "mass",
      productId: "coffee",
      name: "Café de montaña · selección especial de la cosecha para preparar y compartir en casa",
      quantity: "0.123456789",
      unitPrice: "12.123456789",
      measure: {
        kind: "mass",
        quantityUnit: "kg",
        priceUnit: "lb",
        conversionVersion: "mass-si-1",
      },
      lineTotal: "3.30",
    },
  ],
  total: "3.30",
  createdAt: "2026-10-18T12:00:00Z",
  createdBy: "operator",
  closedAt: null,
  closedBy: null,
  sale: null,
  settlement: null,
};
export function closedTicket(pass = false): PosOrderV2 {
  const settlement = buildFinancialSettlementFromSnapshots({
    currencyCode: "USD",
    lines: ticketOrder.items.map((line, position) => ({
      ...line,
      sourceLineId: line.lineId,
      position,
    })),
    discount: {
      amount: "0.30",
      origin: { type: "campaign_coupon", sourceId: "coupon", scope: "order" },
    },
    payments: [{ paymentId: "payment", methodId: "cash", amount: "3.00" }],
  });
  return {
    ...ticketOrder,
    status: "closed",
    version: 2,
    closedAt: "2026-10-18T12:01:00Z",
    closedBy: "operator",
    settlement,
    sale: pass
      ? {
          consumer: "Ana",
          total: settlement.collected,
          grossTotal: settlement.gross,
          unitsGranted: 5,
          balanceAfter: 18,
          kind: "points",
          coupon: {
            label: "Tu beneficio de cosecha",
            discountAmount: settlement.discount,
            extraUnits: 2,
          },
        }
      : null,
  };
}
