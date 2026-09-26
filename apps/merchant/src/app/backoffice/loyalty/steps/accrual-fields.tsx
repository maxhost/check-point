import { NumberDraftField } from "../number-draft-field";
import { ChoiceGroup, TextField } from "../../../../ui";
import { formatMoney } from "../format";
import { parseMoney } from "../program-form-state";
import type { LoyaltyVm } from "../use-loyalty-program";
export function AccrualFields({
  vm,
  errors,
}: {
  vm: LoyaltyVm;
  errors: Record<string, string>;
}) {
  const earn = vm.earn;
  const mode = earn.effectiveMode(vm.kind);
  const unit =
    vm.kind === "points"
      ? earn.grant === 1
        ? vm.singular
        : vm.plural
      : vm.stampName;
  const block = parseMoney(earn.blockAmount);
  return (
    <section className="loyalty-fields">
      <h3>Mecánica de acumulación</h3>
      {vm.kind === "stamps" && (
        <ChoiceGroup
          label="Modo de acumulación"
          value={mode}
          onChange={(value) =>
            earn.setAccrualMode(
              value === "per_purchase" ? "per_purchase" : "per_amount",
            )
          }
          options={[
            { value: "per_amount", label: "Por monto" },
            { value: "per_purchase", label: "Por compra" },
          ]}
        />
      )}
      <NumberDraftField
        label={vm.kind === "points" ? "Puntos otorgados" : "Sellos otorgados"}
        minValue={1}
        step={1}
        value={earn.grant}
        onChange={earn.setGrant}
        errorMessage={errors.grant}
      />
      {mode === "per_amount" && (
        <TextField
          label="Monto por bloque"
          inputMode="decimal"
          value={earn.blockAmount}
          onChange={earn.setBlockAmount}
          placeholder="Ej.: 5,00"
          description={`Moneda: ${vm.currencyCode}.`}
          errorMessage={errors.blockAmount}
        />
      )}
      <p aria-live="polite" className="text-sm text-content-muted">
        {mode === "per_purchase"
          ? `Otorgás ${earn.grant} ${unit.toLowerCase()} por compra.`
          : `Otorgás ${earn.grant} ${unit.toLowerCase()} cada ${Number.isFinite(block) && block > 0 ? formatMoney(block, vm.currencyCode) : "…"} gastados en el local.`}
      </p>
    </section>
  );
}
