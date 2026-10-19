import type {
  BackofficeInitialContext,
  ModuleDTO,
} from "../../../apps/merchant/src/backoffice-context-contract";
import type { PosOrderV2 } from "../../../apps/merchant/src/modules/pos/contracts";
import { connectedOrder } from "./pos-connected-console-fixture";
export const actionOpen: PosOrderV2 = {
  ...connectedOrder,
  total: "4.00",
  id: "action-open",
  orderLabel: "Pedido abierto",
};
export const actionClosed: PosOrderV2 = {
  ...connectedOrder,
  total: "4.00",
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

export function actionCore(scope = "a"): BackofficeInitialContext {
  return {
    version: 1,
    bootId: `actions-${scope}`,
    scopeKey: scope.repeat(64),
    userId: "actions-user",
    emailVerified: true,
    business: {
      id: `actions-${scope}`,
      name: "Comercio",
      status: "active",
      timezone: "America/Guayaquil",
      currencyCode: "USD",
    },
    membership: { role: "owner", status: "active", permissions: ["pos"] },
    billing: { access: "subscribed", trialDaysLeft: null, trialEndsAt: null },
  };
}
export const actionModule: ModuleDTO = {
  id: "pos",
  name: "POS",
  description: "",
  enabled: true,
  requires: [],
  suggested: false,
  navigation: [],
  permissions: [],
};
