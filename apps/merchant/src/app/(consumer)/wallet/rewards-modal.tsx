"use client";

import { useEffect } from "react";
import type { RewardDTO } from "../../../server/loyalty-program/client-view";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";

/**
 * The reward catalog of a program, seen by the consumer (spec 0055 §7). The summary
 * already carries `rewards` (the same DTO the wizard and the counter use — public
 * `imagePath` only, never an R2 object key) and the balance, so the sheet needs no fetch.
 *
 * It answers the question the wallet could not answer before: "I have 50 points — what
 * can I ask for?". Each reward shows its cost and how far away it is.
 */
export function RewardsModal({
  program,
  onClose,
}: {
  program: ConsumerProgramSummary;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const balance = balanceOf(program);
  return (
    <div
      className="consumer-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="consumer-terms-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewards-title"
      >
        <button
          className="consumer-modal-close"
          type="button"
          aria-label="Cerrar catálogo de premios"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="rewards-title">Catálogo de premios</h2>
        <p className="consumer-terms-business">
          Tenés {balance} {program.unitName}
        </p>
        {program.rewards.length === 0 ? (
          <p className="consumer-terms-copy">
            {program.businessName} todavía no publicó sus premios.
          </p>
        ) : (
          <ul className="consumer-rewards">
            {program.rewards.map((reward) => (
              <RewardItem
                key={reward.id}
                reward={reward}
                cost={costOf(program, reward)}
                balance={balance}
                unitName={program.unitName}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RewardItem({
  reward,
  cost,
  balance,
  unitName,
}: {
  reward: RewardDTO;
  cost: number | null;
  balance: number;
  unitName: string;
}) {
  const missing = cost === null ? 0 : cost - balance;
  return (
    <li className="consumer-reward">
      {reward.imagePath && (
        <img src={reward.imagePath} alt="" aria-hidden="true" />
      )}
      <div>
        <strong>{titleOf(reward)}</strong>
        {/* No cost, no promise: an unpriced reward shows its name and nothing else. */}
        {cost !== null && (
          <span className="consumer-reward-cost">
            {cost} {unitName}
          </span>
        )}
      </div>
      {cost !== null && (
        <span
          className={`consumer-reward-gap ${missing <= 0 ? "is-ready" : ""}`}
        >
          {missing <= 0
            ? "Ya podés canjearlo"
            : `Te faltan ${missing} ${unitName}`}
        </span>
      )}
    </li>
  );
}

/** A discount reward has no name of its own: its percentage IS the reward. */
function titleOf(reward: RewardDTO): string {
  if (reward.type === "discount" && reward.discountPercent !== null) {
    return `${reward.discountPercent}% de descuento`;
  }
  return reward.label;
}

const balanceOf = (program: ConsumerProgramSummary): number =>
  program.kind === "stamps" ? program.stampsCount : program.pointsBalance;

/** What this reward costs in the program's unit: the card `target` for Sellos (the whole
 * card buys the single reward), the reward's own `pointsCost` for Puntos. `null` when it
 * is not a usable positive integer — the same shapes the server refuses to redeem. */
function costOf(
  program: ConsumerProgramSummary,
  reward: RewardDTO,
): number | null {
  const cost = program.kind === "stamps" ? program.target : reward.pointsCost;
  return Number.isInteger(cost) && (cost as number) >= 1
    ? (cost as number)
    : null;
}
