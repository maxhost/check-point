import type { CounterProduct } from "../counter/types";
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
export type PosSession = {
  authenticated: boolean;
  user?: { id: string };
  business?: {
    id: string;
    status: string;
    timezone: string;
    posEnabled: boolean;
    currencyCode: string;
  } | null;
  membership?: { role: string; status: string; permissions: string[] } | null;
};
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
  const response = await fetch(url, {
    method,
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new PosError(
      payload?.error ?? "No pudimos completar la acción. Intenta otra vez.",
      payload?.code,
      payload?.order,
      payload?.openCount,
      response.status,
    );
  if (!payload)
    throw new Error("No pudimos leer la respuesta. Intenta otra vez.");
  return payload as T;
}
export const orderUrl = (id: string) =>
  `/api/pos/orders/${encodeURIComponent(id)}`;
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
