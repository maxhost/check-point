export type CounterLocation = { id: string; name: string };

/** The three actions of the resolved stage. Hoisted here (spec 0055) because it used to
 * be declared twice, unexported, in `counter-console.tsx` and `stages.tsx`. */
export type Mode = "detailed" | "quick" | "redeem";

/** The ONE client-facing reward shape, mirroring `RewardDTO`
 * (`server/loyalty-program/client-view.ts`, contract fixed in
 * `docs/specs/0055-contratos-del-orquestador.md` §1). Public `imagePath` only —
 * an `*ObjectKey` never reaches the browser. */
export type CounterReward = {
  id: string;
  type: string;
  label: string;
  productId: string | null;
  discountPercent: number | null;
  pointsCost: number | null;
  position: number;
  imagePath: string | null;
};

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
    /** Whether this program lets the operator hand a reward over without enough
     * balance (spec 0055 §5); the balance then falls to 0, never below. */
    redeemAllowInsufficient: boolean;
    /** Raw `configuration.target` (the Sellos card size), served by `programDTO` and
     * deliberately NOT normalized: the console validates it with the same semantics as
     * the server's `planRedemption`, so it can never paint "Canjeable" on a program the
     * redemption answers `422 invalid_program` to. Stays optional because an absent or
     * junk value must degrade to `unavailable` (cases 25-28), never to a free redemption. */
    target?: unknown;
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
  /** The program's rewards, already ordered by `position` by the server. */
  rewards: CounterReward[];
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

/** `POST /api/counter/redeem` (spec 0055). Mirrors `RedeemResult` in
 * `server/counter/redeem.ts`: the reward snapshot, what was debited, the resulting
 * balance and whether THIS operation used the insufficient-balance dispensation. */
export type RedeemResponse = {
  redemption: {
    rewardLabel: string;
    rewardType: string;
    discountPercent: number | null;
    unitsDebited: number;
    balanceAfter: number;
    kind: string;
    override: boolean;
  };
};

/** One row of the day's history shown on the idle console. `entryKind` tells the two
 * events of value apart (spec 0055): an accreditation adds units, a redemption debits
 * them and is the only one carrying a `rewardLabel`. */
export type AccreditationRow = {
  id: string;
  createdAt: string;
  operator: string;
  consumer: string;
  accrualKind: string;
  unitsGranted: number;
  entryKind: "accrual" | "redemption";
  rewardLabel: string | null;
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

/**
 * What the Canjear mode shows for ONE reward. `enabled` is the only thing the confirm
 * button reads; `label` is the only copy the row prints for the state.
 */
export type RewardState = {
  status: "redeemable" | "short" | "unavailable";
  /** The cost of this reward in the program's unit: `pointsCost` (Puntos) or the card
   * `target` (Sellos). `null` when it could not be determined. */
  cost: number | null;
  /** How many units are missing; `0` unless `status === "short"`. */
  missing: number;
  enabled: boolean;
  label: string;
};

/**
 * PURE decision of a reward's state in the Canjear mode (spec 0055 «UI — consola de
 * mostrador»), with a case table as its oracle (`types.test.ts`).
 *
 * It MIRRORS the evaluation order of the server's `planRedemption`
 * (`server/counter/redeem-plan.ts`, contract §2) so the operator never sees "Canjeable"
 * on something the server answers `422` to. It is NOT the decider: the server debits
 * inside a locked transaction over the fresh balance, and this runs on the snapshot the
 * scan returned. A reward shown as redeemable can still come back `insufficient_balance`
 * if the balance moved in between — that path stays on the error toast.
 *
 * Declared, not papered over: extracting this pins the DECISION, not the wiring. That
 * `redeem-panel.tsx` renders the state it returns, and that the console posts the reward
 * the operator selected, is not covered by this unit.
 */
export function rewardState(input: {
  kind: string;
  balance: number;
  /** Raw `configuration.target`; only read for Sellos, exactly like the server. */
  target: unknown;
  reward: { pointsCost: number | null };
  redeemAllowInsufficient: boolean;
}): RewardState {
  const unavailable: RewardState = {
    status: "unavailable",
    cost: null,
    missing: 0,
    enabled: false,
    label: "No disponible",
  };
  if (!Number.isInteger(input.balance) || input.balance < 0) return unavailable;
  const cost =
    input.kind === "stamps"
      ? costFromTarget(input.target)
      : costFromPointsCost(input.reward.pointsCost);
  if (cost === null) return unavailable;

  if (input.balance >= cost) {
    return {
      status: "redeemable",
      cost,
      missing: 0,
      enabled: true,
      label: "Canjeable",
    };
  }
  const missing = cost - input.balance;
  return {
    status: "short",
    cost,
    missing,
    // The program may let the operator hand it over anyway; the balance falls to 0
    // (spec 0055 §9) and the server records `insufficient_override`.
    enabled: input.redeemAllowInsufficient,
    label: `Faltan ${missing} ${unitLabel(input.kind, missing)}`,
  };
}

/** Puntos: the reward's own cost. `null`, `0`, negatives and decimals are a broken
 * reward (the DB check only says `IS NULL OR > 0`) — the server answers `invalid_reward`. */
function costFromPointsCost(pointsCost: number | null): number | null {
  return Number.isInteger(pointsCost) && (pointsCost as number) >= 1
    ? (pointsCost as number)
    : null;
}

/** Sellos: the card size, raw out of the program jsonb. A numeric string is accepted
 * (`Number("10") === 10`); everything else is a broken program, never a free redemption
 * — `Number(null) === 0` would make every card look complete. */
function costFromTarget(target: unknown): number | null {
  if (typeof target !== "number" && typeof target !== "string") return null;
  const parsed = Number(target);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

/** Whether the console may post a redemption: a reward of THIS scan is selected and its
 * state allows it. Single source for the Confirm button of the Canjear mode. */
export function canRedeem(
  resolved: ResolveResponse | null,
  rewardId: string | null,
): boolean {
  const reward = resolved?.rewards.find((item) => item.id === rewardId);
  if (!resolved || !reward) return false;
  return rewardState({
    kind: resolved.program.kind,
    balance: balanceFor(resolved.program.kind, resolved.membership),
    target: resolved.program.target,
    reward,
    redeemAllowInsufficient: resolved.program.redeemAllowInsufficient,
  }).enabled;
}
