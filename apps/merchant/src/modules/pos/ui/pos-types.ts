import {
  panelRequest,
  PanelRequestError,
} from "../../../app/backoffice/panel-request";
import type { CounterProduct } from "../../../app/backoffice/counter/types";
export type PosLocation = { id: string; name: string };
export type PosSale = {
  consumer: string;
  total: string;
  grossTotal: string;
  unitsGranted: number;
  balanceAfter: number;
  kind: "points" | "stamps";
  coupon: {
    label: string;
    discountAmount: string;
    extraUnits: number | null;
  } | null;
};
export type PosItem = {
  lineId: string;
  productId: string | null;
  name: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
};
export type PosOrder = {
  id: string;
  status: "open" | "closed" | "voided";
  version: number;
  tableLabel: string;
  note: string | null;
  /** Optional for older cached snapshots; the current API always supplies it. */
  tableId?: string | null;
  location: PosLocation | null;
  business: { name: string; currencyCode: string };
  items: PosItem[];
  total: string;
  createdAt: string;
  createdBy: string;
  closedAt: string | null;
  closedBy: string | null;
  sale: PosSale | null;
};
export type PosSummary = Pick<
  PosOrder,
  | "id"
  | "status"
  | "tableLabel"
  | "tableId"
  | "location"
  | "total"
  | "createdAt"
  | "closedAt"
> & { itemCount: number; saleTotal: string | null };
export type PosHistory = { open: PosSummary[]; closedToday: PosSummary[] };
export type PosCatalog = {
  bestSellingProductIds: string[];
  products: CounterProduct[];
  categories: { id: string; name: string }[];
};
export type { PanelSession as PosSession } from "../../../app/backoffice/panel-request";
export type DraftLine = {
  key: string;
  lineId?: string;
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  needsPrice: boolean;
};
export class PosError extends Error {
  constructor(
    message: string,
    public code?: string,
    public order?: PosOrder,
    public openCount?: number,
    public status?: number,
  ) {
    super(message);
  }
}
export async function posRequest<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  try {
    return await panelRequest<T>(url, method, body);
  } catch (cause) {
    if (cause instanceof PanelRequestError)
      throw new PosError(
        cause.message,
        cause.code,
        cause.payload.order as PosOrder | undefined,
        cause.payload.openCount as number | undefined,
        cause.status,
      );
    throw cause;
  }
}
export const orderUrl = (id: string) =>
  `/api/modules/pos/orders/${encodeURIComponent(id)}`;
export function draftItems(order: PosOrder): DraftLine[] {
  return order.items.map((item) => ({
    key: item.lineId,
    lineId: item.lineId,
    productId: item.productId,
    name: item.name,
    unitPrice: Number(item.unitPrice),
    quantity: item.quantity,
    needsPrice: false,
  }));
}
export function linePayload(lines: DraftLine[]) {
  return lines.map((line) => ({
    ...(line.lineId ? { lineId: line.lineId } : {}),
    productId: line.productId,
    quantity: line.quantity,
    ...(!line.lineId && line.needsPrice
      ? { unitPrice: line.unitPrice.toFixed(2) }
      : {}),
  }));
}
