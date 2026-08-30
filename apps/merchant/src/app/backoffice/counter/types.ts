export type CounterLocation = { id: string; name: string };

export type ResolveResponse = {
  consumer: { displayName: string };
  membership: {
    id: string;
    pointsBalance: number;
    stampsCount: number;
    justEnrolled: boolean;
  };
  program: {
    id: string;
    kind: string;
    accrual: {
      mode: string | null;
      grant: number | null;
      blockAmount: number | null;
    };
    cardDesign: {
      backgroundColor: string | null;
      backgroundColor2: string | null;
      gradientAngle: number | null;
      borderColor: string | null;
    };
  };
  catalog: {
    products: CounterProduct[];
    categories: { id: string; name: string }[];
  };
};

export type CounterProduct = {
  id: string;
  name: string;
  categoryId: string | null;
  unitPrice: number | null;
  imagePath: string | null;
};

export type GrantResponse = {
  order: { unitsGranted: number; balanceAfter: number; kind: string };
};

/** One row of the day's accreditation history shown on the idle console. */
export type AccreditationRow = {
  id: string;
  createdAt: string;
  operator: string;
  consumer: string;
  accrualKind: string;
  unitsGranted: number;
};

/** A cart line. `hasStoredPrice` is false when the catalog product has no price and
 * the operator must type the line amount (the server snapshots it either way). */
export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  hasStoredPrice: boolean;
  quantity: number;
};

/** Formats an amount in the business currency; falls back to the raw number on bad ISO. */
export function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

/** The kind-specific balance for a membership, given the program kind. */
export function balanceFor(
  kind: string,
  membership: { pointsBalance: number; stampsCount: number },
): number {
  return kind === "stamps" ? membership.stampsCount : membership.pointsBalance;
}

/** Client-side preview of the units a sale would grant, mirroring the server's
 * `computeAccrual` (spec 0036). Informational only — never editable, never sent;
 * helps the operator catch pricing/catalog mistakes before confirming. */
export function previewUnits(
  accrual: {
    mode: string | null;
    grant: number | null;
    blockAmount: number | null;
  },
  total: number,
): number {
  if (accrual.grant === null) return 0;
  if (accrual.mode === "per_purchase") return accrual.grant;
  if (accrual.mode !== "per_amount") return 0;
  const block = accrual.blockAmount;
  if (!block || block <= 0 || total <= 0) return 0;
  return Math.floor(total / block) * accrual.grant;
}

export const unitLabel = (kind: string, n: number): string =>
  kind === "stamps"
    ? n === 1
      ? "sello"
      : "sellos"
    : n === 1
      ? "punto"
      : "puntos";
