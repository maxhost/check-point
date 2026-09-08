"use client";

import {
  type CounterReward,
  type RedeemResponse,
  type ResolveResponse,
  balanceFor,
  rewardState,
  unitLabel,
} from "./types";

/**
 * The Canjear mode (spec 0055), the third action of the resolved stage. It lives in its
 * own module on purpose: `counter-console.tsx` (256 lines) and `stages.tsx` (243) are
 * near the 300-line budget, so the new mode enters through a new component instead of
 * fattening them.
 *
 * It only PAINTS the decision: every enabled/disabled state comes from `rewardState`
 * in `types.ts`, which has the case table as its oracle. The real guard is the server:
 * this list is the snapshot the scan returned, the balance may have moved since, and the
 * debit happens inside a locked transaction that re-decides with `planRedemption`.
 */
export function RedeemPanel({
  resolved,
  selectedRewardId,
  onSelect,
}: {
  resolved: ResolveResponse;
  selectedRewardId: string | null;
  onSelect: (rewardId: string) => void;
}) {
  const kind = resolved.program.kind;
  const balance = balanceFor(kind, resolved.membership);
  const isStamps = kind === "stamps";
  // Sellos = one reward per card (spec 0036); Puntos = the whole list, by `position`.
  const rewards = isStamps ? resolved.rewards.slice(0, 1) : resolved.rewards;

  if (rewards.length === 0) {
    return (
      <p className="counter-hint">
        Este programa todavía no tiene premios configurados.
      </p>
    );
  }

  return (
    <ul className="counter-rewards" role="radiogroup" aria-label="Premios">
      {rewards.map((reward) => (
        <RewardRow
          key={reward.id}
          reward={reward}
          kind={kind}
          balance={balance}
          state={rewardState({
            kind,
            balance,
            target: resolved.program.target,
            reward,
            redeemAllowInsufficient: resolved.program.redeemAllowInsufficient,
          })}
          isStamps={isStamps}
          selected={reward.id === selectedRewardId}
          onSelect={() => onSelect(reward.id)}
        />
      ))}
    </ul>
  );
}

/** One selectable reward: what it is, what it costs and whether it can be handed over.
 * Single selection — a redemption is exactly one reward (spec 0055 §4). */
function RewardRow({
  reward,
  kind,
  balance,
  state,
  isStamps,
  selected,
  onSelect,
}: {
  reward: CounterReward;
  kind: string;
  balance: number;
  state: ReturnType<typeof rewardState>;
  isStamps: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={!state.enabled}
        className={`counter-reward ${selected ? "is-selected" : ""} is-${state.status}`}
        onClick={onSelect}
      >
        {reward.imagePath && (
          <img src={reward.imagePath} alt="" aria-hidden="true" />
        )}
        <span className="counter-reward-body">
          <strong>{rewardTitle(reward)}</strong>
          <span className="counter-reward-cost">
            {isStamps
              ? `${balance} de ${state.cost ?? "—"} ${unitLabel(kind, state.cost ?? 0)}`
              : state.cost === null
                ? "Sin costo configurado"
                : `${state.cost} ${unitLabel(kind, state.cost)}`}
          </span>
        </span>
        <span className={`counter-reward-state is-${state.status}`}>
          {state.label}
        </span>
      </button>
    </li>
  );
}

/** A discount reward has no name of its own: its percentage IS what gets handed over. */
function rewardTitle(reward: CounterReward): string {
  if (reward.type === "discount" && reward.discountPercent !== null) {
    return `${reward.discountPercent}% de descuento`;
  }
  return reward.label;
}

/** Done screen of a redemption: what to HAND OVER, big, plus the resulting balance and
 * the manual restart (enmienda QA of spec 0030 — the console never auto-advances). */
export function RedeemDone({
  redeemed,
  displayName,
  onNext,
}: {
  redeemed: RedeemResponse;
  displayName: string;
  onNext: () => void;
}) {
  const { redemption } = redeemed;
  return (
    <section className="counter-panel counter-done">
      <p className="counter-check" aria-hidden>
        ✓
      </p>
      <h2>Entregá</h2>
      <p className="counter-reward-delivered">
        {redemption.rewardType === "discount" &&
        redemption.discountPercent !== null
          ? `${redemption.discountPercent}% de descuento`
          : redemption.rewardLabel}
      </p>
      <p className="counter-hint">para {displayName}</p>
      <p className="counter-granted">
        −{redemption.unitsDebited}{" "}
        {unitLabel(redemption.kind, redemption.unitsDebited)}
      </p>
      <p className="counter-balance">
        Saldo: {redemption.balanceAfter}{" "}
        {unitLabel(redemption.kind, redemption.balanceAfter)}
      </p>
      {redemption.override && (
        <p className="counter-hint">
          Se entregó sin saldo suficiente: el saldo quedó en 0.
        </p>
      )}
      <button type="button" className="counter-primary" onClick={onNext}>
        Escanear siguiente
      </button>
    </section>
  );
}

/**
 * `POST /api/counter/redeem`. The `clientRequestId` is minted once per scan, exactly
 * like the grant: this is the SECOND layer of idempotency (the button also disables on
 * the first tap), never the first — the first one is the server's locked transaction.
 */
export async function postRedeem(body: {
  clientRequestId: string;
  membershipId: string;
  rewardId: string | null;
  locationId: string | null;
}): Promise<RedeemResponse> {
  const response = await fetch("/api/counter/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !("redemption" in payload)) {
    throw new Error(payload?.error ?? "No pudimos canjear.");
  }
  return payload as RedeemResponse;
}
