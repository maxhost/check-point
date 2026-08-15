import { formatMoney } from "../format";
import type { LoyaltyVm } from "../use-loyalty-program";

/**
 * Accrual mechanics block for the terms step (spec 0036): how many units are granted
 * per purchase or per block of spend, with a live example in the business currency.
 * Puntos is always `per_amount` (no toggle); Sellos offers `por monto` / `por compra`.
 */
export function AccrualFields({ vm }: { vm: LoyaltyVm }) {
  const earn = vm.earn;
  const mode = earn.effectiveMode(vm.kind);
  const unit =
    vm.kind === "points"
      ? earn.grant === 1
        ? vm.singular
        : vm.plural
      : vm.stampName;
  const block = Number(earn.blockAmount);
  const example =
    mode === "per_purchase"
      ? `Otorgás ${earn.grant} ${unit.toLowerCase()} por compra.`
      : `Otorgás ${earn.grant} ${unit.toLowerCase()} cada ${
          Number.isFinite(block) && block > 0
            ? formatMoney(block, vm.currencyCode)
            : "…"
        } gastados en el local.`;

  return (
    <fieldset className="accrual-fields">
      <legend>Mecánica de acumulación</legend>
      {vm.kind === "stamps" && (
        <div
          className="accrual-mode"
          role="radiogroup"
          aria-label="Modo de acumulación"
        >
          {(["per_amount", "per_purchase"] as const).map((value) => (
            <label
              key={value}
              className={`chip ${earn.accrualMode === value ? "selected" : ""}`}
            >
              <input
                className="sr-only"
                type="radio"
                checked={earn.accrualMode === value}
                onChange={() => earn.setAccrualMode(value)}
              />
              {value === "per_amount" ? "Por monto" : "Por compra"}
            </label>
          ))}
        </div>
      )}
      <div className="accrual-grid">
        <label>
          {vm.kind === "points" ? "Puntos otorgados" : "Sellos otorgados"}
          <input
            type="number"
            min={1}
            step={1}
            value={earn.grant}
            onChange={(event) => {
              const next = Number(event.target.value);
              earn.setGrant(Number.isFinite(next) ? Math.trunc(next) : 0);
            }}
          />
        </label>
        {mode === "per_amount" && (
          <label>
            Monto por bloque ({vm.currencyCode})
            <input
              type="number"
              min={0}
              step="0.01"
              value={earn.blockAmount}
              onChange={(event) => earn.setBlockAmount(event.target.value)}
            />
          </label>
        )}
      </div>
      <p className="accrual-example" aria-live="polite">
        {example}
      </p>
    </fieldset>
  );
}
