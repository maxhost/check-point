import type { PosOrderV2 } from "../../../apps/merchant/src/modules/pos/contracts";
import { connectedOrder } from "./pos-connected-console-fixture";
export const actionOpen: PosOrderV2 = {
  ...connectedOrder,
  id: "action-open",
  orderLabel: "Pedido abierto",
};
export const actionClosed: PosOrderV2 = {
  ...connectedOrder,
  id: "action-closed",
  orderLabel: "Pedido cerrado",
  status: "closed",
  closedAt: new Date().toISOString(),
};
export const actionHistory = () => ({
  open: [
    { ...actionOpen, lineCount: actionOpen.items.length, saleTotal: null },
  ],
  closedToday: [
    {
      ...actionClosed,
      lineCount: actionClosed.items.length,
      saleTotal: actionClosed.total,
    },
  ],
});
