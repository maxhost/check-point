import { useState } from "react";
import type { Kind, LoyaltyVm } from "./use-loyalty-program";
import type { RewardDraft } from "./use-rewards";
import { StepCardDesign } from "./steps/step-card-design";
import { StepReview } from "./steps/step-review";
import { StepRewards } from "./steps/step-rewards";
import { StepStampBasics } from "./steps/step-stamp-basics";
import { StepTerms } from "./steps/step-terms";
import { StepUnits } from "./steps/step-units";

type StepId =
  | "modality"
  | "units"
  | "basics"
  | "design"
  | "terms"
  | "rewards"
  | "review";

/** Steps by modality; creation adds the modality picker as step 0 (editing keeps kind fixed). */
function stepsFor(kind: Kind, isCreate: boolean): StepId[] {
  const core: StepId[] =
    kind === "points"
      ? ["units", "terms", "rewards", "review"]
      : ["basics", "design", "terms", "rewards", "review"];
  return isCreate ? ["modality", ...core] : core;
}

/** X (grant) is a positive integer; Y (blockAmount) > 0 only when the mode is per_amount. */
function accrualValid(vm: LoyaltyVm): boolean {
  const earn = vm.earn;
  if (!Number.isInteger(earn.grant) || earn.grant <= 0) return false;
  if (earn.effectiveMode(vm.kind) === "per_amount") {
    const y = Number(earn.blockAmount);
    if (!Number.isFinite(y) || y <= 0) return false;
  }
  return true;
}

/** One reward is valid when its type-specific field is set (and, for Puntos, its cost > 0). */
function rewardValid(reward: RewardDraft, isPoints: boolean): boolean {
  if (
    isPoints &&
    (!Number.isInteger(reward.pointsCost) || reward.pointsCost <= 0)
  )
    return false;
  if (reward.type === "catalog_product") return Boolean(reward.productId);
  if (reward.type === "discount")
    return (
      Number.isInteger(reward.discountPercent) &&
      reward.discountPercent >= 1 &&
      reward.discountPercent <= 100
    );
  return Boolean(reward.label.trim());
}

function isStepValid(step: StepId, vm: LoyaltyVm): boolean {
  switch (step) {
    case "units":
      return Boolean(vm.singular.trim() && vm.plural.trim());
    case "basics":
      return (
        Boolean(vm.stampName.trim()) &&
        Number.isInteger(vm.target) &&
        vm.target >= 2 &&
        vm.target <= 50
      );
    case "terms":
      return Boolean(vm.terms.trim()) && accrualValid(vm);
    case "rewards": {
      const isPoints = vm.kind === "points";
      const rewards = vm.earn.rewards;
      if (rewards.length === 0) return false;
      if (!isPoints && rewards.length !== 1) return false;
      return rewards.every((reward) => rewardValid(reward, isPoints));
    }
    default:
      return true;
  }
}

function Modality({ vm }: { vm: LoyaltyVm }) {
  return (
    <>
      <h2>Modalidad</h2>
      <div className="loyalty-types" role="radiogroup">
        {(["points", "stamps"] as const).map((value) => (
          <label
            className={`plan ${vm.kind === value ? "selected" : ""}`}
            key={value}
          >
            <input
              className="sr-only"
              type="radio"
              checked={vm.kind === value}
              onChange={() => vm.setKind(value)}
            />
            <span className="loyalty-choice-content">
              <strong>{value === "points" ? "Puntos" : "Sellos"}</strong>
              <span>
                {value === "points"
                  ? "Una unidad flexible para premios."
                  : "Una tarjeta que se completa con visitas."}
              </span>
            </span>
          </label>
        ))}
      </div>
    </>
  );
}

export function ProgramEditor({ vm }: { vm: LoyaltyVm }) {
  const isCreate = !vm.program;
  const steps = stepsFor(vm.kind, isCreate);
  const [index, setIndex] = useState(0);
  const clamped = Math.min(index, steps.length - 1);
  const step = steps[clamped];
  const isLast = step === "review";

  return (
    <section className="panel loyalty-panel loyalty-wizard">
      <p className="wizard-progress">
        Paso {clamped + 1} de {steps.length}
      </p>
      {step === "modality" && <Modality vm={vm} />}
      {step === "units" && <StepUnits vm={vm} />}
      {step === "basics" && <StepStampBasics vm={vm} />}
      {step === "design" && <StepCardDesign vm={vm} />}
      {step === "terms" && <StepTerms vm={vm} />}
      {step === "rewards" && <StepRewards vm={vm} />}
      {step === "review" && <StepReview vm={vm} />}
      {vm.error && isLast && <p className="form-error">{vm.error}</p>}
      <div className="wizard-nav">
        {clamped > 0 && (
          <button
            type="button"
            className="button wizard-back"
            disabled={vm.saving}
            onClick={() => setIndex(clamped - 1)}
          >
            Atrás
          </button>
        )}
        {isLast ? (
          <button
            className="button"
            disabled={vm.saving || !vm.terms.trim()}
            onClick={() => void vm.save()}
          >
            {vm.saving
              ? "Guardando…"
              : isCreate
                ? "Activar programa"
                : "Guardar cambios"}
          </button>
        ) : (
          <button
            className="button"
            disabled={!isStepValid(step, vm)}
            onClick={() => setIndex(clamped + 1)}
          >
            Siguiente
          </button>
        )}
      </div>
    </section>
  );
}
